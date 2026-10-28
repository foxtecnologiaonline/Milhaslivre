import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema';

export interface CalculateShippingInput {
  fromZipCode: string;
  toZipCode: string;
  weightGrams: number;
  declaredValueCents: number;
}

export interface ShippingQuote {
  carrierId: string;
  carrierName: string;
  priceCents: number;
  etaDays: number;
}

export interface GenerateLabelInput {
  serviceId: string;
  fromZipCode: string;
  toZipCode: string;
  weightGrams: number;
  declaredValueCents: number;
}

export interface GeneratedLabel {
  trackingCode: string;
}

const ME_API_BASE = 'https://melhorenvio.com.br/api/v2/me';

// Real Melhor Envio v2 REST integration (Bearer token) — like PagarmeService,
// this has never been exercised against Melhor Envio's servers in this
// environment (no credentials here). No-ops with a log line when
// MELHOR_ENVIO_TOKEN is unset, same pattern as the other gateways.
@Injectable()
export class MelhorEnvioService {
  private readonly logger = new Logger(MelhorEnvioService.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  isConfigured(): boolean {
    return !!this.config.get('MELHOR_ENVIO_TOKEN', { infer: true });
  }

  async calculateShipping(input: CalculateShippingInput): Promise<ShippingQuote | null> {
    const token = this.config.get('MELHOR_ENVIO_TOKEN', { infer: true });
    if (!token) {
      this.logger.warn('MELHOR_ENVIO_TOKEN not set — skipping shipping calculation (no-op)');
      return null;
    }

    const response = await fetch(`${ME_API_BASE}/shipment/calculate`, {
      method: 'POST',
      headers: this.headers(token),
      body: JSON.stringify({
        from: { postal_code: input.fromZipCode },
        to: { postal_code: input.toZipCode },
        package: { weight: input.weightGrams / 1000, width: 15, height: 10, length: 20 },
        options: { insurance_value: input.declaredValueCents / 100, receipt: false, own_hand: false },
      }),
    });

    if (!response.ok) {
      this.logger.error(`Melhor Envio calculate failed: ${response.status} ${await response.text()}`);
      return null;
    }

    const options = (await response.json()) as Array<{
      id: number;
      name: string;
      price: string;
      delivery_time: number;
      error?: string;
    }>;
    const valid = options.filter((option) => !option.error);
    if (valid.length === 0) return null;

    const cheapest = valid.reduce((a, b) => (Number(a.price) <= Number(b.price) ? a : b));
    return {
      carrierId: String(cheapest.id),
      carrierName: cheapest.name,
      priceCents: Math.round(Number(cheapest.price) * 100),
      etaDays: cheapest.delivery_time,
    };
  }

  // Approximates Melhor Envio's real add-to-cart -> checkout -> generate
  // flow as one call chain. Field names follow the v2 docs but this has
  // never run against a live account, so treat the exact shapes as
  // best-effort.
  async generateLabel(input: GenerateLabelInput): Promise<GeneratedLabel | null> {
    const token = this.config.get('MELHOR_ENVIO_TOKEN', { infer: true });
    if (!token) {
      this.logger.warn('MELHOR_ENVIO_TOKEN not set — skipping label generation (no-op)');
      return null;
    }

    const cartRes = await fetch(`${ME_API_BASE}/cart`, {
      method: 'POST',
      headers: this.headers(token),
      body: JSON.stringify({
        service: input.serviceId,
        from: { postal_code: input.fromZipCode },
        to: { postal_code: input.toZipCode },
        package: { weight: input.weightGrams / 1000, width: 15, height: 10, length: 20 },
        options: { insurance_value: input.declaredValueCents / 100, receipt: false, own_hand: false },
      }),
    });
    if (!cartRes.ok) {
      this.logger.error(`Melhor Envio cart failed: ${cartRes.status} ${await cartRes.text()}`);
      return null;
    }
    const cartBody = (await cartRes.json()) as { id: string };

    const checkoutRes = await fetch(`${ME_API_BASE}/shipment/checkout`, {
      method: 'POST',
      headers: this.headers(token),
      body: JSON.stringify({ orders: [cartBody.id] }),
    });
    if (!checkoutRes.ok) {
      this.logger.error(`Melhor Envio checkout failed: ${checkoutRes.status} ${await checkoutRes.text()}`);
      return null;
    }

    const generateRes = await fetch(`${ME_API_BASE}/shipment/generate`, {
      method: 'POST',
      headers: this.headers(token),
      body: JSON.stringify({ orders: [cartBody.id] }),
    });
    if (!generateRes.ok) {
      this.logger.error(`Melhor Envio generate failed: ${generateRes.status} ${await generateRes.text()}`);
      return null;
    }
    const generateBody = (await generateRes.json()) as { tracking?: string };

    return { trackingCode: generateBody.tracking ?? cartBody.id };
  }

  async trackShipment(trackingCode: string): Promise<{ status: string } | null> {
    const token = this.config.get('MELHOR_ENVIO_TOKEN', { infer: true });
    if (!token) {
      this.logger.warn('MELHOR_ENVIO_TOKEN not set — skipping tracking lookup (no-op)');
      return null;
    }

    const response = await fetch(`${ME_API_BASE}/shipment/tracking`, {
      method: 'POST',
      headers: this.headers(token),
      body: JSON.stringify({ orders: [trackingCode] }),
    });
    if (!response.ok) {
      this.logger.error(`Melhor Envio tracking failed: ${response.status} ${await response.text()}`);
      return null;
    }

    const body = (await response.json()) as Record<string, { tracking_events?: Array<{ status: string }> }>;
    const events = body[trackingCode]?.tracking_events ?? [];
    return { status: events[0]?.status ?? 'posted' };
  }

  private headers(token: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'Marketplace (contato@marketplace.example)',
    };
  }
}
