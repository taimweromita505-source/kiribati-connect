CREATE TABLE listing_comments (
 id TEXT PRIMARY KEY,
 listing_id TEXT NOT NULL REFERENCES notices(id),
 author_id TEXT NOT NULL REFERENCES users(id),
 body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 1000),
 created_at TEXT NOT NULL,
 deleted_at TEXT,
 deleted_by TEXT
);
CREATE INDEX listing_comments_feed ON listing_comments(listing_id,created_at DESC,id DESC) WHERE deleted_at IS NULL;
CREATE INDEX listing_comments_author_time ON listing_comments(author_id,created_at);
