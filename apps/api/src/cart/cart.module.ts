import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { IdentityModule } from '../identity/identity.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { CART_REPOSITORY } from './cart.repository';
import { PgCartRepository } from './cart.repository.pg';

@Module({
  imports: [IdentityModule, CatalogModule],
  controllers: [CartController],
  providers: [CartService, { provide: CART_REPOSITORY, useClass: PgCartRepository }],
  exports: [CartService],
})
export class CartModule {}
