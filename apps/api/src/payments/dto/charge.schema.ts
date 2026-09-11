import { z } from 'zod';

export const chargeSchema = z.object({
  orderId: z.string().uuid(),
  method: z.enum(['credit_card', 'pix', 'boleto']),
  cardToken: z.string().optional(),
});

export type ChargeDto = z.infer<typeof chargeSchema>;
