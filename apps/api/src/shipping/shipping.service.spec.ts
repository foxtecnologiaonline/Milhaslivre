import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Env } from '../config/env.schema';
import type { GeneratedLabel, MelhorEnvioService, ShippingQuote } from '../melhorenvio/melhorenvio.service';
import type { OrderRecord, OrderRepository, SubOrderRecord } from '../orders/order.repository';
import { OrdersService } from '../orders/orders.service';
import type { JwtPayload } from '../identity/types';
import type { PagarmeService } from '../pagarme/pagarme.service';
import type { CreateSellerInput, SellerRecord, SellerRepository } from '../seller/seller.repository';
import { SellerService } from '../seller/seller.service';
import type { SellerStatus } from '../seller/types';
import { ShippingService } from './shipping.service';
import type {
  CreateShipmentInput,
  ShipmentRecord,
  ShipmentRepository,
} from './shipment.repository';

class InMemoryOrderRepository implements OrderRepository {
  orders: OrderRecord[] = [];

  seedPaidSubOrder(overrides: Partial<SubOrderRecord> = {}): { order: OrderRecord; subOrder: SubOrderRecord } {
    const orderId = `order-${this.orders.length + 1}`;
    const subOrder: SubOrderRecord = {
      id: overrides.id ?? `${orderId}-sub-1`,
      orderId,
      sellerId: 'seller-1',
      subtotalCents: 5000,
      shippingCents: 0,
      status: 'paid',
      items: [],
      ...overrides,
    };
    const order: OrderRecord = {
      id: orderId,
      buyerId: 'buyer-1',
      totalCents: subOrder.subtotalCents,
      status: 'confirmed',
      createdAt: new Date(),
      subOrders: [subOrder],
    };
    this.orders.push(order);
    return { order, subOrder };
  }

  async createOrder(): Promise<OrderRecord> {
    throw new Error('not used in shipping tests');
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
  async findSubOrdersBySellerId(sellerId: string) {
    return this.orders.flatMap((order) => order.subOrders.filter((so) => so.sellerId === sellerId));
  }
  async markOrderConfirmed() {}
  async updateSubOrderStatus(id: string, status: string) {
    for (const order of this.orders) {
      const subOrder = order.subOrders.find((so) => so.id === id);
      if (subOrder) {
        subOrder.status = status;
        return subOrder;
      }
    }
    throw new Error('sub-order not found');
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
      recipientId: null,
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

class InMemoryShipmentRepository implements ShipmentRepository {
  shipments: ShipmentRecord[] = [];
  private counter = 0;

  async findById(id: string) {
    return this.shipments.find((s) => s.id === id) ?? null;
  }
  async findBySubOrderId(subOrderId: string) {
    return this.shipments.find((s) => s.subOrderId === subOrderId) ?? null;
  }
  async create(input: CreateShipmentInput) {
    const shipment: ShipmentRecord = { id: `shipment-${++this.counter}`, createdAt: new Date(), ...input };
    this.shipments.push(shipment);
    return shipment;
  }
}

function buildShipping(
  melhorEnvioOverrides?: Partial<MelhorEnvioService>,
  sellerRepository = new InMemorySellerRepository(),
) {
  const shipmentRepository = new InMemoryShipmentRepository();
  const orderRepository = new InMemoryOrderRepository();
  const ordersService = new OrdersService(orderRepository, new EventEmitter2());
  const sellerService = new SellerService(sellerRepository, {
    createRecipient: jest.fn().mockResolvedValue(null),
  } as unknown as PagarmeService);

  const melhorEnvio = {
    isConfigured: jest.fn().mockReturnValue(false),
    calculateShipping: jest.fn().mockResolvedValue(null),
    generateLabel: jest.fn().mockResolvedValue(null),
    trackShipment: jest.fn().mockResolvedValue(null),
    ...melhorEnvioOverrides,
  } as unknown as MelhorEnvioService;

  const config = {
    get: (key: keyof Env) => (key === 'SHIPPING_ORIGIN_ZIP_CODE' ? '01310-100' : undefined),
  } as unknown as ConfigService<Env, true>;

  const shippingService = new ShippingService(
    shipmentRepository,
    melhorEnvio,
    config,
    ordersService,
    sellerService,
  );

  return { shippingService, shipmentRepository, orderRepository, sellerRepository, melhorEnvio };
}

describe('ShippingService', () => {
  describe('quote', () => {
    it('returns the calculated quote on the happy path', async () => {
      const result: ShippingQuote = { carrierId: '1', carrierName: 'Correios', priceCents: 1500, etaDays: 5 };
      const { shippingService } = buildShipping({ calculateShipping: jest.fn().mockResolvedValue(result) });

      const quote = await shippingService.quote({
        toZipCode: '20040-020',
        weightGrams: 500,
        declaredValueCents: 10000,
      });

      expect(quote).toEqual(result);
    });

    it('returns a zero-cost placeholder when Melhor Envio is not configured', async () => {
      const { shippingService } = buildShipping();

      const quote = await shippingService.quote({
        toZipCode: '20040-020',
        weightGrams: 500,
        declaredValueCents: 10000,
      });

      expect(quote).toEqual({ carrierId: null, carrierName: null, priceCents: 0, etaDays: null });
    });
  });

  describe('ensureLabel', () => {
    it('creates a shipment on the happy path', async () => {
      const { shippingService, shipmentRepository } = buildShipping({
        generateLabel: jest.fn().mockResolvedValue({ trackingCode: 'BR123' } as GeneratedLabel),
      });

      const shipment = await shippingService.ensureLabel('sub-order-1', 5000);

      expect(shipment.trackingCode).toBe('BR123');
      expect(shipmentRepository.shipments).toHaveLength(1);
    });

    it('is idempotent: a second call returns the existing shipment without calling the gateway again', async () => {
      const generateLabel = jest.fn().mockResolvedValue({ trackingCode: 'BR123' } as GeneratedLabel);
      const { shippingService } = buildShipping({ generateLabel });

      const first = await shippingService.ensureLabel('sub-order-1', 5000);
      const second = await shippingService.ensureLabel('sub-order-1', 5000);

      expect(second.id).toBe(first.id);
      expect(generateLabel).toHaveBeenCalledTimes(1);
    });
  });

  describe('requestLabel', () => {
    it('lets the owning seller generate a label on the happy path', async () => {
      const sellerRepository = new InMemorySellerRepository();
      sellerRepository.seed({ id: 'seller-1', userId: 'user-1' });
      const { shippingService, orderRepository } = buildShipping(undefined, sellerRepository);
      const { subOrder } = orderRepository.seedPaidSubOrder({ sellerId: 'seller-1' });

      const user: JwtPayload = { sub: 'user-1', email: 'seller@example.com', role: 'seller' };
      const shipment = await shippingService.requestLabel(user, subOrder.id);

      expect(shipment.subOrderId).toBe(subOrder.id);
    });

    it('lets an admin generate a label regardless of the owner', async () => {
      const { shippingService, orderRepository } = buildShipping();
      const { subOrder } = orderRepository.seedPaidSubOrder({ sellerId: 'seller-1' });

      const user: JwtPayload = { sub: 'admin-1', email: 'admin@example.com', role: 'admin' };
      const shipment = await shippingService.requestLabel(user, subOrder.id);

      expect(shipment.subOrderId).toBe(subOrder.id);
    });

    it("rejects a seller generating a label for another seller's sub-order", async () => {
      const sellerRepository = new InMemorySellerRepository();
      sellerRepository.seed({ id: 'seller-2', userId: 'user-2' });
      const { shippingService, orderRepository } = buildShipping(undefined, sellerRepository);
      const { subOrder } = orderRepository.seedPaidSubOrder({ sellerId: 'seller-1' });

      const user: JwtPayload = { sub: 'user-2', email: 'seller2@example.com', role: 'seller' };

      await expect(shippingService.requestLabel(user, subOrder.id)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects generating a label before the sub-order is paid', async () => {
      const { shippingService, orderRepository } = buildShipping();
      const { subOrder } = orderRepository.seedPaidSubOrder({ sellerId: 'seller-1', status: 'pending' });

      const user: JwtPayload = { sub: 'admin-1', email: 'admin@example.com', role: 'admin' };

      await expect(shippingService.requestLabel(user, subOrder.id)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('getTracking', () => {
    it('throws when the shipment does not exist', async () => {
      const { shippingService } = buildShipping();

      await expect(shippingService.getTracking('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('handleSubOrderPaid (event listener)', () => {
    it('generates a label automatically when a sub-order becomes paid', async () => {
      const { shippingService, shipmentRepository } = buildShipping({
        generateLabel: jest.fn().mockResolvedValue({ trackingCode: 'BR999' } as GeneratedLabel),
      });

      await shippingService.handleSubOrderPaid({
        subOrderId: 'sub-order-9',
        orderId: 'order-9',
        sellerId: 'seller-1',
        subtotalCents: 3000,
        from: 'pending',
        to: 'paid',
      });

      expect(shipmentRepository.shipments).toHaveLength(1);
    });

    it('does nothing for a transition that is not to paid', async () => {
      const generateLabel = jest.fn();
      const { shippingService, shipmentRepository } = buildShipping({ generateLabel });

      await shippingService.handleSubOrderPaid({
        subOrderId: 'sub-order-9',
        orderId: 'order-9',
        sellerId: 'seller-1',
        subtotalCents: 3000,
        from: 'pending',
        to: 'cancelled',
      });

      expect(generateLabel).not.toHaveBeenCalled();
      expect(shipmentRepository.shipments).toHaveLength(0);
    });
  });
});
