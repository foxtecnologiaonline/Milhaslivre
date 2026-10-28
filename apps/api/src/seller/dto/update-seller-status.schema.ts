import { z } from 'zod';

export const updateSellerStatusSchema = z
  .object({
    status: z.enum(['approved', 'rejected']),
    reason: z.string().min(1).optional(),
  })
  .refine((data) => data.status !== 'rejected' || !!data.reason, {
    message: 'reason is required when rejecting a seller',
    path: ['reason'],
  });

export type UpdateSellerStatusDto = z.infer<typeof updateSellerStatusSchema>;
