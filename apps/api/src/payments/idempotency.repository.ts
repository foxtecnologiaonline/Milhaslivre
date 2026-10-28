export interface IdempotencyRecord {
  key: string;
  orderId: string;
  response: unknown;
}

export const IDEMPOTENCY_REPOSITORY = Symbol('IDEMPOTENCY_REPOSITORY');

export interface IdempotencyRepository {
  find(key: string): Promise<IdempotencyRecord | null>;
  store(key: string, orderId: string, response: unknown): Promise<void>;
}
