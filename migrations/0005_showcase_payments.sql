ALTER TABLE notices ADD COLUMN payment_state TEXT NOT NULL DEFAULT 'unpaid';
ALTER TABLE notices ADD COLUMN paid_at TEXT;
ALTER TABLE notices ADD COLUMN deleted_at TEXT;
UPDATE notices SET payment_state='legacy' WHERE status='approved';
UPDATE notices SET status='draft' WHERE status='pending';
CREATE TABLE listing_payments (
 id TEXT PRIMARY KEY, listing_id TEXT NOT NULL, user_id TEXT NOT NULL,
 session_id TEXT UNIQUE, order_id TEXT UNIQUE, location_id TEXT, checkout_url TEXT, state TEXT NOT NULL DEFAULT 'creating',
 amount INTEGER NOT NULL DEFAULT 100, currency TEXT NOT NULL DEFAULT 'aud',
 created_at TEXT NOT NULL, expires_at INTEGER, paid_at TEXT,
 payment_intent TEXT, livemode INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX listing_payment_active ON listing_payments(listing_id) WHERE state IN ('creating','open','processing');
CREATE TABLE payment_events(id TEXT PRIMARY KEY, event_type TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE listing_images(id TEXT PRIMARY KEY, listing_id TEXT NOT NULL, author_id TEXT NOT NULL, mime TEXT NOT NULL, bytes BLOB NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX listing_images_listing ON listing_images(listing_id,created_at);
