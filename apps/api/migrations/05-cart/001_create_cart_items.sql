-- cart module: one buyer's cart is the set of cart_items rows for that buyer_id.
CREATE SCHEMA IF NOT EXISTS cart;

CREATE TABLE cart.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL,
  offer_id UUID NOT NULL REFERENCES catalog.offers(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (buyer_id, offer_id)
);

CREATE INDEX idx_cart_cart_items_buyer_id ON cart.cart_items(buyer_id);
