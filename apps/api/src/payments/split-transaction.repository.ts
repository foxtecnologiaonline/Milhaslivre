export type SplitTransactionStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface SplitTransactionRecord {
  id: string;
  paymentId: string;
  sellerId: string;
  amountCents: number;
  feeCents: number;
  status: SplitTransactionStatus;
  createdAt: Date;
}

export interface CreateSplitTransactionInput {
  paymentId: string;
  sellerId: string;
  amountCents: number;
  feeCents: number;
  status: SplitTransactionStatus;
}

export const SPLIT_TRANSACTION_REPOSITORY = Symbol('SPLIT_TRANSACTION_REPOSITORY');

// payments.split_transactions is append-only, same rule as payments.payments.
export interface SplitTransactionRepository {
  insertMany(inputs: CreateSplitTransactionInput[]): Promise<SplitTransactionRecord[]>;
  findByPaymentId(paymentId: string): Promise<SplitTransactionRecord[]>;
}
