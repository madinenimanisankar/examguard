const Company = require('../models/Company');
const User = require('../models/User');
const Exam = require('../models/Exam');
const ExamSession = require('../models/ExamSession');
const SecurityAlert = require('../models/SecurityAlert');
const AuditLog = require('../models/AuditLog');
const mailer = require('../services/mailer');
const { HttpError, asyncHandler, logAudit } = require('../utils/helpers');

exports.overview = asyncHandler(async (req, res) => {
  const [companies, pendingCompanies, users, exams, publishedExams, sessions, activeSessions, alerts, openAlerts] = await Promise.all([
    Company.countDocuments({}),
    Company.countDocuments({ status: 'pending' }),
    User.countDocuments({}),
    Exam.countDocuments({}),
    Exam.countDocuments({ status: 'published' }),
    ExamSession.countDocuments({}),
    ExamSession.countDocuments({ status: 'active' }),
    SecurityAlert.countDocuments({}),
    SecurityAlert.countDocuments({ status: { $in: ['new', 'under_review'] } }),
  ]);
  res.json({ companies, pendingCompanies, users, exams, publishedExams, sessions, activeSessions, alerts, openAlerts });
});

exports.companies = asyncHandler(async (req, res) => {
  const companies = await Company.find({}).sort({ createdAt: -1 }).limit(200).populate('ownerUserId', 'name email emailVerified').lean();
  res.json({ companies });
});

exports.verifyCompany = asyncHandler(async (req, res) => {
  const { status } = req.body || {};
  if (!['verified', 'rejected', 'pending'].includes(status)) throw new HttpError(400, 'Invalid company status');
  const company = await Company.findById(req.params.id);
  if (!company) throw new HttpError(404, 'Company not found');
  company.status = status;
  company.verifiedAt = status === 'verified' ? new Date() : null;
  company.verifiedBy = req.user._id;
  await company.save();
  const owner = await User.findById(company.ownerUserId);
  if (status === 'verified' && owner) await mailer.sendCompanyVerifiedEmail(company, owner);
  await logAudit(req, 'admin.company.verify', { targetType: 'company', targetId: company._id, meta: { status } });
  res.json({ company });
});

exports.users = asyncHandler(async (req, res) => {
  const users = await User.find({}).sort({ createdAt: -1 }).limit(200).populate('companyId', 'name').lean();
  res.json({ users: users.map(({ passwordHash, verificationTokenHash, resetTokenHash, ...u }) => u) });
});

exports.auditLogs = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.action) filter.action = { $regex: String(req.query.action).slice(0, 60), $options: 'i' };
  const logs = await AuditLog.find(filter).sort({ at: -1 }).limit(200).lean();
  res.json({ logs });
});

// Platform admin sees alerts at a high level for abuse investigation.
// This access is itself audit-logged.
exports.alertsOverview = asyncHandler(async (req, res) => {
  await logAudit(req, 'admin.alerts_view', {});
  const alerts = await SecurityAlert.find({})
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('examId', 'title')
    .populate('candidateId', 'name email')
    .populate('companyId', 'name')
    .lean();
  res.json({ alerts });
});
