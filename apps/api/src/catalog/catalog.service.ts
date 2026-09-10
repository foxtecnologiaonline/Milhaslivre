import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
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
}
