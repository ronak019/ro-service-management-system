// utils/tokens.js
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../db/index.js';

export function signAccessToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_TTL || '15m' }
  );
}

/**
 * Issues a refresh token, stores only its SHA-256 hash in the DB (so a DB
 * leak alone can't be replayed as a live token), and returns the raw token
 * to hand back to the client.
 */
export async function issueRefreshToken(user, { userAgent, ip } = {}) {
  const ttlDays = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 7);
  const raw = jwt.sign(
    { id: user.id, jti: crypto.randomUUID() },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: `${ttlDays}d` }
  );
  const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip)
     VALUES ($1, $2, $3, $4, $5)`,
    [user.id, tokenHash, expiresAt, userAgent || null, ip || null]
  );

  return raw;
}

export function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/** Verifies a refresh token's signature AND that it hasn't been revoked/expired in the DB. */
export async function verifyRefreshToken(raw) {
  const payload = jwt.verify(raw, process.env.JWT_REFRESH_SECRET); // throws if invalid/expired signature
  const tokenHash = hashToken(raw);
  const row = await db.query(
    `SELECT * FROM refresh_tokens
     WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
    [tokenHash]
  );
  if (row.rows.length === 0) {
    const err = new Error('Refresh token revoked or not found');
    err.code = 'REFRESH_REVOKED';
    throw err;
  }
  return { payload, tokenRow: row.rows[0] };
}

export async function revokeRefreshToken(raw) {
  const tokenHash = hashToken(raw);
  await db.query(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`,
    [tokenHash]
  );
}

export async function revokeAllRefreshTokensForUser(userId) {
  await db.query(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
}
