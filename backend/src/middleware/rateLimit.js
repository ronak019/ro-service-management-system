// middleware/rateLimit.js
import rateLimit from 'express-rate-limit';

// Tight limit on login/refresh to slow down credential stuffing / brute force.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});

// Public complaint endpoint is unauthenticated — anyone with a report link
// can hit it, so it needs its own limit to stop spam/abuse.
export const complaintLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many complaints submitted. Please try again later.' },
});

// Public report lookup — throttle token-guessing attempts.
export const publicReportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

// General API-wide safety net.
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
