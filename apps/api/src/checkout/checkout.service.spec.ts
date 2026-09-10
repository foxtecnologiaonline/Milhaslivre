import { BadRequestException, ConflictException } from '@nestjs/common';
import { CartService } from '../cart/cart.service';
import type { AddCartItemInput, CartItemRecord, CartRepository } from '../cart/cart.repository';
import { CatalogService } from '../catalog/catalog.service';
import type { CreateOfferInput, OfferRecord, OfferRepository } from '../catalog/offer.repository';
import type {
  CategoryRecord,
  ProductRecord,
  ProductRepository,
} from '../catalog/product.repository';
import { InventoryService } from '../inventory/inventory.service';
import type {
  CreateReservationInput,
  ReservationRecord,
  ReservationRepository,
} from '../inventory/reservation.repository';
import type { CreateOrderInput, OrderRecord, OrderRepository } from '../orders/order.repository';
import { OrdersService } from '../orders/orders.service';
import type { SellerService } from '../seller/seller.service';
import { CheckoutService } from './checkout.service';

class NullProductRepository implements ProductRepository {
  async findById(): Promise<ProductRecord | null> {
    return null;
  }
  async search(): Promise<ProductRecord[]> {
    return [];
  }
  async create(): Promise<ProductRecord> {
    throw new Error('not used');
  }
  async findCategoryById(): Promise<CategoryRecord | null> {
    return null;
  }
}

class InMemoryOfferRepository implements OfferRepository {
  offers: OfferRecord[] = [];

  seed(overrides: Partial<OfferRecord> = {}): OfferRecord {
    const offer: OfferRecord = {
      id: `offer-${this.offers.length + 1}`,
      productId: 'product-1',
      sellerId: 'seller-1',
      priceCents: 1000,
      stock: 10,
      condition: 'new',
      slaDays: 3,
      isBuyboxWinner: false,
      createdAt: new Date(),
      ...overrides,
    };
    this.offers.push(offer);
    return offer;
  }

  async create(input: CreateOfferInput) {
    return this.seed(input);
  }
  async findByProductId(productId: string) {
    return this.offers.filter((o) => o.productId === productId);
  }
  async findById(id: string) {
    return this.offers.find((o) => o.id === id) ?? null;
  }
  async decrementStock(id: string, quantity: number) {
    const offer = this.offers.find((o) => o.id === id);
    if (!offer || offer.stock < quantity) return null;
    offer.stock -= quantity;
    return offer;
  }
  async incrementStock(id: string, quantity: number) {
    const offer = this.offers.find((o) => o.id === id);
    if (!offer) return null;
    offer.stock += quantity;
    return offer;
  }
  async setStock(id: string, quantity: number) {
    const offer = this.offers.find((o) => o.id === id);
    if (!offer) return null;
    offer.stock = quantity;
    return offer;
  }
}

class InMemoryCartRepository implements CartRepository {
  items: CartItemRecord[] = [];
  private counter = 0;

  async upsertItem(input: AddCartItemInput) {
    const item: CartItemRecord = {
      id: `cart-item-${++this.counter}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...input,
    };
    this.items.push(item);
    return item;
  }
  async findByBuyerId(buyerId: string) {
    return this.items.filter((i) => i.buyerId === buyerId);
  }
  async findById(id: string) {
    return this.items.find((i) => i.id === id) ?? null;
  }
  async removeItem(id: string) {
    this.items = this.items.filter((i) => i.id !== id);
  }
}

class InMemoryReservationRepository implements ReservationRepository {
  reservations: ReservationRecord[] = [];
  private counter = 0;

  async create(input: CreateReservationInput): Promise<ReservationRecord> {
    const reservation: ReservationRecord = {
      id: `reservation-${++this.counter}`,
      status: 'active',
      createdAt: new Date(),
      releasedAt: null,
      ...input,
    };
    this.reservations.push(reservation);
    return reservation;
  }
  async findById(id: string) {
    return this.reservations.find((r) => r.id === id) ?? null;
  }
  async markReleased(id: string): Promise<ReservationRecord> {
    const reservation = this.reservations.find((r) => r.id === id);
    if (!reservation) throw new Error('not found');
    reservation.status = 'released';
    reservation.releasedAt = new Date();
    return reservation;
  }
}

class InMemoryOrderRepository implements OrderRepository {
  orders: OrderRecord[] = [];
  private counter = 0;

  async createOrder(input: CreateOrderInput): Promise<OrderRecord> {
    const orderId = `order-${++this.counter}`;
    const subOrders = input.subOrders.map((subOrder, subIdx) => {
      const subOrderId = `${orderId}-sub-${subIdx}`;
      const subtotalCents = subOrder.items.reduce((sum, i) => sum + i.unitPriceCents * i.qty, 0);
      return {
        id: subOrderId,
        orderId,
        sellerId: subOrder.sellerId,
        subtotalCents,
        shippingCents: 0,
        status: 'pending',
        items: subOrder.items.map((item, itemIdx) => ({
          id: `${subOrderId}-item-${itemIdx}`,
          subOrderId,
          offerId: item.offerId,
          qty: item.qty,
          unitPriceCents: item.unitPriceCents,
        })),
      };
    });
    const order: OrderRecord = {
      id: orderId,
      buyerId: input.buyerId,
      totalCents: subOrders.reduce((sum, so) => sum + so.subtotalCents, 0),
      status: 'pending',
      createdAt: new Date(),
      subOrders,
    };
    this.orders.push(order);
    return order;
  }
}

function buildCheckout() {
  const offerRepository = new InMemoryOfferRepository();
  const sellerService = {} as unknown as SellerService;
  const catalogService = new CatalogService(new NullProductRepository(), offerRepository, sellerService);
  const cartRepository = new InMemoryCartRepository();
  const cartService = new CartService(cartRepository, catalogService);
  const reservationRepository = new InMemoryReservationRepository();
  const inventoryService = new InventoryService(reservationRepository, catalogService, sellerService);
  const orderRepository = new InMemoryOrderRepository();
  const ordersService = new OrdersService(orderRepository);
  const checkoutService = new CheckoutService(cartService, inventoryService, ordersService);

  return { checkoutService, cartService, offerRepository, cartRepository, reservationRepository };
}

describe('CheckoutService', () => {
  it('splits a multi-seller cart into one Order with one SubOrder per seller, on the happy path', async () => {
    const { checkoutService, cartService, offerRepository } = buildCheckout();
    const offerA = offerRepository.seed({ sellerId: 'seller-a', priceCents: 1000, stock: 10 });
    const offerB = offerRepository.seed({ sellerId: 'seller-b', priceCents: 2000, stock: 5 });
    await cartService.addItem('buyer-1', { offerId: offerA.id, quantity: 2 });
    await cartService.addItem('buyer-1', { offerId: offerB.id, quantity: 1 });

    const order = await checkoutService.checkout('buyer-1');

    expect(order.subOrders).toHaveLength(2);
    expect(order.totalCents).toBe(2 * 1000 + 1 * 2000);
    expect(offerRepository.offers.find((o) => o.id === offerA.id)?.stock).toBe(8);
    expect(offerRepository.offers.find((o) => o.id === offerB.id)?.stock).toBe(4);
    expect(await cartService.getCart('buyer-1')).toHaveLength(0);
  });

  it('rejects checkout with an empty cart', async () => {
    const { checkoutService } = buildCheckout();

    await expect(checkoutService.checkout('buyer-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rolls back reservations and keeps the cart intact when stock runs out mid-checkout', async () => {
    const { checkoutService, cartService, offerRepository, reservationRepository } = buildCheckout();
    const offerA = offerRepository.seed({ sellerId: 'seller-a', priceCents: 1000, stock: 10 });
    const offerB = offerRepository.seed({ sellerId: 'seller-b', priceCents: 2000, stock: 1 });
    await cartService.addItem('buyer-1', { offerId: offerA.id, quantity: 3 });
    await cartService.addItem('buyer-1', { offerId: offerB.id, quantity: 5 });

    await expect(checkoutService.checkout('buyer-1')).rejects.toBeInstanceOf(ConflictException);

    expect(offerRepository.offers.find((o) => o.id === offerA.id)?.stock).toBe(10);
    expect(offerRepository.offers.find((o) => o.id === offerB.id)?.stock).toBe(1);
    expect(reservationRepository.reservations.every((r) => r.status === 'released')).toBe(true);
    expect(await cartService.getCart('buyer-1')).toHaveLength(2);
  });
});
