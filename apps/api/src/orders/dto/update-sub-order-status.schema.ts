import { z } from 'zod';

export const updateSubOrderStatusSchema = z.object({
  status: z.enum(['shipped', 'delivered']),
});

export type UpdateSubOrderStatusDto = z.infer<typeof updateSubOrderStatusSchema>;
