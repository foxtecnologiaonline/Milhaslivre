import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SUB_ORDER_STATUS_CHANGED, SubOrderStatusChangedEvent } from './order-events';
import {
  CreateOrderInput,
  ORDER_REPOSITORY,
  OrderRecord,
  OrderRepository,
  SubOrderRecord,
} from './order.repository';

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

  // Called by payments once a charge is confirmed paid: confirms the Order
  // and marks every SubOrder paid, emitting one domain event per SubOrder
  // transition (pending -> paid) — even though everything runs in-process
  // today, the event is what a future queue-backed consumer (e.g. seller
  // payout, notifications) would subscribe to.
  async markOrderPaid(order: OrderRecord): Promise<void> {
    await this.repository.markOrderConfirmed(order.id);
    for (const subOrder of order.subOrders) {
      await this.repository.markSubOrderPaid(subOrder.id);
      const event: SubOrderStatusChangedEvent = {
        subOrderId: subOrder.id,
        orderId: order.id,
        sellerId: subOrder.sellerId,
        subtotalCents: subOrder.subtotalCents,
        from: subOrder.status,
        to: 'paid',
      };
      this.events.emit(SUB_ORDER_STATUS_CHANGED, event);
    }
  }
}
