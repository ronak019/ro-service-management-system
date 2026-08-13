// routes/reports.js
import express from 'express';
import { body, param } from 'express-validator';
import { authenticate, requireRole } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { publicReportLimiter } from '../middleware/rateLimit.js';
import { db } from '../db/index.js';
import { audit } from '../utils/audit.js';

const router = express.Router();

// POST /api/reports/jobs/:jobId — technician submits a report for their own job
router.post(
  '/jobs/:jobId',
  authenticate,
  requireRole('technician'),
  upload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'images', maxCount: 10 },
  ]),
  [param('jobId').isInt()],
  validate,
  async (req, res) => {
    const { jobId } = req.params;
    const { textReport } = req.body;
    const userId = req.user.id;

    const techRes = await db.query('SELECT id FROM technicians WHERE user_id = $1', [userId]);
    if (techRes.rows.length === 0) {
      return res.status(404).json({ error: 'Technician profile not found' });
    }
    const technicianId = techRes.rows[0].id;

    // Ownership check — a technician may only report on jobs assigned to them.
    const jobRes = await db.query(
      'SELECT * FROM jobs WHERE id = $1 AND technician_id = $2',
      [jobId, technicianId]
    );
    if (jobRes.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const audioFile = req.files?.audio?.[0];
    const imageFiles = req.files?.images || [];

    if (!textReport?.trim() && !audioFile) {
      return res.status(400).json({ error: 'Provide text report and/or an audio recording' });
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const reportRes = await client.query(
        `INSERT INTO reports (job_id, text_report, audio_url, created_by)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [jobId, textReport?.trim() || null, audioFile?.location || null, userId]
      );
      const report = reportRes.rows[0];

      const imageRows = [];
      for (const file of imageFiles) {
        const r = await client.query(
          'INSERT INTO report_images (report_id, image_url) VALUES ($1, $2) RETURNING *',
          [report.id, file.location]
        );
        imageRows.push(r.rows[0]);
      }

      await client.query('COMMIT');

      await audit({
        userId,
        action: 'report.created',
        entityType: 'report',
        entityId: report.id,
        details: { jobId: Number(jobId), imageCount: imageRows.length, hasAudio: !!audioFile },
        ip: req.ip,
      });

      res.status(201).json({ report, images: imageRows });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error(e);
      res.status(500).json({ error: 'Failed to save report' });
    } finally {
      client.release();
    }
  }
);

// GET /api/reports/public/:token — no auth; customer-facing report view
router.get(
  '/public/:token',
  publicReportLimiter,
  [param('token').isHexadecimal().isLength({ min: 32 })],
  validate,
  async (req, res) => {
    const { token } = req.params;

    const tokenRow = await db.query(
      `SELECT * FROM report_access_tokens
       WHERE token = $1 AND is_revoked = FALSE AND expires_at > NOW()`,
      [token]
    );
    if (tokenRow.rows.length === 0) {
      return res.status(404).json({ error: 'This link is invalid, expired, or has been revoked' });
    }

    const { job_id } = tokenRow.rows[0];

    const jobRes = await db.query(
      `SELECT j.id, j.status, j.scheduled_at,
              c.address, c.city, c.ro_model,
              u.name AS customer_name
       FROM jobs j
       JOIN customers c ON c.id = j.customer_id
       JOIN users u ON u.id = c.user_id
       WHERE j.id = $1`,
      [job_id]
    );
    if (jobRes.rows.length === 0) return res.status(404).json({ error: 'Job not found' });
    const job = jobRes.rows[0];

    const reportRes = await db.query(
      `SELECT id, text_report, audio_url, created_at FROM reports
       WHERE job_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [job_id]
    );
    const report = reportRes.rows[0] || null;

    let images = [];
    if (report) {
      const imgRes = await db.query(
        `SELECT id, image_url FROM report_images WHERE report_id = $1`,
        [report.id]
      );
      images = imgRes.rows;
    }

    res.json({ job, report, images });
  }
);

export default router;
