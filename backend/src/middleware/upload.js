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
const ALLOWED_VIDEO_MIMES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/3gpp'];
const ALLOWED_MIMES = new Set([...ALLOWED_IMAGE_MIMES, ...ALLOWED_AUDIO_MIMES, ...ALLOWED_VIDEO_MIMES]);

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
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/3gpp': '3gp',
};

function folderFor(mimetype) {
  if (ALLOWED_IMAGE_MIMES.includes(mimetype)) return 'images';
  if (ALLOWED_VIDEO_MIMES.includes(mimetype)) return 'videos';
  return 'audio';
}

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
      cb(null, keyFor(folderFor(file.mimetype), file.mimetype));
    },
  }),
  limits: {
    fileSize: 60 * 1024 * 1024, // 60MB — covers a short phone-recorded video clip
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

export { ALLOWED_IMAGE_MIMES, ALLOWED_AUDIO_MIMES, ALLOWED_VIDEO_MIMES };

/**
 * Returns the browser-viewable URL for an uploaded file.
 *
 * On real AWS S3, `file.location` (built by multer-s3) is already a public,
 * directly-fetchable URL when the bucket allows public reads.
 *
 * Some S3-compatible providers (e.g. Supabase Storage) expose a *different*
 * URL for public/anonymous reads than the S3 API endpoint itself — the S3
 * endpoint requires a signed request, while public objects are served from
 * a separate REST path. For those, set PUBLIC_ASSET_BASE_URL to that
 * provider's public base (e.g. Supabase:
 * `https://<project-ref>.supabase.co/storage/v1/object/public/<bucket>`)
 * and this function will build the correct link from the object key.
 */
export function getPublicUrl(file) {
  if (process.env.PUBLIC_ASSET_BASE_URL) {
    return `${process.env.PUBLIC_ASSET_BASE_URL.replace(/\/$/, '')}/${file.key}`;
  }
  return file.location;
}
