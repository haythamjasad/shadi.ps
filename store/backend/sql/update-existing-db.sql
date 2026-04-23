-- Safe migration for existing databases.
-- This file only creates missing tables and adds missing columns.
-- It is designed to preserve existing data.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `admin_password_resets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `admin_id` int NOT NULL,
  `email` varchar(255) NOT NULL,
  `code_hash` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL,
  `attempt_count` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_admin_id` (`admin_id`),
  KEY `idx_reset_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cities` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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

CREATE TABLE IF NOT EXISTS `site_banner` (
  `id` int NOT NULL,
  `image_url` text,
  `feature_tabs` json DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `payment_gateway_settings` (
  `id` int NOT NULL,
  `enabled` tinyint(1) DEFAULT '1',
  `api_url` varchar(255) DEFAULT NULL,
  `secret_key` text,
  `webhook_secret` text,
  `currency` varchar(10) DEFAULT 'ILS',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `store_settings` (
  `id` int NOT NULL,
  `currency` varchar(10) DEFAULT 'ILS',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP PROCEDURE IF EXISTS ensure_column;
DELIMITER $$
CREATE PROCEDURE ensure_column(IN p_table VARCHAR(64), IN p_column VARCHAR(64), IN p_ddl TEXT)
BEGIN
  IF EXISTS (
    SELECT 1
      FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = p_table
  ) AND NOT EXISTS (
    SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = p_table
       AND COLUMN_NAME = p_column
  ) THEN
    SET @migration_sql = p_ddl;
    PREPARE migration_stmt FROM @migration_sql;
    EXECUTE migration_stmt;
    DEALLOCATE PREPARE migration_stmt;
  END IF;
END $$
DELIMITER ;

CALL ensure_column('products', 'categories', 'ALTER TABLE `products` ADD COLUMN `categories` JSON NULL AFTER `category`');
CALL ensure_column('admin_users', 'is_super_admin', 'ALTER TABLE `admin_users` ADD COLUMN `is_super_admin` TINYINT(1) NOT NULL DEFAULT 0 AFTER `password_hash`');
CALL ensure_column('admin_users', 'permissions', 'ALTER TABLE `admin_users` ADD COLUMN `permissions` JSON NULL AFTER `is_super_admin`');
CALL ensure_column('categories', 'sort_order', 'ALTER TABLE `categories` ADD COLUMN `sort_order` INT NOT NULL DEFAULT 0 AFTER `name`');
CALL ensure_column('products', 'color_options', 'ALTER TABLE `products` ADD COLUMN `color_options` JSON NULL AFTER `categories`');
CALL ensure_column('products', 'image_urls', 'ALTER TABLE `products` ADD COLUMN `image_urls` JSON NULL AFTER `image_url`');
CALL ensure_column('products', 'docs', 'ALTER TABLE `products` ADD COLUMN `docs` JSON NULL AFTER `image_urls`');
CALL ensure_column('products', 'links', 'ALTER TABLE `products` ADD COLUMN `links` JSON NULL AFTER `docs`');
CALL ensure_column('products', 'is_hidden', 'ALTER TABLE `products` ADD COLUMN `is_hidden` TINYINT(1) DEFAULT 0 AFTER `is_available`');
CALL ensure_column('products', 'show_on_home', 'ALTER TABLE `products` ADD COLUMN `show_on_home` TINYINT(1) DEFAULT 0 AFTER `is_hidden`');
CALL ensure_column('products', 'updated_at', 'ALTER TABLE `products` ADD COLUMN `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER `created_at`');

CALL ensure_column('orders', 'customer_email', 'ALTER TABLE `orders` ADD COLUMN `customer_email` VARCHAR(255) NULL AFTER `customer_phone`');
CALL ensure_column('orders', 'address_line2', 'ALTER TABLE `orders` ADD COLUMN `address_line2` VARCHAR(255) NULL AFTER `address_line1`');
CALL ensure_column('orders', 'state', 'ALTER TABLE `orders` ADD COLUMN `state` VARCHAR(120) NULL AFTER `city`');
CALL ensure_column('orders', 'country', 'ALTER TABLE `orders` ADD COLUMN `country` VARCHAR(120) NOT NULL DEFAULT ''فلسطين'' AFTER `state`');
CALL ensure_column('orders', 'postal_code', 'ALTER TABLE `orders` ADD COLUMN `postal_code` VARCHAR(30) NULL AFTER `country`');
CALL ensure_column('orders', 'notes', 'ALTER TABLE `orders` ADD COLUMN `notes` TEXT NULL AFTER `postal_code`');
CALL ensure_column('orders', 'subtotal', 'ALTER TABLE `orders` ADD COLUMN `subtotal` DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER `notes`');
CALL ensure_column('orders', 'tax', 'ALTER TABLE `orders` ADD COLUMN `tax` DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER `subtotal`');
CALL ensure_column('orders', 'shipping', 'ALTER TABLE `orders` ADD COLUMN `shipping` DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER `tax`');
CALL ensure_column('orders', 'total', 'ALTER TABLE `orders` ADD COLUMN `total` DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER `shipping`');
CALL ensure_column('orders', 'status', 'ALTER TABLE `orders` ADD COLUMN `status` VARCHAR(50) DEFAULT ''pending_payment'' AFTER `total`');

CALL ensure_column('order_items', 'color_name', 'ALTER TABLE `order_items` ADD COLUMN `color_name` VARCHAR(255) NULL AFTER `product_name`');
CALL ensure_column('order_items', 'color_hex', 'ALTER TABLE `order_items` ADD COLUMN `color_hex` VARCHAR(20) NULL AFTER `color_name`');

CALL ensure_column('payments', 'order_payload', 'ALTER TABLE `payments` ADD COLUMN `order_payload` JSON NULL AFTER `raw_response`');

CALL ensure_column('smtp_settings', 'label', 'ALTER TABLE `smtp_settings` ADD COLUMN `label` VARCHAR(120) NULL AFTER `id`');
CALL ensure_column('smtp_settings', 'from_name', 'ALTER TABLE `smtp_settings` ADD COLUMN `from_name` VARCHAR(255) NULL AFTER `password`');
CALL ensure_column('smtp_settings', 'from_email', 'ALTER TABLE `smtp_settings` ADD COLUMN `from_email` VARCHAR(255) NULL AFTER `from_name`');
CALL ensure_column('smtp_settings', 'notify_email', 'ALTER TABLE `smtp_settings` ADD COLUMN `notify_email` VARCHAR(255) NULL AFTER `from_email`');
CALL ensure_column('smtp_settings', 'is_active', 'ALTER TABLE `smtp_settings` ADD COLUMN `is_active` TINYINT(1) DEFAULT 0 AFTER `notify_email`');
CALL ensure_column('smtp_settings', 'created_at', 'ALTER TABLE `smtp_settings` ADD COLUMN `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP AFTER `is_active`');
CALL ensure_column('smtp_settings', 'updated_at', 'ALTER TABLE `smtp_settings` ADD COLUMN `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER `created_at`');

CALL ensure_column('site_banner', 'feature_tabs', 'ALTER TABLE `site_banner` ADD COLUMN `feature_tabs` JSON NULL AFTER `image_url`');

INSERT IGNORE INTO `categories` (`name`)
SELECT DISTINCT TRIM(`category`)
FROM `products`
WHERE `category` IS NOT NULL AND TRIM(`category`) <> '';

UPDATE `categories` c
JOIN (
  SELECT `id`, ROW_NUMBER() OVER (ORDER BY `name` ASC, `id` ASC) AS seq
  FROM `categories`
) ordered ON ordered.id = c.id
SET c.sort_order = ordered.seq
WHERE c.sort_order = 0;

UPDATE `admin_users`
SET `is_super_admin` = 1
WHERE LOWER(TRIM(`email`)) = 'haythemasad5@gmail.com';

DROP PROCEDURE IF EXISTS ensure_column;
