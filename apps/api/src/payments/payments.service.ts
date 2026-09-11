import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PagarmeService } from '../pagarme/pagarme.service';
import { OrdersService } from '../orders/orders.service';
import { SellerService } from '../seller/seller.service';
import type { ChargeDto } from './dto/charge.schema';
import type { WebhookDto } from './dto/webhook.schema';
import { IDEMPOTENCY_REPOSITORY, IdempotencyRepository } from './idempotency.repository';
import { PAYMENT_REPOSITORY, PaymentRecord, PaymentRepository, PaymentStatus } from './payment.repository';
import {
  SPLIT_TRANSACTION_REPOSITORY,
  SplitTransactionRecord,
  SplitTransactionRepository,
} from './split-transaction.repository';
import { WEBHOOK_EVENT_REPOSITORY, WebhookEventRepository } from './webhook-event.repository';

export interface ChargeResult {
  payment: PaymentRecord;
  splits: SplitTransactionRecord[];
}

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository,
    @Inject(SPLIT_TRANSACTION_REPOSITORY) private readonly splits: SplitTransactionRepository,
    @Inject(IDEMPOTENCY_REPOSITORY) private readonly idempotency: IdempotencyRepository,
    @Inject(WEBHOOK_EVENT_REPOSITORY) private readonly webhookEvents: WebhookEventRepository,
    private readonly ordersService: OrdersService,
    private readonly sellerService: SellerService,
    private readonly pagarmeService: PagarmeService,
  ) {}

  async charge(buyerId: string, idempotencyKey: string, dto: ChargeDto): Promise<ChargeResult> {
    const cached = await this.idempotency.find(idempotencyKey);
    if (cached) {
      return cached.response as ChargeResult;
    }

    const order = await this.ordersService.findById(dto.orderId);
    if (order.buyerId !== buyerId) {
      throw new ForbiddenException('order does not belong to this buyer');
    }
    if (order.status !== 'pending') {
      throw new ConflictException('order is not payable');
    }

    const splitEntries = await Promise.all(
      order.subOrders.map(async (subOrder) => {
        const seller = await this.sellerService.findById(subOrder.sellerId);
        return {
          sellerId: seller.id,
          recipientId: seller.recipientId,
          amountCents: subOrder.subtotalCents + subOrder.shippingCents,
        };
      }),
    );

    if (this.pagarmeService.isConfigured() && splitEntries.some((entry) => !entry.recipientId)) {
      throw new ConflictException('one or more sellers do not have a payment recipient yet');
    }

    const gatewayResult = await this.pagarmeService.createOrderWithSplit({
      totalCents: order.totalCents,
      method: dto.method,
      cardToken: dto.cardToken,
      splits: splitEntries.map((entry) => ({
        recipientId: entry.recipientId as string,
        amountCents: entry.amountCents,
      })),
    });

    const status: PaymentStatus = gatewayResult?.status ?? 'pending';
    const payment = await this.payments.insert({
      orderId: order.id,
      gatewayId: gatewayResult?.gatewayId || null,
      status,
      method: dto.method,
      totalCents: order.totalCents,
    });

    const splits = await this.splits.insertMany(
      splitEntries.map((entry) => ({
        paymentId: payment.id,
        sellerId: entry.sellerId,
        amountCents: entry.amountCents,
        feeCents: 0,
        status,
      })),
    );

    if (status === 'paid') {
      await this.ordersService.markOrderPaid(order);
    }

    const response: ChargeResult = { payment, splits };
    await this.idempotency.store(idempotencyKey, order.id, response);
    return response;
  }

  async handleWebhook(rawBody: string, signature: string | undefined, payload: WebhookDto) {
    if (!this.pagarmeService.verifyWebhookSignature(rawBody, signature)) {
      throw new UnauthorizedException('invalid webhook signature');
    }

    if (await this.webhookEvents.wasProcessed(payload.id)) {
      return { received: true, duplicate: true };
    }
    await this.webhookEvents.markProcessed(payload.id);

    const payment = await this.payments.findLatestByGatewayId(payload.data.id);
    if (!payment) {
      return { received: true, unknownPayment: true };
    }

    const newStatus = mapWebhookStatus(payload.data.status);
    if (newStatus === payment.status) {
      return { received: true, unchanged: true };
    }

    const newPayment = await this.payments.insert({
      orderId: payment.orderId,
      gatewayId: payment.gatewayId,
      status: newStatus,
      method: payment.method,
      totalCents: payment.totalCents,
    });

    const previousSplits = await this.splits.findByPaymentId(payment.id);
    await this.splits.insertMany(
      previousSplits.map((split) => ({
        paymentId: newPayment.id,
        sellerId: split.sellerId,
        amountCents: split.amountCents,
        feeCents: split.feeCents,
        status: newStatus,
      })),
    );

    if (newStatus === 'paid') {
      const order = await this.ordersService.findById(payment.orderId);
      await this.ordersService.markOrderPaid(order);
    }

    return { received: true };
  }
}

function mapWebhookStatus(gatewayStatus: string): PaymentStatus {
  if (gatewayStatus === 'paid') return 'paid';
  if (gatewayStatus === 'failed' || gatewayStatus === 'canceled') return 'failed';
  if (gatewayStatus === 'refunded') return 'refunded';
  return 'pending';
}
