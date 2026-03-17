-- Rename users table to user (Better Auth convention)
ALTER TABLE `users` RENAME TO `user`;
--> statement-breakpoint
-- Rename full_name to name
ALTER TABLE `user` RENAME COLUMN `full_name` TO `name`;
--> statement-breakpoint
-- Rename avatar_url to image
ALTER TABLE `user` RENAME COLUMN `avatar_url` TO `image`;
--> statement-breakpoint
-- Add email_verified column
ALTER TABLE `user` ADD COLUMN `email_verified` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
-- Drop provider column (now tracked in account table)
ALTER TABLE `user` DROP COLUMN `provider`;
--> statement-breakpoint
-- Create session table
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL REFERENCES `user`(`id`),
	`token` text NOT NULL,
	`expires_at` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` text DEFAULT '(datetime(''now''))',
	`updated_at` text DEFAULT '(datetime(''now''))'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);
--> statement-breakpoint
-- Create account table
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL REFERENCES `user`(`id`),
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`access_token_expires_at` text,
	`refresh_token_expires_at` text,
	`scope` text,
	`id_token` text,
	`password` text,
	`created_at` text DEFAULT '(datetime(''now''))',
	`updated_at` text DEFAULT '(datetime(''now''))'
);
--> statement-breakpoint
-- Create verification table
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT '(datetime(''now''))',
	`updated_at` text DEFAULT '(datetime(''now''))'
);
