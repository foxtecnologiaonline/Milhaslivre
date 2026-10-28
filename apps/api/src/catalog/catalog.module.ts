import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { SellerModule } from '../seller/seller.module';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { OFFER_REPOSITORY } from './offer.repository';
import { PgOfferRepository } from './offer.repository.pg';
import { PRODUCT_REPOSITORY } from './product.repository';
import { PgProductRepository } from './product.repository.pg';

@Module({
  imports: [IdentityModule, SellerModule],
  controllers: [CatalogController],
  providers: [
    CatalogService,
    { provide: PRODUCT_REPOSITORY, useClass: PgProductRepository },
    { provide: OFFER_REPOSITORY, useClass: PgOfferRepository },
  ],
  exports: [CatalogService],
})
export class CatalogModule {}
