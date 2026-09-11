import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HealthController } from './health/health.controller';
import { DatabaseModule } from './database/database.module';
import { validateEnv } from './config/env.schema';
import { IdentityModule } from './identity/identity.module';
import { SellerModule } from './seller/seller.module';
import { CatalogModule } from './catalog/catalog.module';
import { InventoryModule } from './inventory/inventory.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { CheckoutModule } from './checkout/checkout.module';
import { PaymentsModule } from './payments/payments.module';
import { ShippingModule } from './shipping/shipping.module';
import { ReviewsModule } from './reviews/reviews.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    EventEmitterModule.forRoot(),
    DatabaseModule,
    IdentityModule,
    SellerModule,
    CatalogModule,
    InventoryModule,
    CartModule,
    OrdersModule,
    ShippingModule,
    CheckoutModule,
    PaymentsModule,
    ReviewsModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
