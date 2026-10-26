import { validationResult } from 'express-validator';

export function validateRequest(req, _res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const error = new Error('Some submitted fields are invalid.');
  error.status = 400;
  error.code = 'VALIDATION_ERROR';
  error.details = result.array().map(({ path, msg }) => ({ field: path, message: msg }));
  return next(error);
}
