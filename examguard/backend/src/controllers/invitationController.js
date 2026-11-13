const crypto = require('crypto');
const Invitation = require('../models/Invitation');
const Exam = require('../models/Exam');
const Company = require('../models/Company');
const mailer = require('../services/mailer');
const env = require('../config/env');
const { HttpError, asyncHandler, sha256, randomToken, isEmail, maskEmail, logAudit, baseUrl } = require('../utils/helpers');
const { scopedExam } = require('../middleware/auth');

const INVITE_TTL_DAYS = 14;

function lazyExpire(inv) {
  if (['pending', 'sent'].includes(inv.status) && inv.expiresAt < new Date()) {
    inv.status = 'expired';
    return inv.save();
  }
  return null;
}

exports.send = asyncHandler(async (req, res) => {
  const exam = req.exam;
  let { emails } = req.body || {};
  if (typeof emails === 'string') emails = emails.split(/[\n,;]+/);
  if (!Array.isArray(emails) || !emails.length) throw new HttpError(400, 'Provide at least one candidate email address');
  const clean = [...new Set(emails.map((e) => String(e || '').toLowerCase().trim()).filter(Boolean))];
  if (clean.length > 200) throw new HttpError(400, 'Send at most 200 invitations per batch');
  const invalid = clean.filter((e) => !isEmail(e));
  const valid = clean.filter((e) => isEmail(e));

  const sent = [];
  const skipped = [];
  const failed = [];
  for (const email of valid) {
    const existing = await Invitation.findOne({ examId: exam._id, email, status: { $ne: 'revoked' } });
    if (existing) {
      skipped.push({ email, reason: 'Already invited' });
      continue;
    }
    const rawToken = randomToken();
    const inv = await Invitation.create({
      examId: exam._id,
      companyId: exam.companyId,
      email,
      tokenHash: sha256(rawToken),
      status: 'pending',
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
    });
    let result;
    try {
      result = await mailer.sendInvitationEmail({ to: email, companyName: (await Company.findById(exam.companyId)).name, exam, token: rawToken, baseUrl: baseUrl(req) });
    } catch (e) {
      result = { ok: false, reason: String(e.message || 'send failed').slice(0, 140) };
    }
    inv.status = result.ok ? 'sent' : 'pending';
    inv.sentAt = result.ok ? new Date() : null;
    inv.timesSent = 1;
    applyEmailResult(inv, result);
    await inv.save();
    (result.ok ? sent : failed).push(result.ok ? email : { email, reason: result.reason });
  }
  await logAudit(req, 'invitation.send', { targetType: 'exam', targetId: exam._id, meta: { sent: sent.length, skipped: skipped.length, failed: failed.length, invalid } });
  res.status(201).json({ sent, skipped, failed, invalid });
});

exports.list = asyncHandler(async (req, res) => {
  const invitations = await Invitation.find({ examId: req.exam._id }).sort({ createdAt: -1 }).lean();
  for (const inv of invitations) {
    if (['pending', 'sent'].includes(inv.status) && inv.expiresAt < new Date()) inv.status = 'expired';
    delete inv.tokenHash;
  }
  res.json({ invitations });
});

// Mints a FRESH secure token and returns the raw link exactly once (tokens are
// stored hashed, never in plaintext at rest). Used for "copy link" and resend.
exports.mintLink = asyncHandler(async (req, res) => {
  const inv = await Invitation.findOne({ _id: req.params.id, examId: req.exam._id });
  if (!inv) throw new HttpError(404, 'Invitation not found');
  if (['accepted', 'revoked'].includes(inv.status)) throw new HttpError(409, `Invitation is ${inv.status}; it cannot be reopened`);
  await lazyExpire(inv);
  if (inv.status === 'expired') throw new HttpError(409, 'This invitation expired. Send a new one instead.');
  const rawToken = randomToken();
  inv.tokenHash = sha256(rawToken);
  inv.status = inv.status === 'pending' ? 'sent' : inv.status;
  await inv.save();
  const link = `${baseUrl(req)}/candidate/invitation/${rawToken}`;
  await logAudit(req, 'invitation.link_minted', { targetType: 'invitation', targetId: inv._id });
  res.json({ link, expiresAt: inv.expiresAt });
});

exports.resend = asyncHandler(async (req, res) => {
  const inv = await Invitation.findOne({ _id: req.params.id, examId: req.exam._id });
  if (!inv) throw new HttpError(404, 'Invitation not found');
  if (inv.status === 'revoked') throw new HttpError(409, 'This invitation was revoked');
  if (inv.status === 'accepted') throw new HttpError(409, 'This candidate already registered');
  await lazyExpire(inv);
  if (inv.status === 'expired') {
    inv.expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  }
  const companyName = (await Company.findById(req.exam.companyId)).name;
  const { result, rawToken } = await redeliver(req, inv, companyName);
  await logAudit(req, 'invitation.resend', { targetType: 'invitation', targetId: inv._id });
  res.json({ message: result.ok ? 'Invitation email sent again' : `Email could not be sent (${result.reason === 'console' ? 'no email provider configured — set EMAIL_PROVIDER=smtp in backend/.env' : result.reason}) — use "Copy link" instead`, ok: result.ok, reason: result.reason, ...(result.reason === 'console' ? { link: `${baseUrl(req)}/candidate/invitation/${rawToken}` } : {}) });
});

async function redeliver(req, inv, companyName) {
  if (inv.status === 'expired') inv.expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  const rawToken = randomToken();
  inv.tokenHash = sha256(rawToken);
  let result;
  try {
    result = await mailer.sendInvitationEmail({ to: inv.email, companyName, exam: req.exam, token: rawToken, baseUrl: baseUrl(req) });
  } catch (e) {
    result = { ok: false, reason: String(e.message || 'send failed').slice(0, 140) };
  }
  inv.status = result.ok ? 'sent' : (inv.status === 'expired' ? 'pending' : inv.status === 'sent' ? 'sent' : 'pending');
  inv.sentAt = result.ok ? new Date() : inv.sentAt;
  inv.timesSent += 1;
  applyEmailResult(inv, result);
  await inv.save();
  return { result, rawToken };
}

exports.resendFailed = asyncHandler(async (req, res) => {
  const list = await Invitation.find({ examId: req.exam._id, emailStatus: 'failed', status: { $in: ['pending', 'sent', 'expired'] } });
  if (!list.length) return res.json({ attempted: 0, sent: [], failed: [] });
  const companyName = (await Company.findById(req.exam.companyId)).name;
  const sent = [];
  const failed = [];
  for (const inv of list) {
    await lazyExpire(inv);
    const { result } = await redeliver(req, inv, companyName);
    if (result.ok) sent.push(inv.email);
    else failed.push({ email: inv.email, reason: inv.emailError });
  }
  await logAudit(req, 'invitation.resend_failed', { targetType: 'exam', targetId: req.exam._id, meta: { attempted: list.length, sent: sent.length, failed: failed.length } });
  res.json({ attempted: list.length, sent, failed });
});

function applyEmailResult(inv, result) {
  inv.emailStatus = result.ok ? 'sent' : 'failed';
  inv.emailError = result.ok ? '' : (result.reason === 'console' ? 'No email provider configured (set EMAIL_PROVIDER=smtp)' : String(result.reason || 'send failed').slice(0, 160));
  inv.emailAttemptAt = new Date();
}

exports.revoke = asyncHandler(async (req, res) => {
  const inv = await Invitation.findOne({ _id: req.params.id, examId: req.exam._id });
  if (!inv) throw new HttpError(404, 'Invitation not found');
  inv.status = 'revoked';
  await inv.save();
  await logAudit(req, 'invitation.revoke', { targetType: 'invitation', targetId: inv._id });
  res.json({ message: 'Invitation revoked' });
});

// Public, rate-limited lookup used by the candidate invitation landing page.
exports.lookup = asyncHandler(async (req, res) => {
  const token = String(req.params.token || '');
  if (!/^[a-f0-9]{64}$/.test(token)) throw new HttpError(400, 'This invitation link is malformed');
  const inv = await Invitation.findOne({ tokenHash: sha256(token) });
  if (!inv) throw new HttpError(404, 'This invitation link is invalid');
  await lazyExpire(inv);
  await inv.save();
  const exam = await Exam.findById(inv.examId);
  const company = await Company.findById(inv.companyId);
  if (!exam || !company) throw new HttpError(404, 'This invitation link is no longer valid');
  res.json({
    invitation: {
      status: inv.status,
      maskedEmail: maskEmail(inv.email),
      expiresAt: inv.expiresAt,
    },
    exam: {
      id: exam._id,
      title: exam.title,
      jobRole: exam.jobRole,
      description: exam.description,
      instructions: exam.instructions,
      startAt: exam.startAt,
      endAt: exam.endAt,
      durationMinutes: exam.durationMinutes,
      questionTypes: exam.questionTypes,
      negativeMarking: exam.negativeMarking,
      status: exam.status,
    },
    companyName: company.name,
  });
});
