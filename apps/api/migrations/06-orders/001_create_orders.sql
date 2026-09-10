-- orders module: Order + N SubOrder (one per seller) + line items.
-- Only the tables and the creation path land here (backlog item 7,
-- checkout); GET/PATCH endpoints and status-transition events land on this
-- same schema in backlog item 10.
CREATE SCHEMA IF NOT EXISTS orders;

CREATE TABLE orders.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL,
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE orders.sub_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders.orders(id),
  seller_id UUID NOT NULL REFERENCES seller.sellers(id),
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  shipping_cents INTEGER NOT NULL DEFAULT 0 CHECK (shipping_cents >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'shipped', 'delivered', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE orders.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_order_id UUID NOT NULL REFERENCES orders.sub_orders(id),
  offer_id UUID NOT NULL REFERENCES catalog.offers(id),
  qty INTEGER NOT NULL CHECK (qty > 0),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents > 0)
);

CREATE INDEX idx_orders_sub_orders_order_id ON orders.sub_orders(order_id);
CREATE INDEX idx_orders_sub_orders_seller_id ON orders.sub_orders(seller_id);
CREATE INDEX idx_orders_order_items_sub_order_id ON orders.order_items(sub_order_id);
