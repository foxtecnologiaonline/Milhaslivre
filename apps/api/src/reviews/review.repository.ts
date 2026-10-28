export type ReviewTargetType = 'product' | 'seller';

export interface ReviewRecord {
  id: string;
  orderItemId: string;
  authorId: string;
  targetType: ReviewTargetType;
  productId: string | null;
  sellerId: string | null;
  rating: number;
  comment: string | null;
  createdAt: Date;
}

export interface CreateReviewInput {
  orderItemId: string;
  authorId: string;
  targetType: ReviewTargetType;
  productId: string | null;
  sellerId: string | null;
  rating: number;
  comment: string | null;
}

export const REVIEW_REPOSITORY = Symbol('REVIEW_REPOSITORY');

export interface ReviewRepository {
  create(input: CreateReviewInput): Promise<ReviewRecord>;
  findByOrderItemAndTarget(orderItemId: string, targetType: ReviewTargetType): Promise<ReviewRecord | null>;
  findByProductId(productId: string): Promise<ReviewRecord[]>;
}
