import { z } from 'zod';

export const createOfferSchema = z.object({
  priceCents: z.number().int().positive(),
  stock: z.number().int().nonnegative(),
  condition: z.enum(['new', 'used']),
  slaDays: z.number().int().positive(),
});

export type CreateOfferDto = z.infer<typeof createOfferSchema>;
