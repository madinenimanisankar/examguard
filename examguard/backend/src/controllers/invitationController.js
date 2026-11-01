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
    const result = await mailer.sendInvitationEmail({ to: email, companyName: (await Company.findById(exam.companyId)).name, exam, token: rawToken, baseUrl: baseUrl(req) });
    inv.status = result.ok ? 'sent' : 'pending';
    inv.sentAt = result.ok ? new Date() : null;
    inv.timesSent = 1;
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
  const rawToken = randomToken();
  inv.tokenHash = sha256(rawToken);
  const exam = req.exam;
  const result = await mailer.sendInvitationEmail({ to: inv.email, companyName: (await Company.findById(exam.companyId)).name, exam, token: rawToken, baseUrl: baseUrl(req) });
  inv.status = result.ok ? 'sent' : 'pending';
  inv.sentAt = result.ok ? new Date() : inv.sentAt;
  inv.timesSent += 1;
  await inv.save();
  await logAudit(req, 'invitation.resend', { targetType: 'invitation', targetId: inv._id });
  res.json({ message: result.ok ? 'Invitation email sent again' : 'Email could not be sent right now — use "Copy link" instead', ok: result.ok, ...(result.reason === 'console' ? { link: `${baseUrl(req)}/candidate/invitation/${rawToken}` } : {}) });
});

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
