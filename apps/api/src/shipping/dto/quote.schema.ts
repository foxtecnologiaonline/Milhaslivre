import { z } from 'zod';

export const quoteSchema = z.object({
  toZipCode: z.string().min(8),
  weightGrams: z.number().int().positive(),
  declaredValueCents: z.number().int().positive(),
});

export type QuoteDto = z.infer<typeof quoteSchema>;
