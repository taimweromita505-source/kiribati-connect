CREATE TABLE paypal_checkouts (
 id TEXT PRIMARY KEY, listing_id TEXT NOT NULL, user_id TEXT NOT NULL,
 order_id TEXT UNIQUE, approval_url TEXT, capture_id TEXT UNIQUE,
 state TEXT NOT NULL DEFAULT 'creating', livemode INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL, paid_at TEXT
);
CREATE UNIQUE INDEX paypal_checkout_active ON paypal_checkouts(listing_id,livemode) WHERE state IN ('creating','open','processing');
