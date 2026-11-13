// Layer C of the monitoring design: server-side security-event processing and
// the rule-based behavioral analysis engine (Layer B inputs arrive as events).
// Every alert is explainable: reasons[] records each contributing signal.
const SecurityEvent = require('../models/SecurityEvent');
const SecurityAlert = require('../models/SecurityAlert');

const WINDOW_MINUTES = 15;
const PER_TYPE_CAP = 5;

const EVENT_TYPES = {
  tab_hidden: 'Left the exam tab',
  window_blur: 'Exam window lost focus',
  fullscreen_exit: 'Exited full-screen mode',
  copy_attempt: 'Copy attempt inside the exam',
  paste_attempt: 'Paste attempt inside the exam',
  prohibited_app: 'Prohibited application indicator (SIMULATED DEMO)',
  remote_desktop: 'Remote desktop tool indicator (SIMULATED DEMO)',
  screen_share: 'Screen sharing tool indicator (SIMULATED DEMO)',
  heartbeat: 'Session heartbeat',
};

const SIMULATION_TYPES = ['prohibited_app', 'remote_desktop', 'screen_share'];
const DEFAULT_WEIGHTS = { tab_hidden: 10, window_blur: 8, fullscreen_exit: 20, copy_attempt: 5, paste_attempt: 5, prohibited_app: 70, remote_desktop: 80, screen_share: 60 };
const DEFAULT_THRESHOLDS = { medium: 40, high: 70, critical: 90 };

function levelFor(score, th) {
  if (score >= th.critical) return 'critical';
  if (score >= th.high) return 'high';
  if (score >= th.medium) return 'medium';
  return 'low';
}

async function processSecurityEvent({ exam, session, type, source, meta, occurredAt }) {
  const evt = await SecurityEvent.create({ examId: exam._id, sessionId: session._id, candidateId: session.candidateId, type, source, occurredAt, meta: meta || {}, processedAt: new Date() });

  if (type === 'heartbeat') {
    session.lastActivityAt = occurredAt;
    await session.save();
    return { event: evt, riskScore: session.riskScore, alert: null };
  }

  const since = new Date(occurredAt.getTime() - WINDOW_MINUTES * 60000);
  const recent = await SecurityEvent.find({ sessionId: session._id, type: { $ne: 'heartbeat' }, occurredAt: { $gte: since } }).sort({ occurredAt: -1 }).lean();

  const weights = { ...DEFAULT_WEIGHTS, ...(exam.monitoring?.weights || {}) };
  const th = { ...DEFAULT_THRESHOLDS, ...(exam.monitoring?.thresholds || {}) };
  const counts = {};
  recent.forEach((e) => { counts[e.type] = (counts[e.type] || 0) + 1; });

  let score = 0;
  const reasons = [];
  for (const [t, c] of Object.entries(counts)) {
    const w = weights[t] || 0;
    if (w <= 0) continue;
    const capped = Math.min(c, PER_TYPE_CAP);
    score += w * capped;
    reasons.push(`${EVENT_TYPES[t] || t}: ${c} event(s) in the last ${WINDOW_MINUTES} minutes (+${w * capped})`);
  }
  if (Object.keys(counts).length >= 2) {
    score += 10;
    reasons.push('Multiple different signal types combined (+10)');
  }

  const level = levelFor(score, th);
  let alert = null;

  if (score >= th.medium) {
    const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    const evidence = recent.slice(0, 10).map((e) => ({ eventId: e._id, eventType: e.type, source: e.source, at: e.occurredAt, meta: e.meta || {} }));
    const existing = await SecurityAlert.findOne({ sessionId: session._id, status: { $in: ['new', 'under_review'] } });
    if (existing && score > existing.riskScore) {
      existing.riskScore = score;
      existing.riskLevel = level;
      existing.reasons = reasons;
      existing.evidence = evidence;
      existing.category = dominant;
      await existing.save();
      alert = existing;
    } else if (!existing) {
      alert = await SecurityAlert.create({
        examId: exam._id, companyId: exam.companyId, sessionId: session._id, candidateId: session.candidateId,
        category: dominant, riskScore: score, riskLevel: level, reasons, evidence, status: 'new',
      });
    } else {
      alert = existing;
    }
  }

  session.riskScore = Math.max(session.riskScore || 0, score);
  session.alertsCount = await SecurityAlert.countDocuments({ sessionId: session._id });
  session.lastActivityAt = occurredAt;
  await session.save();

  return { event: evt, riskScore: score, level, alert };
}

module.exports = { EVENT_TYPES, SIMULATION_TYPES, DEFAULT_WEIGHTS, DEFAULT_THRESHOLDS, processSecurityEvent };
