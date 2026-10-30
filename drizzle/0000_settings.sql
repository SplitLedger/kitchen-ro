CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`base_level` integer DEFAULT 99 NOT NULL,
	`dex` integer DEFAULT 99 NOT NULL,
	`luk` integer DEFAULT 1 NOT NULL,
	`mastery` integer DEFAULT 0 NOT NULL,
	`default_kit_key` text DEFAULT 'outdoor' NOT NULL,
	`margin_percent` integer DEFAULT 20 NOT NULL,
	`currency_label` text DEFAULT 'z' NOT NULL,
	`planning_mode` text DEFAULT 'expected' NOT NULL,
	`theme` text DEFAULT 'light' NOT NULL,
	CONSTRAINT "settings_singleton" CHECK("settings"."id" = 1),
	CONSTRAINT "settings_theme" CHECK("settings"."theme" in ('light', 'dark')),
	CONSTRAINT "settings_planning_mode" CHECK("settings"."planning_mode" in ('expected', 'conservative'))
);
