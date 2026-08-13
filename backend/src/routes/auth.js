// routes/auth.js
import express from 'express';
import bcrypt from 'bcrypt';
import { body } from 'express-validator';
import { db } from '../db/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import {
  signAccessToken,
  issueRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokensForUser,
} from '../utils/tokens.js';
import { audit } from '../utils/audit.js';

const router = express.Router();

/**
 * NOTE ON REGISTRATION:
 * The original design let anyone POST /register with role=admin and create
 * themselves an admin account — that's a full auth bypass. Account creation
 * is now admin-only (requires a valid admin JWT), matching the spec's
 * "Admin panel to manage users". Customers/technicians are provisioned by
 * an admin, not self-service.
 */
router.post(
  '/register',
  authenticate,
  requireRole('admin'),
  [
    body('name').trim().isLength({ min: 2, max: 120 }),
    body('role').isIn(['admin', 'technician', 'customer']),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('phone').optional({ values: 'falsy' }).trim().isMobilePhone('any'),
    body('email').optional({ values: 'falsy' }).trim().isEmail(),
  ],
  validate,
  async (req, res) => {
    const { name, phone, email, role, password } = req.body;
    if (!phone && !email) {
      return res.status(400).json({ error: 'Provide at least a phone or email' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    try {
      const result = await db.query(
        `INSERT INTO users (name, phone, email, role, password_hash)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, name, phone, email, role, created_at`,
        [name, phone || null, email || null, role, password_hash]
      );
      const user = result.rows[0];

      // Auto-create the matching profile row so the rest of the API
      // (jobs, customers, technicians lookups) works immediately.
      if (role === 'technician') {
        await db.query('INSERT INTO technicians (user_id) VALUES ($1)', [user.id]);
      } else if (role === 'customer') {
        await db.query('INSERT INTO customers (user_id) VALUES ($1)', [user.id]);
      }

      await audit({
        userId: req.user.id,
        action: 'user.created',
        entityType: 'user',
        entityId: user.id,
        details: { role },
        ip: req.ip,
      });

      res.status(201).json({ user });
    } catch (e) {
      if (e.code === '23505') {
        return res.status(409).json({ error: 'Phone or email already in use' });
      }
      console.error(e);
      res.status(400).json({ error: 'User creation failed' });
    }
  }
);

router.post(
  '/login',
  authLimiter,
  [body('phone').optional().trim(), body('password').notEmpty()],
  validate,
  async (req, res) => {
    const { phone, email, password } = req.body;
    if (!phone && !email) {
      return res.status(400).json({ error: 'phone or email is required' });
    }

    const userRes = await db.query(
      `SELECT * FROM users WHERE (phone = $1 OR email = $2) AND is_active = TRUE`,
      [phone || null, email || null]
    );
    if (userRes.rows.length === 0) {
      // Same generic error whether the user doesn't exist or the password is
      // wrong — don't leak which one it was.
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = userRes.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      await audit({ action: 'login.failed', details: { phone, email }, ip: req.ip });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const accessToken = signAccessToken(user);
    const refreshToken = await issueRefreshToken(user, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    await audit({ userId: user.id, action: 'login.success', ip: req.ip });

    res.json({
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, role: user.role },
    });
  }
);

router.post('/refresh', authLimiter, async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken is required' });

  try {
    const { payload } = await verifyRefreshToken(refreshToken);
    const userRes = await db.query(
      'SELECT id, role FROM users WHERE id = $1 AND is_active = TRUE',
      [payload.id]
    );
    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'User not found or disabled' });
    }
    const accessToken = signAccessToken(userRes.rows[0]);
    res.json({ accessToken });
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or revoked refresh token' });
  }
});

// Logout revokes the specific refresh token so a stolen one can't be reused.
router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) await revokeRefreshToken(refreshToken);
  res.json({ ok: true });
});

// Admin/self action: kill every session for a user (e.g. after a password reset).
router.post('/logout-all', authenticate, async (req, res) => {
  await revokeAllRefreshTokensForUser(req.user.id);
  res.json({ ok: true });
});

router.get('/me', authenticate, async (req, res) => {
  const result = await db.query(
    'SELECT id, name, phone, email, role, created_at FROM users WHERE id = $1',
    [req.user.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
  res.json({ user: result.rows[0] });
});

export default router;
