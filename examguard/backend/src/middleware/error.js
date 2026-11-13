const { HttpError } = require('../utils/helpers');

function notFound(req, res, next) {
  next(new HttpError(404, 'Route not found'));
}

// Safe error handling: known errors map to friendly messages, unknown 500s are logged but never leak internals.
function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message || 'Something went wrong. Please try again.';

  if (err.name === 'ValidationError' && err.errors) {
    status = 400;
    message = Object.values(err.errors).map((e) => e.message).join(' ');
  }
  if (err.name === 'CastError') {
    status = 404;
    message = 'Record not found';
  }
  if (err.code === 11000) {
    status = 409;
    message = 'A record with these details already exists';
  }
  if (err.type === 'entity.too.large') {
    status = 413;
    message = 'Request body too large';
  }

  if (status >= 500) console.error('[error]', err);
  res.status(status).json({ error: message, code: err.code && typeof err.code === 'string' ? err.code : undefined });
}

module.exports = { notFound, errorHandler };
