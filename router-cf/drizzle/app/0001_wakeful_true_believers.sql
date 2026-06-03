CREATE TABLE `verification_results` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`request_id` text NOT NULL,
	`original_fact` text NOT NULL,
	`domain` text DEFAULT 'general' NOT NULL,
	`url` text,
	`min_required` text,
	`results` text NOT NULL,
	`token_usage` text,
	`created_at` text DEFAULT '(datetime(''now''))'
);
--> statement-breakpoint
CREATE INDEX `idx_verification_results_user_id` ON `verification_results` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_verification_results_created_at` ON `verification_results` (`created_at`);