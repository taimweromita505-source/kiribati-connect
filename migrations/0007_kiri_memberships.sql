CREATE TABLE kiri_memberships (
 user_id TEXT PRIMARY KEY REFERENCES users(id),
 state TEXT NOT NULL DEFAULT 'inactive' CHECK(state IN ('inactive','active')),
 paid_until TEXT NOT NULL,
 payment_id TEXT UNIQUE,
 confirmed_at TEXT,
 livemode INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL
);
CREATE TABLE kiri_checkouts (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
 plan TEXT NOT NULL CHECK(plan IN ('monthly','yearly')),
 order_id TEXT UNIQUE, approval_url TEXT, capture_id TEXT UNIQUE,
 state TEXT NOT NULL DEFAULT 'creating', livemode INTEGER NOT NULL,
 created_at TEXT NOT NULL, paid_at TEXT, fulfilled_at TEXT
);
CREATE UNIQUE INDEX kiri_checkout_active ON kiri_checkouts(user_id,plan,livemode) WHERE state IN ('creating','open','processing');
