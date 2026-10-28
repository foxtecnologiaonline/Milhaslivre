import { z } from 'zod';

export const labelSchema = z.object({
  subOrderId: z.string().uuid(),
});

export type LabelDto = z.infer<typeof labelSchema>;
