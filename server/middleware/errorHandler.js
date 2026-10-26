import multer from 'multer';
import mongoose from 'mongoose';

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `No route matches ${req.method} ${req.originalUrl}.` },
  });
}

export function errorHandler(error, _req, res, _next) {
  if (res.headersSent) return;

  let status = Number(error.status || error.statusCode) || 500;
  let code = error.code || 'INTERNAL_SERVER_ERROR';
  let message = status >= 500 && process.env.NODE_ENV === 'production'
    ? 'An unexpected server error occurred.'
    : (error.message || 'An unexpected server error occurred.');
  let details;

  if (error instanceof multer.MulterError) {
    status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    code = error.code;
    message = error.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5 MB or smaller.' : 'The uploaded file could not be accepted.';
  } else if (error instanceof mongoose.Error.ValidationError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Some submitted fields are invalid.';
    details = Object.fromEntries(Object.entries(error.errors).map(([field, issue]) => [field, issue.message]));
  } else if (error instanceof mongoose.Error.CastError) {
    status = 400;
    code = 'INVALID_ID';
    message = `Invalid value for ${error.path}.`;
  } else if (error?.code === 11000) {
    status = 409;
    code = 'DUPLICATE_VALUE';
    const field = Object.keys(error.keyPattern || {})[0];
    message = field ? `A record with this ${field} already exists.` : 'A record with this value already exists.';
  }

  res.status(status).json({
    success: false,
    error: { code, message, ...((details || error.details) ? { details: details || error.details } : {}) },
  });
}
