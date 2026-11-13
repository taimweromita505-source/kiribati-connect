CREATE TABLE IF NOT EXISTS email_alerts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  island TEXT NOT NULL DEFAULT 'All islands',
  boats INTEGER NOT NULL DEFAULT 1,
  jobs INTEGER NOT NULL DEFAULT 1,
  digest INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  last_sent_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_alerts_digest ON email_alerts (digest, last_sent_at);
