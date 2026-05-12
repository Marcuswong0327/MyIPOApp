import pg from 'pg';

const { Pool } = pg;

let pool;

export function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw Object.assign(new Error('missing_database_url'), { statusCode: 500 });
    }
    pool = new Pool({ connectionString, max: 10, idleTimeoutMillis: 10_000 });
  }
  return pool;
}
