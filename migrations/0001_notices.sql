CREATE TABLE `notices` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`island` text NOT NULL,
	`author_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`reviewed_at` text,
	`reviewed_by` text,
	`review_note` text
);
--> statement-breakpoint
CREATE INDEX `notices_status_created` ON `notices` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `notices_author_status` ON `notices` (`author_id`,`status`);