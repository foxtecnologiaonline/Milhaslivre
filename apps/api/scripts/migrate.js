#!/usr/bin/env node
// Idempotent SQL migration runner.
//
// Migrations live under apps/api/migrations/<NN-module>/<NNN_description>.sql,
// applied in lexical order across all module directories combined — the
// leading NN- prefix on each module directory (01-identity, 02-seller, ...)
// keeps that order aligned with the backlog/dependency order (e.g. catalog's
// offers table has a FK into seller, so seller must migrate first). Applied
// migrations are tracked in public.schema_migrations so re-running this
// script is a no-op for files already applied.
'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

async function findMigrationFiles() {
  const modules = await fs.promises.readdir(MIGRATIONS_DIR, { withFileTypes: true });
  const files = [];

  for (const entry of modules) {
    if (!entry.isDirectory()) continue;
    const moduleDir = path.join(MIGRATIONS_DIR, entry.name);
    const sqlFiles = (await fs.promises.readdir(moduleDir)).filter((f) => f.endsWith('.sql'));
    for (const file of sqlFiles) {
      files.push({
        id: `${entry.name}/${file}`,
        fullPath: path.join(moduleDir, file),
      });
    }
  }

  files.sort((a, b) => a.id.localeCompare(b.id));
  return files;
}

async function migrate() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    const files = await findMigrationFiles();
    const { rows } = await pool.query('SELECT id FROM public.schema_migrations');
    const applied = new Set(rows.map((r) => r.id));

    let appliedCount = 0;
    for (const file of files) {
      if (applied.has(file.id)) continue;

      const sql = await fs.promises.readFile(file.fullPath, 'utf8');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO public.schema_migrations (id) VALUES ($1)', [file.id]);
        await client.query('COMMIT');
        console.log(`applied: ${file.id}`);
        appliedCount += 1;
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`migration failed (${file.id}): ${err.message}`);
      } finally {
        client.release();
      }
    }

    console.log(
      appliedCount === 0
        ? 'no pending migrations'
        : `${appliedCount} migration(s) applied`,
    );
  } finally {
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
