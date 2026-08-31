import { Hono } from 'hono';
import { cors } from 'hono/cors';
import quotationRoutes from './routes/quotations';
import operationRoutes from './routes/operations';
import authRoutes from './routes/auth';

const app = new Hono();

// Middleware
app.use('*', cors({
  origin: ['http://localhost:5173', 'https://milhaslivre.vercel.app'],
  credentials: true,
}));

app.use('*', async (c, next) => {
  c.set('startTime', Date.now());
  await next();
});

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date() }));

// Routes
app.route('/api/auth', authRoutes);
app.route('/api/quotations', quotationRoutes);
app.route('/api/operations', operationRoutes);

// 404
app.notFound((c) => c.json({ error: 'Not found' }, 404));

// Error handler
app.onError((err, c) => {
  console.error(err);
  return c.json(
    { error: err.message || 'Internal server error' },
    500
  );
});

export default app;
