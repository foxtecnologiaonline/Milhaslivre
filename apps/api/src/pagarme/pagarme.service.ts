import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Env } from '../config/env.schema';

export interface CreateRecipientInput {
  name: string;
  document: string;
}

export interface SplitEntry {
  recipientId: string;
  amountCents: number;
}

export interface CreateOrderWithSplitInput {
  totalCents: number;
  method: 'credit_card' | 'pix' | 'boleto';
  cardToken?: string;
  splits: SplitEntry[];
}

export interface GatewayChargeResult {
  gatewayId: string;
  status: 'pending' | 'paid' | 'failed';
}

const PAGARME_API_BASE = 'https://api.pagar.me/core/v5';

// Real Pagar.me v5 REST integration (Basic Auth with the secret key), not a
// mock — but it has never been exercised against Pagar.me's servers in this
// environment because no credentials are available here. When PAGARME_API_KEY
// is unset it no-ops with a log line, same pattern as the other third-party
// integrations in this codebase's history (Twilio/SendGrid/Stripe).
@Injectable()
export class PagarmeService {
  private readonly logger = new Logger(PagarmeService.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  isConfigured(): boolean {
    return !!this.config.get('PAGARME_API_KEY', { infer: true });
  }

  async createRecipient(input: CreateRecipientInput): Promise<string | null> {
    const apiKey = this.config.get('PAGARME_API_KEY', { infer: true });
    if (!apiKey) {
      this.logger.warn('PAGARME_API_KEY not set — skipping recipient creation (no-op)');
      return null;
    }

    const response = await fetch(`${PAGARME_API_BASE}/recipients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
      },
      body: JSON.stringify({
        name: input.name,
        document: input.document,
        type: 'individual',
        transfer_settings: { transfer_enabled: false },
      }),
    });

    if (!response.ok) {
      this.logger.error(`Pagar.me recipient creation failed: ${response.status} ${await response.text()}`);
      return null;
    }

    const body = (await response.json()) as { id: string };
    return body.id;
  }

  async createOrderWithSplit(input: CreateOrderWithSplitInput): Promise<GatewayChargeResult | null> {
    const apiKey = this.config.get('PAGARME_API_KEY', { infer: true });
    if (!apiKey) {
      this.logger.warn('PAGARME_API_KEY not set — skipping charge (no-op, payment stays pending)');
      return null;
    }

    const response = await fetch(`${PAGARME_API_BASE}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
      },
      body: JSON.stringify({
        items: [{ amount: input.totalCents, description: 'Pedido Marketplace', quantity: 1 }],
        payments: [
          {
            payment_method: input.method,
            [input.method === 'credit_card' ? 'credit_card' : input.method]:
              input.method === 'credit_card' ? { card_token: input.cardToken } : undefined,
            split: input.splits.map((split) => ({
              amount: split.amountCents,
              recipient_id: split.recipientId,
              type: 'flat',
              options: { charge_processing_fee: false, liable: true },
            })),
          },
        ],
      }),
    });

    if (!response.ok) {
      this.logger.error(`Pagar.me charge failed: ${response.status} ${await response.text()}`);
      return { gatewayId: '', status: 'failed' };
    }

    const body = (await response.json()) as { id: string; status: string };
    return { gatewayId: body.id, status: mapGatewayStatus(body.status) };
  }

  verifyWebhookSignature(rawBody: string, signatureHeader: string | undefined): boolean {
    const secret = this.config.get('PAGARME_WEBHOOK_SECRET', { infer: true });
    if (!secret) {
      this.logger.warn('PAGARME_WEBHOOK_SECRET not set — accepting webhook without verification');
      return true;
    }
    if (!signatureHeader) return false;

    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const provided = signatureHeader.replace(/^sha256=/, '');

    const expectedBuf = Buffer.from(expected, 'hex');
    const providedBuf = Buffer.from(provided, 'hex');
    return expectedBuf.length === providedBuf.length && timingSafeEqual(expectedBuf, providedBuf);
  }
}

function mapGatewayStatus(pagarmeStatus: string): GatewayChargeResult['status'] {
  if (pagarmeStatus === 'paid') return 'paid';
  if (pagarmeStatus === 'failed' || pagarmeStatus === 'canceled') return 'failed';
  return 'pending';
}
