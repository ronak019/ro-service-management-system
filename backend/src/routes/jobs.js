// routes/jobs.js
import express from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { body, param } from 'express-validator';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { db } from '../db/index.js';
import { audit } from '../utils/audit.js';

const router = express.Router();

// Resolve the technicians.id row for the logged-in technician user.
async function getTechnicianId(userId) {
  const techRes = await db.query('SELECT id FROM technicians WHERE user_id = $1', [userId]);
  return techRes.rows[0]?.id || null;
}

/**
 * POST /api/jobs/quick
 * For customers who contacted the technician directly instead of going
 * through admin scheduling. Creates a minimal customer account (reusing one
 * if the phone number is already known) plus a job in one step, so the
 * technician can immediately attach photos/audio/text via the normal report
 * flow (POST /api/reports/jobs/:jobId) right after.
 */
router.post(
  '/quick',
  authenticate,
  requireRole('technician'),
  [
    body('customerName').trim().isLength({ min: 2, max: 120 }),
    body('customerPhone').trim().isMobilePhone('any'),
    body('address').optional({ values: 'falsy' }).trim(),
    body('notes').optional({ values: 'falsy' }).trim(),
  ],
  validate,
  async (req, res) => {
    const { customerName, customerPhone, address, notes } = req.body;
    const technicianId = await getTechnicianId(req.user.id);
    if (!technicianId) return res.status(404).json({ error: 'Technician profile not found' });

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Reuse an existing customer account by phone; otherwise create a
      // lightweight one (random password — this customer never needs to log
      // in, they only ever access their report via the public link).
      let customerId;
      const existing = await client.query(
        `SELECT c.id FROM customers c JOIN users u ON u.id = c.user_id WHERE u.phone = $1`,
        [customerPhone]
      );
      if (existing.rows.length > 0) {
        customerId = existing.rows[0].id;
      } else {
        const randomPassword = crypto.randomBytes(12).toString('hex');
        const hash = await bcrypt.hash(randomPassword, 12);
        const userRes = await client.query(
          `INSERT INTO users (name, phone, role, password_hash) VALUES ($1, $2, 'customer', $3) RETURNING id`,
          [customerName, customerPhone, hash]
        );
        const custRes = await client.query(
          `INSERT INTO customers (user_id, address) VALUES ($1, $2) RETURNING id`,
          [userRes.rows[0].id, address || null]
        );
        customerId = custRes.rows[0].id;
      }

      const jobRes = await client.query(
        `INSERT INTO jobs (customer_id, technician_id, scheduled_at, status, notes, created_by)
         VALUES ($1, $2, NOW(), 'in_progress', $3, $4) RETURNING *`,
        [customerId, technicianId, notes || 'Direct customer contact', req.user.id]
      );

      await client.query('COMMIT');

      await audit({
        userId: req.user.id,
        action: 'job.quick_created',
        entityType: 'job',
        entityId: jobRes.rows[0].id,
        details: { customerPhone },
        ip: req.ip,
      });

      res.status(201).json({ job: jobRes.rows[0] });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error(e);
      res.status(500).json({ error: 'Could not create job' });
    } finally {
      client.release();
    }
  }
);

// GET /api/jobs — technician's own jobs only
router.get('/', authenticate, requireRole('technician'), async (req, res) => {
  const technicianId = await getTechnicianId(req.user.id);
  if (!technicianId) return res.status(404).json({ error: 'Technician profile not found' });

  const jobsRes = await db.query(
    `SELECT j.id, j.status, j.scheduled_at, j.notes, j.created_at,
            c.id AS customer_id, c.address, c.city, c.ro_model,
            u.name AS customer_name, u.phone AS customer_phone
     FROM jobs j
     JOIN customers c ON c.id = j.customer_id
     JOIN users u ON u.id = c.user_id
     WHERE j.technician_id = $1
     ORDER BY j.scheduled_at DESC`,
    [technicianId]
  );

  res.json({ jobs: jobsRes.rows });
});

// GET /api/jobs/:id — single job detail, technician must own it
router.get(
  '/:id',
  authenticate,
  requireRole('technician'),
  [param('id').isInt()],
  validate,
  async (req, res) => {
    const technicianId = await getTechnicianId(req.user.id);
    if (!technicianId) return res.status(404).json({ error: 'Technician profile not found' });

    const jobRes = await db.query(
      `SELECT j.*, c.address, c.city, c.ro_model, u.name AS customer_name, u.phone AS customer_phone
       FROM jobs j
       JOIN customers c ON c.id = j.customer_id
       JOIN users u ON u.id = c.user_id
       WHERE j.id = $1 AND j.technician_id = $2`,
      [req.params.id, technicianId]
    );
    if (jobRes.rows.length === 0) return res.status(404).json({ error: 'Job not found' });

    const reportsRes = await db.query(
      `SELECT * FROM reports WHERE job_id = $1 ORDER BY created_at DESC`,
      [req.params.id]
    );

    // Every complaint on this job — whether the customer submitted it via
    // their link, or a technician logged it on the customer's behalf —
    // so the assigned technician has full context, not just their own reports.
    const complaintsRes = await db.query(
      `SELECT co.*, COALESCE(json_agg(ci.image_url) FILTER (WHERE ci.id IS NOT NULL), '[]') AS image_urls
       FROM complaints co
       LEFT JOIN complaint_images ci ON ci.complaint_id = co.id
       WHERE co.job_id = $1
       GROUP BY co.id
       ORDER BY co.created_at DESC`,
      [req.params.id]
    );

    res.json({ job: jobRes.rows[0], reports: reportsRes.rows, complaints: complaintsRes.rows });
  }
);

// PUT /api/jobs/:id/status — start / complete / cancel, own jobs only
router.put(
  '/:id/status',
  authenticate,
  requireRole('technician'),
  [param('id').isInt(), body('status').isIn(['pending', 'in_progress', 'completed', 'cancelled'])],
  validate,
  async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const technicianId = await getTechnicianId(req.user.id);
    if (!technicianId) return res.status(404).json({ error: 'Technician profile not found' });

    const result = await db.query(
      `UPDATE jobs SET status = $1, updated_at = NOW()
       WHERE id = $2 AND technician_id = $3 RETURNING *`,
      [status, id, technicianId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    await audit({
      userId: req.user.id,
      action: 'job.status_changed',
      entityType: 'job',
      entityId: Number(id),
      details: { status },
      ip: req.ip,
    });

    res.json({ job: result.rows[0] });
  }
);

export default router;
