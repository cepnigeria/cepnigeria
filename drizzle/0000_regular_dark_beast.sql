CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`membership_number` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`phone` text NOT NULL,
	`email` text,
	`password_hash` text NOT NULL,
	`category` text NOT NULL,
	`state` text NOT NULL,
	`lga` text NOT NULL,
	`ward` text NOT NULL,
	`pvc_status` text,
	`political_affiliation` text,
	`referral_code` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_membership_number_unique` ON `members` (`membership_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `members_phone_unique` ON `members` (`phone`);--> statement-breakpoint
CREATE UNIQUE INDEX `members_referral_code_unique` ON `members` (`referral_code`);--> statement-breakpoint
CREATE TABLE `organization_units` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`parent_id` text,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `positions` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`unit_id` text,
	`parent_position_id` text,
	`allows_deputy` integer DEFAULT true NOT NULL,
	`allows_assistant` integer DEFAULT true NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `whatsapp_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`invite_url` text NOT NULL,
	`unit_id` text,
	`active` integer DEFAULT true NOT NULL
);
