export interface CartItemRecord {
  id: string;
  buyerId: string;
  offerId: string;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AddCartItemInput {
  buyerId: string;
  offerId: string;
  quantity: number;
}

export const CART_REPOSITORY = Symbol('CART_REPOSITORY');

export interface CartRepository {
  upsertItem(input: AddCartItemInput): Promise<CartItemRecord>;
  findByBuyerId(buyerId: string): Promise<CartItemRecord[]>;
  findById(id: string): Promise<CartItemRecord | null>;
  removeItem(id: string): Promise<void>;
}
