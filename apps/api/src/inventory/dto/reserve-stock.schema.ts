import { z } from 'zod';

export const reserveStockSchema = z.object({
  quantity: z.number().int().positive(),
});

export type ReserveStockDto = z.infer<typeof reserveStockSchema>;
