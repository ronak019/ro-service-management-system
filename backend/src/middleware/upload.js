// middleware/upload.js
import multer from 'multer';
import multerS3 from 'multer-s3';
import { S3Client } from '@aws-sdk/client-s3';
import { randomBytes } from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

export const s3 = new S3Client({
  region: process.env.AWS_REGION,
  endpoint: process.env.AWS_S3_ENDPOINT || undefined, // set for Cloudflare R2, unset for AWS S3
  forcePathStyle: !!process.env.AWS_S3_ENDPOINT, // R2 needs path-style addressing
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_AUDIO_MIMES = [
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/ogg',
  'audio/webm',
  'audio/mpeg',
  'audio/wav',
];
const ALLOWED_MIMES = new Set([...ALLOWED_IMAGE_MIMES, ...ALLOWED_AUDIO_MIMES]);

// Extension is taken from the detected mimetype, never trusted from the
// client filename, to avoid path traversal / double-extension tricks
// (e.g. "photo.jpg.exe" or "../../evil").
const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/ogg': 'ogg',
  'audio/webm': 'webm',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
};

function keyFor(folder, mimetype) {
  const ext = EXT_BY_MIME[mimetype] || 'bin';
  const rand = randomBytes(16).toString('hex');
  return `${folder}/${Date.now()}-${rand}.${ext}`;
}

export const upload = multer({
  storage: multerS3({
    s3,
    bucket: process.env.AWS_BUCKET,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const folder = ALLOWED_IMAGE_MIMES.includes(file.mimetype) ? 'images' : 'audio';
      cb(null, keyFor(folder, file.mimetype));
    },
  }),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB — covers a few minutes of compressed audio + full-res photos
    files: 12,
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

export { ALLOWED_IMAGE_MIMES, ALLOWED_AUDIO_MIMES };
