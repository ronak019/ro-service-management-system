// middleware/validate.js
import { validationResult } from 'express-validator';

/** Drop this after a chain of express-validator checks to short-circuit on bad input. */
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  }
  next();
};
