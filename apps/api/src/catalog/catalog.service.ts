import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SellerService } from '../seller/seller.service';
import type { CreateOfferDto } from './dto/create-offer.schema';
import type { CreateProductDto } from './dto/create-product.schema';
import { OFFER_REPOSITORY, OfferRecord, OfferRepository } from './offer.repository';
import { PRODUCT_REPOSITORY, ProductRecord, ProductRepository } from './product.repository';

export interface ProductWithOffers extends ProductRecord {
  offers: OfferRecord[];
}

@Injectable()
export class CatalogService {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    @Inject(OFFER_REPOSITORY) private readonly offers: OfferRepository,
    private readonly sellerService: SellerService,
  ) {}

  async createProduct(dto: CreateProductDto): Promise<ProductRecord> {
    if (dto.categoryId) {
      const category = await this.products.findCategoryById(dto.categoryId);
      if (!category) {
        throw new BadRequestException('unknown categoryId');
      }
    }

    return this.products.create({
      title: dto.title,
      description: dto.description,
      categoryId: dto.categoryId ?? null,
      brand: dto.brand ?? null,
      attributes: dto.attributes ?? {},
    });
  }

  async findProductById(id: string): Promise<ProductWithOffers> {
    const product = await this.products.findById(id);
    if (!product) {
      throw new NotFoundException('product not found');
    }
    const offers = await this.offers.findByProductId(id);
    return { ...product, offers };
  }

  async searchProducts(query: string | undefined): Promise<ProductRecord[]> {
    return this.products.search(query);
  }

  // Admin catalog moderation: the storefront listing above always hides
  // blocked products, this one is for the admin panel to see everything.
  async listAllProductsForAdmin(): Promise<ProductRecord[]> {
    return this.products.search(undefined, { includeBlocked: true });
  }

  async setProductBlocked(id: string, isBlocked: boolean): Promise<ProductRecord> {
    const updated = await this.products.setBlocked(id, isBlocked);
    if (!updated) {
      throw new NotFoundException('product not found');
    }
    return updated;
  }

  async createOffer(userId: string, productId: string, dto: CreateOfferDto): Promise<OfferRecord> {
    const product = await this.products.findById(productId);
    if (!product) {
      throw new NotFoundException('product not found');
    }

    const seller = await this.sellerService.getApprovedSellerForUser(userId);

    return this.offers.create({
      productId,
      sellerId: seller.id,
      priceCents: dto.priceCents,
      stock: dto.stock,
      condition: dto.condition,
      slaDays: dto.slaDays,
    });
  }

  async getOfferById(id: string): Promise<OfferRecord> {
    const offer = await this.offers.findById(id);
    if (!offer) {
      throw new NotFoundException('offer not found');
    }
    return offer;
  }

  async reserveOfferStock(offerId: string, quantity: number): Promise<OfferRecord> {
    const updated = await this.offers.decrementStock(offerId, quantity);
    if (updated) return updated;

    await this.getOfferById(offerId);
    throw new ConflictException('insufficient stock');
  }

  async releaseOfferStock(offerId: string, quantity: number): Promise<OfferRecord> {
    const updated = await this.offers.incrementStock(offerId, quantity);
    if (!updated) {
      throw new NotFoundException('offer not found');
    }
    return updated;
  }

  async setOfferStock(offerId: string, quantity: number): Promise<OfferRecord> {
    const updated = await this.offers.setStock(offerId, quantity);
    if (!updated) {
      throw new NotFoundException('offer not found');
    }
    return updated;
  }
}
