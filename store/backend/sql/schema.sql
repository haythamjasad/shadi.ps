-- Generated from local database
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;











CREATE TABLE `admin_users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `is_super_admin` tinyint(1) NOT NULL DEFAULT '0',
  `permissions` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `admin_password_resets` (
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

CREATE TABLE `brands` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `types` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `suppliers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `contact_info` text,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(80) DEFAULT NULL,
  `address_line1` varchar(255) DEFAULT NULL,
  `city` varchar(120) DEFAULT NULL,
  `state` varchar(120) DEFAULT NULL,
  `country` varchar(120) DEFAULT 'فلسطين',
  `account_balance` decimal(12,2) NOT NULL DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_suppliers_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `is_hidden` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `cities` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `products` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text,
  `technical_data` text,
  `warnings` text,
  `usage` text,
  `price` decimal(10,2) NOT NULL,
  `mrp` decimal(10,2) DEFAULT NULL,
  `stock` int DEFAULT '0',
  `brand` varchar(120) DEFAULT NULL,
  `type` varchar(120) DEFAULT NULL,
  `supplier_id` int DEFAULT NULL,
  `purchase_price` decimal(10,2) DEFAULT NULL,
  `category` varchar(120) DEFAULT NULL,
  `categories` json DEFAULT NULL,
  `color_options` json DEFAULT NULL,
  `variant_options` json DEFAULT NULL,
  `image_url` text,
  `image_urls` json DEFAULT NULL,
  `docs` json DEFAULT NULL,
  `links` json DEFAULT NULL,
  `is_available` tinyint(1) DEFAULT '1',
  `is_hidden` tinyint(1) DEFAULT '0',
  `show_on_home` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_products_supplier_id` (`supplier_id`),
  CONSTRAINT `fk_products_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `journal_entries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `supplier_id` int NOT NULL,
  `transaction_type` enum('credit','debit') NOT NULL,
  `voucher_type` enum('purchase_invoice','supplier_payment','supplier_service_credit','supplier_discount_debit') NOT NULL DEFAULT 'purchase_invoice',
  `amount` decimal(12,2) NOT NULL,
  `reference_doc` varchar(255) DEFAULT NULL,
  `date` date NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_journal_entries_supplier_date` (`supplier_id`,`date`),
  KEY `idx_journal_entries_type` (`transaction_type`),
  CONSTRAINT `fk_journal_entries_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `category_product_orders` (
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

CREATE TABLE `orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `source` enum('store','admin') DEFAULT NULL,
  `customer_name` varchar(255) NOT NULL,
  `customer_phone` varchar(50) NOT NULL,
  `customer_email` varchar(255) DEFAULT NULL,
  `address_line1` varchar(255) NOT NULL,
  `address_line2` varchar(255) DEFAULT NULL,
  `city` varchar(120) NOT NULL,
  `state` varchar(120) DEFAULT NULL,
  `country` varchar(120) NOT NULL,
  `postal_code` varchar(30) DEFAULT NULL,
  `notes` text,
  `subtotal` decimal(10,2) NOT NULL,
  `tax` decimal(10,2) NOT NULL,
  `shipping` decimal(10,2) NOT NULL,
  `delivery_fee_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `delivery_payer` enum('customer','store','supplier') DEFAULT NULL,
  `delivery_note` varchar(255) DEFAULT NULL,
  `discount_type` varchar(20) DEFAULT NULL,
  `discount_value` decimal(10,2) NOT NULL DEFAULT '0.00',
  `discount_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `discount_reason` varchar(255) DEFAULT NULL,
  `total` decimal(10,2) NOT NULL,
  `status` varchar(50) DEFAULT 'pending_payment',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `order_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_id` int NOT NULL,
  `product_id` int DEFAULT NULL,
  `supplier_id` int DEFAULT NULL,
  `product_name` varchar(255) NOT NULL,
  `color_name` varchar(255) DEFAULT NULL,
  `color_hex` varchar(20) DEFAULT NULL,
  `variant_id` varchar(120) DEFAULT NULL,
  `size_name` varchar(255) DEFAULT NULL,
  `quantity` int NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `purchase_price` decimal(10,2) DEFAULT NULL,
  `line_total` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `order_id` (`order_id`),
  KEY `idx_order_items_supplier_id` (`supplier_id`),
  CONSTRAINT `order_items_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `order_supplier_deliveries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_id` int NOT NULL,
  `supplier_id` int NOT NULL,
  `amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `note` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_order_supplier_delivery` (`order_id`,`supplier_id`),
  KEY `idx_order_supplier_deliveries_order_id` (`order_id`),
  KEY `idx_order_supplier_deliveries_supplier_id` (`supplier_id`),
  CONSTRAINT `fk_order_supplier_deliveries_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_order_supplier_deliveries_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `payments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_id` int NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `status` varchar(50) DEFAULT 'initiated',
  `transaction_id` varchar(255) DEFAULT NULL,
  `raw_response` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `order_id` (`order_id`),
  CONSTRAINT `payments_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `payment_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `provider` varchar(120) NOT NULL,
  `settings_json` json NOT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `provider` (`provider`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `smtp_settings` (
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
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `whatsapp_settings` (
  `id` int NOT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `message` text,
  `qr_data_url` longtext,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `site_banner` (
  `id` int NOT NULL,
  `image_url` text,
  `feature_tabs` json DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `payment_gateway_settings` (
  `id` int NOT NULL,
  `enabled` tinyint(1) DEFAULT '1',
  `api_url` varchar(255) DEFAULT NULL,
  `secret_key` text,
  `webhook_secret` text,
  `currency` varchar(10) DEFAULT 'ILS',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `store_settings` (
  `id` int NOT NULL,
  `currency` varchar(10) DEFAULT 'ILS',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Patch for latest backend columns
ALTER TABLE payments MODIFY order_id INT NULL;
ALTER TABLE payments ADD COLUMN order_payload JSON NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source ENUM('store','admin') NULL DEFAULT NULL AFTER id;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS source ENUM('manual','store','mixed') NOT NULL DEFAULT 'manual' AFTER account_balance;
ALTER TABLE products ADD COLUMN IF NOT EXISTS color_options JSON NULL AFTER categories;
ALTER TABLE products ADD COLUMN IF NOT EXISTS variant_options JSON NULL AFTER color_options;
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_id INT NULL AFTER type;
ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_price DECIMAL(10,2) NULL AFTER supplier_id;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS color_name VARCHAR(255) NULL AFTER product_name;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS color_hex VARCHAR(20) NULL AFTER color_name;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_id VARCHAR(120) NULL AFTER color_hex;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS size_name VARCHAR(255) NULL AFTER variant_id;
ALTER TABLE smtp_settings ADD COLUMN IF NOT EXISTS label VARCHAR(120) NULL;
ALTER TABLE smtp_settings ADD COLUMN IF NOT EXISTS from_name VARCHAR(255) NULL;
ALTER TABLE smtp_settings ADD COLUMN IF NOT EXISTS from_email VARCHAR(255) NULL;
ALTER TABLE smtp_settings ADD COLUMN IF NOT EXISTS notify_email VARCHAR(255) NULL;
ALTER TABLE smtp_settings ADD COLUMN IF NOT EXISTS is_active TINYINT(1) DEFAULT 0;
ALTER TABLE smtp_settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE smtp_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
CREATE TABLE IF NOT EXISTS site_banner (
  id INT NOT NULL,
  image_url TEXT NULL,
  feature_tabs JSON NULL,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS payment_gateway_settings (
  id INT NOT NULL,
  enabled TINYINT(1) DEFAULT 1,
  api_url VARCHAR(255) DEFAULT NULL,
  secret_key TEXT DEFAULT NULL,
  webhook_secret TEXT DEFAULT NULL,
  currency VARCHAR(10) DEFAULT 'ILS',
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS store_settings (
  id INT NOT NULL,
  currency VARCHAR(10) DEFAULT 'ILS',
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS admin_idempotency_keys (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_scope VARCHAR(120) NOT NULL,
  idempotency_key VARCHAR(160) NOT NULL,
  method VARCHAR(12) NOT NULL,
  route_key VARCHAR(160) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  status_code INT NULL,
  response_json LONGTEXT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_admin_idempotency_key (admin_scope, idempotency_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
UPDATE smtp_settings SET is_active = 1 WHERE id = 1 AND is_active = 0;

SET FOREIGN_KEY_CHECKS=1;
