import { Module } from '@nestjs/common';
import { ORDER_REPOSITORY } from './order.repository';
import { PgOrderRepository } from './order.repository.pg';
import { OrdersService } from './orders.service';

// No controller yet — GET /orders/:id, GET /sellers/:id/orders and
// PATCH /suborders/:id/status land here in backlog item 10. For now this
// module only owns the orders.* schema and exposes creation for checkout.
@Module({
  providers: [OrdersService, { provide: ORDER_REPOSITORY, useClass: PgOrderRepository }],
  exports: [OrdersService],
})
export class OrdersModule {}
