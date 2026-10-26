import rateLimit from 'express-rate-limit';

const commonOptions = {
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again shortly.' },
  }),
};

export const apiRateLimit = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000,
  limit: 300,
});

export const authRateLimit = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000,
  limit: 20,
});

export const reportRateLimit = rateLimit({
  ...commonOptions,
  windowMs: 60 * 60 * 1000,
  limit: 30,
});
