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

CREATE TABLE IF NOT EXISTS `smtp_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `label` varchar(120) DEFAULT NULL,
  `host` varchar(255) DEFAULT NULL,
  `port` int DEFAULT '587',
  `secure` tinyint(1) DEFAULT '0',
  `username` varchar(255) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `from_name` varchar(255) DEFAULT NULL,
  `from_email` varchar(255) DEFAULT NULL,
  `notify_email` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE `products` ADD COLUMN `categories` JSON NULL AFTER `category`;
ALTER TABLE `admin_users` ADD COLUMN `is_super_admin` TINYINT(1) NOT NULL DEFAULT 0 AFTER `password_hash`;
ALTER TABLE `admin_users` ADD COLUMN `permissions` JSON NULL AFTER `is_super_admin`;
ALTER TABLE `products` ADD COLUMN `color_options` JSON NULL AFTER `categories`;
ALTER TABLE `products` ADD COLUMN `image_urls` JSON NULL AFTER `image_url`;
ALTER TABLE `products` ADD COLUMN `docs` JSON NULL AFTER `image_urls`;
ALTER TABLE `products` ADD COLUMN `links` JSON NULL AFTER `docs`;
ALTER TABLE `products` ADD COLUMN `is_hidden` TINYINT(1) DEFAULT 0 AFTER `is_available`;
ALTER TABLE `products` ADD COLUMN `show_on_home` TINYINT(1) DEFAULT 0 AFTER `is_hidden`;
ALTER TABLE `products` ADD COLUMN `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER `created_at`;

ALTER TABLE `orders` ADD COLUMN `customer_email` VARCHAR(255) NULL AFTER `customer_phone`;
ALTER TABLE `orders` ADD COLUMN `address_line2` VARCHAR(255) NULL AFTER `address_line1`;
ALTER TABLE `orders` ADD COLUMN `state` VARCHAR(120) NULL AFTER `city`;
ALTER TABLE `orders` ADD COLUMN `country` VARCHAR(120) NOT NULL DEFAULT 'فلسطين' AFTER `state`;
ALTER TABLE `orders` ADD COLUMN `postal_code` VARCHAR(30) NULL AFTER `country`;
ALTER TABLE `orders` ADD COLUMN `notes` TEXT NULL AFTER `postal_code`;
ALTER TABLE `orders` ADD COLUMN `subtotal` DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER `notes`;
ALTER TABLE `orders` ADD COLUMN `tax` DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER `subtotal`;
ALTER TABLE `orders` ADD COLUMN `shipping` DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER `tax`;
ALTER TABLE `orders` ADD COLUMN `total` DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER `shipping`;
ALTER TABLE `orders` ADD COLUMN `status` VARCHAR(50) DEFAULT 'pending_payment' AFTER `total`;

ALTER TABLE `order_items` ADD COLUMN `color_name` VARCHAR(255) NULL AFTER `product_name`;
ALTER TABLE `order_items` ADD COLUMN `color_hex` VARCHAR(20) NULL AFTER `color_name`;

ALTER TABLE `payments` MODIFY COLUMN `order_id` INT NULL;
ALTER TABLE `payments` ADD COLUMN `amount` DECIMAL(10,2) NOT NULL DEFAULT '0.00' AFTER `order_id`;
ALTER TABLE `payments` ADD COLUMN `status` VARCHAR(50) DEFAULT 'initiated' AFTER `amount`;
ALTER TABLE `payments` ADD COLUMN `transaction_id` VARCHAR(255) NULL AFTER `status`;
ALTER TABLE `payments` ADD COLUMN `raw_response` JSON NULL AFTER `transaction_id`;
ALTER TABLE `payments` ADD COLUMN `order_payload` JSON NULL AFTER `raw_response`;

ALTER TABLE `site_banner` ADD COLUMN `feature_tabs` JSON NULL AFTER `image_url`;
ALTER TABLE `smtp_settings` ADD COLUMN `label` VARCHAR(120) NULL AFTER `id`;
ALTER TABLE `smtp_settings` ADD COLUMN `from_name` VARCHAR(255) NULL AFTER `password`;
ALTER TABLE `smtp_settings` ADD COLUMN `from_email` VARCHAR(255) NULL AFTER `from_name`;
ALTER TABLE `smtp_settings` ADD COLUMN `notify_email` VARCHAR(255) NULL AFTER `from_email`;
ALTER TABLE `smtp_settings` ADD COLUMN `is_active` TINYINT(1) DEFAULT 0 AFTER `notify_email`;
ALTER TABLE `smtp_settings` ADD COLUMN `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP AFTER `is_active`;
ALTER TABLE `smtp_settings` ADD COLUMN `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER `created_at`;

INSERT IGNORE INTO `categories` (`name`)
SELECT DISTINCT TRIM(`category`)
FROM `products`
WHERE `category` IS NOT NULL AND TRIM(`category`) <> '';

UPDATE `smtp_settings` SET `is_active` = 1 WHERE `id` = 1 AND `is_active` = 0;
