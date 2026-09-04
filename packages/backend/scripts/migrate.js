// Runs SQL migration files against DATABASE_URL, tracking applied migrations
// so re-running is idempotent.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, '..', 'migrations');

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL not configured');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: dbUrl });

async function main() {
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    const applied = new Set(
      (await client.query('SELECT filename FROM schema_migrations')).rows.map(
        (r) => r.filename
      )
    );

    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    let ranCount = 0;

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`⏭  Skipping already applied: ${file}`);
        continue;
      }

      const sql = readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log(`▶  Running migration: ${file}`);

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        ranCount++;
        console.log(`✅ Applied: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌ Failed to apply ${file}:`, err.message);
        throw err;
      }
    }

    if (ranCount === 0) {
      console.log('✅ Database already up to date');
    } else {
      console.log(`✅ Applied ${ranCount} migration(s)`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
