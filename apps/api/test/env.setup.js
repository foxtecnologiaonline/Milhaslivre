// Default env vars for tests so ConfigModule's Zod validation passes without
// requiring a real .env file or live Postgres (pg.Pool connects lazily).
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret-not-for-production';
