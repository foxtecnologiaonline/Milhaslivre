-- catalog module: categories, products, offers.
CREATE SCHEMA IF NOT EXISTS catalog;

CREATE TABLE catalog.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No category management endpoint in the MVP yet; seed a small starter set
-- so products have something to reference.
INSERT INTO catalog.categories (name, slug) VALUES
  ('Eletrônicos', 'eletronicos'),
  ('Moda', 'moda'),
  ('Casa', 'casa'),
  ('Outros', 'outros');

CREATE TABLE catalog.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category_id UUID REFERENCES catalog.categories(id),
  brand TEXT,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE catalog.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES catalog.products(id),
  seller_id UUID NOT NULL REFERENCES seller.sellers(id),
  price_cents INTEGER NOT NULL CHECK (price_cents > 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  condition TEXT NOT NULL CHECK (condition IN ('new', 'used')),
  sla_days INTEGER NOT NULL CHECK (sla_days > 0),
  is_buybox_winner BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_catalog_offers_product_id ON catalog.offers(product_id);
CREATE INDEX idx_catalog_offers_seller_id ON catalog.offers(seller_id);
