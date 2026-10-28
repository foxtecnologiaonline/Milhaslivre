-- inventory module: stock reservations. The stock counter itself lives on
-- catalog.offers (owned by the catalog module); this table only tracks the
-- reserve/release audit trail exposed by this module's endpoints.
CREATE SCHEMA IF NOT EXISTS inventory;

CREATE TABLE inventory.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES catalog.offers(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'released')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at TIMESTAMPTZ
);

CREATE INDEX idx_inventory_reservations_offer_id ON inventory.reservations(offer_id);
