// server.js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';
import jobsRoutes from './routes/jobs.js';
import reportRoutes from './routes/reports.js';
import complaintRoutes from './routes/complaints.js';
import adminRoutes from './routes/admin.js';
import pushRoutes from './routes/push.js';
import { generalLimiter } from './middleware/rateLimit.js';

dotenv.config();
const app = express();

// Behind a reverse proxy (nginx/ALB/etc) in production — needed for req.ip
// and rate-limiting to see the real client IP instead of the proxy's.
app.set('trust proxy', 1);

app.use(helmet());

// Lock CORS to an explicit allowlist. The original app.use(cors()) accepted
// every origin, which defeats CORS for the authenticated admin/technician APIs.
const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(
  cors({
    origin(origin, callback) {
      // Allow no-origin requests (server-to-server, curl, mobile apps) and any listed origin.
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '2mb' })); // file uploads go through multipart, not JSON — keep this small
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(generalLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/push', pushRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Multer/file-filter errors land here (e.g. bad file type, too large) — without
// this handler they'd surface as an unhandled 500 with a stack trace.
app.use((err, req, res, next) => {
  if (err && err.message?.includes('Unsupported file type')) {
    return res.status(400).json({ error: err.message });
  }
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large' });
  }
  if (err?.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`RO service backend listening on port ${PORT}`);
});
