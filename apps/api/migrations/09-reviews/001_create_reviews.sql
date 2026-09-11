-- reviews module: a buyer reviews a product or a seller, tied to the
-- order_item that proves they actually bought it. One review per
-- (order_item, target_type) — a buyer can review the product and the
-- seller separately for the same purchase, but not twice for the same target.
CREATE SCHEMA IF NOT EXISTS reviews;

CREATE TABLE reviews.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES orders.order_items(id),
  author_id UUID NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('product', 'seller')),
  product_id UUID REFERENCES catalog.products(id),
  seller_id UUID REFERENCES seller.sellers(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_item_id, target_type),
  CHECK (
    (target_type = 'product' AND product_id IS NOT NULL AND seller_id IS NULL) OR
    (target_type = 'seller' AND seller_id IS NOT NULL AND product_id IS NULL)
  )
);

CREATE INDEX idx_reviews_reviews_product_id ON reviews.reviews(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX idx_reviews_reviews_seller_id ON reviews.reviews(seller_id) WHERE seller_id IS NOT NULL;
