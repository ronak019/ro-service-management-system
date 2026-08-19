// routes/push.js
import express from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { db } from '../db/index.js';

const router = express.Router();

// Any logged-in user (technician today, could extend to admin/customer later)
// registers their browser's push subscription here.
router.post(
  '/subscribe',
  authenticate,
  [
    body('endpoint').isString().notEmpty(),
    body('keys.p256dh').isString().notEmpty(),
    body('keys.auth').isString().notEmpty(),
  ],
  validate,
  async (req, res) => {
    const { endpoint, keys } = req.body;
    await db.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) DO UPDATE SET user_id = $1, p256dh = $3, auth = $4`,
      [req.user.id, endpoint, keys.p256dh, keys.auth]
    );
    res.json({ ok: true });
  }
);

router.post('/unsubscribe', authenticate, [body('endpoint').isString().notEmpty()], validate, async (req, res) => {
  await db.query('DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2', [
    req.body.endpoint,
    req.user.id,
  ]);
  res.json({ ok: true });
});

// Public key the frontend needs to create a subscription — safe to expose.
router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
});

export default router;
