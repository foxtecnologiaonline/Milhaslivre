import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { IdentityModule } from '../identity/identity.module';
import { SellerModule } from '../seller/seller.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { RESERVATION_REPOSITORY } from './reservation.repository';
import { PgReservationRepository } from './reservation.repository.pg';

@Module({
  imports: [IdentityModule, SellerModule, CatalogModule],
  controllers: [InventoryController],
  providers: [
    InventoryService,
    { provide: RESERVATION_REPOSITORY, useClass: PgReservationRepository },
  ],
  exports: [InventoryService],
})
export class InventoryModule {}
