import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import type { Env } from '../config/env.schema';
import { SUB_ORDER_STATUS_CHANGED, SubOrderStatusChangedEvent } from '../orders/order-events';
import { OrdersService } from '../orders/orders.service';
import { MelhorEnvioService } from '../melhorenvio/melhorenvio.service';
import { SellerService } from '../seller/seller.service';
import type { JwtPayload } from '../identity/types';
import type { QuoteDto } from './dto/quote.schema';
import { SHIPMENT_REPOSITORY, ShipmentRecord, ShipmentRepository } from './shipment.repository';

// No buyer shipping-address or product-weight data model exists yet (out of
// scope for this backlog item's endpoints), so quotes/labels triggered from
// checkout and the payment-paid event use a placeholder destination and a
// flat per-item weight estimate. The standalone POST /shipping/quote
// endpoint takes a real toZipCode from the caller.
const PLACEHOLDER_DESTINATION_ZIP = '20040-020';
const PLACEHOLDER_WEIGHT_PER_ITEM_GRAMS = 500;

export interface QuoteResult {
  carrierId: string | null;
  carrierName: string | null;
  priceCents: number;
  etaDays: number | null;
}

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);

  constructor(
    @Inject(SHIPMENT_REPOSITORY) private readonly shipments: ShipmentRepository,
    private readonly melhorEnvio: MelhorEnvioService,
    private readonly config: ConfigService<Env, true>,
    private readonly ordersService: OrdersService,
    private readonly sellerService: SellerService,
  ) {}

  async quote(dto: QuoteDto): Promise<QuoteResult> {
    const fromZipCode = this.config.get('SHIPPING_ORIGIN_ZIP_CODE', { infer: true });
    const result = await this.melhorEnvio.calculateShipping({
      fromZipCode,
      toZipCode: dto.toZipCode,
      weightGrams: dto.weightGrams,
      declaredValueCents: dto.declaredValueCents,
    });
    return result ?? { carrierId: null, carrierName: null, priceCents: 0, etaDays: null };
  }

  // Called by checkout, once per SubOrder, to price sub_orders.shipping_cents.
  async quoteForSubOrder(totalQty: number, declaredValueCents: number): Promise<number> {
    const result = await this.quote({
      toZipCode: PLACEHOLDER_DESTINATION_ZIP,
      weightGrams: Math.max(totalQty, 1) * PLACEHOLDER_WEIGHT_PER_ITEM_GRAMS,
      declaredValueCents,
    });
    return result.priceCents;
  }

  async getShipmentById(id: string): Promise<ShipmentRecord> {
    const shipment = await this.shipments.findById(id);
    if (!shipment) {
      throw new NotFoundException('shipment not found');
    }
    return shipment;
  }

  async getTracking(id: string): Promise<{ carrier: string | null; trackingCode: string | null; status: string; etaDays: number | null }> {
    const shipment = await this.getShipmentById(id);

    if (shipment.trackingCode && this.melhorEnvio.isConfigured()) {
      const live = await this.melhorEnvio.trackShipment(shipment.trackingCode);
      if (live) {
        return {
          carrier: shipment.carrier,
          trackingCode: shipment.trackingCode,
          status: live.status,
          etaDays: shipment.etaDays,
        };
      }
    }

    return {
      carrier: shipment.carrier,
      trackingCode: shipment.trackingCode,
      status: shipment.status,
      etaDays: shipment.etaDays,
    };
  }

  // Idempotent: a SubOrder gets at most one shipment. Used both by the
  // explicit POST /shipping/label endpoint and automatically by the
  // sub_order.status_changed listener below.
  async ensureLabel(subOrderId: string, declaredValueCents: number): Promise<ShipmentRecord> {
    const existing = await this.shipments.findBySubOrderId(subOrderId);
    if (existing) return existing;

    const fromZipCode = this.config.get('SHIPPING_ORIGIN_ZIP_CODE', { infer: true });
    const label = await this.melhorEnvio.generateLabel({
      serviceId: '1',
      fromZipCode,
      toZipCode: PLACEHOLDER_DESTINATION_ZIP,
      weightGrams: PLACEHOLDER_WEIGHT_PER_ITEM_GRAMS,
      declaredValueCents,
    });

    return this.shipments.create({
      subOrderId,
      carrier: label ? 'melhor_envio' : null,
      trackingCode: label?.trackingCode ?? null,
      status: 'label_generated',
      priceCents: 0,
      etaDays: null,
    });
  }

  async requestLabel(user: JwtPayload, subOrderId: string): Promise<ShipmentRecord> {
    const subOrder = await this.ordersService.findSubOrderById(subOrderId);
    if (subOrder.status !== 'paid') {
      throw new ForbiddenException('a label can only be generated after the sub-order is paid');
    }

    if (user.role !== 'admin') {
      const seller = await this.sellerService.getApprovedSellerForUser(user.sub);
      if (seller.id !== subOrder.sellerId) {
        throw new ForbiddenException("cannot generate a label for another seller's sub-order");
      }
    }

    return this.ensureLabel(subOrder.id, subOrder.subtotalCents);
  }

  @OnEvent(SUB_ORDER_STATUS_CHANGED)
  async handleSubOrderPaid(event: SubOrderStatusChangedEvent): Promise<void> {
    if (event.to !== 'paid') return;
    try {
      await this.ensureLabel(event.subOrderId, event.subtotalCents);
    } catch (err) {
      // A failed auto-label shouldn't break payment processing; the seller
      // can retry via POST /shipping/label.
      this.logger.error(`auto label generation failed for sub-order ${event.subOrderId}: ${err}`);
    }
  }
}
