// scripts/create-admin.js
// Run once after migrations to create the very first admin account, since
// the /auth/register API now requires an existing admin to call it.
//
// Usage: node scripts/create-admin.js
// Reads BOOTSTRAP_ADMIN_PHONE / BOOTSTRAP_ADMIN_PASSWORD from .env

import 'dotenv/config';
import bcrypt from 'bcrypt';
import { db } from '../src/db/index.js';

async function main() {
  const phone = process.env.BOOTSTRAP_ADMIN_PHONE;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!phone || !password) {
    console.error('Set BOOTSTRAP_ADMIN_PHONE and BOOTSTRAP_ADMIN_PASSWORD in .env first.');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters.');
    process.exit(1);
  }

  const existing = await db.query('SELECT id FROM users WHERE role = $1 LIMIT 1', ['admin']);
  if (existing.rows.length > 0) {
    console.log('An admin already exists. Not creating another one.');
    process.exit(0);
  }

  const hash = await bcrypt.hash(password, 12);
  const result = await db.query(
    `INSERT INTO users (name, phone, role, password_hash) VALUES ($1, $2, 'admin', $3) RETURNING id, phone`,
    ['Super Admin', phone, hash]
  );

  console.log('Admin created:', result.rows[0]);
  console.log('IMPORTANT: change this password after first login.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
