import postgres from 'postgres';

if (!process.env.DATABASE_URL) {
  console.warn('DATABASE_URL não configurada.');
}

const sql = postgres(process.env.DATABASE_URL || '', {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

export default sql;
