import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { logger } from './logger';
import { ServerError } from './error';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL not configured');
    }

    pool = new Pool({
      connectionString: dbUrl,
      max: 20,
      min: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 3000,
      statement_timeout: 30000,
    });

    pool.on('error', (err: Error) => {
      logger.error('Unexpected pool error', err);
    });

    pool.on('connect', () => {
      logger.debug('Database connection established');
    });
  }

  return pool;
}

export async function query<T extends QueryResultRow = any>(
  text: string,
  values?: any[]
): Promise<QueryResult<T>> {
  try {
    logger.debug('Executing query', { query: text.slice(0, 100), valuesCount: values?.length });
    const result = await getPool().query<T>(text, values);
    return result;
  } catch (err) {
    logger.error('Query failed', err, { query: text.slice(0, 100) });
    throw new ServerError('Database query failed');
  }
}

export async function getOne<T extends QueryResultRow = any>(
  text: string,
  values?: any[]
): Promise<T | null> {
  const result = await query<T>(text, values);
  return result.rows[0] || null;
}

export async function getMany<T extends QueryResultRow = any>(
  text: string,
  values?: any[]
): Promise<T[]> {
  const result = await query<T>(text, values);
  return result.rows;
}

export async function run(
  text: string,
  values?: any[]
): Promise<void> {
  await query(text, values);
}

export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Transaction failed', err);
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database pool closed');
  }
}
