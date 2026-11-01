const Submission = require('../models/Submission');
const ExamSession = require('../models/ExamSession');
const Exam = require('../models/Exam');
const Question = require('../models/Question');
const SecurityAlert = require('../models/SecurityAlert');
const { HttpError, asyncHandler, csvEscape, logAudit } = require('../utils/helpers');

// Aggregates score rows for one exam. Academic scores and security-review
// indicators are kept as separate fields on purpose.
async function buildResultRows(exam) {
  const sessions = await ExamSession.find({ examId: exam._id }).populate('candidateId', 'name email').lean();
  const sessionIds = sessions.map((s) => s._id);
  const submissions = await Submission.find({ examId: exam._id, sessionId: { $in: sessionIds } }).lean();
  const questions = await Question.find({ examId: exam._id }).select('type marks section').lean();
  const qMap = new Map(questions.map((q) => [String(q._id), q]));
  const alerts = await SecurityAlert.find({ examId: exam._id }, 'sessionId status riskLevel').lean();

  const alertsBySession = new Map();
  alerts.forEach((a) => {
    const key = String(a.sessionId);
    const cur = alertsBySession.get(key) || { open: 0, any: 0 };
    cur.any += 1;
    if (['new', 'under_review'].includes(a.status)) cur.open += 1;
    alertsBySession.set(key, cur);
  });

  const rows = sessions.map((s) => {
    const subs = submissions.filter((x) => String(x.sessionId) === String(s._id));
    let total = 0;
    let pendingManual = 0;
    const byType = {};
    subs.forEach((sub) => {
      const q = qMap.get(String(sub.questionId));
      const type = q?.type || 'unknown';
      byType[type] = (byType[type] || 0) + (sub.score || 0);
      total += sub.score || 0;
      if (sub.status === 'pending_review') pendingManual += 1;
    });
    const al = alertsBySession.get(String(s._id)) || { open: 0, any: 0 };
    return {
      sessionId: s._id,
      candidateId: s.candidateId?._id,
      name: s.candidateId?.name || 'Deleted user',
      email: s.candidateId?.email || '—',
      status: s.status,
      startedAt: s.startedAt,
      submittedAt: s.submittedAt,
      timeTakenMin: s.submittedAt ? Math.max(0, Math.round((new Date(s.submittedAt) - new Date(s.startedAt)) / 60000)) : null,
      totalScore: Math.round(total * 100) / 100,
      maxScore: exam.totalMarks,
      breakdown: byType,
      pendingManual,
      openAlerts: al.open,
      totalAlerts: al.any,
      securityStatus: al.open > 0 ? 'review_pending' : 'clear',
    };
  });

  rows.sort((a, b) => b.totalScore - a.totalScore);
  let rank = 0;
  let lastScore = null;
  rows.forEach((r, i) => {
    if (r.totalScore !== lastScore) {
      rank = i + 1;
      lastScore = r.totalScore;
    }
    r.rank = r.status === 'submitted' ? rank : null;
  });
  return rows;
}

exports.forExam = asyncHandler(async (req, res) => {
  const rows = await buildResultRows(req.exam);
  res.json({ exam: req.exam, rows });
});

exports.csv = asyncHandler(async (req, res) => {
  const rows = await buildResultRows(req.exam);
  const header = ['Candidate', 'Email', 'Status', 'Total Score', 'Max Score', 'MCQ', 'Coding', 'Descriptive', 'Aptitude', 'Rank', 'Security Review', 'Pending Manual Review', 'Submitted At'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([
      r.name, r.email, r.status, r.totalScore, r.maxScore,
      r.breakdown.mcq || 0, r.breakdown.coding || 0, r.breakdown.descriptive || 0, r.breakdown.aptitude || 0,
      r.rank ?? '', r.securityStatus, r.pendingManual, r.submittedAt || '',
    ].map(csvEscape).join(','));
  }
  await logAudit(req, 'results.export_csv', { targetType: 'exam', targetId: req.exam._id });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="examguard-results-${req.exam._id}.csv"`);
  res.send(lines.join('\n'));
});

exports.scoreSubmission = asyncHandler(async (req, res) => {
  const sub = await Submission.findById(req.params.submissionId);
  if (!sub) throw new HttpError(404, 'Submission not found');
  const exam = await Exam.findById(sub.examId);
  if (!exam || String(exam.companyId) !== String(req.user.companyId)) throw new HttpError(404, 'Submission not found');
  const q = await Question.findById(sub.questionId);
  if (!q || q.type !== 'descriptive') throw new HttpError(400, 'Only descriptive answers can be scored manually');
  const score = Number(req.body?.score);
  if (!Number.isFinite(score) || score < 0 || score > q.marks) throw new HttpError(400, `Score must be between 0 and ${q.marks}`);
  sub.score = score;
  sub.status = 'evaluated';
  sub.autoFeedback = String(req.body?.feedback || 'Manually reviewed').slice(0, 500);
  sub.evaluatedAt = new Date();
  await sub.save();
  await logAudit(req, 'results.manual_score', { targetType: 'submission', targetId: sub._id, meta: { score } });
  res.json({ submission: sub });
});

exports.release = asyncHandler(async (req, res) => {
  req.exam.resultsReleased = true;
  await req.exam.save();
  await logAudit(req, 'results.release', { targetType: 'exam', targetId: req.exam._id });
  res.json({ exam: req.exam });
});

// Full attempt detail for authorized HR reviewers (manual scoring, evidence).
exports.forSession = asyncHandler(async (req, res) => {
  const session = await ExamSession.findById(req.params.sessionId).populate('candidateId', 'name email');
  if (!session) throw new HttpError(404, 'Session not found');
  const exam = await Exam.findById(session.examId);
  if (!exam || String(exam.companyId) !== String(req.user.companyId)) throw new HttpError(404, 'Session not found');
  const subs = await Submission.find({ sessionId: session._id }).populate('questionId').sort({ createdAt: 1 }).lean();
  res.json({
    session,
    candidate: session.candidateId,
    submissions: subs
      .filter((s) => s.questionId)
      .map((s) => ({
        id: s._id,
        question: {
          id: s.questionId._id,
          text: s.questionId.text,
          type: s.questionId.type,
          marks: s.questionId.marks,
          options: s.questionId.options,
          modelAnswer: s.questionId.modelAnswer,
        },
        score: s.score,
        status: s.status,
        feedback: s.autoFeedback,
        answer: s.answer,
      })),
  });
});
