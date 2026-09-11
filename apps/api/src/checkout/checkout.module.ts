import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { IdentityModule } from '../identity/identity.module';
import { InventoryModule } from '../inventory/inventory.module';
import { OrdersModule } from '../orders/orders.module';
import { ShippingModule } from '../shipping/shipping.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';

@Module({
  imports: [IdentityModule, CartModule, InventoryModule, OrdersModule, ShippingModule],
  controllers: [CheckoutController],
  providers: [CheckoutService],
})
export class CheckoutModule {}
