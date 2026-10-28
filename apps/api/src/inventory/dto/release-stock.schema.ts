import { z } from 'zod';

export const releaseStockSchema = z.object({
  reservationId: z.string().uuid(),
});

export type ReleaseStockDto = z.infer<typeof releaseStockSchema>;
