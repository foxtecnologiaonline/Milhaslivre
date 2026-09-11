import { z } from 'zod';

export const createReviewSchema = z.object({
  orderItemId: z.string().uuid(),
  targetType: z.enum(['product', 'seller']),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1).max(2000).optional(),
});

export type CreateReviewDto = z.infer<typeof createReviewSchema>;
