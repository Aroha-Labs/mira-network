CREATE TABLE `credit_history` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount` real NOT NULL,
	`description` text,
	`created_at` text DEFAULT '(datetime(''now''))'
);
--> statement-breakpoint
CREATE INDEX `idx_credit_history_user_id` ON `credit_history` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_credit_history_created_at` ON `credit_history` (`created_at`);--> statement-breakpoint
CREATE TABLE `usage_summary` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`model` text NOT NULL,
	`request_count` integer DEFAULT 0,
	`prompt_tokens` integer DEFAULT 0,
	`completion_tokens` integer DEFAULT 0,
	`total_cost` real DEFAULT 0,
	`avg_response_time` real DEFAULT 0,
	`avg_ttft` real DEFAULT 0,
	`created_at` text DEFAULT '(datetime(''now''))'
);
--> statement-breakpoint
CREATE INDEX `idx_usage_summary_user_date` ON `usage_summary` (`user_id`,`date`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_user_date_model` ON `usage_summary` (`user_id`,`date`,`model`);