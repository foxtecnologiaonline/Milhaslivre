import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { SellerService } from '../seller/seller.service';
import type { SellerRecord } from '../seller/seller.repository';
import { CatalogService } from './catalog.service';
import type {
  CreateOfferInput,
  OfferRecord,
  OfferRepository,
} from './offer.repository';
import type {
  CategoryRecord,
  CreateProductInput,
  ProductRecord,
  ProductRepository,
  SearchOptions,
} from './product.repository';

class InMemoryProductRepository implements ProductRepository {
  products: ProductRecord[] = [];
  categories: CategoryRecord[] = [{ id: 'cat-1', name: 'Eletrônicos', slug: 'eletronicos' }];
  private counter = 0;

  async findById(id: string) {
    return this.products.find((p) => p.id === id) ?? null;
  }

  async search(query: string | undefined, options?: SearchOptions) {
    const visible = options?.includeBlocked ? this.products : this.products.filter((p) => !p.isBlocked);
    if (!query) return visible;
    return visible.filter((p) => p.title.toLowerCase().includes(query.toLowerCase()));
  }

  async create(input: CreateProductInput) {
    const product: ProductRecord = { id: `product-${++this.counter}`, createdAt: new Date(), isBlocked: false, ...input };
    this.products.push(product);
    return product;
  }

  async findCategoryById(id: string) {
    return this.categories.find((c) => c.id === id) ?? null;
  }

  async setBlocked(id: string, isBlocked: boolean) {
    const product = this.products.find((p) => p.id === id);
    if (!product) return null;
    product.isBlocked = isBlocked;
    return product;
  }
}

class InMemoryOfferRepository implements OfferRepository {
  offers: OfferRecord[] = [];
  private counter = 0;

  async create(input: CreateOfferInput) {
    const offer: OfferRecord = {
      id: `offer-${++this.counter}`,
      isBuyboxWinner: false,
      createdAt: new Date(),
      ...input,
    };
    this.offers.push(offer);
    return offer;
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

const approvedSeller: SellerRecord = {
  id: 'seller-1',
  userId: 'user-1',
  companyName: 'Loja da Ana',
  document: '12345678900',
  status: 'approved',
  rejectedReason: null,
  createdAt: new Date(),
  approvedAt: new Date(),
  recipientId: null,
};

function buildService(sellerOverrides?: Partial<SellerService>) {
  const products = new InMemoryProductRepository();
  const offers = new InMemoryOfferRepository();
  const sellerService = {
    getApprovedSellerForUser: jest.fn().mockResolvedValue(approvedSeller),
    ...sellerOverrides,
  } as unknown as SellerService;

  return { service: new CatalogService(products, offers, sellerService), products, offers, sellerService };
}

const baseProductDto = { title: 'Notebook', description: 'Um notebook', attributes: {} };

describe('CatalogService', () => {
  describe('createProduct', () => {
    it('creates a product on the happy path', async () => {
      const { service } = buildService();

      const product = await service.createProduct(baseProductDto);

      expect(product).toMatchObject({ title: 'Notebook' });
    });

    it('rejects an unknown categoryId', async () => {
      const { service } = buildService();

      await expect(
        service.createProduct({ ...baseProductDto, categoryId: 'does-not-exist' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('findProductById', () => {
    it('returns the product with its offers on the happy path', async () => {
      const { service } = buildService();
      const product = await service.createProduct(baseProductDto);
      await service.createOffer('user-1', product.id, {
        priceCents: 1000,
        stock: 5,
        condition: 'new',
        slaDays: 3,
      });

      const found = await service.findProductById(product.id);

      expect(found.offers).toHaveLength(1);
    });

    it('throws when the product does not exist', async () => {
      const { service } = buildService();

      await expect(service.findProductById('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('setProductBlocked', () => {
    it('blocks a product and hides it from search, but not from admin listing', async () => {
      const { service } = buildService();
      const product = await service.createProduct(baseProductDto);

      const blocked = await service.setProductBlocked(product.id, true);

      expect(blocked.isBlocked).toBe(true);
      expect(await service.searchProducts(undefined)).toHaveLength(0);
      expect(await service.listAllProductsForAdmin()).toHaveLength(1);
    });

    it('throws when the product does not exist', async () => {
      const { service } = buildService();

      await expect(service.setProductBlocked('missing', true)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('createOffer', () => {
    it('creates an offer for an approved seller on the happy path', async () => {
      const { service } = buildService();
      const product = await service.createProduct(baseProductDto);

      const offer = await service.createOffer('user-1', product.id, {
        priceCents: 5000,
        stock: 10,
        condition: 'new',
        slaDays: 2,
      });

      expect(offer).toMatchObject({ productId: product.id, sellerId: approvedSeller.id });
    });

    it('propagates rejection when the seller is not approved', async () => {
      const { service } = buildService({
        getApprovedSellerForUser: jest.fn().mockRejectedValue(new ForbiddenException()),
      });
      const product = await service.createProduct(baseProductDto);

      await expect(
        service.createOffer('user-1', product.id, {
          priceCents: 5000,
          stock: 10,
          condition: 'new',
          slaDays: 2,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws when the product does not exist', async () => {
      const { service } = buildService();

      await expect(
        service.createOffer('user-1', 'missing', {
          priceCents: 5000,
          stock: 10,
          condition: 'new',
          slaDays: 2,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
