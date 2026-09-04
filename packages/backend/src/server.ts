import { serve } from '@hono/node-server';
import app from './index';
import { getConfig } from './config';
import { logger } from './logger';
import { closePool } from './db';
import { closeRedis } from './redis';

const config = getConfig();
const port = Number(process.env.PORT) || 3000;

const server = serve({ fetch: app.fetch, port }, (info) => {
  logger.info(`Milhas Livre backend listening on http://localhost:${info.port}`, {
    environment: config.ENVIRONMENT,
  });
});

async function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully`);
  server.close(async () => {
    await closePool();
    await closeRedis();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
