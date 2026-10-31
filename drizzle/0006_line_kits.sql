PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_order_lines` (
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
	`kit_id` integer,
	`kit_override` integer DEFAULT false NOT NULL,
	`kit_name` text,
	`always_success` integer,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`kit_id`) REFERENCES `cooking_kits`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "order_lines_quantity" CHECK("__new_order_lines"."quantity" >= 1),
	CONSTRAINT "order_lines_stat" CHECK("__new_order_lines"."stat" in ('str', 'agi', 'vit', 'int', 'dex', 'luk')),
	CONSTRAINT "order_lines_sale_source" CHECK("__new_order_lines"."sale_source" is null or "__new_order_lines"."sale_source" in ('margin', 'recipe', 'line'))
);
--> statement-breakpoint
INSERT INTO `__new_order_lines`("id", "order_id", "recipe_id", "position", "name", "stat", "level", "ingredient_count", "quantity", "min_rate_bp", "avg_rate_bp", "max_rate_bp", "used_rate_bp", "attempts", "one_attempt_cost", "unit_cost", "unit_sale", "sale_source", "sale_override", "kit_id", "kit_override", "kit_name", "always_success")
SELECT `order_lines`.`id`, `order_lines`.`order_id`, `order_lines`.`recipe_id`, `order_lines`.`position`, `order_lines`.`name`, `order_lines`.`stat`, `order_lines`.`level`, `order_lines`.`ingredient_count`, `order_lines`.`quantity`, `order_lines`.`min_rate_bp`, `order_lines`.`avg_rate_bp`, `order_lines`.`max_rate_bp`, `order_lines`.`used_rate_bp`, `order_lines`.`attempts`, `order_lines`.`one_attempt_cost`, `order_lines`.`unit_cost`, `order_lines`.`unit_sale`, `order_lines`.`sale_source`, `order_lines`.`sale_override`, NULL, 0, CASE WHEN `orders`.`status` IS NOT NULL AND `orders`.`status` != 'draft' THEN `orders`.`kit_name` ELSE NULL END, CASE WHEN `orders`.`status` IS NOT NULL AND `orders`.`status` != 'draft' THEN `orders`.`always_success` ELSE NULL END
FROM `order_lines`
LEFT JOIN `orders` ON `orders`.`id` = `order_lines`.`order_id`;--> statement-breakpoint
DROP TABLE `order_lines`;--> statement-breakpoint
ALTER TABLE `__new_order_lines` RENAME TO `order_lines`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `order_lines_order_position` ON `order_lines` (`order_id`,`position`);
