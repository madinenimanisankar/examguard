const path = require('path');
// Load .env from the backend folder regardless of the process working directory
// (works the same for `npm run dev`, Render, and one-off scripts).
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const env = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUrl: process.env.MONGO_URL || 'mongodb://127.0.0.1:27017',
  dbName: process.env.DB_NAME || 'examguard',
  jwtSecret: process.env.JWT_SECRET,
  appBaseUrl: (process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/+$/, ''),
  emailProvider: process.env.EMAIL_PROVIDER || 'console',
  emergentEmailKey: process.env.EMERGENT_EMAIL_KEY || '',
  resendApiKey: process.env.RESEND_API_KEY || '',
  fromEmail: process.env.FROM_EMAIL || '',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: process.env.SMTP_PORT || 587,
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  emailFromName: process.env.EMAIL_FROM_NAME || 'ExamGuard',
  emailReplyTo: process.env.EMAIL_REPLY_TO || '',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@examguard.dev',
  adminPassword: process.env.ADMIN_PASSWORD || 'AdminGuard@2026',
  pythonCmd: process.env.PYTHON_CMD || (process.platform === 'win32' ? 'python' : 'python3'),
  nodeCmd: process.env.NODE_CMD || 'node',
  displayTz: process.env.DISPLAY_TZ || 'Asia/Kolkata',
};

if (!env.jwtSecret || env.jwtSecret.length < 24) {
  console.error('[env] JWT_SECRET is missing or too short. Set it in backend/.env (64 random hex chars).');
  process.exit(1);
}

module.exports = env;
