const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const env = require('./src/config/env');
const connectDB = require('./src/config/db');
const routes = require('./src/routes');
const { notFound, errorHandler } = require('./src/middleware/error');

// Strips MongoDB operator keys ($gt, $where, dotted paths) from request bodies.
function sanitizeBody(value) {
  if (Array.isArray(value)) return value.forEach(sanitizeBody);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    for (const key of Object.keys(value)) {
      if (key.startsWith('$') || key.includes('.')) {
        delete value[key];
      } else {
        sanitizeBody(value[key]);
      }
    }
  }
}

async function main() {
  await connectDB();
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use((req, res, next) => {
    if (req.body && typeof req.body === 'object') sanitizeBody(req.body);
    next();
  });
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 1000, standardHeaders: true, legacyHeaders: false }));
  app.use('/api', routes);
  app.use(notFound);
  app.use(errorHandler);
  app.listen(env.port, '0.0.0.0', () => {
    console.log(`[api] ExamGuard API (Express) listening on :${env.port}`);
  });
}

main().catch((e) => {
  console.error('[api] failed to start:', e);
  process.exit(1);
});
