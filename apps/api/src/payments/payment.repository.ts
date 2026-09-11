export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type PaymentMethod = 'credit_card' | 'pix' | 'boleto';

export interface PaymentRecord {
  id: string;
  orderId: string;
  gatewayId: string | null;
  status: PaymentStatus;
  method: PaymentMethod;
  totalCents: number;
  createdAt: Date;
}

export interface CreatePaymentInput {
  orderId: string;
  gatewayId: string | null;
  status: PaymentStatus;
  method: PaymentMethod;
  totalCents: number;
}

export const PAYMENT_REPOSITORY = Symbol('PAYMENT_REPOSITORY');

// payments.payments is append-only: every state change is a new row, never
// an UPDATE. "Current" state is the latest row for an order/gateway id.
export interface PaymentRepository {
  insert(input: CreatePaymentInput): Promise<PaymentRecord>;
  findLatestByOrderId(orderId: string): Promise<PaymentRecord | null>;
  findLatestByGatewayId(gatewayId: string): Promise<PaymentRecord | null>;
}
