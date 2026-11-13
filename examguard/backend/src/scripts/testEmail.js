// Usage: npm run test-email -- you@example.com
const env = require('../config/env');
const mailer = require('../services/mailer');

(async () => {
  const to = process.argv[2] || env.smtpUser;
  console.log('EMAIL_PROVIDER =', env.emailProvider);
  console.log('SMTP_HOST      =', env.smtpHost || '(empty)', ' SMTP_PORT =', env.smtpPort);
  console.log('SMTP_USER      =', env.smtpUser || '(empty)', ' SMTP_PASS set:', Boolean(env.smtpPass), `(${String(env.smtpPass).length} chars)`);
  console.log('FROM_EMAIL     =', env.fromEmail || '(empty)');
  if (!to) { console.error('Give a recipient: npm run test-email -- you@example.com'); process.exit(1); }
  const r = await mailer.sendEmail({ to, subject: 'ExamGuard test email', html: '<p>If you can read this, email sending works.</p>' });
  console.log('RESULT:', JSON.stringify(r));
  process.exit(r.ok ? 0 : 1);
})();
