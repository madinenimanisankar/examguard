const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const auth = require('../controllers/authController');
const exams = require('../controllers/examController');
const questions = require('../controllers/questionController');
const invitations = require('../controllers/invitationController');
const attempts = require('../controllers/attemptController');
const security = require('../controllers/securityController');
const results = require('../controllers/resultController');
const admin = require('../controllers/adminController');
const { requireAuth, requireRole, requireHr, scopedExam } = require('../middleware/auth');

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 150, standardHeaders: true, legacyHeaders: false });
const eventLimiter = rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });

router.get('/health', (req, res) => res.json({ ok: true, service: 'examguard-api' }));

// ---- Authentication ----
router.post('/auth/company/register', authLimiter, auth.registerCompany);
router.post('/auth/company/verify-email', authLimiter, auth.verifyEmail);
router.post('/auth/candidate/register', authLimiter, auth.candidateRegister);
router.post('/auth/login', authLimiter, auth.login);
router.post('/auth/refresh', authLimiter, auth.refresh);
router.post('/auth/logout', auth.logout);
router.get('/auth/me', requireAuth, auth.me);
router.post('/auth/forgot-password', authLimiter, auth.forgotPassword);
router.post('/auth/reset-password', authLimiter, auth.resetPassword);
router.post('/auth/resend-verification', requireAuth, auth.resendVerification);
router.post('/auth/candidate/accept-invitation', requireAuth, auth.acceptInvitation);

// ---- Public invitation lookup ----
router.get('/invitations/lookup/:token', authLimiter, invitations.lookup);

// ---- HR: examinations ----
router.get('/exams', requireAuth, requireHr, exams.list);
router.post('/exams', requireAuth, requireHr, exams.create);
router.use('/exams/:examId', requireAuth, requireHr, scopedExam);
router.get('/exams/:examId', exams.getOne);
router.put('/exams/:examId', exams.update);
router.delete('/exams/:examId', exams.remove);
router.post('/exams/:examId/publish', exams.publish);
router.post('/exams/:examId/close', exams.close);
router.put('/exams/:examId/monitoring', exams.updateMonitoring);
router.get('/exams/:examId/stats', exams.stats);

// ---- HR: questions ----
router.get('/exams/:examId/questions', questions.listForExam);
router.post('/exams/:examId/questions', questions.create);
router.put('/exams/:examId/questions/reorder', questions.reorder);
router.put('/exams/:examId/questions/:id', questions.update);
router.delete('/exams/:examId/questions/:id', questions.remove);

// ---- HR: invitations ----
router.post('/exams/:examId/invitations', invitations.send);
router.get('/exams/:examId/invitations', invitations.list);
router.post('/exams/:examId/invitations/:id/link', invitations.mintLink);
router.post('/exams/:examId/invitations/:id/resend', invitations.resend);
router.post('/exams/:examId/invitations/:id/revoke', invitations.revoke);

// ---- HR: security monitoring ----
router.post('/exams/:examId/security/simulate', security.simulate);
// Layer A/C: candidate browser events
router.post('/security/events', eventLimiter, requireAuth, requireRole('candidate'), security.postEvent);
router.get('/security/alerts', requireAuth, requireHr, security.alerts);
router.get('/security/alerts/:id', requireAuth, requireHr, security.alertDetail);
router.post('/security/alerts/:id/review', requireAuth, requireHr, security.review);
router.get('/security/sessions', requireAuth, requireHr, security.sessions);

// ---- Results ----
router.get('/results/exams/:examId', requireAuth, requireHr, scopedExam, results.forExam);
router.get('/results/exams/:examId/csv', requireAuth, requireHr, scopedExam, results.csv);
router.put('/results/exams/:examId/release', requireAuth, requireHr, scopedExam, results.release);
router.put('/results/submissions/:submissionId', requireAuth, requireHr, results.scoreSubmission);
router.get('/results/sessions/:sessionId', requireAuth, requireHr, results.forSession);

// ---- Candidate attempts ----
router.post('/attempts/:examId/start', requireAuth, requireRole('candidate'), attempts.start);
router.get('/attempts/session/:id', requireAuth, requireRole('candidate'), attempts.getSession);
router.put('/attempts/session/:id/answers', requireAuth, requireRole('candidate'), attempts.saveAnswer);
router.post('/attempts/session/:id/submit', requireAuth, requireRole('candidate'), attempts.submit);
router.get('/attempts/my', requireAuth, requireRole('candidate'), attempts.myRegistrations);
router.get('/attempts/my-result/:examId', requireAuth, requireRole('candidate'), attempts.myResult);

// ---- Platform admin ----
router.get('/admin/overview', requireAuth, requireRole('admin'), admin.overview);
router.get('/admin/companies', requireAuth, requireRole('admin'), admin.companies);
router.post('/admin/companies/:id/verify', requireAuth, requireRole('admin'), admin.verifyCompany);
router.get('/admin/users', requireAuth, requireRole('admin'), admin.users);
router.get('/admin/audit-logs', requireAuth, requireRole('admin'), admin.auditLogs);
router.get('/admin/alerts', requireAuth, requireRole('admin'), admin.alertsOverview);

module.exports = router;
