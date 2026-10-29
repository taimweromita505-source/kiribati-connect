ALTER TABLE notices ADD COLUMN category TEXT NOT NULL DEFAULT 'Community';
ALTER TABLE notices ADD COLUMN employer TEXT;
ALTER TABLE notices ADD COLUMN contact TEXT;
ALTER TABLE notices ADD COLUMN closing_date TEXT;
ALTER TABLE notices ADD COLUMN expires_at TEXT;
ALTER TABLE notices ADD COLUMN updated_at TEXT;
ALTER TABLE notices ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE notices ADD COLUMN mutation_id TEXT;
CREATE INDEX notices_category_status_expiry ON notices(category,status,expires_at);
CREATE TABLE listing_events (
 id TEXT PRIMARY KEY, listing_id TEXT NOT NULL, actor_id TEXT NOT NULL,
 action TEXT NOT NULL, version INTEGER NOT NULL, created_at TEXT NOT NULL,
 snapshot_json TEXT NOT NULL
);
CREATE INDEX listing_events_listing ON listing_events(listing_id,created_at);
