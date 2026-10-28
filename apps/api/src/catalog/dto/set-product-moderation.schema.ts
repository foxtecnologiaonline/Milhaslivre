import { z } from 'zod';

export const setProductModerationSchema = z.object({
  isBlocked: z.boolean(),
});

export type SetProductModerationDto = z.infer<typeof setProductModerationSchema>;
