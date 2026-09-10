import { BadRequestException, Injectable } from '@nestjs/common';
import { CartService } from '../cart/cart.service';
import type { CartItemWithOffer } from '../cart/cart.service';
import { InventoryService } from '../inventory/inventory.service';
import type { OrderRecord } from '../orders/order.repository';
import { OrdersService } from '../orders/orders.service';

@Injectable()
export class CheckoutService {
  constructor(
    private readonly cartService: CartService,
    private readonly inventoryService: InventoryService,
    private readonly ordersService: OrdersService,
  ) {}

  async checkout(buyerId: string): Promise<OrderRecord> {
    const cartItems = await this.cartService.getCart(buyerId);
    if (cartItems.length === 0) {
      throw new BadRequestException('cart is empty');
    }

    const reservations: { offerId: string; reservationId: string }[] = [];
    try {
      for (const item of cartItems) {
        const reservation = await this.inventoryService.reserve(item.offerId, item.quantity);
        reservations.push({ offerId: item.offerId, reservationId: reservation.id });
      }

      const order = await this.ordersService.createOrder({
        buyerId,
        subOrders: groupBySeller(cartItems),
      });

      for (const item of cartItems) {
        await this.cartService.removeItem(buyerId, item.id);
      }

      return order;
    } catch (err) {
      // Compensate: release any reservation already made in this attempt
      // before the failure, so a partial checkout never leaves stock stuck.
      await Promise.all(
        reservations.map((r) => this.inventoryService.release(r.offerId, r.reservationId).catch(() => undefined)),
      );
      throw err;
    }
  }
}

function groupBySeller(cartItems: CartItemWithOffer[]) {
  const bySeller = new Map<string, CartItemWithOffer[]>();
  for (const item of cartItems) {
    const items = bySeller.get(item.offer.sellerId) ?? [];
    items.push(item);
    bySeller.set(item.offer.sellerId, items);
  }

  return Array.from(bySeller.entries()).map(([sellerId, items]) => ({
    sellerId,
    items: items.map((item) => ({
      offerId: item.offerId,
      qty: item.quantity,
      unitPriceCents: item.offer.priceCents,
    })),
  }));
}
