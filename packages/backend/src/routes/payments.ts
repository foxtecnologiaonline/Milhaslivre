import { Hono } from 'hono';
import { getOne, run } from '../db';
import { extractToken } from '../auth';
import { logger } from '../logger';
import { createCommissionCheckout, constructWebhookEvent } from '../services/payment';
import { sendPaymentReceiptEmail } from '../services/email';
import { notifyOperationCompleted } from '../services/twilio';
import { AuthenticationError, NotFoundError, ConflictError, isAppError } from '../error';

const app = new Hono();

const APP_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// POST /api/payments/:operationId/checkout - create a Stripe checkout session for the buyer
app.post('/:operationId/checkout', async (c) => {
  try {
    const token = await extractToken(c);
    if (!token) throw new AuthenticationError();

    const { operationId } = c.req.param();

    const operation = await getOne<{
      id: string;
      status: string;
      total_price: number;
      program: string;
      buyer_id: string | null;
    }>(`SELECT * FROM operations WHERE id = $1 AND deleted_at IS NULL`, [operationId]);

    if (!operation) throw new NotFoundError('Operation');
    if (operation.status !== 'confirmed') {
      throw new ConflictError('Operation must be confirmed before payment');
    }

    const buyer = operation.buyer_id
      ? await getOne<{ email: string }>('SELECT email FROM users WHERE id = $1', [
          operation.buyer_id,
        ])
      : null;

    const session = await createCommissionCheckout({
      operationId: operation.id,
      amount: Number(operation.total_price),
      program: operation.program,
      buyerEmail: buyer?.email,
      successUrl: `${APP_URL}/dashboard?payment=success&operation=${operation.id}`,
      cancelUrl: `${APP_URL}/dashboard?payment=cancelled&operation=${operation.id}`,
    });

    if (!session) {
      return c.json({ error: 'Payment provider not configured' }, 503);
    }

    await run(
      `UPDATE transactions SET payment_reference = $1 WHERE operation_id = $2`,
      [session.sessionId, operation.id]
    );

    return c.json({ checkoutUrl: session.url });
  } catch (err) {
    if (isAppError(err)) throw err;
    logger.error('Failed to create checkout session', err);
    throw err;
  }
});

// POST /api/payments/webhook - Stripe webhook (signature-verified, raw body required)
app.post('/webhook', async (c) => {
  const signature = c.req.header('stripe-signature');
  if (!signature) {
    return c.json({ error: 'Missing Stripe signature' }, 400);
  }

  const rawBody = await c.req.text();

  let event;
  try {
    event = constructWebhookEvent(rawBody, signature);
  } catch (err) {
    logger.warn('Stripe webhook signature verification failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return c.json({ error: 'Invalid signature' }, 400);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as { id: string; metadata?: { operationId?: string } };
    const operationId = session.metadata?.operationId;

    if (operationId) {
      const operation = await getOne<{
        id: string;
        total_price: number;
        commission_amount: number;
        seller_id: string;
      }>(`SELECT * FROM operations WHERE id = $1`, [operationId]);

      if (operation) {
        await run(
          `UPDATE transactions SET status = 'completed', paid_at = NOW(), payment_method = 'stripe'
           WHERE operation_id = $1`,
          [operationId]
        );
        await run(
          `UPDATE operations SET status = 'completed', updated_at = NOW() WHERE id = $1`,
          [operationId]
        );

        logger.info('Payment completed via Stripe webhook', { operationId });

        const seller = await getOne<{ email: string; phone: string }>(
          'SELECT email, phone FROM users WHERE id = $1',
          [operation.seller_id]
        );

        if (seller) {
          sendPaymentReceiptEmail(
            seller.email,
            operationId,
            Number(operation.total_price),
            Number(operation.commission_amount)
          ).catch((err) => logger.error('Failed to send payment receipt email', err));

          notifyOperationCompleted(
            seller.phone,
            operationId,
            Number(operation.commission_amount)
          ).catch((err) => logger.error('Failed to notify payment completion', err));
        }
      }
    }
  }

  return c.json({ received: true });
});

export default app;
