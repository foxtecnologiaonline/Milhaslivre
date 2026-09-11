import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { MelhorEnvioModule } from '../melhorenvio/melhorenvio.module';
import { OrdersModule } from '../orders/orders.module';
import { SellerModule } from '../seller/seller.module';
import { SHIPMENT_REPOSITORY } from './shipment.repository';
import { PgShipmentRepository } from './shipment.repository.pg';
import { ShippingController } from './shipping.controller';
import { ShippingService } from './shipping.service';

@Module({
  imports: [IdentityModule, SellerModule, OrdersModule, MelhorEnvioModule],
  controllers: [ShippingController],
  providers: [ShippingService, { provide: SHIPMENT_REPOSITORY, useClass: PgShipmentRepository }],
  exports: [ShippingService],
})
export class ShippingModule {}
