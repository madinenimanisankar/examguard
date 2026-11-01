const Exam = require('../models/Exam');
const Question = require('../models/Question');
const ExamSession = require('../models/ExamSession');
const Invitation = require('../models/Invitation');
const Registration = require('../models/Registration');
const SecurityAlert = require('../models/SecurityAlert');
const Company = require('../models/Company');
const { QUESTION_TYPES } = require('../models/Exam');
const { HttpError, asyncHandler, logAudit } = require('../utils/helpers');
const { requireHr, scopedExam } = require('../middleware/auth');

function validateExamPayload(body) {
  const { title, jobRole, description, instructions, startAt, endAt, durationMinutes, questionTypes } = body || {};
  if (!title || !String(title).trim()) throw new HttpError(400, 'Examination title is required');
  if (!jobRole || !String(jobRole).trim()) throw new HttpError(400, 'Job role / assessment purpose is required');
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new HttpError(400, 'Valid start and end date-times are required');
  if (end <= start) throw new HttpError(400, 'End time must be after start time');
  const duration = Number(durationMinutes);
  if (!Number.isInteger(duration) || duration < 5 || duration > 600) throw new HttpError(400, 'Duration must be between 5 and 600 minutes');
  if (!Array.isArray(questionTypes) || questionTypes.length === 0) {
    throw new HttpError(400, 'Select at least one question type (MCQ, Coding, Descriptive, Aptitude)');
  }
  const types = [...new Set(questionTypes)];
  if (types.some((t) => !QUESTION_TYPES.includes(t))) throw new HttpError(400, 'Unknown question type selected');
  return { title: String(title).trim(), jobRole: String(jobRole).trim(), description: String(description || ''), instructions: String(instructions || ''), startAt: start, endAt: end, durationMinutes: duration, questionTypes: types };
}

async function assertEditable(exam) {
  if (exam.status === 'closed') throw new HttpError(409, 'This examination is closed and can no longer be edited');
  if (exam.status === 'published') {
    const started = await ExamSession.countDocuments({ examId: exam._id });
    if (started > 0) throw new HttpError(409, 'Candidates have started this examination; editing is locked');
  }
}

async function recomputeTotalMarks(examId) {
  const agg = await Question.aggregate([{ $match: { examId } }, { $group: { _id: null, total: { $sum: '$marks' } } }]);
  const total = agg[0]?.total || 0;
  await Exam.updateOne({ _id: examId }, { $set: { totalMarks: total } });
  return total;
}

exports.create = asyncHandler(async (req, res) => {
  const data = validateExamPayload(req.body);
  const exam = await Exam.create({ ...data, companyId: req.companyId, createdBy: req.user._id });
  await logAudit(req, 'exam.create', { targetType: 'exam', targetId: exam._id });
  res.status(201).json({ exam });
});

exports.list = asyncHandler(async (req, res) => {
  const exams = await Exam.find({ companyId: req.companyId }).sort({ createdAt: -1 }).lean();
  const withCounts = await Promise.all(
    exams.map(async (e) => ({
      ...e,
      questionCount: await Question.countDocuments({ examId: e._id }),
      invitationCount: await Invitation.countDocuments({ examId: e._id }),
      sessionCount: await ExamSession.countDocuments({ examId: e._id }),
      openAlerts: await SecurityAlert.countDocuments({ examId: e._id, status: { $in: ['new', 'under_review'] } }),
    }))
  );
  res.json({ exams: withCounts, companyStatus: (await Company.findById(req.companyId))?.status });
});

exports.getOne = asyncHandler(async (req, res) => res.json({ exam: req.exam }));

exports.update = asyncHandler(async (req, res) => {
  await assertEditable(req.exam);
  const data = validateExamPayload(req.body);
  Object.assign(req.exam, data);
  await req.exam.save();
  await logAudit(req, 'exam.update', { targetType: 'exam', targetId: req.exam._id });
  res.json({ exam: req.exam });
});

exports.publish = asyncHandler(async (req, res) => {
  await assertEditable(req.exam);
  const company = await Company.findById(req.companyId);
  if (!company || company.status !== 'verified') {
    throw new HttpError(403, 'Your company must be verified by the ExamGuard platform administrator before you can publish examinations');
  }
  const counts = await Question.aggregate([{ $match: { examId: req.exam._id } }, { $group: { _id: '$type', n: { $sum: 1 } } }]);
  const byType = Object.fromEntries(counts.map((c) => [c._id, c.n]));
  for (const t of req.exam.questionTypes) {
    if (!byType[t]) throw new HttpError(400, `Add at least one "${t}" question before publishing`);
  }
  if ((await Question.countDocuments({ examId: req.exam._id })) === 0) throw new HttpError(400, 'Add questions before publishing');
  req.exam.totalMarks = await recomputeTotalMarks(req.exam._id);
  req.exam.status = 'published';
  await req.exam.save();
  await logAudit(req, 'exam.publish', { targetType: 'exam', targetId: req.exam._id });
  res.json({ exam: req.exam });
});

exports.close = asyncHandler(async (req, res) => {
  req.exam.status = 'closed';
  await req.exam.save();
  await logAudit(req, 'exam.close', { targetType: 'exam', targetId: req.exam._id });
  res.json({ exam: req.exam });
});

exports.remove = asyncHandler(async (req, res) => {
  if (req.exam.status !== 'draft') throw new HttpError(409, 'Only draft examinations can be deleted');
  await Question.deleteMany({ examId: req.exam._id });
  await Exam.deleteOne({ _id: req.exam._id });
  await logAudit(req, 'exam.delete', { targetType: 'exam', targetId: req.exam._id });
  res.json({ message: 'Examination deleted' });
});

exports.updateMonitoring = asyncHandler(async (req, res) => {
  await assertEditable(req.exam);
  const { monitoring } = req.body || {};
  if (!monitoring || typeof monitoring !== 'object') throw new HttpError(400, 'Monitoring settings are required');
  const th = monitoring.thresholds || {};
  const medium = Number(th.medium), high = Number(th.high), critical = Number(th.critical);
  if (th.medium != null && (medium < 5 || medium >= (high || 999))) throw new HttpError(400, 'Medium threshold must be below the high threshold');
  if (th.high != null && (high <= medium || high >= (critical || 999))) throw new HttpError(400, 'Thresholds must be in ascending order (medium < high < critical)');
  if (th.critical != null && critical <= (high || 0)) throw new HttpError(400, 'Critical threshold must be above the high threshold');
  if (monitoring.prohibitedList != null) {
    if (!Array.isArray(monitoring.prohibitedList) || monitoring.prohibitedList.some((s) => typeof s !== 'string' || s.length > 60)) {
      throw new HttpError(400, 'Prohibited list must be an array of short strings');
    }
  }
  req.exam.monitoring = {
    ...req.exam.monitoring.toObject(),
    fullscreenRequired: Boolean(monitoring.fullscreenRequired),
    simulatorEnabled: monitoring.simulatorEnabled == null ? req.exam.monitoring.simulatorEnabled : Boolean(monitoring.simulatorEnabled),
    weights: { ...req.exam.monitoring.weights.toObject(), ...(monitoring.weights || {}) },
    thresholds: { ...req.exam.monitoring.thresholds.toObject(), ...(monitoring.thresholds || {}) },
    prohibitedList: monitoring.prohibitedList ?? req.exam.monitoring.prohibitedList,
  };
  await req.exam.save();
  await logAudit(req, 'exam.monitoring.update', { targetType: 'exam', targetId: req.exam._id });
  res.json({ exam: req.exam });
});

exports.stats = asyncHandler(async (req, res) => {
  const examId = req.exam._id;
  const [invitations, registrations, activeSessions, submitted, alertsOpen] = await Promise.all([
    Invitation.countDocuments({ examId }),
    Registration.countDocuments({ examId }),
    ExamSession.countDocuments({ examId, status: 'active' }),
    ExamSession.countDocuments({ examId, status: 'submitted' }),
    SecurityAlert.countDocuments({ examId, status: { $in: ['new', 'under_review'] } }),
  ]);
  res.json({ invitations, registrations, activeSessions, submitted, alertsOpen, questionCount: await Question.countDocuments({ examId }) });
});

exports.recompute = recomputeTotalMarks;
exports.assertEditable = assertEditable;
