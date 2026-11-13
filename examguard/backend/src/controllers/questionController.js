const Question = require('../models/Question');
const Exam = require('../models/Exam');
const evaluator = require('../services/evaluator');
const { HttpError, asyncHandler, logAudit } = require('../utils/helpers');
const { requireHr, scopedExam } = require('../middleware/auth');
const { assertEditable } = require('./examController');

function validateQuestionPayload(type, body) {
  const { text, marks, negativeMarks, section } = body || {};
  if (!text || !String(text).trim()) throw new HttpError(400, 'Question text is required');
  const m = Number(marks);
  if (!Number.isFinite(m) || m < 1 || m > 100) throw new HttpError(400, 'Marks must be between 1 and 100');
  const neg = Number(negativeMarks || 0);
  if (neg < 0 || neg > m) throw new HttpError(400, 'Negative marks must be between 0 and the question marks');
  const out = { type, text: String(text).trim(), marks: m, negativeMarks: neg, section: Number(section) || 0 };

  if (type === 'mcq' || type === 'aptitude') {
    const options = (body.options || []).map((o) => String(o || '').trim()).filter(Boolean);
    if (options.length < 2) throw new HttpError(400, 'Provide at least two answer options');
    const ci = Number(body.correctIndex);
    if (!Number.isInteger(ci) || ci < 0 || ci >= options.length) throw new HttpError(400, 'Select which option is the correct answer');
    out.options = options;
    out.correctIndex = ci;
  } else if (type === 'coding') {
    const p = body.problem || {};
    if (!p.statement || !String(p.statement).trim()) throw new HttpError(400, 'Coding problem statement is required');
    const examples = (p.examples || []).filter((e) => e && String(e.input || '').length || String(e.output || '').length);
    if (!examples.length) throw new HttpError(400, 'Add at least one example input and output');
    const languages = (p.languages || []).filter((l) => evaluator.SUPPORTED_LANGUAGES.includes(l));
    if (!languages.length) throw new HttpError(400, 'Select at least one supported programming language');
    const testCases = (body.testCases || []).filter((t) => t && String(t.input || '').length && String(t.output || '').length);
    if (!testCases.length) throw new HttpError(400, 'Add at least one test case');
    out.problem = {
      statement: String(p.statement),
      inputFormat: String(p.inputFormat || ''),
      outputFormat: String(p.outputFormat || ''),
      constraints: String(p.constraints || ''),
      examples: examples.map((e) => ({ input: String(e.input || ''), output: String(e.output || '') })),
      languages,
      timeLimitSeconds: Math.min(Math.max(Number(p.timeLimitSeconds) || 5, 1), 15),
    };
    out.testCases = testCases.map((t) => ({ input: String(t.input), output: String(t.output), hidden: t.hidden !== false }));
  } else if (type === 'descriptive') {
    out.modelAnswer = String(body.modelAnswer || '');
  }
  return out;
}

async function recompute(examId) {
  const agg = await Question.aggregate([{ $match: { examId } }, { $group: { _id: null, total: { $sum: '$marks' } } }]);
  await Exam.updateOne({ _id: examId }, { $set: { totalMarks: agg[0]?.total || 0 } });
}

exports.create = asyncHandler(async (req, res) => {
  await assertEditable(req.exam);
  const type = String(req.body?.type || '');
  if (!['mcq', 'coding', 'descriptive', 'aptitude'].includes(type)) throw new HttpError(400, 'Unknown question type');
  if (!req.exam.questionTypes.includes(type)) throw new HttpError(400, `This examination's paper pattern does not include "${type}" questions`);
  const data = validateQuestionPayload(type, req.body);
  const max = await Question.findOne({ examId: req.exam._id }).sort({ order: -1 }).select('order');
  const q = await Question.create({ ...data, examId: req.exam._id, order: max ? max.order + 1 : 0 });
  await recompute(req.exam._id);
  await logAudit(req, 'question.create', { targetType: 'question', targetId: q._id });
  res.status(201).json({ question: q });
});

exports.update = asyncHandler(async (req, res) => {
  await assertEditable(req.exam);
  const q = await Question.findOne({ _id: req.params.id, examId: req.exam._id });
  if (!q) throw new HttpError(404, 'Question not found');
  const data = validateQuestionPayload(q.type, req.body);
  Object.assign(q, data);
  await q.save();
  await recompute(req.exam._id);
  await logAudit(req, 'question.update', { targetType: 'question', targetId: q._id });
  res.json({ question: q });
});

exports.remove = asyncHandler(async (req, res) => {
  await assertEditable(req.exam);
  const q = await Question.findOneAndDelete({ _id: req.params.id, examId: req.exam._id });
  if (!q) throw new HttpError(404, 'Question not found');
  await recompute(req.exam._id);
  await logAudit(req, 'question.delete', { targetType: 'question', targetId: q._id });
  res.json({ message: 'Question removed' });
});

exports.reorder = asyncHandler(async (req, res) => {
  await assertEditable(req.exam);
  const ids = req.body?.orderedIds;
  if (!Array.isArray(ids) || !ids.length) throw new HttpError(400, 'orderedIds array is required');
  for (let i = 0; i < ids.length; i += 1) {
    await Question.updateOne({ _id: ids[i], examId: req.exam._id }, { order: i });
  }
  res.json({ message: 'Questions reordered' });
});

exports.listForExam = asyncHandler(async (req, res) => {
  const questions = await Question.find({ examId: req.exam._id }).sort({ order: 1 });
  res.json({ questions });
});
