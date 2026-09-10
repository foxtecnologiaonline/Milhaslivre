import type { OfferCondition } from './types';

export interface OfferRecord {
  id: string;
  productId: string;
  sellerId: string;
  priceCents: number;
  stock: number;
  condition: OfferCondition;
  slaDays: number;
  isBuyboxWinner: boolean;
  createdAt: Date;
}

export interface CreateOfferInput {
  productId: string;
  sellerId: string;
  priceCents: number;
  stock: number;
  condition: OfferCondition;
  slaDays: number;
}

export const OFFER_REPOSITORY = Symbol('OFFER_REPOSITORY');

export interface OfferRepository {
  create(input: CreateOfferInput): Promise<OfferRecord>;
  findByProductId(productId: string): Promise<OfferRecord[]>;
}
