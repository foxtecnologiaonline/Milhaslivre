import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from './logger';
import { isAppError, ServerError } from './error';
import { createRateLimiter } from './middleware/rateLimit';
import quotationRoutes from './routes/quotations';
import operationRoutes from './routes/operations';
import authRoutes from './routes/auth';

const app = new Hono();

// CORS
app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'https://milhaslivre.vercel.app'],
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
);

// Request logging middleware
app.use('*', async (c, next) => {
  const start = Date.now();
  c.set('startTime', start);
  c.set('requestId', crypto.randomUUID());

  await next();

  const duration = Date.now() - start;
  logger.info(`${c.req.method} ${c.req.path}`, {
    status: c.res.status,
    duration: `${duration}ms`,
    requestId: c.get('requestId'),
  });
});

// Health check
app.get('/health', (c) =>
  c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
);

// Version
app.get('/version', (c) =>
  c.json({
    version: '0.1.0',
    environment: process.env.ENVIRONMENT || 'development',
  })
);

// API Routes with rate limiting
app.use('/api/auth/*', createRateLimiter('auth'));
app.route('/api/auth', authRoutes);

app.use('/api/*', createRateLimiter('api'));
app.route('/api/quotations', quotationRoutes);
app.route('/api/operations', operationRoutes);

// 404 handler
app.notFound((c) => {
  logger.warn(`Not found: ${c.req.method} ${c.req.path}`);
  return c.json(
    {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
    },
    404
  );
});

// Global error handler
app.onError((err, c) => {
  const requestId = c.get('requestId');

  if (isAppError(err)) {
    logger.warn(`App error: ${err.code}`, {
      message: err.message,
      statusCode: err.statusCode,
      requestId,
    });

    return c.json(
      {
        code: err.code,
        message: err.message,
        ...(process.env.ENVIRONMENT === 'development' && { details: err.details }),
      },
      err.statusCode
    );
  }

  // Unknown error
  logger.error(`Unhandled error`, err, { requestId });

  return c.json(
    {
      code: 'SERVER_ERROR',
      message: 'Internal server error',
      ...(process.env.ENVIRONMENT === 'development' && {
        details: err instanceof Error ? err.message : String(err),
      }),
    },
    500
  );
});

export default app;
