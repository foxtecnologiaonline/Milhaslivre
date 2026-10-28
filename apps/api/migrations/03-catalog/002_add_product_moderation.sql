-- Admin catalog moderation (backlog item 14): a blocked product is hidden
-- from search/listing but stays reachable by direct id (e.g. so the admin
-- panel can still open it to unblock).
ALTER TABLE catalog.products ADD COLUMN is_blocked BOOLEAN NOT NULL DEFAULT false;
