CREATE TABLE `memories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`npc_id` text NOT NULL,
	`kind` text NOT NULL,
	`summary_en` text NOT NULL,
	`summary_zh` text NOT NULL,
	`intensity` real DEFAULT 0.5 NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer,
	FOREIGN KEY (`npc_id`) REFERENCES `npcs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_memories_npc_created` ON `memories` (`npc_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `npcs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`home` text NOT NULL,
	`location` text NOT NULL,
	`activity` text NOT NULL,
	`goal` text NOT NULL,
	`mood` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`health` real DEFAULT 3 NOT NULL,
	`max_health` real DEFAULT 3 NOT NULL,
	`energy` real DEFAULT 80 NOT NULL,
	`curiosity` real DEFAULT 50 NOT NULL,
	`sociability` real DEFAULT 50 NOT NULL,
	`courage` real DEFAULT 50 NOT NULL,
	`trust_player` real DEFAULT 0 NOT NULL,
	`fear_player` real DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `processed_actions` (
	`action_id` text PRIMARY KEY NOT NULL,
	`result_json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `relationships` (
	`source_id` text NOT NULL,
	`target_id` text NOT NULL,
	`affinity` real DEFAULT 0 NOT NULL,
	`trust` real DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`source_id`, `target_id`),
	FOREIGN KEY (`source_id`) REFERENCES `npcs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_id`) REFERENCES `npcs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `world_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`summary_en` text NOT NULL,
	`summary_zh` text NOT NULL,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_world_events_created` ON `world_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `world_state` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
