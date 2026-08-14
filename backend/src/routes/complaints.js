// routes/complaints.js
import express from 'express';
import { body, param } from 'express-validator';
import { upload, getPublicUrl } from '../middleware/upload.js';
import { complaintLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { db } from '../db/index.js';
import { audit } from '../utils/audit.js';

const router = express.Router();

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
