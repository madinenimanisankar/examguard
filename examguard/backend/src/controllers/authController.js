const bcrypt = require('bcryptjs');
const Company = require('../models/Company');
const Exam = require('../models/Exam');
const Invitation = require('../models/Invitation');
const LoginAttempt = require('../models/LoginAttempt');
const Registration = require('../models/Registration');
const User = require('../models/User');
const mailer = require('../services/mailer');
const env = require('../config/env');
const { HttpError, asyncHandler, sha256, randomToken, isEmail, logAudit, baseUrl } = require('../utils/helpers');
const { setAuthCookies, clearAuthCookies, requireAuth } = require('../middleware/auth');

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role, companyId: u.companyId, emailVerified: u.emailVerified });

async function companySummary(id) {
  if (!id) return null;
  const c = await Company.findById(id);
  return c ? { id: c._id, name: c.name, status: c.status } : null;
}

async function checkLock(req, email) {
  const key = `${req.ip}:${email}`;
  const rec = await LoginAttempt.findOne({ identifier: key });
  if (rec?.lockedUntil && rec.lockedUntil > new Date()) {
    throw new HttpError(429, 'Too many failed attempts. Please try again in a few minutes.');
  }
}

async function registerFailedAttempt(req, email) {
  const key = `${req.ip}:${email}`;
  await LoginAttempt.findOneAndUpdate(
    { identifier: key },
    { $inc: { count: 1 }, $set: { lastFailedAt: new Date(), lockedUntil: null } },
    { upsert: true }
  );
  const rec = await LoginAttempt.findOne({ identifier: key });
  if (rec && rec.count >= 5) {
    rec.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
    await rec.save();
  }
}

exports.registerCompany = asyncHandler(async (req, res) => {
  const { companyName, hrName, email, password, website } = req.body || {};
  if (!companyName || !String(companyName).trim()) throw new HttpError(400, 'Company name is required');
  if (!hrName || !String(hrName).trim()) throw new HttpError(400, 'HR representative name is required');
  if (!isEmail(email)) throw new HttpError(400, 'A valid official email address is required');
  if (!PASSWORD_RULE.test(String(password || ''))) throw new HttpError(400, 'Password must be at least 8 characters and include a letter and a number');

  const normalizedEmail = String(email).toLowerCase().trim();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) throw new HttpError(409, 'An account with this email already exists');

  const user = await User.create({
    name: String(hrName).trim(),
    email: normalizedEmail,
    passwordHash: await bcrypt.hash(password, 10),
    role: 'hr',
  });
  const company = await Company.create({
    name: String(companyName).trim(),
    website: String(website || '').trim().slice(0, 200),
    status: 'pending',
    ownerUserId: user._id,
  });
  user.companyId = company._id;
  const rawToken = randomToken();
  user.verificationTokenHash = sha256(rawToken);
  user.verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();

  const sent = await mailer.sendVerificationEmail(user, rawToken, baseUrl(req));
  setAuthCookies(res, user);
  await logAudit(req, 'auth.company.register', { targetType: 'company', targetId: company._id });
  res.status(201).json({
    user: publicUser(user),
    company: await companySummary(company._id),
    verifyEmailSent: sent.ok,
    ...(sent.reason === 'console' ? { debugVerifyUrl: `${env.appBaseUrl}/verify-email?token=${rawToken}` } : {}),
  });
});

exports.verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.body || {};
  if (!token) throw new HttpError(400, 'Verification token is required');
  const user = await User.findOne({ verificationTokenHash: sha256(token) });
  if (!user || !user.verificationExpires || user.verificationExpires < new Date()) {
    throw new HttpError(400, 'This verification link is invalid or has expired');
  }
  user.emailVerified = true;
  user.verificationTokenHash = null;
  user.verificationExpires = null;
  await user.save();
  await logAudit(req, 'auth.email.verified', { targetType: 'user', targetId: user._id });
  res.json({ message: 'Email verified successfully', user: publicUser(user) });
});

exports.resendVerification = asyncHandler(async (req, res) => {
  if (req.user.emailVerified) return res.json({ message: 'Email is already verified' });
  const rawToken = randomToken();
  req.user.verificationTokenHash = sha256(rawToken);
  req.user.verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await req.user.save();
  const sent = await mailer.sendVerificationEmail(req.user, rawToken);
  res.json({ message: sent.ok ? 'Verification email sent' : 'Email sending unavailable — use the debug link', ...(sent.reason === 'console' ? { debugVerifyUrl: `${env.appBaseUrl}/verify-email?token=${rawToken}` } : {}) });
});

exports.candidateRegister = asyncHandler(async (req, res) => {
  const { invitationToken, name, password } = req.body || {};
  if (!invitationToken) throw new HttpError(400, 'Invitation token is required');
  if (!name || !String(name).trim()) throw new HttpError(400, 'Your full name is required');
  if (!PASSWORD_RULE.test(String(password || ''))) throw new HttpError(400, 'Password must be at least 8 characters and include a letter and a number');

  const invitation = await Invitation.findOne({ tokenHash: sha256(invitationToken) });
  if (!invitation) throw new HttpError(404, 'This invitation link is invalid');
  if (['pending', 'sent'].includes(invitation.status) && invitation.expiresAt < new Date()) {
    invitation.status = 'expired';
    await invitation.save();
  }
  if (!['pending', 'sent'].includes(invitation.status)) {
    throw new HttpError(409, `This invitation is ${invitation.status}. Ask the company to send a fresh invitation.`);
  }
  const existing = await User.findOne({ email: invitation.email });
  if (existing) {
    throw new HttpError(409, 'An account already exists for this email. Log in with it, then open the invitation link again to accept.', 'ACCOUNT_EXISTS');
  }
  const user = await User.create({
    name: String(name).trim(),
    email: invitation.email,
    passwordHash: await bcrypt.hash(password, 10),
    role: 'candidate',
    emailVerified: true,
  });
  await Registration.create({ examId: invitation.examId, companyId: invitation.companyId, candidateId: user._id, invitationId: invitation._id });
  invitation.status = 'accepted';
  invitation.acceptedByUserId = user._id;
  await invitation.save();
  const exam = await Exam.findById(invitation.examId);
  setAuthCookies(res, user);
  await logAudit(req, 'auth.candidate.register', { targetType: 'exam', targetId: invitation.examId });
  res.status(201).json({ user: publicUser(user), exam: exam ? { id: exam._id, title: exam.title } : null });
});

exports.acceptInvitation = asyncHandler(async (req, res) => {
  const { invitationToken } = req.body || {};
  if (!invitationToken) throw new HttpError(400, 'Invitation token is required');
  const invitation = await Invitation.findOne({ tokenHash: sha256(invitationToken) });
  if (!invitation) throw new HttpError(404, 'This invitation link is invalid');
  if (['pending', 'sent'].includes(invitation.status) && invitation.expiresAt < new Date()) {
    invitation.status = 'expired';
    await invitation.save();
  }
  if (!['pending', 'sent'].includes(invitation.status)) {
    throw new HttpError(409, `This invitation is ${invitation.status}. Ask the company to send a fresh invitation.`);
  }
  if (invitation.email !== req.user.email) throw new HttpError(403, 'This invitation was sent to a different email address');
  const already = await Registration.findOne({ examId: invitation.examId, candidateId: req.user._id });
  if (already) return res.json({ message: 'Invitation already accepted', examId: invitation.examId });
  await Registration.create({ examId: invitation.examId, companyId: invitation.companyId, candidateId: req.user._id, invitationId: invitation._id });
  invitation.status = 'accepted';
  invitation.acceptedByUserId = req.user._id;
  await invitation.save();
  await logAudit(req, 'invitation.accepted', { targetType: 'exam', targetId: invitation.examId });
  res.json({ message: 'Invitation accepted', examId: invitation.examId });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!isEmail(email) || !password) throw new HttpError(400, 'Email and password are required');
  const normalizedEmail = String(email).toLowerCase().trim();
  await checkLock(req, normalizedEmail);
  const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(String(password), user.passwordHash))) {
    await registerFailedAttempt(req, normalizedEmail);
    throw new HttpError(401, 'Invalid email or password');
  }
  await LoginAttempt.findOneAndDelete({ identifier: `${req.ip}:${normalizedEmail}` });
  setAuthCookies(res, user);
  await logAudit(req, 'auth.login', { targetType: 'user', targetId: user._id });
  res.json({ user: publicUser(user), company: await companySummary(user.companyId) });
});

exports.refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.refresh_token;
  if (!token) throw new HttpError(401, 'No refresh session');
  let payload;
  try {
    payload = jwtVerifyRefresh(token);
  } catch {
    throw new HttpError(401, 'Session expired. Please log in again.');
  }
  const user = await User.findById(payload.sub);
  if (!user) throw new HttpError(401, 'Account no longer exists');
  setAuthCookies(res, user);
  res.json({ user: publicUser(user), company: await companySummary(user.companyId) });
});

const jwt = require('jsonwebtoken');
function jwtVerifyRefresh(token) {
  const payload = jwt.verify(token, env.jwtSecret);
  if (payload.type !== 'refresh') throw new Error('wrong type');
  return payload;
}

exports.logout = asyncHandler(async (req, res) => {
  clearAuthCookies(res);
  await logAudit(req, 'auth.logout', {});
  res.json({ message: 'Logged out' });
});

exports.me = asyncHandler(async (req, res) => {
  res.json({ user: publicUser(req.user), company: await companySummary(req.user.companyId) });
});

exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body || {};
  if (isEmail(email)) {
    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (user) {
      const rawToken = randomToken();
      user.resetTokenHash = sha256(rawToken);
      user.resetExpires = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();
      await mailer.sendResetEmail(user, rawToken, baseUrl(req));
      await logAudit(req, 'auth.password.reset_requested', { targetType: 'user', targetId: user._id });
    }
  }
  res.json({ message: 'If that email is registered, a reset link has been sent.' });
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !PASSWORD_RULE.test(String(password || ''))) {
    throw new HttpError(400, 'Provide the reset link token and a valid password (8+ chars, letter and number)');
  }
  const user = await User.findOne({ resetTokenHash: sha256(token) });
  if (!user || !user.resetExpires || user.resetExpires < new Date()) {
    throw new HttpError(400, 'This reset link is invalid or has expired');
  }
  user.passwordHash = await bcrypt.hash(password, 10);
  user.resetTokenHash = null;
  user.resetExpires = null;
  await user.save();
  await logAudit(req, 'auth.password.reset', { targetType: 'user', targetId: user._id });
  res.json({ message: 'Password updated. You can log in now.' });
});

exports.routerRefs = { requireAuth };
