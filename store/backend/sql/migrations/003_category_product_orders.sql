CREATE TABLE IF NOT EXISTS `category_product_orders` (
  `category_id` int NOT NULL,
  `product_id` int NOT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`category_id`,`product_id`),
  KEY `idx_category_product_orders_product` (`product_id`),
  KEY `idx_category_product_orders_sort` (`category_id`,`sort_order`,`product_id`),
  CONSTRAINT `fk_category_product_orders_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_category_product_orders_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
