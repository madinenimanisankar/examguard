const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Exam = require('../models/Exam');
const env = require('../config/env');
const { HttpError } = require('../utils/helpers');

const ACCESS_TTL_MS = 12 * 60 * 60 * 1000;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function signAccessToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role, type: 'access' }, env.jwtSecret, { expiresIn: '12h' });
}

function signRefreshToken(user) {
  return jwt.sign({ sub: user._id.toString(), type: 'refresh' }, env.jwtSecret, { expiresIn: '7d' });
}

function setAuthCookies(res, user) {
  // Split-domain deployments (e.g. Vercel frontend + Render API) are cross-site,
  // so production uses SameSite=None + Secure; local dev keeps lax.
  const crossSite = env.nodeEnv === 'production';
  res.cookie('access_token', signAccessToken(user), { httpOnly: true, sameSite: crossSite ? 'none' : 'lax', secure: crossSite, maxAge: ACCESS_TTL_MS });
  res.cookie('refresh_token', signRefreshToken(user), { httpOnly: true, sameSite: crossSite ? 'none' : 'lax', secure: crossSite, maxAge: REFRESH_TTL_MS });
}

function clearAuthCookies(res) {
  res.clearCookie('access_token');
  res.clearCookie('refresh_token');
}

async function requireAuth(req, res, next) {
  try {
    let token = req.cookies?.access_token;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) token = req.headers.authorization.slice(7);
    if (!token) throw new HttpError(401, 'Not authenticated');
    let payload;
    try {
      payload = jwt.verify(token, env.jwtSecret);
    } catch {
      throw new HttpError(401, 'Session expired. Please log in again.');
    }
    if (payload.type !== 'access') throw new HttpError(401, 'Invalid token type');
    const user = await User.findById(payload.sub);
    if (!user) throw new HttpError(401, 'Account no longer exists');
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return next(new HttpError(403, 'You are not allowed to perform this action'));
    next();
  };
}

function requireHr(req, res, next) {
  if (!req.user || req.user.role !== 'hr' || !req.user.companyId) {
    return next(new HttpError(403, 'Company (HR) account required'));
  }
  req.companyId = req.user.companyId;
  next();
}

async function scopedExam(req, res, next) {
  try {
    const id = req.params.examId || req.params.id;
    const exam = await Exam.findById(id);
    if (!exam || String(exam.companyId) !== String(req.user.companyId)) {
      return next(new HttpError(404, 'Examination not found'));
    }
    req.exam = exam;
    next();
  } catch (e) {
    next(e);
  }
}

module.exports = { signAccessToken, signRefreshToken, setAuthCookies, clearAuthCookies, requireAuth, requireRole, requireHr, scopedExam };
