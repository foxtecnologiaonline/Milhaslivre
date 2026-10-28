import { ConflictException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SUB_ORDER_STATUS_CHANGED, SubOrderStatusChangedEvent } from './order-events';
import type { OrderRecord, OrderRepository, SubOrderRecord } from './order.repository';
import { OrdersService } from './orders.service';

class InMemoryOrderRepository implements OrderRepository {
  orders: OrderRecord[] = [];

  seed(overrides: Partial<SubOrderRecord> = {}): { order: OrderRecord; subOrder: SubOrderRecord } {
    const orderId = `order-${this.orders.length + 1}`;
    const subOrder: SubOrderRecord = {
      id: overrides.id ?? `${orderId}-sub-1`,
      orderId,
      sellerId: 'seller-1',
      subtotalCents: 5000,
      shippingCents: 0,
      status: 'pending',
      items: [],
      ...overrides,
    };
    const order: OrderRecord = {
      id: orderId,
      buyerId: 'buyer-1',
      totalCents: subOrder.subtotalCents,
      status: 'pending',
      createdAt: new Date(),
      subOrders: [subOrder],
    };
    this.orders.push(order);
    return { order, subOrder };
  }

  async createOrder(): Promise<OrderRecord> {
    throw new Error('not used in this spec');
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
  async findOrderItemContext(orderItemId: string) {
    for (const order of this.orders) {
      for (const subOrder of order.subOrders) {
        const item = subOrder.items.find((i) => i.id === orderItemId);
        if (item) {
          return {
            orderItemId,
            offerId: item.offerId,
            subOrderId: subOrder.id,
            sellerId: subOrder.sellerId,
            buyerId: order.buyerId,
            status: subOrder.status,
          };
        }
      }
    }
    return null;
  }
  async markOrderConfirmed(id: string) {
    const order = this.orders.find((o) => o.id === id);
    if (order) order.status = 'confirmed';
  }
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

function buildService() {
  const repository = new InMemoryOrderRepository();
  const events = new EventEmitter2();
  return { service: new OrdersService(repository, events), repository, events };
}

describe('OrdersService', () => {
  describe('findById', () => {
    it('throws when the order does not exist', async () => {
      const { service } = buildService();
      await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findSubOrdersBySeller', () => {
    it("returns only that seller's sub-orders across multiple orders, on the happy path", async () => {
      const { service, repository } = buildService();
      repository.seed({ id: 'sub-a', sellerId: 'seller-1' });
      repository.seed({ id: 'sub-b', sellerId: 'seller-2' });
      repository.seed({ id: 'sub-c', sellerId: 'seller-1' });

      const subOrders = await service.findSubOrdersBySeller('seller-1');

      expect(subOrders.map((so) => so.id).sort()).toEqual(['sub-a', 'sub-c']);
    });
  });

  describe('transitionSubOrderStatus', () => {
    it('moves paid -> shipped and emits a domain event, on the happy path', async () => {
      const { service, repository, events } = buildService();
      const { subOrder } = repository.seed({ status: 'paid' });
      const received: SubOrderStatusChangedEvent[] = [];
      events.on(SUB_ORDER_STATUS_CHANGED, (e: SubOrderStatusChangedEvent) => received.push(e));

      const updated = await service.transitionSubOrderStatus(subOrder.id, 'shipped');

      expect(updated.status).toBe('shipped');
      expect(received).toEqual([
        {
          subOrderId: subOrder.id,
          orderId: subOrder.orderId,
          sellerId: subOrder.sellerId,
          subtotalCents: subOrder.subtotalCents,
          from: 'paid',
          to: 'shipped',
        },
      ]);
    });

    it('moves shipped -> delivered on the happy path', async () => {
      const { service, repository } = buildService();
      const { subOrder } = repository.seed({ status: 'shipped' });

      const updated = await service.transitionSubOrderStatus(subOrder.id, 'delivered');

      expect(updated.status).toBe('delivered');
    });

    it('rejects skipping straight from pending to shipped', async () => {
      const { service, repository } = buildService();
      const { subOrder } = repository.seed({ status: 'pending' });

      await expect(service.transitionSubOrderStatus(subOrder.id, 'shipped')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rejects transitioning a sub-order that is already delivered', async () => {
      const { service, repository } = buildService();
      const { subOrder } = repository.seed({ status: 'delivered' });

      await expect(service.transitionSubOrderStatus(subOrder.id, 'shipped')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('throws when the sub-order does not exist', async () => {
      const { service } = buildService();

      await expect(service.transitionSubOrderStatus('missing', 'shipped')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('markOrderPaid', () => {
    it('confirms the order, marks every sub-order paid and emits one event each', async () => {
      const { service, repository, events } = buildService();
      const { order } = repository.seed({ status: 'pending' });
      const received: SubOrderStatusChangedEvent[] = [];
      events.on(SUB_ORDER_STATUS_CHANGED, (e: SubOrderStatusChangedEvent) => received.push(e));

      await service.markOrderPaid(order);

      expect((await repository.findById(order.id))?.status).toBe('confirmed');
      expect(received).toHaveLength(1);
      expect(received[0].to).toBe('paid');
    });
  });
});
