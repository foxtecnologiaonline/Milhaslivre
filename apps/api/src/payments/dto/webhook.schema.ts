import { z } from 'zod';

// Approximates Pagar.me v5's webhook envelope: { id, type, data: { id, status, ... } }.
// data.id is the gateway's charge/order id, matched against payments.gateway_id.
export const webhookSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  data: z.object({
    id: z.string().min(1),
    status: z.string().min(1),
  }),
});

export type WebhookDto = z.infer<typeof webhookSchema>;
