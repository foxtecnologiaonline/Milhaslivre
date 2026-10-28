-- Pagar.me split needs a recipient_id per seller, registered with the
-- gateway at approval time (see payments module, backlog item 8).
ALTER TABLE seller.sellers ADD COLUMN recipient_id TEXT;
