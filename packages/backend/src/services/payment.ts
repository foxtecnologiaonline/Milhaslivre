// Payment processor integration (Stripe)
import Stripe from 'stripe';
import { logger } from '../logger';

let client: Stripe | null = null;

export function getStripeClient(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;

  if (!client) {
    client = new Stripe(secretKey);
  }
  return client;
}

export function isPaymentConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

interface CreateCheckoutOptions {
  operationId: string;
  amount: number; // BRL
  program: string;
  buyerEmail?: string;
  successUrl: string;
  cancelUrl: string;
}

export async function createCommissionCheckout(
  options: CreateCheckoutOptions
): Promise<{ url: string | null; sessionId: string } | null> {
  const stripe = getStripeClient();
  if (!stripe) {
    logger.info('Stripe not configured, skipping checkout session creation', {
      operationId: options.operationId,
    });
    return null;
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: options.buyerEmail,
      line_items: [
        {
          price_data: {
            currency: 'brl',
            unit_amount: Math.round(options.amount * 100),
            product_data: {
              name: `Milhas ${options.program} — Operação ${options.operationId}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: { operationId: options.operationId },
      success_url: options.successUrl,
      cancel_url: options.cancelUrl,
    });

    logger.info('Stripe checkout session created', {
      operationId: options.operationId,
      sessionId: session.id,
    });

    return { url: session.url, sessionId: session.id };
  } catch (err) {
    logger.error('Failed to create Stripe checkout session', err, {
      operationId: options.operationId,
    });
    throw err;
  }
}

export function constructWebhookEvent(rawBody: string, signature: string): Stripe.Event {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    throw new Error('Stripe webhook not configured');
  }

  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}
