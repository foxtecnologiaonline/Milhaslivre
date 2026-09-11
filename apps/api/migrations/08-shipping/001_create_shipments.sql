-- shipping module: one shipment per SubOrder, created once a label is
-- generated (post-payment). Quotes themselves aren't persisted — they're a
-- pure calculation used at checkout time to price sub_orders.shipping_cents.
CREATE SCHEMA IF NOT EXISTS shipping;

CREATE TABLE shipping.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_order_id UUID NOT NULL UNIQUE REFERENCES orders.sub_orders(id),
  carrier TEXT,
  tracking_code TEXT,
  status TEXT NOT NULL DEFAULT 'label_generated' CHECK (status IN ('label_generated', 'in_transit', 'delivered', 'failed')),
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  eta_days INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
