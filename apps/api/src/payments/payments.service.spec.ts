import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { CreateOrderInput, OrderRecord, OrderRepository } from '../orders/order.repository';
import { OrdersService } from '../orders/orders.service';
import type { PagarmeService } from '../pagarme/pagarme.service';
import type { CreateSellerInput, SellerRecord, SellerRepository } from '../seller/seller.repository';
import { SellerService } from '../seller/seller.service';
import type { SellerStatus } from '../seller/types';
import type { CreatePaymentInput, PaymentRecord, PaymentRepository } from './payment.repository';
import type { IdempotencyRecord, IdempotencyRepository } from './idempotency.repository';
import { PaymentsService } from './payments.service';
import type {
  CreateSplitTransactionInput,
  SplitTransactionRecord,
  SplitTransactionRepository,
} from './split-transaction.repository';
import type { WebhookEventRepository } from './webhook-event.repository';

class InMemoryOrderRepository implements OrderRepository {
  orders: OrderRecord[] = [];

  async createOrder(input: CreateOrderInput): Promise<OrderRecord> {
    const orderId = `order-${this.orders.length + 1}`;
    const subOrders = input.subOrders.map((subOrder, subIdx) => {
      const subOrderId = `${orderId}-sub-${subIdx}`;
      const subtotalCents = subOrder.items.reduce((sum, i) => sum + i.unitPriceCents * i.qty, 0);
      return {
        id: subOrderId,
        orderId,
        sellerId: subOrder.sellerId,
        subtotalCents,
        shippingCents: subOrder.shippingCents,
        status: 'pending',
        items: subOrder.items.map((item, itemIdx) => ({
          id: `${subOrderId}-item-${itemIdx}`,
          subOrderId,
          offerId: item.offerId,
          qty: item.qty,
          unitPriceCents: item.unitPriceCents,
        })),
      };
    });
    const order: OrderRecord = {
      id: orderId,
      buyerId: input.buyerId,
      totalCents: subOrders.reduce((sum, so) => sum + so.subtotalCents + so.shippingCents, 0),
      status: 'pending',
      createdAt: new Date(),
      subOrders,
    };
    this.orders.push(order);
    return order;
  }

  async findById(id: string) {
    return this.orders.find((o) => o.id === id) ?? null;
  }

  async findSubOrderById(id: string) {
    for (const order of this.orders) {
      const subOrder = order.subOrders.find((so) => so.id === id);
      if (subOrder) return subOrder;
    }
    return null;
  }

  async markOrderConfirmed(id: string) {
    const order = this.orders.find((o) => o.id === id);
    if (order) order.status = 'confirmed';
  }

  async markSubOrderPaid(id: string) {
    for (const order of this.orders) {
      const subOrder = order.subOrders.find((so) => so.id === id);
      if (subOrder) subOrder.status = 'paid';
    }
  }
}

class InMemorySellerRepository implements SellerRepository {
  sellers: SellerRecord[] = [];

  seed(overrides: Partial<SellerRecord> = {}): SellerRecord {
    const seller: SellerRecord = {
      id: overrides.id ?? `seller-${this.sellers.length + 1}`,
      userId: 'user-1',
      companyName: 'Loja',
      document: '12345678900',
      status: 'approved',
      rejectedReason: null,
      createdAt: new Date(),
      approvedAt: new Date(),
      recipientId: 'rp_default',
      ...overrides,
    };
    this.sellers.push(seller);
    return seller;
  }

  async findById(id: string) {
    return this.sellers.find((s) => s.id === id) ?? null;
  }
  async findByUserId(userId: string) {
    return this.sellers.find((s) => s.userId === userId) ?? null;
  }
  async create(input: CreateSellerInput) {
    return this.seed(input);
  }
  async updateStatus(id: string, status: SellerStatus, rejectedReason: string | null) {
    const seller = this.sellers.find((s) => s.id === id);
    if (!seller) throw new Error('not found');
    seller.status = status;
    seller.rejectedReason = rejectedReason;
    return seller;
  }
  async attachRecipient(id: string, recipientId: string) {
    const seller = this.sellers.find((s) => s.id === id);
    if (!seller) throw new Error('not found');
    seller.recipientId = recipientId;
    return seller;
  }
}

class InMemoryPaymentRepository implements PaymentRepository {
  rows: PaymentRecord[] = [];
  private counter = 0;

  async insert(input: CreatePaymentInput): Promise<PaymentRecord> {
    const row: PaymentRecord = { id: `payment-${++this.counter}`, createdAt: new Date(), ...input };
    this.rows.push(row);
    return row;
  }
  async findLatestByOrderId(orderId: string) {
    for (let i = this.rows.length - 1; i >= 0; i--) {
      if (this.rows[i].orderId === orderId) return this.rows[i];
    }
    return null;
  }
  async findLatestByGatewayId(gatewayId: string) {
    for (let i = this.rows.length - 1; i >= 0; i--) {
      if (this.rows[i].gatewayId === gatewayId) return this.rows[i];
    }
    return null;
  }
}

class InMemorySplitTransactionRepository implements SplitTransactionRepository {
  rows: SplitTransactionRecord[] = [];
  private counter = 0;

  async insertMany(inputs: CreateSplitTransactionInput[]) {
    const created = inputs.map((input) => ({ id: `split-${++this.counter}`, createdAt: new Date(), ...input }));
    this.rows.push(...created);
    return created;
  }
  async findByPaymentId(paymentId: string) {
    return this.rows.filter((r) => r.paymentId === paymentId);
  }
}

class InMemoryIdempotencyRepository implements IdempotencyRepository {
  private map = new Map<string, IdempotencyRecord>();

  async find(key: string) {
    return this.map.get(key) ?? null;
  }
  async store(key: string, orderId: string, response: unknown) {
    this.map.set(key, { key, orderId, response });
  }
}

class InMemoryWebhookEventRepository implements WebhookEventRepository {
  private processed = new Set<string>();

  async wasProcessed(id: string) {
    return this.processed.has(id);
  }
  async markProcessed(id: string) {
    this.processed.add(id);
  }
}

function buildPayments(pagarmeOverrides?: Partial<PagarmeService>) {
  const orderRepository = new InMemoryOrderRepository();
  const ordersService = new OrdersService(orderRepository, new EventEmitter2());

  const sellerRepository = new InMemorySellerRepository();
  const sellerPagarme = { createRecipient: jest.fn().mockResolvedValue(null) } as unknown as PagarmeService;
  const sellerService = new SellerService(sellerRepository, sellerPagarme);

  const paymentRepository = new InMemoryPaymentRepository();
  const splitRepository = new InMemorySplitTransactionRepository();
  const idempotencyRepository = new InMemoryIdempotencyRepository();
  const webhookEventRepository = new InMemoryWebhookEventRepository();

  const pagarmeService = {
    isConfigured: jest.fn().mockReturnValue(false),
    createOrderWithSplit: jest.fn().mockResolvedValue(null),
    verifyWebhookSignature: jest.fn().mockReturnValue(true),
    ...pagarmeOverrides,
  } as unknown as PagarmeService;

  const paymentsService = new PaymentsService(
    paymentRepository,
    splitRepository,
    idempotencyRepository,
    webhookEventRepository,
    ordersService,
    sellerService,
    pagarmeService,
  );

  return {
    paymentsService,
    orderRepository,
    sellerRepository,
    paymentRepository,
    splitRepository,
    webhookEventRepository,
    pagarmeService,
  };
}

async function seedOrder(
  orderRepository: InMemoryOrderRepository,
  sellerRepository: InMemorySellerRepository,
  opts: { buyerId: string; sellerId?: string; amountCents: number; recipientId?: string | null },
) {
  const sellerId = opts.sellerId ?? `seller-${sellerRepository.sellers.length + 1}`;
  const recipientId = opts.recipientId === undefined ? 'rp_default' : opts.recipientId;
  sellerRepository.seed({ id: sellerId, recipientId });
  return orderRepository.createOrder({
    buyerId: opts.buyerId,
    subOrders: [
      { sellerId, shippingCents: 0, items: [{ offerId: 'offer-1', qty: 1, unitPriceCents: opts.amountCents }] },
    ],
  });
}

describe('PaymentsService', () => {
  describe('charge', () => {
    it('records a pending payment when the gateway is not configured (no-op), on the happy path', async () => {
      const { paymentsService, orderRepository, sellerRepository, paymentRepository } = buildPayments();
      const order = await seedOrder(orderRepository, sellerRepository, { buyerId: 'buyer-1', amountCents: 1000 });

      const result = await paymentsService.charge('buyer-1', 'idem-1', { orderId: order.id, method: 'pix' });

      expect(result.payment.status).toBe('pending');
      expect(paymentRepository.rows).toHaveLength(1);
      expect((await orderRepository.findById(order.id))?.status).toBe('pending');
    });

    it('confirms the order and its sub-orders when the gateway reports paid', async () => {
      const { paymentsService, orderRepository, sellerRepository } = buildPayments({
        isConfigured: jest.fn().mockReturnValue(true),
        createOrderWithSplit: jest.fn().mockResolvedValue({ gatewayId: 'gw_1', status: 'paid' }),
      });
      const order = await seedOrder(orderRepository, sellerRepository, { buyerId: 'buyer-1', amountCents: 1000 });

      const result = await paymentsService.charge('buyer-1', 'idem-1', { orderId: order.id, method: 'pix' });

      expect(result.payment.status).toBe('paid');
      const stored = await orderRepository.findById(order.id);
      expect(stored?.status).toBe('confirmed');
      expect(stored?.subOrders[0].status).toBe('paid');
    });

    it('is idempotent: the same key returns the cached response without charging twice', async () => {
      const { paymentsService, orderRepository, sellerRepository, paymentRepository } = buildPayments();
      const order = await seedOrder(orderRepository, sellerRepository, { buyerId: 'buyer-1', amountCents: 1000 });

      const first = await paymentsService.charge('buyer-1', 'idem-1', { orderId: order.id, method: 'pix' });
      const second = await paymentsService.charge('buyer-1', 'idem-1', { orderId: order.id, method: 'pix' });

      expect(second).toEqual(first);
      expect(paymentRepository.rows).toHaveLength(1);
    });

    it("rejects charging an order that belongs to a different buyer", async () => {
      const { paymentsService, orderRepository, sellerRepository } = buildPayments();
      const order = await seedOrder(orderRepository, sellerRepository, { buyerId: 'buyer-1', amountCents: 1000 });

      await expect(
        paymentsService.charge('buyer-2', 'idem-1', { orderId: order.id, method: 'pix' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects charging an order that is not pending', async () => {
      const { paymentsService, orderRepository, sellerRepository } = buildPayments();
      const order = await seedOrder(orderRepository, sellerRepository, { buyerId: 'buyer-1', amountCents: 1000 });
      await orderRepository.markOrderConfirmed(order.id);

      await expect(
        paymentsService.charge('buyer-1', 'idem-1', { orderId: order.id, method: 'pix' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects charging when a seller has no recipient and the gateway is configured', async () => {
      const { paymentsService, orderRepository, sellerRepository } = buildPayments({
        isConfigured: jest.fn().mockReturnValue(true),
      });
      const order = await seedOrder(orderRepository, sellerRepository, {
        buyerId: 'buyer-1',
        amountCents: 1000,
        recipientId: null,
      });

      await expect(
        paymentsService.charge('buyer-1', 'idem-1', { orderId: order.id, method: 'pix' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('handleWebhook', () => {
    it('transitions a pending payment to paid and confirms the order, on the happy path', async () => {
      const { paymentsService, orderRepository, sellerRepository, paymentRepository } = buildPayments({
        isConfigured: jest.fn().mockReturnValue(true),
        createOrderWithSplit: jest.fn().mockResolvedValue({ gatewayId: 'gw_1', status: 'pending' }),
      });
      const order = await seedOrder(orderRepository, sellerRepository, { buyerId: 'buyer-1', amountCents: 1000 });
      await paymentsService.charge('buyer-1', 'idem-1', { orderId: order.id, method: 'pix' });

      const result = await paymentsService.handleWebhook(
        '{}',
        undefined,
        { id: 'evt-1', type: 'order.paid', data: { id: 'gw_1', status: 'paid' } },
      );

      expect(result).toEqual({ received: true });
      const latest = await paymentRepository.findLatestByGatewayId('gw_1');
      expect(latest?.status).toBe('paid');
      expect((await orderRepository.findById(order.id))?.status).toBe('confirmed');
    });

    it('is idempotent: the same event id is processed only once', async () => {
      const { paymentsService, orderRepository, sellerRepository, paymentRepository } = buildPayments({
        isConfigured: jest.fn().mockReturnValue(true),
        createOrderWithSplit: jest.fn().mockResolvedValue({ gatewayId: 'gw_1', status: 'pending' }),
      });
      const order = await seedOrder(orderRepository, sellerRepository, { buyerId: 'buyer-1', amountCents: 1000 });
      await paymentsService.charge('buyer-1', 'idem-1', { orderId: order.id, method: 'pix' });

      const event = { id: 'evt-1', type: 'order.paid', data: { id: 'gw_1', status: 'paid' } };
      await paymentsService.handleWebhook('{}', undefined, event);
      const rowsAfterFirst = paymentRepository.rows.length;
      const second = await paymentsService.handleWebhook('{}', undefined, event);

      expect(second).toEqual({ received: true, duplicate: true });
      expect(paymentRepository.rows).toHaveLength(rowsAfterFirst);
    });

    it('rejects a webhook with an invalid signature', async () => {
      const { paymentsService } = buildPayments({ verifyWebhookSignature: jest.fn().mockReturnValue(false) });

      await expect(
        paymentsService.handleWebhook('{}', 'bad-signature', {
          id: 'evt-1',
          type: 'order.paid',
          data: { id: 'gw_1', status: 'paid' },
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
