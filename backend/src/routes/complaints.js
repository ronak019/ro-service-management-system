// routes/complaints.js
import express from 'express';
import { body, param } from 'express-validator';
import { authenticate, requireRole } from '../middleware/auth.js';
import { upload, getPublicUrl } from '../middleware/upload.js';
import { complaintLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { db } from '../db/index.js';
import { audit } from '../utils/audit.js';

const router = express.Router();

/**
 * POST /api/complaints/technician/:jobId
 * Authenticated technician logs a complaint on the customer's behalf — for
 * the common case where the customer calls the technician directly instead
 * of using their report link. Same storage shape as the public complaint
 * endpoint, just a different, authenticated entry point with an ownership
 * check instead of a token.
 */
router.post(
  '/technician/:jobId',
  authenticate,
  requireRole('technician'),
  upload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'images', maxCount: 5 },
  ]),
  [
    param('jobId').isInt(),
    body('message').optional({ values: 'falsy' }).trim().isLength({ max: 5000 }),
  ],
  validate,
  async (req, res) => {
    const { jobId } = req.params;
    const { message } = req.body;

    const techRes = await db.query(
      `SELECT t.id, u.name FROM technicians t JOIN users u ON u.id = t.user_id WHERE t.user_id = $1`,
      [req.user.id]
    );
    if (techRes.rows.length === 0) return res.status(404).json({ error: 'Technician profile not found' });
    const technicianId = techRes.rows[0].id;
    const technicianName = techRes.rows[0].name;

    const jobCheck = await db.query(
      'SELECT id FROM jobs WHERE id = $1 AND technician_id = $2',
      [jobId, technicianId]
    );
    if (jobCheck.rows.length === 0) return res.status(404).json({ error: 'Job not found' });

    const audioFile = req.files?.audio?.[0];
    const imageFiles = req.files?.images || [];

    if (!message?.trim() && !audioFile && imageFiles.length === 0) {
      return res.status(400).json({ error: 'Provide a message, photo, and/or audio recording' });
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO complaints (job_id, customer_message, audio_url, status, source, logged_by_name)
         VALUES ($1, $2, $3, 'open', 'technician', $4) RETURNING *`,
        [jobId, message?.trim() || null, audioFile ? getPublicUrl(audioFile) : null, technicianName]
      );
      const complaint = result.rows[0];

      const imageRows = [];
      for (const file of imageFiles) {
        const r = await client.query(
          'INSERT INTO complaint_images (complaint_id, image_url) VALUES ($1, $2) RETURNING *',
          [complaint.id, getPublicUrl(file)]
        );
        imageRows.push(r.rows[0]);
      }

      await client.query('COMMIT');

      await audit({
        userId: req.user.id,
        action: 'complaint.created_by_technician',
        entityType: 'complaint',
        entityId: complaint.id,
        details: { jobId },
        ip: req.ip,
      });

      res.status(201).json({ complaint, images: imageRows });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error(e);
      res.status(500).json({ error: 'Failed to save complaint' });
    } finally {
      client.release();
    }
  }
);

/**
 * POST /api/complaints/:token
 * Public (no login) — called from the customer report page.
 *
 * SECURITY: job_id is resolved server-side from the same access token used
 * to view the report, never taken directly from the client. The original
 * draft accepted a raw job_id in the body, which would let anyone submit a
 * complaint against an arbitrary job by incrementing an integer.
 */
router.post(
  '/:token',
  complaintLimiter,
  upload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'images', maxCount: 5 },
    { name: 'video', maxCount: 1 },
  ]),
  [
    param('token').isHexadecimal().isLength({ min: 32 }),
    body('message').optional({ values: 'falsy' }).trim().isLength({ max: 5000 }),
  ],
  validate,
  async (req, res) => {
    const { token } = req.params;
    const { message } = req.body;

    const tokenRow = await db.query(
      `SELECT job_id FROM report_access_tokens
       WHERE token = $1 AND is_revoked = FALSE AND expires_at > NOW()`,
      [token]
    );
    if (tokenRow.rows.length === 0) {
      return res.status(404).json({ error: 'This link is invalid, expired, or has been revoked' });
    }
    const jobId = tokenRow.rows[0].job_id;

    const audioFile = req.files?.audio?.[0];
    const videoFile = req.files?.video?.[0];
    const imageFiles = req.files?.images || [];

    if (!message?.trim() && !audioFile && !videoFile && imageFiles.length === 0) {
      return res.status(400).json({ error: 'Provide a message, photo, video, and/or audio recording' });
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO complaints (job_id, customer_message, audio_url, video_url, status)
         VALUES ($1, $2, $3, $4, 'open') RETURNING *`,
        [
          jobId,
          message?.trim() || null,
          audioFile ? getPublicUrl(audioFile) : null,
          videoFile ? getPublicUrl(videoFile) : null,
        ]
      );
      const complaint = result.rows[0];

      const imageRows = [];
      for (const file of imageFiles) {
        const r = await client.query(
          'INSERT INTO complaint_images (complaint_id, image_url) VALUES ($1, $2) RETURNING *',
          [complaint.id, getPublicUrl(file)]
        );
        imageRows.push(r.rows[0]);
      }

      await client.query('COMMIT');

      await audit({
        action: 'complaint.created',
        entityType: 'complaint',
        entityId: complaint.id,
        details: { jobId, imageCount: imageRows.length, hasVideo: !!videoFile },
        ip: req.ip,
      });

      res.status(201).json({ complaint, images: imageRows });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error(e);
      res.status(500).json({ error: 'Failed to save complaint' });
    } finally {
      client.release();
    }
  }
);

export default router;
