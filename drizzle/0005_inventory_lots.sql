CREATE TABLE `inventory_lots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ingredient_id` integer,
	`kit_id` integer,
	`quantity` integer NOT NULL,
	`unit_price` integer NOT NULL,
	`source` text NOT NULL,
	`acquired_on` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`kit_id`) REFERENCES `cooking_kits`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "inventory_lots_quantity" CHECK("inventory_lots"."quantity" >= 0),
	CONSTRAINT "inventory_lots_unit_price" CHECK("inventory_lots"."unit_price" >= 0),
	CONSTRAINT "inventory_lots_source" CHECK("inventory_lots"."source" in ('bought', 'farmed')),
	CONSTRAINT "inventory_lots_owner" CHECK((
        ("inventory_lots"."ingredient_id" is not null and "inventory_lots"."kit_id" is null) or
        ("inventory_lots"."ingredient_id" is null and "inventory_lots"."kit_id" is not null)
      ))
);
--> statement-breakpoint
CREATE TABLE `order_allocations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`lot_id` integer,
	`ingredient_id` integer,
	`kit_id` integer,
	`quantity` integer NOT NULL,
	`unit_price` integer NOT NULL,
	`source` text NOT NULL,
	`acquired_on` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lot_id`) REFERENCES `inventory_lots`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`kit_id`) REFERENCES `cooking_kits`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "order_allocations_quantity" CHECK("order_allocations"."quantity" >= 1),
	CONSTRAINT "order_allocations_unit_price" CHECK("order_allocations"."unit_price" >= 0),
	CONSTRAINT "order_allocations_source" CHECK("order_allocations"."source" in ('bought', 'farmed')),
	CONSTRAINT "order_allocations_owner" CHECK((
        ("order_allocations"."ingredient_id" is not null and "order_allocations"."kit_id" is null) or
        ("order_allocations"."ingredient_id" is null and "order_allocations"."kit_id" is not null)
      ))
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_name` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`planning_mode` text DEFAULT 'expected' NOT NULL,
	`price_basis` text DEFAULT 'average' NOT NULL,
	`kit_id` integer,
	`kit_name` text NOT NULL,
	`produce_value` integer NOT NULL,
	`always_success` integer NOT NULL,
	`base_level` integer NOT NULL,
	`dex` integer NOT NULL,
	`luk` integer NOT NULL,
	`mastery` integer NOT NULL,
	`margin_percent` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`confirmed_at` text,
	FOREIGN KEY (`kit_id`) REFERENCES `cooking_kits`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "orders_status" CHECK("__new_orders"."status" in ('draft', 'confirmed', 'done', 'cancelled')),
	CONSTRAINT "orders_planning_mode" CHECK("__new_orders"."planning_mode" in ('expected', 'conservative')),
	CONSTRAINT "orders_price_basis" CHECK("__new_orders"."price_basis" in ('minimum', 'average', 'maximum'))
);
--> statement-breakpoint
INSERT INTO `__new_orders`("id", "customer_name", "notes", "status", "planning_mode", "price_basis", "kit_id", "kit_name", "produce_value", "always_success", "base_level", "dex", "luk", "mastery", "margin_percent", "created_at", "updated_at", "confirmed_at") SELECT "id", "customer_name", "notes", "status", "planning_mode", 'average', "kit_id", "kit_name", "produce_value", "always_success", "base_level", "dex", "luk", "mastery", "margin_percent", "created_at", "updated_at", "confirmed_at" FROM `orders`;--> statement-breakpoint
DROP TABLE `orders`;--> statement-breakpoint
ALTER TABLE `__new_orders` RENAME TO `orders`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`base_level` integer DEFAULT 99 NOT NULL,
	`dex` integer DEFAULT 99 NOT NULL,
	`luk` integer DEFAULT 1 NOT NULL,
	`mastery` integer DEFAULT 0 NOT NULL,
	`default_kit_key` text DEFAULT 'outdoor' NOT NULL,
	`margin_percent` integer DEFAULT 20 NOT NULL,
	`currency_label` text DEFAULT 'zeny' NOT NULL,
	`planning_mode` text DEFAULT 'expected' NOT NULL,
	`price_basis` text DEFAULT 'average' NOT NULL,
	`theme` text DEFAULT 'dark' NOT NULL,
	CONSTRAINT "settings_singleton" CHECK("__new_settings"."id" = 1),
	CONSTRAINT "settings_theme" CHECK("__new_settings"."theme" in ('light', 'dark')),
	CONSTRAINT "settings_planning_mode" CHECK("__new_settings"."planning_mode" in ('expected', 'conservative')),
	CONSTRAINT "settings_price_basis" CHECK("__new_settings"."price_basis" in ('minimum', 'average', 'maximum'))
);
--> statement-breakpoint
INSERT INTO `__new_settings`("id", "base_level", "dex", "luk", "mastery", "default_kit_key", "margin_percent", "currency_label", "planning_mode", "price_basis", "theme") SELECT "id", "base_level", "dex", "luk", "mastery", "default_kit_key", "margin_percent", "currency_label", "planning_mode", 'average', "theme" FROM `settings`;--> statement-breakpoint
DROP TABLE `settings`;--> statement-breakpoint
ALTER TABLE `__new_settings` RENAME TO `settings`;--> statement-breakpoint
INSERT INTO `inventory_lots` ("ingredient_id", "quantity", "unit_price", "source", "acquired_on", "note")
SELECT "id", 1, "unit_value", 'bought', date('now'), 'Imported from unit price'
FROM `ingredients`
WHERE "unit_value" IS NOT NULL;--> statement-breakpoint
INSERT INTO `inventory_lots` ("kit_id", "quantity", "unit_price", "source", "acquired_on", "note")
SELECT "id", 1, "unit_value", 'bought', date('now'), 'Imported from unit price'
FROM `cooking_kits`
WHERE "unit_value" IS NOT NULL;--> statement-breakpoint
ALTER TABLE `cooking_kits` DROP COLUMN `unit_value`;--> statement-breakpoint
ALTER TABLE `ingredients` DROP COLUMN `unit_value`;