-- payments module. payments and split_transactions are append-only ledgers
-- for audit: a status change is a new row, never an UPDATE of an existing
-- one. "Current" state for an order/seller pair is the latest row by
-- created_at.
CREATE SCHEMA IF NOT EXISTS payments;

CREATE TABLE payments.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders.orders(id),
  gateway_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  method TEXT NOT NULL CHECK (method IN ('credit_card', 'pix', 'boleto')),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_payments_order_id ON payments.payments(order_id);
CREATE INDEX idx_payments_payments_gateway_id ON payments.payments(gateway_id);

CREATE TABLE payments.split_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments.payments(id),
  seller_id UUID NOT NULL REFERENCES seller.sellers(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  fee_cents INTEGER NOT NULL DEFAULT 0 CHECK (fee_cents >= 0),
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_split_transactions_payment_id ON payments.split_transactions(payment_id);
CREATE INDEX idx_payments_split_transactions_seller_id ON payments.split_transactions(seller_id);

-- Idempotency for POST /payments/charge: the Idempotency-Key header maps to
-- the response we already returned, so a retried request is a no-op.
CREATE TABLE payments.idempotency_keys (
  key TEXT PRIMARY KEY,
  order_id UUID NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotency for POST /payments/webhook, keyed by the gateway's event id.
CREATE TABLE payments.webhook_events (
  id TEXT PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
