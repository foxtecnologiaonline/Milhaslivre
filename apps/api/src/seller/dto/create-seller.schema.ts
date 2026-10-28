import { z } from 'zod';

export const createSellerSchema = z.object({
  companyName: z.string().min(1),
  document: z.string().min(11),
});

export type CreateSellerDto = z.infer<typeof createSellerSchema>;
