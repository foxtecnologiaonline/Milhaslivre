import { NotFoundException } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
import type { CreateOfferInput, OfferRecord, OfferRepository } from '../catalog/offer.repository';
import type {
  CategoryRecord,
  ProductRecord,
  ProductRepository,
} from '../catalog/product.repository';
import type { SellerService } from '../seller/seller.service';
import { CartService } from './cart.service';
import type { AddCartItemInput, CartItemRecord, CartRepository } from './cart.repository';

class NullProductRepository implements ProductRepository {
  async findById(): Promise<ProductRecord | null> {
    return null;
  }
  async search(): Promise<ProductRecord[]> {
    return [];
  }
  async create(): Promise<ProductRecord> {
    throw new Error('not used in cart tests');
  }
  async findCategoryById(): Promise<CategoryRecord | null> {
    return null;
  }
  async setBlocked(): Promise<ProductRecord | null> {
    return null;
  }
}

class InMemoryOfferRepository implements OfferRepository {
  offers: OfferRecord[] = [];

  seed(overrides: Partial<OfferRecord> = {}): OfferRecord {
    const offer: OfferRecord = {
      id: 'offer-1',
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

  async create(input: CreateOfferInput): Promise<OfferRecord> {
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

  async upsertItem(input: AddCartItemInput): Promise<CartItemRecord> {
    const existing = this.items.find(
      (i) => i.buyerId === input.buyerId && i.offerId === input.offerId,
    );
    if (existing) {
      existing.quantity += input.quantity;
      existing.updatedAt = new Date();
      return existing;
    }
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

function buildService() {
  const offerRepository = new InMemoryOfferRepository();
  const sellerService = {} as unknown as SellerService;
  const catalogService = new CatalogService(new NullProductRepository(), offerRepository, sellerService);
  const cartRepository = new InMemoryCartRepository();
  const cartService = new CartService(cartRepository, catalogService);

  return { cartService, cartRepository, offerRepository };
}

describe('CartService', () => {
  describe('addItem', () => {
    it('adds a new item on the happy path', async () => {
      const { cartService, offerRepository } = buildService();
      const offer = offerRepository.seed();

      const item = await cartService.addItem('buyer-1', { offerId: offer.id, quantity: 2 });

      expect(item).toMatchObject({ buyerId: 'buyer-1', offerId: offer.id, quantity: 2 });
    });

    it('merges quantity when the same offer is added again', async () => {
      const { cartService, offerRepository } = buildService();
      const offer = offerRepository.seed();

      await cartService.addItem('buyer-1', { offerId: offer.id, quantity: 2 });
      const second = await cartService.addItem('buyer-1', { offerId: offer.id, quantity: 3 });

      expect(second.quantity).toBe(5);
    });

    it('rejects adding an offer that does not exist', async () => {
      const { cartService } = buildService();

      await expect(cartService.addItem('buyer-1', { offerId: 'missing', quantity: 1 })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('getCart', () => {
    it('returns the items enriched with offer data on the happy path', async () => {
      const { cartService, offerRepository } = buildService();
      const offer = offerRepository.seed({ priceCents: 2500 });
      await cartService.addItem('buyer-1', { offerId: offer.id, quantity: 1 });

      const cart = await cartService.getCart('buyer-1');

      expect(cart).toHaveLength(1);
      expect(cart[0].offer.priceCents).toBe(2500);
    });

    it("does not return another buyer's items", async () => {
      const { cartService, offerRepository } = buildService();
      const offer = offerRepository.seed();
      await cartService.addItem('buyer-1', { offerId: offer.id, quantity: 1 });

      const cart = await cartService.getCart('buyer-2');

      expect(cart).toHaveLength(0);
    });
  });

  describe('removeItem', () => {
    it('removes the item on the happy path', async () => {
      const { cartService, offerRepository } = buildService();
      const offer = offerRepository.seed();
      const item = await cartService.addItem('buyer-1', { offerId: offer.id, quantity: 1 });

      await cartService.removeItem('buyer-1', item.id);

      expect(await cartService.getCart('buyer-1')).toHaveLength(0);
    });

    it("rejects removing another buyer's item", async () => {
      const { cartService, offerRepository } = buildService();
      const offer = offerRepository.seed();
      const item = await cartService.addItem('buyer-1', { offerId: offer.id, quantity: 1 });

      await expect(cartService.removeItem('buyer-2', item.id)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
