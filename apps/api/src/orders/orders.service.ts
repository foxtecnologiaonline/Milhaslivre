import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SUB_ORDER_STATUS_CHANGED, SubOrderStatusChangedEvent } from './order-events';
import {
  CreateOrderInput,
  ORDER_REPOSITORY,
  OrderRecord,
  OrderRepository,
  SubOrderRecord,
} from './order.repository';

// Legal manual transitions via PATCH /suborders/:id/status. 'paid' is never
// reachable here — only payments (via markOrderPaid) can set it, since
// letting a seller self-report a payment would be a real security hole.
const MANUAL_TRANSITIONS: Record<string, string[]> = {
  paid: ['shipped'],
  shipped: ['delivered'],
};

@Injectable()
export class OrdersService {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly repository: OrderRepository,
    private readonly events: EventEmitter2,
  ) {}

  async createOrder(input: CreateOrderInput): Promise<OrderRecord> {
    return this.repository.createOrder(input);
  }

  async findById(id: string): Promise<OrderRecord> {
    const order = await this.repository.findById(id);
    if (!order) {
      throw new NotFoundException('order not found');
    }
    return order;
  }

  async findSubOrderById(id: string): Promise<SubOrderRecord> {
    const subOrder = await this.repository.findSubOrderById(id);
    if (!subOrder) {
      throw new NotFoundException('sub-order not found');
    }
    return subOrder;
  }

  async findSubOrdersBySeller(sellerId: string): Promise<SubOrderRecord[]> {
    return this.repository.findSubOrdersBySellerId(sellerId);
  }

  // Called by payments once a charge is confirmed paid: confirms the Order
  // and marks every SubOrder paid, emitting one domain event per SubOrder
  // transition (pending -> paid) — even though everything runs in-process
  // today, the event is what a future queue-backed consumer (e.g. seller
  // payout, notifications) would subscribe to.
  async markOrderPaid(order: OrderRecord): Promise<void> {
    await this.repository.markOrderConfirmed(order.id);
    for (const subOrder of order.subOrders) {
      const from = subOrder.status;
      await this.repository.updateSubOrderStatus(subOrder.id, 'paid');
      this.emitStatusChanged(subOrder, from, 'paid');
    }
  }

  // Manual transitions a seller (or admin) drives themselves: paid -> shipped
  // -> delivered. Same event as the payment-driven transition above.
  async transitionSubOrderStatus(subOrderId: string, to: 'shipped' | 'delivered'): Promise<SubOrderRecord> {
    const subOrder = await this.findSubOrderById(subOrderId);
    const from = subOrder.status;
    const allowed = MANUAL_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new ConflictException(`cannot transition sub-order from ${from} to ${to}`);
    }

    const updated = await this.repository.updateSubOrderStatus(subOrderId, to);
    this.emitStatusChanged(subOrder, from, to);
    return updated;
  }

  private emitStatusChanged(subOrder: SubOrderRecord, from: string, to: string): void {
    const event: SubOrderStatusChangedEvent = {
      subOrderId: subOrder.id,
      orderId: subOrder.orderId,
      sellerId: subOrder.sellerId,
      subtotalCents: subOrder.subtotalCents,
      from,
      to,
    };
    this.events.emit(SUB_ORDER_STATUS_CHANGED, event);
  }
}
