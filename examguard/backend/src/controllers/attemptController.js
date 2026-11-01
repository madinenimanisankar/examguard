const ExamSession = require('../models/ExamSession');
const Exam = require('../models/Exam');
const Question = require('../models/Question');
const Registration = require('../models/Registration');
const Submission = require('../models/Submission');
const evaluator = require('../services/evaluator');
const { HttpError, asyncHandler, logAudit } = require('../utils/helpers');

const SUBMIT_GRACE_SECONDS = 60;

function sanitizeQuestion(q) {
  const out = {
    id: q._id, type: q.type, section: q.section, text: q.text, marks: q.marks, negativeMarks: q.negativeMarks, order: q.order,
  };
  if (q.type === 'mcq' || q.type === 'aptitude') out.options = q.options;
  if (q.type === 'coding') {
    out.problem = {
      statement: q.problem?.statement || '',
      inputFormat: q.problem?.inputFormat || '',
      outputFormat: q.problem?.outputFormat || '',
      constraints: q.problem?.constraints || '',
      examples: q.problem?.examples || [],
      languages: q.problem?.languages || ['javascript'],
      timeLimitSeconds: q.problem?.timeLimitSeconds || 5,
    };
  }
  // NOTE: correctIndex, modelAnswer and hidden test cases are never sent to the browser.
  return out;
}

async function loadOwnSession(req) {
  const session = await ExamSession.findById(req.params.id);
  if (!session || String(session.candidateId) !== String(req.user._id)) throw new HttpError(404, 'Exam session not found');
  return session;
}

exports.start = asyncHandler(async (req, res) => {
  const exam = await Exam.findById(req.params.examId);
  if (!exam || exam.status !== 'published') throw new HttpError(409, 'This examination is not open');
  const now = new Date();
  if (now < exam.startAt) throw new HttpError(409, `This examination opens on ${exam.startAt.toISOString()}`);
  if (now > exam.endAt) throw new HttpError(409, 'The examination window has closed');
  const registration = await Registration.findOne({ examId: exam._id, candidateId: req.user._id });
  if (!registration) throw new HttpError(403, 'You are not registered for this examination');

  let session = await ExamSession.findOne({ examId: exam._id, candidateId: req.user._id });
  if (session) {
    if (session.status === 'submitted') throw new HttpError(409, 'You have already submitted this examination');
    if (session.endsAt > now) {
      // resume in progress
    } else {
      session.status = 'expired';
      await session.save();
      throw new HttpError(409, 'Your examination time is over');
    }
  } else {
    const endsAt = new Date(Math.min(now.getTime() + exam.durationMinutes * 60000, exam.endAt.getTime()));
    session = await ExamSession.create({ examId: exam._id, candidateId: req.user._id, registrationId: registration._id, startedAt: now, endsAt });
    await logAudit(req, 'attempt.start', { targetType: 'exam', targetId: exam._id });
  }
  const questions = (await Question.find({ examId: exam._id }).sort({ order: 1 })).map(sanitizeQuestion);
  res.json({
    session: { id: session._id, startedAt: session.startedAt, endsAt: session.endsAt, status: session.status },
    serverNow: now,
    exam: { id: exam._id, title: exam.title, durationMinutes: exam.durationMinutes, sections: exam.sections, monitoring: { fullscreenRequired: exam.monitoring?.fullscreenRequired || false } },
    questions,
  });
});

exports.getSession = asyncHandler(async (req, res) => {
  const session = await loadOwnSession(req);
  const now = new Date();
  if (session.status === 'active' && session.endsAt < now) {
    session.status = 'expired';
    await session.save();
  }
  const exam = await Exam.findById(session.examId);
  const questions = (await Question.find({ examId: session.examId }).sort({ order: 1 })).map(sanitizeQuestion);
  const subs = await Submission.find({ sessionId: session._id });
  const answers = Object.fromEntries(subs.map((s) => [String(s.questionId), { selected: s.answer?.selected ?? null, code: s.answer?.code || '', language: s.answer?.language || '', text: s.answer?.text || '' }]));
  res.json({
    session: { id: session._id, startedAt: session.startedAt, endsAt: session.endsAt, status: session.status, riskScore: session.riskScore },
    serverNow: now,
    exam: { id: exam._id, title: exam.title, durationMinutes: exam.durationMinutes, sections: exam.sections, monitoring: { fullscreenRequired: exam.monitoring?.fullscreenRequired || false } },
    questions,
    answers,
  });
});

exports.saveAnswer = asyncHandler(async (req, res) => {
  const session = await loadOwnSession(req);
  const now = new Date();
  if (session.status !== 'active' || session.endsAt < now) throw new HttpError(409, 'This exam session is no longer active');
  const { questionId, answer } = req.body || {};
  const q = await Question.findOne({ _id: questionId, examId: session.examId });
  if (!q) throw new HttpError(404, 'Question not found in this examination');
  const clean = {
    selected: answer?.selected == null ? null : Number(answer.selected),
    code: String(answer?.code || '').slice(0, 50000),
    language: evaluator.SUPPORTED_LANGUAGES.includes(answer?.language) ? answer.language : 'javascript',
    text: String(answer?.text || '').slice(0, 20000),
  };
  await Submission.findOneAndUpdate(
    { sessionId: session._id, questionId: q._id },
    { $set: { answer: clean, status: 'saved', maxScore: q.marks, candidateId: req.user._id, examId: session.examId } },
    { upsert: true }
  );
  session.lastActivityAt = now;
  await session.save();
  res.json({ saved: true, serverNow: now });
});

exports.submit = asyncHandler(async (req, res) => {
  const session = await loadOwnSession(req);
  const now = new Date();
  if (session.status === 'submitted') throw new HttpError(409, 'You have already submitted this examination');
  if (session.status === 'expired' || session.endsAt.getTime() + SUBMIT_GRACE_SECONDS * 1000 < now.getTime()) {
    session.status = 'expired';
    await session.save();
    throw new HttpError(409, 'The examination time is over and your saved answers were recorded');
  }
  const questions = await Question.find({ examId: session.examId }).sort({ order: 1 });
  const subs = await Submission.find({ sessionId: session._id });
  const subByQ = new Map(subs.map((s) => [String(s.questionId), s]));

  let autoScore = 0;
  let pendingReview = 0;
  for (const q of questions) {
    let sub = subByQ.get(String(q._id));
    const answer = sub?.answer || { selected: null, code: '', language: 'javascript', text: '' };
    const result = await evaluator.evaluateSubmission(q, answer);
    if (!sub) {
      sub = await Submission.create({ sessionId: session._id, examId: session.examId, candidateId: req.user._id, questionId: q._id, answer, maxScore: q.marks });
    }
    sub.status = result.status;
    sub.score = result.score;
    sub.maxScore = q.marks;
    sub.autoFeedback = result.feedback;
    sub.evaluatedAt = new Date();
    await sub.save();
    if (result.status === 'evaluated') autoScore += result.score;
    else pendingReview += 1;
  }
  session.status = 'submitted';
  session.submittedAt = now;
  await session.save();
  await logAudit(req, 'attempt.submit', { targetType: 'exam', targetId: session.examId, meta: { autoScore, pendingReview } });
  res.json({
    message: 'Examination submitted successfully',
    summary: { autoScore: Math.round(autoScore * 100) / 100, pendingReview, questions: questions.length },
  });
});

exports.myRegistrations = asyncHandler(async (req, res) => {
  const registrations = await Registration.find({ candidateId: req.user._id }).populate('examId').lean();
  const out = [];
  for (const reg of registrations) {
    const session = await ExamSession.findOne({ examId: reg.examId?._id, candidateId: req.user._id });
    const subs = session ? await Submission.find({ sessionId: session._id, status: { $in: ['evaluated', 'pending_review'] } }) : [];
    out.push({
      registrationId: reg._id,
      exam: reg.examId ? { id: reg.examId._id, title: reg.examId.title, jobRole: reg.examId.jobRole, startAt: reg.examId.startAt, endAt: reg.examId.endAt, status: reg.examId.status, durationMinutes: reg.examId.durationMinutes, resultVisibility: reg.examId.resultVisibility, resultsReleased: reg.examId.resultsReleased } : null,
      session: session ? { id: session._id, status: session.status, endsAt: session.endsAt, startedAt: session.startedAt, riskScore: session.riskScore } : null,
      autoScore: subs.filter((s) => s.status === 'evaluated').reduce((a, s) => a + s.score, 0),
      pendingReview: subs.filter((s) => s.status === 'pending_review').length,
    });
  }
  res.json({ registrations: out.filter((r) => r.exam) });
});

exports.myResult = asyncHandler(async (req, res) => {
  const exam = await Exam.findById(req.params.examId);
  if (!exam) throw new HttpError(404, 'Examination not found');
  const session = await ExamSession.findOne({ examId: exam._id, candidateId: req.user._id });
  if (!session || session.status !== 'submitted') throw new HttpError(404, 'No submitted attempt found for this examination');
  const now = new Date();
  const allowed = exam.resultVisibility === 'immediate' || (exam.resultVisibility === 'after_end' && now > exam.endAt) || (exam.resultVisibility === 'manual' && exam.resultsReleased);
  if (!allowed) throw new HttpError(403, 'The company has not released results for this examination yet');
  const questions = await Question.find({ examId: exam._id }).lean();
  const qMap = new Map(questions.map((q) => [String(q._id), q]));
  const subs = await Submission.find({ sessionId: session._id });
  let total = 0;
  const perType = {};
  const details = [];
  for (const sub of subs) {
    const q = qMap.get(String(sub.questionId));
    if (!q) continue;
    total += sub.score || 0;
    perType[q.type] = (perType[q.type] || 0) + (sub.score || 0);
    details.push({ questionText: q.text, type: q.type, marks: q.marks, score: sub.score, status: sub.status, feedback: sub.autoFeedback });
  }
  const allSessions = await ExamSession.find({ examId: exam._id, status: 'submitted' }).lean();
  const totals = [];
  for (const s of allSessions) {
    const ss = await Submission.find({ sessionId: s._id });
    totals.push({ id: String(s._id), score: ss.reduce((a, x) => a + (x.score || 0), 0) });
  }
  totals.sort((a, b) => b.score - a.score);
  const rank = totals.findIndex((t) => t.id === String(session._id)) + 1;
  res.json({
    result: {
      totalScore: Math.round(total * 100) / 100,
      maxScore: exam.totalMarks,
      perType,
      details,
      rank: rank > 0 ? rank : null,
      completionTime: session.submittedAt,
      timeTakenMin: session.submittedAt ? Math.round((session.submittedAt - session.startedAt) / 60000) : null,
    },
  });
});
