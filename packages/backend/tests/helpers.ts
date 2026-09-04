// Wraps a route sub-app with the same error-formatting behavior registered on
// the main app (src/index.ts), so integration tests see the real status codes
// (401/404/409/...) instead of Hono's generic 500 fallback for unhandled sub-app errors.
import { Hono } from 'hono';
import { isAppError } from '../src/error';

export function withErrorHandling(subApp: Hono<any>) {
  const app = new Hono();
  app.route('/', subApp);

  app.onError((err, c) => {
    if (isAppError(err)) {
      return c.json(
        { code: err.code, message: err.message, details: err.details },
        err.statusCode as 400 | 401 | 403 | 404 | 409 | 429 | 500
      );
    }
    return c.json({ code: 'SERVER_ERROR', message: 'Internal server error' }, 500);
  });

  return app;
}
