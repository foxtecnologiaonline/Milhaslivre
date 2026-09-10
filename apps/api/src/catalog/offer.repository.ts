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
  findById(id: string): Promise<OfferRecord | null>;
  findByProductId(productId: string): Promise<OfferRecord[]>;
  // Single conditional UPDATE (stock = stock - qty WHERE stock >= qty) — the
  // WHERE guard is the optimistic-concurrency check, so this either succeeds
  // atomically or reports the precondition (enough stock) no longer holds.
  decrementStock(id: string, quantity: number): Promise<OfferRecord | null>;
  incrementStock(id: string, quantity: number): Promise<OfferRecord | null>;
  setStock(id: string, quantity: number): Promise<OfferRecord | null>;
}
