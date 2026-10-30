PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`base_level` integer DEFAULT 99 NOT NULL,
	`dex` integer DEFAULT 99 NOT NULL,
	`luk` integer DEFAULT 1 NOT NULL,
	`mastery` integer DEFAULT 0 NOT NULL,
	`default_kit_key` text DEFAULT 'outdoor' NOT NULL,
	`margin_percent` integer DEFAULT 20 NOT NULL,
	`currency_label` text DEFAULT 'z' NOT NULL,
	`planning_mode` text DEFAULT 'expected' NOT NULL,
	`theme` text DEFAULT 'dark' NOT NULL,
	CONSTRAINT "settings_singleton" CHECK("__new_settings"."id" = 1),
	CONSTRAINT "settings_theme" CHECK("__new_settings"."theme" in ('light', 'dark')),
	CONSTRAINT "settings_planning_mode" CHECK("__new_settings"."planning_mode" in ('expected', 'conservative'))
);
--> statement-breakpoint
INSERT INTO `__new_settings`("id", "base_level", "dex", "luk", "mastery", "default_kit_key", "margin_percent", "currency_label", "planning_mode", "theme") SELECT "id", "base_level", "dex", "luk", "mastery", "default_kit_key", "margin_percent", "currency_label", "planning_mode", "theme" FROM `settings`;--> statement-breakpoint
DROP TABLE `settings`;--> statement-breakpoint
ALTER TABLE `__new_settings` RENAME TO `settings`;--> statement-breakpoint
UPDATE `settings` SET `theme` = 'dark' WHERE `theme` = 'light';--> statement-breakpoint
PRAGMA foreign_keys=ON;