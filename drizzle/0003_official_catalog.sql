CREATE TABLE `cooking_kits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`seed_key` text,
	`name` text NOT NULL,
	`produce_value` integer NOT NULL,
	`always_success` integer DEFAULT false NOT NULL,
	`origin` text NOT NULL,
	`reference_price` integer,
	`unit_value` integer,
	`archived` integer DEFAULT false NOT NULL,
	CONSTRAINT "cooking_kits_origin" CHECK("cooking_kits"."origin" in ('official', 'custom'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cooking_kits_seed_key_unique` ON `cooking_kits` (`seed_key`);--> statement-breakpoint
CREATE TABLE `ingredients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`seed_key` text,
	`name` text NOT NULL,
	`origin` text NOT NULL,
	`reference_price` integer,
	`unit_value` integer,
	`archived` integer DEFAULT false NOT NULL,
	CONSTRAINT "ingredients_origin" CHECK("ingredients"."origin" in ('official', 'custom'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ingredients_seed_key_unique` ON `ingredients` (`seed_key`);--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`seed_key` text,
	`name` text NOT NULL,
	`stat` text NOT NULL,
	`level` integer NOT NULL,
	`weight` integer NOT NULL,
	`hp_regen` integer NOT NULL,
	`sp_regen` integer NOT NULL,
	`stat_bonus` integer NOT NULL,
	`cookbook_label` text NOT NULL,
	`origin` text NOT NULL,
	`diverged` integer DEFAULT false NOT NULL,
	`sale_price_override` integer,
	`archived` integer DEFAULT false NOT NULL,
	CONSTRAINT "recipes_origin" CHECK("recipes"."origin" in ('official', 'custom')),
	CONSTRAINT "recipes_stat" CHECK("recipes"."stat" in ('str', 'agi', 'vit', 'int', 'dex', 'luk'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recipes_seed_key_unique` ON `recipes` (`seed_key`);--> statement-breakpoint
CREATE TABLE `recipe_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recipe_id` integer NOT NULL,
	`ingredient_id` integer NOT NULL,
	`quantity` integer NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "recipe_items_quantity" CHECK("recipe_items"."quantity" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_items_recipe_position` ON `recipe_items` (`recipe_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_items_recipe_ingredient` ON `recipe_items` (`recipe_id`,`ingredient_id`);