// db/index.js
import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pkg;

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Keep pool modest by default; tune for your traffic.
  max: 10,
  idleTimeoutMillis: 30000,
});

db.on('error', (err) => {
  // Idle client errors should not crash the process.
  console.error('Unexpected PG pool error', err);
});
