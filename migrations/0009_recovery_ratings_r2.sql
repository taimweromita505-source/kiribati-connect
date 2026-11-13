CREATE TABLE password_resets(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at INTEGER NOT NULL,used_at INTEGER);
CREATE INDEX password_resets_user ON password_resets(user_id);
CREATE TABLE listing_ratings(listing_id TEXT NOT NULL,user_id TEXT NOT NULL REFERENCES users(id),stars INTEGER NOT NULL CHECK(stars BETWEEN 1 AND 5),review TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,PRIMARY KEY(listing_id,user_id));
CREATE INDEX listing_ratings_listing ON listing_ratings(listing_id);
ALTER TABLE listing_images ADD COLUMN r2_key TEXT;
