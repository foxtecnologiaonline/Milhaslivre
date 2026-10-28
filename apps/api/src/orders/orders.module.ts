import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { SellerModule } from '../seller/seller.module';
import { ORDER_REPOSITORY } from './order.repository';
import { PgOrderRepository } from './order.repository.pg';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [IdentityModule, SellerModule],
  controllers: [OrdersController],
  providers: [OrdersService, { provide: ORDER_REPOSITORY, useClass: PgOrderRepository }],
  exports: [OrdersService],
})
export class OrdersModule {}
