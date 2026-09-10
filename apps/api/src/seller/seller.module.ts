import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { SELLER_REPOSITORY } from './seller.repository';
import { PgSellerRepository } from './seller.repository.pg';
import { SellerController } from './seller.controller';
import { SellerService } from './seller.service';

@Module({
  imports: [IdentityModule],
  controllers: [SellerController],
  providers: [SellerService, { provide: SELLER_REPOSITORY, useClass: PgSellerRepository }],
  exports: [SellerService],
})
export class SellerModule {}
