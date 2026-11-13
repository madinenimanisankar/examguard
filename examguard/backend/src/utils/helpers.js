const crypto = require('crypto');
const env = require('../config/env');
const AuditLog = require('../models/AuditLog');

// Public base URL for links inside emails. Prefers APP_BASE_URL, but when it
// points at localhost (local dev) and a real Host header exists, uses that —
// so invitation links work both in local runs and when hosted.
function baseUrl(req) {
  if (req && env.appBaseUrl.includes('localhost')) {
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    // Only follow non-IP hosts (127.0.0.1 / raw IPs are rejected by the email link gate).
    const isIpHost = host && (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(host) || host.startsWith('['));
    if (host && !isIpHost) return `${proto}://${host}`;
  }
  return env.appBaseUrl;
}

class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const randomToken = () => crypto.randomBytes(32).toString('hex');

const maskEmail = (email) => {
  const [user, domain] = String(email).split('@');
  if (!domain) return 'hidden';
  return `${user[0]}${'*'.repeat(Math.max(user.length - 1, 2))}@${domain}`;
};

const isEmail = (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

const escapeHtml = (s) =>
  String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function csvEscape(value) {
  if (value == null) return '';
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function logAudit(req, action, { targetType, targetId, meta } = {}) {
  try {
    await AuditLog.create({
      actorId: req.user?._id || null,
      actorEmail: req.user?.email || 'anonymous',
      actorRole: req.user?.role || 'anonymous',
      action,
      targetType: targetType || null,
      targetId: targetId ? String(targetId) : null,
      meta: meta || {},
      ip: req.ip || '',
      at: new Date(),
    });
  } catch (e) {
    console.error('[audit] write failed:', e.message);
  }
}

module.exports = { HttpError, asyncHandler, sha256, randomToken, maskEmail, isEmail, escapeHtml, csvEscape, logAudit, baseUrl };
