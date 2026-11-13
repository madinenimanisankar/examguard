const ExamSession = require('../models/ExamSession');
const Exam = require('../models/Exam');
const SecurityEvent = require('../models/SecurityEvent');
const SecurityAlert = require('../models/SecurityAlert');
const engine = require('../services/securityEngine');
const { HttpError, asyncHandler, logAudit } = require('../utils/helpers');
const { scopedExam } = require('../middleware/auth');

// Layer A/B events arrive here (Layer C): validated, throttled, authorized.
exports.postEvent = asyncHandler(async (req, res) => {
  const { sessionId, type, meta } = req.body || {};
  if (!engine.EVENT_TYPES[type]) throw new HttpError(400, 'Unknown security event type');
  if (!sessionId) throw new HttpError(400, 'sessionId is required');
  const session = await ExamSession.findById(sessionId);
  if (!session || String(session.candidateId) !== String(req.user._id)) throw new HttpError(404, 'Exam session not found');
  if (session.status !== 'active') return res.json({ ok: true, ignored: 'session not active' });
  const exam = await Exam.findById(session.examId);
  if (!exam || exam.status !== 'published') return res.json({ ok: true, ignored: 'exam not active' });
  let occurredAt = req.body?.occurredAt ? new Date(req.body.occurredAt) : new Date();
  if (Number.isNaN(occurredAt.getTime()) || occurredAt > new Date(Date.now() + 5000)) occurredAt = new Date();

  // Throttle duplicate bursts (client retries, flapping focus).
  const last = await SecurityEvent.findOne({ sessionId: session._id, type, occurredAt: { $gte: new Date(Date.now() - 3000) } });
  if (last) return res.json({ ok: true, throttled: true });

  const result = await engine.processSecurityEvent({ exam, session, type, source: 'browser', meta: sanitizeMeta(meta), occurredAt });
  res.json({ ok: true });
});

function sanitizeMeta(meta) {
  if (!meta || typeof meta !== 'object') return {};
  const out = {};
  for (const k of ['processName', 'detail', 'url']) {
    if (typeof meta[k] === 'string') out[k] = meta[k].slice(0, 120);
  }
  return out;
}

// HR demo simulator: injects a clearly-labeled SIMULATED device-level event.
exports.simulate = asyncHandler(async (req, res) => {
  const exam = req.exam;
  if (!exam.monitoring?.simulatorEnabled) throw new HttpError(403, 'Simulation mode is disabled for this examination');
  const { type, sessionId } = req.body || {};
  if (!engine.SIMULATION_TYPES.includes(type)) throw new HttpError(400, 'Simulatable event types: prohibited_app, remote_desktop, screen_share');
  let session;
  if (sessionId) {
    session = await ExamSession.findById(sessionId);
    if (!session || String(session.examId) !== String(exam._id)) throw new HttpError(404, 'Exam session not found for this examination');
  } else {
    session = await ExamSession.findOne({ examId: exam._id, status: 'active' }).sort({ startedAt: -1 });
    if (!session) throw new HttpError(404, 'No active exam session — a candidate must be taking the exam first');
  }
  const result = await engine.processSecurityEvent({
    exam, session, type, source: 'simulation',
    meta: { processName: String(req.body?.processName || 'demo-process'), simulated: true },
    occurredAt: new Date(),
  });
  await logAudit(req, 'security.simulate', { targetType: 'session', targetId: session._id, meta: { type } });
  res.json({
    message: 'SIMULATED event recorded (demo data, not a real device observation)',
    riskScore: result.riskScore,
    level: result.level,
    alert: result.alert,
  });
});

exports.alerts = asyncHandler(async (req, res) => {
  const filter = { companyId: req.user.companyId };
  if (req.query.examId) filter.examId = req.query.examId;
  if (req.query.status) filter.status = req.query.status;
  const alerts = await SecurityAlert.find(filter).sort({ createdAt: -1 }).limit(100).populate('candidateId', 'name email').populate('examId', 'title').lean();
  res.json({ alerts });
});

exports.alertDetail = asyncHandler(async (req, res) => {
  const alert = await SecurityAlert.findOne({ _id: req.params.id, companyId: req.user.companyId }).populate('candidateId', 'name email').populate('examId', 'title').lean();
  if (!alert) throw new HttpError(404, 'Alert not found');
  res.json({ alert });
});

exports.review = asyncHandler(async (req, res) => {
  const alert = await SecurityAlert.findOne({ _id: req.params.id, companyId: req.user.companyId });
  if (!alert) throw new HttpError(404, 'Alert not found');
  const { status, decision, note } = req.body || {};
  if (!['new', 'under_review', 'resolved', 'inconclusive'].includes(status)) throw new HttpError(400, 'Invalid review status');
  alert.status = status;
  if (decision != null) alert.review.decision = String(decision).slice(0, 500);
  if (note) alert.review.notes.push({ text: String(note).slice(0, 2000), by: req.user.email, at: new Date() });
  alert.review.reviewedBy = req.user._id;
  alert.review.reviewedAt = new Date();
  await alert.save();
  await logAudit(req, 'alert.review', { targetType: 'alert', targetId: alert._id, meta: { status } });
  res.json({ alert });
});

exports.sessions = asyncHandler(async (req, res) => {
  const filter = { examId: req.query.examId || { $exists: true } };
  const examFilter = { companyId: req.user.companyId };
  if (req.query.examId) examFilter._id = req.query.examId;
  const exams = await Exam.find(examFilter).select('_id title').lean();
  const examMap = new Map(exams.map((e) => [String(e._id), e.title]));
  const sessions = await ExamSession.find({ examId: { $in: exams.map((e) => e._id) }, ...(req.query.examId ? {} : {}) })
    .sort({ startedAt: -1 })
    .limit(100)
    .populate('candidateId', 'name email')
    .lean();
  res.json({
    sessions: sessions.map((s) => ({
      id: s._id, examId: s.examId, examTitle: examMap.get(String(s.examId)) || '—', candidate: s.candidateId, status: s.status,
      startedAt: s.startedAt, endsAt: s.endsAt, submittedAt: s.submittedAt, riskScore: s.riskScore, alertsCount: s.alertsCount,
    })),
  });
});

exports.routesRef = { scopedExam };
