// routes/jobs.js
import express from 'express';
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

    res.json({ job: jobRes.rows[0], reports: reportsRes.rows });
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
