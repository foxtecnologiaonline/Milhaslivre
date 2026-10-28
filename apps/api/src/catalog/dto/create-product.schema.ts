import { z } from 'zod';

export const createProductSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  brand: z.string().min(1).optional(),
  categoryId: z.string().uuid().optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
});

export type CreateProductDto = z.infer<typeof createProductSchema>;
