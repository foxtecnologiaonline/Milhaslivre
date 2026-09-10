import { z } from 'zod';

export const addCartItemSchema = z.object({
  offerId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

export type AddCartItemDto = z.infer<typeof addCartItemSchema>;
