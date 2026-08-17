// routes/admin.js
// All routes here require an authenticated admin.
import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { body, param, query } from 'express-validator';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { db } from '../db/index.js';
import { audit } from '../utils/audit.js';
import { revokeAllRefreshTokensForUser } from '../utils/tokens.js';

const router = express.Router();
router.use(authenticate, requireRole('admin'));

// ---------- Users ----------

router.get('/users', [query('role').optional().isIn(['admin', 'technician', 'customer'])], validate, async (req, res) => {
  const { role } = req.query;
  const result = await db.query(
    `SELECT id, name, phone, email, role, is_active, created_at FROM users
     WHERE ($1::text IS NULL OR role = $1)
     ORDER BY created_at DESC`,
    [role || null]
  );
  res.json({ users: result.rows });
});

// Disable/enable instead of deleting — preserves job/report history integrity.
router.put(
  '/users/:id/active',
  [param('id').isInt(), body('isActive').isBoolean()],
  validate,
  async (req, res) => {
    const { id } = req.params;
    const { isActive } = req.body;
    const result = await db.query(
      'UPDATE users SET is_active = $1 WHERE id = $2 RETURNING id, name, role, is_active',
      [isActive, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    if (!isActive) await revokeAllRefreshTokensForUser(id); // force logout everywhere

    await audit({
      userId: req.user.id,
      action: isActive ? 'user.enabled' : 'user.disabled',
      entityType: 'user',
      entityId: Number(id),
      ip: req.ip,
    });

    res.json({ user: result.rows[0] });
  }
);

// Edit a user's own account fields (not role — role changes aren't supported to
// avoid orphaning their technician/customer profile row).
router.put(
  '/users/:id',
  [
    param('id').isInt(),
    body('name').optional().trim().isLength({ min: 2, max: 120 }),
    body('phone').optional({ values: 'falsy' }).trim().isMobilePhone('any'),
    body('email').optional({ values: 'falsy' }).trim().isEmail(),
  ],
  validate,
  async (req, res) => {
    const { id } = req.params;
    const { name, phone, email } = req.body;
    try {
      const result = await db.query(
        `UPDATE users SET
           name = COALESCE($1, name),
           phone = COALESCE($2, phone),
           email = COALESCE($3, email)
         WHERE id = $4 RETURNING id, name, phone, email, role, is_active`,
        [name || null, phone || null, email || null, id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

      await audit({
        userId: req.user.id,
        action: 'user.updated',
        entityType: 'user',
        entityId: Number(id),
        ip: req.ip,
      });

      res.json({ user: result.rows[0] });
    } catch (e) {
      if (e.code === '23505') return res.status(409).json({ error: 'Phone or email already in use' });
      console.error(e);
      res.status(400).json({ error: 'Update failed' });
    }
  }
);

// Admin sets a new password for a user directly (e.g. they forgot theirs).
// Revokes all existing sessions for that user so old refresh tokens can't
// keep working under the old password.
router.post(
  '/users/:id/reset-password',
  [param('id').isInt(), body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')],
  validate,
  async (req, res) => {
    const { id } = req.params;
    const { password } = req.body;
    const hash = await bcrypt.hash(password, 12);

    const result = await db.query(
      `UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id, name`,
      [hash, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    await revokeAllRefreshTokensForUser(id);
    await audit({
      userId: req.user.id,
      action: 'user.password_reset',
      entityType: 'user',
      entityId: Number(id),
      ip: req.ip,
    });

    res.json({ ok: true });
  }
);

// Customer profile fields (address, RO model etc.) — separate from account creation.
router.put(
  '/customers/:id',
  [
    param('id').isInt(),
    body('address').optional().trim(),
    body('city').optional().trim(),
    body('pincode').optional().trim(),
    body('roModel').optional().trim(),
    body('installationDate').optional().isISO8601(),
  ],
  validate,
  async (req, res) => {
    const { id } = req.params;
    const { address, city, pincode, roModel, installationDate } = req.body;
    const result = await db.query(
      `UPDATE customers SET
         address = COALESCE($1, address),
         city = COALESCE($2, city),
         pincode = COALESCE($3, pincode),
         ro_model = COALESCE($4, ro_model),
         installation_date = COALESCE($5, installation_date)
       WHERE id = $6 RETURNING *`,
      [address, city, pincode, roModel, installationDate, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
    res.json({ customer: result.rows[0] });
  }
);

router.get('/technicians', async (req, res) => {
  const result = await db.query(
    `SELECT t.id, t.area, t.is_active, u.name, u.phone, u.email
     FROM technicians t JOIN users u ON u.id = t.user_id
     ORDER BY u.name`
  );
  res.json({ technicians: result.rows });
});

router.get('/customers', async (req, res) => {
  const result = await db.query(
    `SELECT c.id, c.address, c.city, c.pincode, c.ro_model, u.name, u.phone, u.email
     FROM customers c JOIN users u ON u.id = c.user_id
     ORDER BY u.name`
  );
  res.json({ customers: result.rows });
});

// ---------- Jobs ----------

router.post(
  '/jobs',
  [
    body('customerId').isInt(),
    body('technicianId').isInt(),
    body('scheduledAt').isISO8601(),
    body('notes').optional().trim(),
  ],
  validate,
  async (req, res) => {
    const { customerId, technicianId, scheduledAt, notes } = req.body;
    try {
      const result = await db.query(
        `INSERT INTO jobs (customer_id, technician_id, scheduled_at, notes, created_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [customerId, technicianId, scheduledAt, notes || null, req.user.id]
      );
      await audit({
        userId: req.user.id,
        action: 'job.created',
        entityType: 'job',
        entityId: result.rows[0].id,
        details: { customerId, technicianId },
        ip: req.ip,
      });
      res.status(201).json({ job: result.rows[0] });
    } catch (e) {
      res.status(400).json({ error: 'Could not create job — check customerId/technicianId' });
    }
  }
);

// Reassign a job to a different technician.
router.put(
  '/jobs/:id/assign',
  [param('id').isInt(), body('technicianId').isInt()],
  validate,
  async (req, res) => {
    const { id } = req.params;
    const { technicianId } = req.body;
    const result = await db.query(
      `UPDATE jobs SET technician_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [technicianId, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Job not found' });

    await audit({
      userId: req.user.id,
      action: 'job.reassigned',
      entityType: 'job',
      entityId: Number(id),
      details: { technicianId },
      ip: req.ip,
    });

    res.json({ job: result.rows[0] });
  }
);

router.get('/jobs', [query('status').optional().isIn(['pending', 'in_progress', 'completed', 'cancelled'])], validate, async (req, res) => {
  const { status } = req.query;
  const result = await db.query(
    `SELECT j.*, cu.name AS customer_name, tu.name AS technician_name
     FROM jobs j
     JOIN customers c ON c.id = j.customer_id JOIN users cu ON cu.id = c.user_id
     JOIN technicians t ON t.id = j.technician_id JOIN users tu ON tu.id = t.user_id
     WHERE ($1::text IS NULL OR j.status = $1)
     ORDER BY j.scheduled_at DESC`,
    [status || null]
  );
  res.json({ jobs: result.rows });
});

// ---------- Reports & complaints (read-only oversight) ----------

router.get('/reports', async (req, res) => {
  const result = await db.query(
    `SELECT r.*, j.status AS job_status, cu.name AS customer_name, tu.name AS technician_name
     FROM reports r
     JOIN jobs j ON j.id = r.job_id
     JOIN customers c ON c.id = j.customer_id JOIN users cu ON cu.id = c.user_id
     JOIN technicians t ON t.id = j.technician_id JOIN users tu ON tu.id = t.user_id
     ORDER BY r.created_at DESC LIMIT 200`
  );
  res.json({ reports: result.rows });
});

router.get('/complaints', [query('status').optional().isIn(['open', 'in_progress', 'resolved'])], validate, async (req, res) => {
  const { status } = req.query;
  const result = await db.query(
    `SELECT co.*, cu.name AS customer_name, cu.phone AS customer_phone,
            COALESCE(
              json_agg(ci.image_url) FILTER (WHERE ci.id IS NOT NULL), '[]'
            ) AS image_urls
     FROM complaints co
     JOIN jobs j ON j.id = co.job_id
     JOIN customers c ON c.id = j.customer_id JOIN users cu ON cu.id = c.user_id
     LEFT JOIN complaint_images ci ON ci.complaint_id = co.id
     WHERE ($1::text IS NULL OR co.status = $1)
     GROUP BY co.id, cu.name, cu.phone
     ORDER BY co.created_at DESC LIMIT 200`,
    [status || null]
  );
  res.json({ complaints: result.rows });
});

router.put(
  '/complaints/:id/status',
  [param('id').isInt(), body('status').isIn(['open', 'in_progress', 'resolved'])],
  validate,
  async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const result = await db.query(
      `UPDATE complaints SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Complaint not found' });

    await audit({
      userId: req.user.id,
      action: 'complaint.status_changed',
      entityType: 'complaint',
      entityId: Number(id),
      details: { status },
      ip: req.ip,
    });

    res.json({ complaint: result.rows[0] });
  }
);

// ---------- Public report links ----------

// Creates or rotates the single active link for a job (UNIQUE(job_id) enforces "one at a time").
router.post(
  '/jobs/:jobId/report-link',
  [param('jobId').isInt(), body('expiresInDays').optional().isInt({ min: 1, max: 365 })],
  validate,
  async (req, res) => {
    const { jobId } = req.params;
    const expiresInDays = req.body.expiresInDays || 30;
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    const jobCheck = await db.query('SELECT id FROM jobs WHERE id = $1', [jobId]);
    if (jobCheck.rows.length === 0) return res.status(404).json({ error: 'Job not found' });

    await db.query(
      `INSERT INTO report_access_tokens (job_id, token, expires_at, is_revoked)
       VALUES ($1, $2, $3, FALSE)
       ON CONFLICT (job_id) DO UPDATE SET token = $2, expires_at = $3, is_revoked = FALSE`,
      [jobId, token, expiresAt]
    );

    await audit({
      userId: req.user.id,
      action: 'report_link.generated',
      entityType: 'job',
      entityId: Number(jobId),
      details: { expiresAt },
      ip: req.ip,
    });

    const link = `${process.env.FRONTEND_URL}/report/${token}`;
    res.json({ link, token, expiresAt });
  }
);

router.post('/jobs/:jobId/report-link/revoke', [param('jobId').isInt()], validate, async (req, res) => {
  const { jobId } = req.params;
  const result = await db.query(
    `UPDATE report_access_tokens SET is_revoked = TRUE WHERE job_id = $1 RETURNING *`,
    [jobId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'No link found for this job' });

  await audit({
    userId: req.user.id,
    action: 'report_link.revoked',
    entityType: 'job',
    entityId: Number(jobId),
    ip: req.ip,
  });

  res.json({ ok: true });
});

export default router;
