// utils/audit.js
import { db } from '../db/index.js';

/**
 * Fire-and-forget audit log write. Never throws into the caller's request
 * flow — logging failures shouldn't break the actual operation.
 */
export async function audit({ userId = null, action, entityType = null, entityId = null, details = null, ip = null }) {
  try {
    await db.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, ip)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, action, entityType, entityId, details ? JSON.stringify(details) : null, ip]
    );
  } catch (e) {
    console.error('audit log write failed', e.message);
  }
}
