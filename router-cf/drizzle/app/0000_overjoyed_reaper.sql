CREATE TABLE `flows` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`system_prompt` text NOT NULL,
	`variables` text,
	`created_at` text DEFAULT '(datetime(''now''))',
	`updated_at` text DEFAULT '(datetime(''now''))'
);
--> statement-breakpoint
CREATE INDEX `idx_flows_user_id` ON `flows` (`user_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`name` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`description` text,
	`updated_at` text DEFAULT '(datetime(''now''))'
);
