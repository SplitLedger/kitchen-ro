CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_name` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`planning_mode` text DEFAULT 'expected' NOT NULL,
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
	CONSTRAINT "orders_status" CHECK("orders"."status" in ('draft', 'confirmed', 'done', 'cancelled')),
	CONSTRAINT "orders_planning_mode" CHECK("orders"."planning_mode" in ('expected', 'conservative'))
);
--> statement-breakpoint
CREATE TABLE `order_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`recipe_id` integer,
	`position` integer NOT NULL,
	`name` text NOT NULL,
	`stat` text NOT NULL,
	`level` integer NOT NULL,
	`ingredient_count` integer NOT NULL,
	`quantity` integer NOT NULL,
	`min_rate_bp` integer,
	`avg_rate_bp` integer,
	`max_rate_bp` integer,
	`used_rate_bp` integer,
	`attempts` integer,
	`one_attempt_cost` integer,
	`unit_cost` integer,
	`unit_sale` integer,
	`sale_source` text,
	`sale_override` integer,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "order_lines_quantity" CHECK("order_lines"."quantity" >= 1),
	CONSTRAINT "order_lines_stat" CHECK("order_lines"."stat" in ('str', 'agi', 'vit', 'int', 'dex', 'luk')),
	CONSTRAINT "order_lines_sale_source" CHECK("order_lines"."sale_source" is null or "order_lines"."sale_source" in ('margin', 'recipe', 'line'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `order_lines_order_position` ON `order_lines` (`order_id`,`position`);--> statement-breakpoint
CREATE TABLE `order_materials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`position` integer NOT NULL,
	`kind` text NOT NULL,
	`ingredient_id` integer,
	`kit_id` integer,
	`name` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_value` integer,
	`extended_cost` integer,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`kit_id`) REFERENCES `cooking_kits`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "order_materials_kind" CHECK("order_materials"."kind" in ('ingredient', 'kit')),
	CONSTRAINT "order_materials_quantity" CHECK("order_materials"."quantity" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `order_materials_order_position` ON `order_materials` (`order_id`,`position`);
