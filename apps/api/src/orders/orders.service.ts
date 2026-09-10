import { Inject, Injectable } from '@nestjs/common';
import { CreateOrderInput, ORDER_REPOSITORY, OrderRecord, OrderRepository } from './order.repository';

@Injectable()
export class OrdersService {
  constructor(@Inject(ORDER_REPOSITORY) private readonly repository: OrderRepository) {}

  async createOrder(input: CreateOrderInput): Promise<OrderRecord> {
    return this.repository.createOrder(input);
  }
}
