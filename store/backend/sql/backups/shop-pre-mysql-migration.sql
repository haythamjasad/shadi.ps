/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19-11.8.3-MariaDB, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: shop
-- ------------------------------------------------------
-- Server version	11.8.3-MariaDB-1build1 from Ubuntu

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*M!100616 SET @OLD_NOTE_VERBOSITY=@@NOTE_VERBOSITY, NOTE_VERBOSITY=0 */;

--
-- Current Database: `shop`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `shop` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */;

USE `shop`;

--
-- Table structure for table `admin_password_resets`
--

DROP TABLE IF EXISTS `admin_password_resets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_password_resets` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `admin_id` int(11) NOT NULL,
  `email` varchar(255) NOT NULL,
  `code_hash` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL,
  `attempt_count` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_admin_id` (`admin_id`),
  KEY `idx_reset_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_password_resets`
--

LOCK TABLES `admin_password_resets` WRITE;
/*!40000 ALTER TABLE `admin_password_resets` DISABLE KEYS */;
set autocommit=0;
/*!40000 ALTER TABLE `admin_password_resets` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `admin_users`
--

DROP TABLE IF EXISTS `admin_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_users`
--

LOCK TABLES `admin_users` WRITE;
/*!40000 ALTER TABLE `admin_users` DISABLE KEYS */;
set autocommit=0;
/*!40000 ALTER TABLE `admin_users` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `brands`
--

DROP TABLE IF EXISTS `brands`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `brands` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `brands`
--

LOCK TABLES `brands` WRITE;
/*!40000 ALTER TABLE `brands` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `brands` VALUES
(1,'AquaFlow','2026-02-24 21:09:06'),
(2,'BrassPro','2026-02-24 21:09:06'),
(3,'BuildMix','2026-02-24 21:09:06'),
(4,'CleanSand','2026-02-24 21:09:06'),
(5,'ThermoShield','2026-02-24 21:09:06'),
(6,'HydroSeal','2026-02-24 21:09:06');
/*!40000 ALTER TABLE `brands` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `order_items`
--

DROP TABLE IF EXISTS `order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `order_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `product_name` varchar(255) NOT NULL,
  `quantity` int(11) NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `line_total` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `order_id` (`order_id`),
  CONSTRAINT `order_items_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `order_items`
--

LOCK TABLES `order_items` WRITE;
/*!40000 ALTER TABLE `order_items` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `order_items` VALUES
(2,4,26,'دبق بلاط عادي  Pegoland® 695',1,45.00,45.00),
(3,4,25,'روبة بلاط داخلية Morcemcolor® Plus Flexible ',1,59.00,59.00),
(4,5,28,'ألياف صناعية PAVILAND FIBER  ',1,30.00,30.00),
(5,5,29,'عزل اسمنتي\n SikaTop 550',1,0.00,0.00),
(6,5,30,'عزل بيتومين بولي يوريثان\nSikaLastic HLM 5000 R',1,0.00,0.00);
/*!40000 ALTER TABLE `order_items` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_name` varchar(255) NOT NULL,
  `customer_phone` varchar(50) NOT NULL,
  `customer_email` varchar(255) DEFAULT NULL,
  `address_line1` varchar(255) NOT NULL,
  `address_line2` varchar(255) DEFAULT NULL,
  `city` varchar(120) NOT NULL,
  `state` varchar(120) DEFAULT NULL,
  `country` varchar(120) NOT NULL,
  `postal_code` varchar(30) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `subtotal` decimal(10,2) NOT NULL,
  `tax` decimal(10,2) NOT NULL,
  `shipping` decimal(10,2) NOT NULL,
  `total` decimal(10,2) NOT NULL,
  `status` varchar(50) DEFAULT 'pending_payment',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `orders`
--

LOCK TABLES `orders` WRITE;
/*!40000 ALTER TABLE `orders` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `orders` VALUES
(4,'haytham','0569934929','haythamasad5@gmail.com','buta','bauit','aijsdbn','iasjdbjin','فلسطين',NULL,'adsbniashdbhuiasbd',104.00,0.00,20.00,124.00,'pending_payment','2026-02-26 18:33:39'),
(5,'asd','asd','asd','asd','asd','asd','asd','فلسطين',NULL,'asd',30.00,0.00,0.00,30.00,'pending_payment','2026-02-26 18:49:14');
/*!40000 ALTER TABLE `orders` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `payment_settings`
--

DROP TABLE IF EXISTS `payment_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `provider` varchar(120) NOT NULL,
  `settings_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`settings_json`)),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `provider` (`provider`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_settings`
--

LOCK TABLES `payment_settings` WRITE;
/*!40000 ALTER TABLE `payment_settings` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `payment_settings` VALUES
(1,'bank_of_palestine','{\"apiKey\": \"\", \"secret\": \"\", \"endpoint\": \"\", \"merchantId\": \"\"}','2026-02-23 21:01:54');
/*!40000 ALTER TABLE `payment_settings` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `payments`
--

DROP TABLE IF EXISTS `payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `payments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) DEFAULT NULL,
  `amount` decimal(10,2) NOT NULL,
  `status` varchar(50) DEFAULT 'initiated',
  `transaction_id` varchar(255) DEFAULT NULL,
  `raw_response` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`raw_response`)),
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `order_payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`order_payload`)),
  PRIMARY KEY (`id`),
  KEY `order_id` (`order_id`),
  CONSTRAINT `payments_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payments`
--

LOCK TABLES `payments` WRITE;
/*!40000 ALTER TABLE `payments` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `payments` VALUES
(4,4,124.00,'initiated',NULL,NULL,'2026-02-26 18:34:40',NULL);
/*!40000 ALTER TABLE `payments` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `technical_data` text DEFAULT NULL,
  `warnings` text DEFAULT NULL,
  `usage` text DEFAULT NULL,
  `price` decimal(10,2) NOT NULL,
  `mrp` decimal(10,2) DEFAULT NULL,
  `stock` int(11) DEFAULT 0,
  `brand` varchar(120) DEFAULT NULL,
  `type` varchar(120) DEFAULT NULL,
  `category` varchar(120) DEFAULT NULL,
  `image_url` text DEFAULT NULL,
  `image_urls` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`image_urls`)),
  `docs` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`docs`)),
  `links` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`links`)),
  `is_available` tinyint(1) DEFAULT 1,
  `is_hidden` tinyint(1) DEFAULT 0,
  `show_on_home` tinyint(1) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `products` VALUES
(22,'منظف بلاط Desmor ',' مادة تنظيف بلاط حجم 1 لتر مخصصة لإزالة الاسمنت و بقايا لاصق البلاط و الدهانات و الروبة عن الارضيات والجدران . ','المظهر: سائل عديم اللون 1 لتر\nالكثافة: 1.3 غ/سم³\nالرقم الهيدروجيني (pH): حمضي قوي\nالذوبانية: يذوب تمامًا في الماء','1- يفضل ان يختبر على جزء صغير ومخفي من البلاط.\n2- ارتداء القفازات اثناء التنفيذ .\n3- يتجنب استخدامه على المعادن  .\n4- انتبه الى ظروف التخزين وفترة صلاحية المنتج\n','يخفف بالماء حسب درجة الاتساخ . في التنظيف العادي يضاف 100 مل الى 1 لتر ماء ، في التنظيف المتوسط 200 مل من المادة الى 1 لتر ماء ، وفي التنظيف العميق يضاف 300 مل من المادة الى 1 لتر ماء .يوزع على السطح ثم يترك لمدة 3-5 دقائق ليفكك الاوساخ والترسبات ثم يفرك ومن ثم يشطف بالماء النظيف.',85.00,NULL,0,'','مواد بناء','مواد البناء','/uploads/excel/row-2.png','[\"/uploads/excel/row-2.png\"]','[{\"name\": \"pdf-sample_0.pdf\", \"type\": \"application/pdf\", \"dataUrl\": \"data:application/pdf;base64,JVBERi0xLjcKJbXtrvsKNCAwIG9iago8PCAvTGVuZ3RoIDUgMCBSCiAgIC9GaWx0ZXIgL0ZsYXRlRGVjb2RlCj4+CnN0cmVhbQp4nDNUMABCXUMgYWFipJCcy1XIFahQyGWgZ2hoDBQ0tTTRMzc3BksWpSqEK+RxgSRNLAwMTEzAeqEcMwWQFiNToAjQEP1EA4X0YgX9CnMFl3yuQCAEAFcZFZQKZW5kc3RyZWFtCmVuZG9iago1IDAgb2JqCiAgIDkwCmVuZG9iagozIDAgb2JqCjw8CiAgIC9FeHRHU3RhdGUgPDwKICAgICAgL2EwIDw8IC9DQSAxIC9jYSAxID4+CiAgID4+CiAgIC9YT2JqZWN0IDw8IC94NyA3IDAgUiA+Pgo+PgplbmRvYmoKNyAwIG9iago8PCAvTGVuZ3RoIDEwIDAgUgogICAvRmlsdGVyIC9GbGF0ZURlY29kZQogICAvVHlwZSAvWE9iamVjdAogICAvU3VidHlwZSAvRm9ybQogICAvQkJveCBbIDAgMCAxMjM5IDE3NTQgXQogICAvUmVzb3VyY2VzIDkgMCBSCj4+CnN0cmVhbQp4nHWMvQ7CMAyEdz+Fx2TIr1OSrKgwMIGUDTEwNBESGWjVoW9P0oWJs2Tdd9LdB1RZNJYFDPabC6rnzho1GksRjR8czhPmf5HurWMCIjlE8i7umfihMUFSkw2t6aSP7QdMFVQWWrRNTBnubFw5sVo3Lqx37NpgPHd/YPn1nvgjXeCU4AZf0MsnjwplbmRzdHJlYW0KZW5kb2JqCjEwIDAgb2JqCiAgIDEzNwplbmRvYmoKOSAwIG9iago8PAogICAvRXh0R1N0YXRlIDw8CiAgICAgIC9nczAgPDwgL0JNIC9Ob3JtYWwgL1NNYXNrIC9Ob25lIC9DQSAxLjAgL2NhIDEuMCA+PgogICAgICAvYTAgPDwgL0NBIDEgL2NhIDEgPj4KICAgPj4KICAgL0ZvbnQgPDwKICAgICAgL2YtMC0wIDExIDAgUgogICA+Pgo+PgplbmRvYmoKOCAwIG9iago8PCAvVHlwZSAvT2JqU3RtCiAgIC9MZW5ndGggMTIgMCBSCiAgIC9OIDEKICAgL0ZpcnN0IDQKICAgL0ZpbHRlciAvRmxhdGVEZWNvZGUKPj4Kc3RyZWFtCnicM1Mw4IrmiuUCAAY4AV0KZW5kc3RyZWFtCmVuZG9iagoxMiAwIG9iagogICAxNgplbmRvYmoKMTQgMCBvYmoKPDwgL0xlbmd0aCAxNSAwIFIKICAgL0ZpbHRlciAvRmxhdGVEZWNvZGUKICAgL0xlbmd0aDEgMTEzMzYKPj4Kc3RyZWFtCnic5Xp7fFTVtf/a+5wzjzzmkcdk8uKcYcgMyRATQkIIRObkKTYFwkOboJEJDwVfBEl8VUlEvWpQC1XxWYneihS1nEwQJzxK1Npab61YW0u9es2n4tt85La+fkpmft99JiD0evu5/f3+vOewztqP9d1r7bX3XnvvMMSIKIX6SCJt5WWdXW8kfrKJKHUnEV+28spu7VP17t8SOWQi6+wLuy66zPbBvqlE2TqR8qeLLr3mwvM+uuBjtPAkGjm+ZnXnKtcTl+wgyveibOYaFFhvjLcj34r8lDWXdV9dwZU25LuRn3bpupWdjnI32sofQN57WefVXZZful5CPoa81nXF6q463yoJ+SNErnXEhbEKXlhrpfo9nMUt1hgP65mkyHGJUqxynFGuzaLEuXSABcjODOYlb8j1Re147QLXZ7Xzx2spjLTrOD7Ty31un7sIH0YyHdekkeO6Qt+QJo+g+3Q3dHUq+8hFKvXqM6YqU1POylktr05TSnJqcuZ52j1rPEpNzsz8W/LvV7alKqq7iBHPzChyumy5wd1WZo0lRobsqZUw8XY9s8/HNF+5j/vcGRpprnIXd8X45iFt+hJvCKZ1CNvmuzrWfxFaP3/MNDJs2kgd61lHpq8ix+PJyM6yWsTr9zH3jIrqubyqMhAIBvx388JnIjfEIqXVF86/ccVPx19jU9+6rnre8traS5fMfVrZVxB4Lv7+756+cWBlS4kqP3e8ypFx7gu7du29MMMBjxKjOxIfyEvkAHnoIT3nB+6L3NsUyW7JtdTyWncLb3G/z63OGO/W3XKqh1Kys7JS7JbMrEB2NsVYse7w6NqUyt0elvAwT54X3dY9k6dUbvEOeHmX95iXf+pl3pTUgN0mqpyQHbCxYzZmy80J15q9X39FSPR/Afp/RegL0PyxWpc5VrUu+CE8JvzAOnxVFot/ciBQhXHL8nhmVMycKZLSgtkH116y6/ssV10cnndFCcvdfs6KC3Zt4wNx7+jqOQt7jrKRb94Q/dxIZLlPnktBNmeYimFMhzslrFgsadkWT1qlVGmr9Fb6G3mTrcnb6E/TpLLiJfZIcV/x9uKfWh637kh72vJ0mlF8uHi02EHFZcWtqDhU/HaxpVjPK6gMI99nVipWn2zNK/TAZdEUq094bpJsdbndwfyCgkAwhZHF6QpkuPVlVRE3W+dm7hhv1p15+YHCApStK2CRAlaAsj1FGF8GH0eJgmI6Oe1hwfWZsDsI0aBeB6oFTQlWBvXZZ1aWBV8Jvh2UnEE12BeUKKgFy4OJoBzMnfpO0tfCxckH820MXv6iY30IU+2L9R2Cweem18UbHguPMXdGDYGml7MrQus7MAyhTF/2zBkVnpyZ5teTjSGoxCycbLGYycCJ5EYmbR65cFt586Pn9zw6tTD+fmFw0Zw1Z8TfnxSeWbemNP6+HNj6s6XnnLN0+fmN94238+UPn1E7b/O2OOfNDy6b1nzT/ePHMWaO+CJ5MeZmJqvckzFVYZmxxKjuTXNW2jzpzkqr+FjER/GgjAvnqHmzKzGocnqqw+LilGmRM7ksSQxuz4y4mCvGdusZqc70MsdU0rLLsyPZ0rFsli38OzlQKbieUTCpMjsnJ0+ukXRvbmWvxKQYC+p2buY44yKXwWpIL5hZqVE54kVu1i8Hkg4OzR/PxRf/vOMLmlY3vhcKrb9ivuuzoxQe6ygLm65lGTVu068ZNUhYHS6x1EPMHJeOFsO1pMWYvWhZW1R20b7EMWKJY4OSi83C095wftswKYkPdEe6O5zpyszFJ8MbVmKJY0PICB5FPtlWe6YvM9PHrA7JPzkYFEum2sFC8a+YP35bQ1HDD3pbFy3Ira9acUGuHBh38L8e58MdK86c7H4zfUO7iA2c7iGSv0IcdFI+XaUXWZThrGGvdJbCLlJeV3iGuyjd4aB8VxGc4iSb579EPo9aWF4YKewq7CtUCl1OjSXdJYJfwenB72TsE5Evo6bs2/g3w+3TEACzsywi+vlzubn0K0Xsu4f9O3Ms3rhrxb0LLv7Ns4/uvrLhgnlVA8o+j++t3bfE1rqzx/8kPxePnLGirnVNegrm073oz03oj52u0MM2RbYoRVbNVm47ZHvbJpfZtti4zUaSLPpjJ5s1bFlo4ZbFEnYfnqellqfyVNl+aidSTu0EItgXSCDzbTc61oNLiqsWvUFHsn0m3SuNjc/hq8YfUvZ9FX/sq/GtIj5h3+TvKa8hDsf0ipkyK5E1l+Zul/u8ik0+5OXZHjfPyvC4HZlOcjkyGbl4lt3mTGXLUxMwTASaFAtzO5Oh2Iw7LrSL+YOpj6A9I2xbaGu1SbaprjL3cjd3x5ispzsyAzxrOQ14Rjzcg6Hba0+r9OTmXD3M15LZtdD62vlixzzeUftZR+5R8qJvolegMD41FU48CBAiPGTOqKoUgSHHKsJAdvaMbD+Cgt/7UM39PVdvCDTMPbPq97+Pv/+QHGj9l5uWTPmlq2ZRy1vHn5HOFnPtLhj7JMZG7O9XDZMdKzGMSKfbW+28z27YR+yH7Z/aFdUesffaB1CgSBYrNn/JSUynwzQKZAeOCRbFYpVTuDXAZLGa7b4plXKubWKzCU0cA8wBQhfMoTFHBx24IpQJcxnoLpYbf5/lynuZHD/+zffkgNhC4MhvbVwiluGIXiwsVFoV3qcYyohyWPlUUVQlovQqAyhQYA6OJlwKMDphC+XK/8WWCe0zkpqVfV83wx912JeD2K+yqID96zC5El/pzak199sfSN/m2qk8nrLfvj89lmezZbF5/CxLc8rCSTvT91r25v065cW011OOpH1l/TI9vcBZkK3nF1Zm6w53pTP7UPYr2ZIZ7JyTwiZ35IDzO/Q0pyOj1RFxcIc3g4l5kJtfyWZkCLOHCrVKk08uTvJQaZJ7C0yuOx3OygF4B8clTsszMjD3huTUDK+Yg1NSreRjZdm+hQ7myCubtHzSuknbJ8mTnD6bjsBtyy1cW5f0xvwxcwHNH/sMYWAMgU7P8upTs8JefZITn3wXPgXusBnYwuNmIMyAEZDIEMZAyOSQEzx6QhR7nhkMTQChAluaqM8RzBiyp8w1s3W+cIiE/NEQAnOHqd6hw0sOodQh1Dt0OIvMRhGeQiFspbU4i2HwOtZTR4hh2/FrwUCVi2ZUkOQzzyiZYkO0WnL418w788Pd8Y9vXsuyXhtjGZZxXdrUWb8sKF197vm1tYwtLnvgkae3vsVsiNC/jh+8fvM8dum1vQ0NG5KnNEn4l9JI5gvAJ8HVEjmolxJsCetkV7ON7Mf8V/xNLaCVa7O1J32TEwlxjqYBtphFUH/9RH0m6mtO1v/3D4OON9kD7CH2MN6BifdXeF9kL/5D5D/3iF5ZvqNc+R+3kIJ4IR6b+bXDL6c/fILL/7Rt/wsexLICkx6nApyzCrBCjp6g+NrEUVEnOP8IQ1WYpIknipvfn9hUptEQ+5py6CuWy6bT2fDzlxiD3TSO00MWLaVtLIOmYFc7h85mMmRCdDt7MHFl4kM6k35MjyaeYZsSu1D/I/oVfQUL/kNmVE0LIH8OraYPpXepPfEARvcWSqU5tJh5qJNex/s5bLgLN7VfsOsSX0FrFm1Ce7VUh8j5bOI4ldDt8hbliP1p2kr7mSWxMrEWc3oy9fNQ4vXE2xSgdvpXehI2hdiIPI98dAndTPexXOlXSN1DP6U4S+MdUoNyCJrOpnPpcrqK+mkXvcQyWKtyRDmW+GHifczeTJoKm9bSh6yKzeePyWmJuYk36DwaphfRX/GOyOfJjyvnxcOJnySeo2x6hqWwA+xZpUK5c/yGxCOJn2NlB2g6PLIAelbQjfQs/Yb+k/7KexO9NI+WQPMLrJBpLACPv85z+Ua+UXqNzkBvO2BtD20nAyOyj/bTQfjm37EbvsuyWD77HlvBtrK/8jS+ir8iPSjtkf4gM/ln8LefiuCjbnqM9tJv6WV6hSlov5y1sovZOnYv+wkb5Qb/hH8p2+Qb5W/kcSUQH41/k1iQ+BxnlTz6Pl2L+LMVPhyiPfQ7+iP9lf5GXzCcVNka9giu36PsE27nk/lC3sW38cf4U9ICaav0rFwl18uXyC/Lbyj/omy2dlrjx3fE74o/FX818UziVTOueeGNZnj0BsyKx+gQvYbW/0xv0V/E/EH7c9gydgG0bGC3srvZU+wF9ir7CL0k853M5/BGaF3Hr4CfNvG7+N3Q/grew/wN/hb/mH8uKdJkaaa0XnpEMqSYdFh6T3bJAfkMebq8UF4mJzAyFcpZyhJlp/KE8pxyzFJrWWXpsnxg3WS9yfbb8ZLx/4hTfE3ciA9h7towk66FJx6mRzHv92AMXoJHfweLR+kzjEIe87Eg7K5hzayFzWc/YOez1WwTu4X9mN3HHmSPsp+jB+gDt8L2EK/jS3gnX81v4rfwO/gevPv4b/jr/Agfg+U5kl8KSdOls6Vl0nnS5ehDt7RRugme3Srtkl6RXpPelz6QxjBqOfIkuUe+Vr5fflzeI7+qfF+5DO+jyiGcVF5VjivHcbjNsxRYyiwXW3Za/mK1WGdaW623Wf9g/ZutixWwEliunRoteC7W4CS+i2fJvWwMBYVMxt1gKy4vt2IfymB/o7AUx7g4RD1sy+a5cqZAWnTZAL6b7acq9gL1WriEyC+PUpS9yUfl5/mZ9EfsU7ny49LlykvcR08gGm3hB/h+Vk97eC0/lz+ELfBdtpPexXy/mu5ml7AN9AQbY7Oxt1WzXvoD90hL2E1Um3iUy8zOzsbRFxbQDfIquuAfR0Hc5d6kD+MPy+nydYhPMdqGEX2S3mY/o6+ZkvgE0U1CNOpElLkd8/1mElGvA+usF+sxFxHkUssrtIdhH7NWW+bK19Ix+j/0obIPM6oekfT9+Fr5YfmdRHWiFCsMq4x2Yt2tobOwYt7FLDmIvMidj5WeglhSgVXdSstoFV2PqLc1YSQeStyYuCaxjv4N2K/ZNPY1G8CKiAFRSy/i/RH9mW3GOjzr/20XiK+iEfqIeVkRq8B6GFOuVLYou5Q9yi+Uly3T4e2b6EHM6L9gNqegByvpVfqIvsRRpZ5yaRpVwt5ZsL2NLuXt0kFqYHnUhTU7FXG8fqInG9DKJnjvIazng1gbxxAnzqdf0BHGWQ56tBL6bWinBX5eDukdGMEb2RBKViFql9DH6LeDzeLd0KejpW2IWiOw6U16D95OmHZNQ1xoZOeirS/pB7QKGmZSKxvECOylGkTWRum38PcU5qJ6Npn9FLgIVqiDCqlGeYdxmhZfkJjF10oHscckUD6A3SufzmTrYYUT/RinbLaQquKLYcNrRHrdUj0898zaObNrZlVXVc6omF5edkbptFBJ8dRgoGiKf7JPUycVFuTn5XpzcH3NzHC7nI70tNQUu81qwb0Fl4NpTf7miGYEIoYc8M+bVyry/k4UdJ5SEDE0FDWfLmNoEVNMO11Sh+SFfyepJyX1k5LMpdVSbek0rcmvGS83+rUYW7aoDek7Gv3tmjFmpueb6S1mOh1pnw8Arcm7plEzWERrMpqvXNPfFGlEc4OpKQ3+htUppdNoMCUVyVSkjBx/1yDLmcvMBM9pmj3IyZYOo4w8f2OTketvFBYYUlFT5yqjdVFbU2O+z9deOs1gDSv9Kwzy1xvOkClCDaYaw9JgWE012lrRG9qsDU4b6b895qIVkVDaKv+qzvPbDKmzXehwh6C30ci59qj32ywaz2hou+XU2nypv8m7VhPZ/v5bNGNkUduptT7xbW9HG8DyouZIfzNU3w4ntizRoI3f3N5msJuhUhM9Eb1K9m+1v0mURC7WDLu/3r+m/+IIhiav36DF1/iieXn6cGKU8pq0/qVtfp8Rzve3dzYWDGZR/+JrhnJ1Lff0mtJpgy530rGDDudEIi391MTqk3VmyhQXqZbFJz3LhEX+szEhDG2lBkva/OjTLPFZPYv6V86CGJ52BpSxCiOy1rA3RPpds0W5wBtKkcuv9X9OmAH+sU9OL+mcKLEUuT4nkRTz5ORUQ/2JtBEKGSUlYopYGzCmsHGuma8qnXZljM/0d7k0MLiPWuHbzvbZZXC/zycGeHNMpxXIGH2L2pJ5jVbkR0kvC7UbPCJqRk7UZJ8javpO1JyER/yYyXvMi0e2YQuc/Od0eTKb1sw2mOcfVK9O1rcs8bcsWtamNfVHJnzbsvS0XLJ+1sm6iZSR2dAm5fOJFM+XzFpMyvNPCotMW5ohF+GfxZzUqwwJk9IsYFqz4YrMS37bU3y+/xYTs9pOAcUSxwTKZN/CJqw0ZodOz885LX+adWn9EuyVA7xl6bL+/pTT6poRgPr7m/1ac3+kvzOW6Fvh11z+/mH+OH+8v6spcmJAY4l9m/ON5tvb0Yk1bDYmK6f6QT+7ddGgzm5dsqxt2IWb661L26Kc8YZIffvgFNS1DeMoopul/GSpyGkiRy0MEz3KbWZV/rBO1GfWymaBmV8ZY2SW2U6UMVoZ48kyl1mGpzR5J+XvXfT1p19ftdxZ+7ktN3m1fPSd2sJT9sxFlvuU1yBrP3nDBM46N76AGk7erdnfbbSpFhQpv6a75XfoDmshbZQ3kEM5l+5B/l6+i7y8hu4ShPI6yM/E/URjX/N9OK12Scdwbr5a2Wi2mordNamXk4vKsGuSZYFrHc4p/Be0VHqAnIyRmhiR7htyZVXoMen+IWdmhV7nku6hVhAnQ5pPIyBO66St1AviEG+Jlk6vGBaJoRRHhQvym0kD9YEkGsCXmXkdJOQ3D2V6RPM3Rp1uE/fDaHllMjHk8la01mVJVxOTVkuX48Kh4qB6ObZzVVoJXgi+QlpF6aad+pDTVdEHfWGIh3FuK0Z1neTBaUiVGqU87MRCrCfqSOrpiU4tqahLkRokrynilNJxEFElm2SNVqjafkkMry7dOmRPFfbdGnVlVxyUbpasuCiqUh+kclTnQSmFykCiJ0uH7OkVW+rSpKXo5lK4RYWNjLabX126PIqGoK9JKsDlSZUukQpxkVOlZmlSNFsd2S/dZYr9WLQCfXOjthmCDaU7Kkbq7NJc1BrSnfD4naa2LUOBWTjnBaSpVC6JodSkXqR6xXBK/Uj1Y5j6MTT9GJp+WNEv/kwi3Yaa2yBTJl1LXdJVtAW0HWkZTWZH4cFhMzFlasWwlCt54QnXfviOoTRvyO4QlnmjGZmmmHcozVERPihtoIUgDuO7h3K8Fev2SyVmV6YNefMFoCtqT4PrcpJjAaBHjMFBqUCaZHqi0PSAUaciz8gpqcT4S/yw8A5/jf9RjK+4epn83yb4yxP8d0meGOGHh6BFj/HfCz5aV8DfRWPL+Vu0HSnO9/PnqRyAN3hMWMH/zIcpDH4E+VXgw+AzwPdFfS+qMR4bAoPtD0bTPaKz/PloqGwioRZNJHLyJxIZnoq6Iv4cf5YK0MSfwKeAP8tHaDL4IXAv+AgOny+CP82raA74ngn+S35AzGn+DN+LY7DKh6IOYYIRtQq2O2oR7OdRSuZay9QD/Of8CdygVf5UNJCH0p1DgSmqcz/aY7iodkcL1Yy6FP4Ia2OfQWgAh2RwyuCPRqtFI1uiBzR1mG/hW3RvtV6kl+o7pPKi8tLyHZJWpJVq1doOrc7F7yQFzsOC5ZvxrSaNY/aAdNAWfltUrjbqxtEn0S9OffgOmKkIvl1mChc2cp2sPWamwvxmWgjiaGMjqBfUB7oBl6Mt/FrQD0HXga43S7pBPaCrED66gOgCoguILhPRBUQXEF1AdJmILlN7D0ggIkBEgIgAETERESAiQESAiJgIYW8EiIiJaAWiFYhWIFpNRCsQrUC0AtFqIlqBaAWi1UToQOhA6EDoJkIHQgdCB0I3EToQOhC6iSgHohyIciDKTUQ5EOVAlANRbiLKgSgHotxEaEBoQGhAaCZCA0IDQgNCMxEaEBoQmolwAeECwgWEy0S4gHAB4QLCZSJc5vj0gARiFIhRIEaBGDURo0CMAjEKxKiJGAViFIhRftWgdLjuBUAOA3IYkMMm5DAghwE5DMhhE3IYkMOAHJ7oerfpDI5psxHUC+oDCewIsCPAjgA7YmJHzOnVAxJYAwgDCAMIw0QYQBhAGEAYJsIAwgDCMBEDQAwAMQDEgIkYAGIAiAEgBkzEgDlxe0AC8c9Pyn96aPgNrM2GzZX3sWKT99InJt9IR0x+PQ2a/DraYfIf0iaTX0vVJr+KAiZHeybvJtXGomq1s86DELAQtBy0DrQdtBt0CGQ1U6+A3gYleJU+WXZaF1q3W3dbD1mV3dZRK3daFlq2W3ZbDlmU3ZZRC9fq8nm6GUcRWuhH5rcX309B2ETwDZupMK+E3krE2Sq8lbxSd49pn5awV0rYoRK2u4T9qITV2flZTDYjnUbVuLyqrE1PC8xVj4CqA8G5iEx37v0kR40GZqoxdiDJivUQ+CegQdAO0CZQNagCVAoqAqlmWQnk2/TJE00eAAVBPpAmVJDHg+NOhtumD/N0tmPohXSyCz3BqcDtjwbLwWLR4EKwZ6LBFWqdne2loDgGsacxck+A746qR1H9VJI9GVX3g+2MqpVgHdHgGWDnRYMvq3Xp7BxSZQFdOsGXoN+CL46q50JsUVQtBgtFgwEhXQJFRagtZm10FLxoAjUlqckfVeeATY6qNULaRkEx8MxCpaZ5CkhwaQgGfTrM2mSmp6pj6l3qJ4B/DMdievxZi8lgrxTF2Ll6inqg9GEI16nRuhQhj/1hcIIbgj+t7ii6TX0QbbGiver96hnqnaUxG4rvgN23mSqi6iZctJ7QM9U+tVztLj2qblC/p3aqi9WOIpRH1fPVA8JMamdt/Im9aisaPBu9KIqqZxXFTBOb1WtUXQ2qNdoB4V+alWy3uvSA8ABVJLVPg39LimJijp9THWNuvcR6zLrFep613jrH6rdOtk6yFlqzbBk2l81hS7Ol2Gw2i022cRvZssQPPkLiIJ1lEf+bTRZZfGUz7eLiy5PnbM5snL5HRqbUwluW1LMWY2QltazQjC+W+GMsBfcYxV/PjIwWallab8wKtcSsicVGdajFsLae1zbI2J3tKDX4rbglLG2LsYQoujlf/MFgkNHNd+QPE2O5N9/R3k5ez5VhbzhjrrumufE7PpGJb+jbx3tqstDY1rKkzdhV2G5UiESisL3FuEH8OWGYO3l6U+MwdwjW3jYsd3Fn02JRLnc1tkPsqCmG2eyAGAUFg5itnjQhhnhSL8QwRkm5AOCQ8wkGuZR0CphygZR0U05mQm7wiNbUOKhppkwR0RFT5kgRnSKDGQNs42AgYEr5NdYmpFibXzMNKzYbUlWIlKqmCMO5zmxIZaYyo+xbkaIJkaqTIlWmLol9K6MmZbKmnpDJmgqZ0P/ns7o+xIam92x8XvyFJuJvWg2KGJuvXOM1+lZo2uDGnok/3QQiK1auEbxztdHjX91obPQ3aoPTn/+O6udF9XR/4yA937S0bfB5fXVjdLo+vcnf2dg+FK5tqztN120ndbXVfkdjtaKxNqErXPcd1XWiOix01QlddUJXWA+buprWinnf2jZoo3rxSyGTD/HUFMzhSL6vvd7j6porJvTwHJ93Y/4+mdhOSg21G2n+eiMdJKpK60rrRBXWmahyiD/DTVR5N87x5e9jOyeqXCh2++vphGtJCLUYVYtaDB9u8WKqGHrnd4/ZBvGY1V5qWtuIf8h3m4T3VEna8J1P93c9PT09G8SnJ7SBqMUoWdJizFwES6xWqIo0tqPsjBNlkmSWDdrtTbHECCpDMIJ1C3UiFWLiFwN6Cm5dVj5gGbBycVXoHsorrFh3EDt4Lwj3OH5VtMy8L/OrhiYXiftL91BZVZLjfip4NM9XIX6YUA2o4EVJrrtLkdhStKV0S/VA0UDpQLVF/OxiBwrVHWIrjZbtkKg7tOGEI5DsbqfkDxmg75FoQaGpeEAkQqH20AbzV1/0964OTfyyDE4/6dgNE61uMJvvPjEgyfINlBROVoZ6ToB6JiBmZY8JMRX+Xwrr0OAKZW5kc3RyZWFtCmVuZG9iagoxNSAwIG9iagogICA3NDY1CmVuZG9iagoxNiAwIG9iago8PCAvTGVuZ3RoIDE3IDAgUgogICAvRmlsdGVyIC9GbGF0ZURlY29kZQo+PgpzdHJlYW0KeJxdUU1vwyAMvfMrfOwOVUjVMlVCkabuksM+tGw/gILJkBaCCDnk389A1Uk7wHu237NsaC79c+9dguY9znrABNZ5E3GZ16gRrjg6z9oDGKfTLSq3nlRgDZmHbUk49d7OTEpoPqi4pLjB7snMV3xgANC8RYPR+RF2X5ehpoY1hB+c0CfgrOvAoKV2Lyq8qgmhKeZ9b6ju0rYn25/icwsIhxK3dSQ9G1yC0hiVH5FJzjuQ1nYMvflXa3m1XK3+VpHJ45GknBMw+XgqnIBJYQonoPy55s/ET7xwAvKK6hVZX7kovOpF1gtduc689ifIg90myCPmt7zvrtcYae3y4GXfvKnzeP+TMIfsKucX542EyAplbmRzdHJlYW0KZW5kb2JqCjE3IDAgb2JqCiAgIDI3MQplbmRvYmoKMTggMCBvYmoKPDwgL1R5cGUgL0ZvbnREZXNjcmlwdG9yCiAgIC9Gb250TmFtZSAvRllQTVVTK0FyaWFsLUJvbGRNVAogICAvRm9udEZhbWlseSAoQXJpYWwpCiAgIC9GbGFncyAzMgogICAvRm9udEJCb3ggWyAwIC0yMTAgODI0IDcyOCBdCiAgIC9JdGFsaWNBbmdsZSAwCiAgIC9Bc2NlbnQgOTA1CiAgIC9EZXNjZW50IC0yMTEKICAgL0NhcEhlaWdodCA3MjgKICAgL1N0ZW1WIDgwCiAgIC9TdGVtSCA4MAogICAvRm9udEZpbGUyIDE0IDAgUgo+PgplbmRvYmoKMTEgMCBvYmoKPDwgL1R5cGUgL0ZvbnQKICAgL1N1YnR5cGUgL1RydWVUeXBlCiAgIC9CYXNlRm9udCAvRllQTVVTK0FyaWFsLUJvbGRNVAogICAvRmlyc3RDaGFyIDMyCiAgIC9MYXN0Q2hhciAxMjEKICAgL0ZvbnREZXNjcmlwdG9yIDE4IDAgUgogICAvRW5jb2RpbmcgL1dpbkFuc2lFbmNvZGluZwogICAvV2lkdGhzIFsgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgNzIyLjE2Nzk2OSAwIDYxMC44Mzk4NDQgMCAwIDAgMCAwIDAgMCAwIDAgNjY2Ljk5MjE4OCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgNTU2LjE1MjM0NCAzMzMuMDA3ODEyIDAgMCAyNzcuODMyMDMxIDAgMCAyNzcuODMyMDMxIDg4OS4xNjAxNTYgMCAwIDAgMCAwIDAgMCA2MTAuODM5ODQ0IDAgMCAwIDU1Ni4xNTIzNDQgXQogICAgL1RvVW5pY29kZSAxNiAwIFIKPj4KZW5kb2JqCjEzIDAgb2JqCjw8IC9UeXBlIC9PYmpTdG0KICAgL0xlbmd0aCAyMyAwIFIKICAgL04gNgogICAvRmlyc3QgMzUKICAgL0ZpbHRlciAvRmxhdGVEZWNvZGUKPj4Kc3RyZWFtCnicVZHRa8IwEMbf81fcy5gyaC+xlSrFB5XJGA7RvYkPoWY14JqSpGPur9+ltc69BO6X+/juu+OAjE8gRSYQxhMmOGT0ghAZEwKSlLM8h/j9UiuIN7JUjgFA/KqPDvYgAGELhxYtTFN54Gw2axVv8lNRC30derRUzjsgtyC6so01x6ZQFgaF1NYAj3gWIQxO3tduGsctLa2sT7pwkbHlcNi5WSW9Idna/OjzWcKzturDfANPRhFGyV2XNtVSegWD5VSgGKMQKSJyTJ5QPCIO+/H+MsID5Qj6jbQqhAoTt2CtjlrOyWZPCCGdpJAl4raBylO7g+TWv7KmqSHPQxHqzqOlPdoRtbJydfAqLj1+AW8b1VeLXVjfly7UdjUPkGYOfKucaWxBmx7dPHckLHw3uqPz/ou3kF6eTXlNR+e8C9edTGALSPULuJOI3wplbmRzdHJlYW0KZW5kb2JqCjIzIDAgb2JqCiAgIDMzMAplbmRvYmoKMjQgMCBvYmoKPDwgL1R5cGUgL1hSZWYKICAgL0xlbmd0aCA5NAogICAvRmlsdGVyIC9GbGF0ZURlY29kZQogICAvU2l6ZSAyNQogICAvVyBbMSAyIDJdCiAgIC9Sb290IDIyIDAgUgogICAvSW5mbyAyMSAwIFIKPj4Kc3RyZWFtCnicY2Bg+P+fiYGXgQFEsDAynGZgYGTgBxHbQGIcQBajPpBglgASTAUgIhJIKJ8Fic0GEqpbQKyNQELRGkQEAwklEFfpBMRQRhDBBCKYQQQro3oxUFa9i4EBAC4JDB4KZW5kc3RyZWFtCmVuZG9iagpzdGFydHhyZWYKMTAxMjIKJSVFT0YK\"}]','[{\"url\": \"www.google.com\", \"label\": \"google\"}]',1,0,1,'2026-02-25 19:53:39','2026-02-26 16:58:50'),
(23,'سيليكون هجين Pumalastic MS','سيليكون نترالي متعادل لاصق وعازل ويجمع بين قوة الالتصاق العالية والمرونة الدائمة ، اضافة الى مقاومته العالية للرطوبة والعوامل الجوية والتعفن والفطريات والبكتيريا والمواد الكيميائية ، يجمع بين خصائص السيليكون والبولييوريثان مما يجعله الخيار الأفضل لترويب الحمامات وخاصة الشاور ','الألوان: أبيض، أسود، بني ، سكني\nالقاعدة الكيميائية: بوليمر MS\nنظام التصلّب: رطوبة الهواء\nالكثافة: 1.67 غ/مل\nتكوّن القشرة (20°C، رطوبة 65%): ~ 25 دقيقة\nسرعة التصلّب: 3 مم / 24 ساعة\nالصلادة: 40 ± 5 Shore A\nمعامل المرونة عند 100%: 0.62 N/mm²\nالاسترداد المرن: >75%\nالحركة المسموح بها: ±20% من عرض الفاصل\nمقاومة الحرارة بعد التصلّب: -40°C إلى +90°C\nمقاومة الشد القصوى: 1.85 N/mm²\nالاستطالة عند الكسر: 550%','1-لا يُستخدم للفواصل التي تتجاوز حركتها 20%.\n2-لا يُطبّق في درجات حرارة أقل من +5°C أو أعلى من +30°C.\n3- انتبه الى ظروف التخزين وفترة صلاحية المنتج\n4- يجب ان يكون السطح نظيفا وخاليا من الغبار والزيوت والاوساخ\n\n\n','احمِ حواف الفاصل بشريط لاصق للحصول على تشطيب أفضل.\nطبّق المادة باستخدام مسدس يدوي مع فوهة بلاستيكية، مع الحفاظ على زاوية وعمق ثابتين وتجنب حبس الهواء.\nنعّم السطح بملعقة مبللة بالماء والصابون مع الضغط الجيد على الحواف والقاع.',35.00,NULL,0,'','مواد بناء','مواد البناء','/uploads/excel/row-3.png',NULL,NULL,NULL,0,0,1,'2026-02-25 19:53:39','2026-02-25 21:31:48'),
(24,'روبة بلاط خارجية Pegoland® Profesional Junta ','روبة اسمنتية خالية من ( الاسمنت البورتلاندي ) مما يجعلها اكثر مقاومة للتشققات والتأكل والاحتكاك والتزهير والتمليح ، مصممة للفواصل حتى 20 ملم وتتمتع بمقاومة عالية للفطريات والطحالب والتعفن بفضل تقنية ال Bioactive ، موصى بها لبرك السباحة والساحات الخارجية والحمامات بسبب مقاومتها العالية للزيوت والمذيبات والاحماض ذات ph >3 .\n\n\n\n\n','قوة الضغط بعد 28 يوم: ≥ 30 N/mm²\nمقاومة الانثناء بعد 28 يوم: ≥ 5 N/mm²\nامتصاص الماء بعد 30 دقيقة: ≤ 0.2 جم\nمقاومة التآكل: ≤ 700 مم³\nمقاومة درجات الحرارة: -20°C إلى +80°C','1- لا يُستخدم في درجات حرارة أقل من 5°C أو أعلى من 30°C.\n2- لا يُستخدم في الأماكن المعرضة للمياه الجوفية أو الرطوبة الصاعدة.\n3- يجب ترطيب الفواصل قبل التركيب في حال وجود  درجات حرارة مرتفعة أو بلاط عالي الامتصاص.\n5- لا يُستخدم على الفواصل الإنشائية أو الفواصل التي تتعرض لحركة هيكلية.\n6- لا يُخلط مع أسمنت بورتلاندي أو أي مواد رابطة هيدروليكية.\n7-لا يُستخدم الماء المالح أو المتسخ في المزج.\n8- انتبه الى ظروف التخزين وفترة صلاحية المنتج\n9- يجب ان يكون السطح نظيفا وخاليا من الغبار والزيوت والاوساخ','تنظيف الفواصل من الغبار وبقايا المواد اللاصقة.\nمزج 19-25% ماء (حوالي 0.57-0.75 لتر لكل كيس 3 كجم) للحصول على عجينة متجانسة.\nاستخدام الكمية التي يمكن استخدامها خلال 20-25 دقيقة.\nتعبئة الفواصل باستخدام أداة مطاطية وضغط المادة جيداً.\nتنظيف السطح بعد جفاف المادة جزئياً (15-30 دقيقة) باستخدام إسفنجة رطبة.\nالانتظار 24 ساعة قبل تشغيل الأسطح، و48 ساعة في المسابح والخزانات.',65.00,NULL,0,'','مواد بناء','مواد البناء','/uploads/excel/row-4.png',NULL,NULL,NULL,0,0,1,'2026-02-25 19:53:39','2026-02-25 21:31:48'),
(25,'روبة بلاط داخلية Morcemcolor® Plus Flexible ','روبة مقاومة للماء ، تتميز بالقوة العالية والمرونة ، مصممة للفواصل من 1 الى 15 ملم ،تحتوي على مادة حافظة ذات خصائص مضادة للفطريات والطحالب ومقاومة للعفن والتأكل (Bioactive Technology) ، إضافة الى تقنية طرد المياه السطحية عن الفواصل (AquaStop) ، وتتميز بصلابة عالية ومقاومة عالية للتشققات وسهولة في التنظيف ، يوصى بها للاستعمال الداخلي وفي الارضيات التي تحتوي على نظام تدفئة اسفل البلاط .','ماء الخلط: 29 – 33%.\nزمن الاستخدام: 50 – 60 دقيقة.\nزمن الانتظار قبل التشطيب: 20 – 30 دقيقة.\nإمكانية المشي: بعد 24 ساعة.\nمقاومة الانحناء بعد 28 يوم ≥ 2.5 نيوتن/مم²\nمقاومة الضغط بعد 28 يوم ≥ 15 نيوتن/مم²\nمقاومة التآكل ≤ 1000 مم³\nامتصاص الماء بعد 30 دقيقة ≤ 2 جم\nامتصاص الماء بعد 240 دقيقة ≤ 5 جم','1- لا يُستخدم في الفواصل التمددية أو المعرضة لحركات إنشائية.\n2- لا يُستخدم تحت 5°C أو فوق 35°C.\n3- لا يُستخدم في ظروف صقيع أو رياح قوية أو شمس مباشرة.\n4- يجب أن تكون الفواصل بعمق لا يقل عن ثلثي سماكة البلاط.\n5- تجنّب الإفراط في الماء لأنه يقلل من الأداء النهائي.\n6-في البلاط المسامي أو الحرارة العالية، يُنصح بترطيب الفواصل قليلاً قبل التطبيق.\n7- انتبه الى ظروف التخزين وفترة صلاحية المنتج\n8- يجب ان يكون السطح نظيفا وخاليا من الغبار والزيوت والاوساخ','يضاف الماء (29% – 33%) ويُخلط يدوياً أو ميكانيكياً حتى تتكون عجينة متجانسة غير سائلة.\nيُترك الخليط 5 دقائق ثم يُعاد خلطه.\nيُملأ بالفواصل باستخدام مِسطرين مطاطي أو مسدس، مع ضغط المونة جيداً.\nالتطبيق يكون بشكل مائل على الفواصل مع إزالة الفائض.\nبعد 20 – 30 دقيقة وعندما تصبح المونة غير لامعة، يُمسح السطح بإسفنجة رطبة قاسية.\nبعد التصلب، يُلمّع السطح بقطعة قماش جافة.\nيُترك 24 ساعة قبل الاستخدام العادي.\nفي أحواض السباحة يجب الانتظار أسبوعاً قبل التعبئة الأولى.',59.00,NULL,0,'','مواد بناء','مواد البناء','/uploads/excel/row-5.png',NULL,NULL,NULL,1,0,1,'2026-02-25 19:53:39','2026-02-25 21:31:49'),
(26,'دبق بلاط عادي  Pegoland® 695','لاصق بلاط اسمنتي مكون من عوامل ربط مختلطة ومواد مضافة مما يمنحه قوة التصاق عالية وانزلاق منخفض ، مناسب لتثبيت جميع أنواع البورسلان و الجرانيت والرخام والحجر الطبيعي ، ويستعمل للجدران الداخلية والارضيات الداخلية .','شكل: مسحوق أبيض 25 كجم \nزمن التعديل: حوالي 30 دقيقة\nمدة صلاحية الخليط: حوالي ساعتين\nقوة الالتصاق بالشد:\n	•	بعد 28 يوم ≥ 0.5 نيوتن/مم²\n	•	بعد الغمر بالماء ≥ 0.5 نيوتن/مم²\n	•	بعد التعرض للحرارة ≥ 0.5 نيوتن/مم²\n	•	بعد دورات تجمد/ذوبان ≥ 0.5 نيوتن/مم²','	1- لا يُطبق تحت 5°م أو فوق 30°م.\n	2- لا يُطبق في حال خطر الصقيع أو المطر أو الرياح الشديدة أو التعرض المباشر للشمس.\n	3- لا يُستخدم في أماكن تجمع المياه.\n	4- في الظروف المناخية القاسية قد يتسارع الجفاف.\n5- انتبه الى ظروف التخزين وفترة صلاحية المنتج\n6- يجب ان يكون السطح نظيفا وخاليا من الغبار والزيوت والاوساخ','	إضافة الماء والخلط يدوياً أو ميكانيكياً حتى الحصول على قوام متجانس قابل للتشغيل.\n		يُترك الخليط 5 دقائق ثم يُعاد خلطه.\n		يُفرد اللاصق على مساحة لا تتجاوز 2 م² باستخدام المالج.\n		يُمشّط باستخدام مالج مسنن حسب المقاس المطلوب.\n		توضع البلاطات على اللاصق الطازج مع الضغط والتحريك حتى تختفي التموجات ويتحقق الالتصاق الكامل.\n	يجب فحص الالتصاق دورياً برفع بلاطة للتأكد من عدم تشكل طبقة جافة أو فقدان الرطوبة. عند حدوث ذلك يجب إزالة المادة وإعادة التطبيق',45.00,NULL,0,'','مواد بناء','مواد البناء','/uploads/excel/row-6.png',NULL,NULL,NULL,1,0,1,'2026-02-25 19:53:39','2026-02-25 21:31:49'),
(27,'دبق بلاط محسن Pegoland® Flex 554','لاصق بلاط اسمنتي مكون من مواد رابطة مختلفة  يتميز بالمرونة والالتصاق القوي مع تقليل الانزلاق  ومقاومة التشوهات ( التمدد  والتقلص ) ، يستخدم داخلي وخارجي ولاحجام البلاط الكبيرة والارضيات التي تحتوي على تدفئة تحت البلاط وغرف التبريد والواجهات الخارجية ولتركيب البلاط فوق البلاط ولبرك السباحة ','اللون: أبيض25 كجم.\nزمن التعديل: حوالي 30 دقيقة.\nزمن صلاحية العجينة: حوالي 4 ساعات.\nقوة التصاق مبدئية وبعد الغمر أو الحرارة أو التجمد/الذوبان: ≥ 1 نيوتن/مم².\n','1- درجة الحرارة المثالية للتطبيق بين 5°C و35°C.\n2- عدم التطبيق في حالات الصقيع، الأمطار، الرياح القوية أو أشعة الشمس المباشرة..\n3-أحواض السباحة يمكن ملؤها بعد 7 أيام من التركيب.\n4- انتبه الى ظروف التخزين وفترة صلاحية المنتج\n5- يجب ان يكون السطح نظيفا وخاليا من الغبار والزيوت والاوساخ','ضافة 26–31% ماء (حوالي 5.2–6.2 لتر لكل كيس).\nالخلط حتى الحصول على عجينة متجانسة وقابلة للتطبيق.\nترك العجينة لترتاح 5 دقائق ثم إعادة الخلط.\nفرد المادة على مساحة لا تتجاوز 2 م² في المرة.\nتركيب البلاط على المادة الطازجة مع الضغط والحركة لضمان التصاق كامل.\nالتحقق بشكل دوري من التصاق المادة برفع بلاطة للتأكد من عدم تكون طبقة جافة.',85.00,NULL,0,'','مواد بناء','مواد البناء','/uploads/excel/row-7.png',NULL,NULL,NULL,1,0,1,'2026-02-25 19:53:39','2026-02-25 21:31:50'),
(28,'ألياف صناعية PAVILAND FIBER  ','ألياف صناعية حجم 600 غم   (Monofilament fiber) مصممة خصيصًا للتقليل من احتمالية تشكل التشققات والشروخ الناتجة عن الانكماش البلاستيكي  في الخلطات الاسمنتية والخرسانية  بالاضافة الى تحسين التماسك الداخلي للخرسانة .','مقاومة الشد: أكبر من 5 غرام/دنير\nالاستطالة: 40 – 60٪\nنسبة الإضافة للخرسانة: 600 غرام / م³ من الخرسانة\n','1- لا يستخدم كبديل لاي من عناصر الخلطة الاسمنتية \n2- يجب خلطه بشكل كامل مع الخلطة الاسمنتية','أضف كيس ألياف بالكامل إلى كل متر مكعب خرسانة الى  الخلاطة واخلط لمدة 5 إلى 7 دقائق.',30.00,NULL,0,'','مواد بناء','مواد البناء','/uploads/excel/row-8.png',NULL,NULL,NULL,1,0,1,'2026-02-25 19:53:39','2026-02-25 21:31:50'),
(29,'عزل اسمنتي\n SikaTop 550','مادة عزل إسمنتية معدّلة بالأكريليك، مكوّنة من عنصرين وتتطلب الخلط في الموقع، لتشكيل منتج يُستخدم لعزل المياه في الحمامات والبلاكين  وخزانات المياه وخلف الحجر وغيره من التطبيقات التي تتطلب العزل المائي.','استهلاك المادة: حوالي 1.8 كغم/م² عند سمك 1 مم.\nسمك الطبقة: 1 مم لكل طبقة (يُطبق على الأقل بطبقتين).\nدرجة الحرارة المحيطة أثناء التطبيق: +5°C إلى +45°C.\nفترة الانتظار بين الطبقات: 3- 6 ساعات\nالكثافة: 1.5 – 1.7 كجم/لتر بعد الخلط\nنفاذية الماء: < 0.1 كغم/(م² × √الوقت)  \n','1- لا يضاف الماء تحت أي ظرف كان\n2- فترة الانتظار بين الطبقات تعتمد على درجة حرارة الجو\n3- انتبه الى ظروف التخزين وفترة صلاحية المنتج\n4- يجب ان يكون السطح نظيفا وخاليا من الغبار والزيوت والاوساخ','يتم الخلط بخلاطة كهربائية ببطء (~500 دورة/دقيقة).\nيُسكب حوالي نصف الجزء السائل في وعاء الخلط ثم يُضاف المسحوق تدريجياً مع الخلط حتى يتجانس.\nبعد التجانس يضاف الجزء السائل المتبقي ويخلط جيداً (حوالي 3 دقائق) للحصول على خليط خالٍ من التكتلات.\nبعد الانتهاء من التطبيق، يتم تطبيق المادة وطلائها بالفرشاة',0.00,NULL,0,'','مواد بناء','مواد البناء','/uploads/excel/row-9.png',NULL,NULL,NULL,1,0,1,'2026-02-25 19:53:39','2026-02-25 21:31:51'),
(30,'عزل بيتومين بولي يوريثان\nSikaLastic HLM 5000 R','هو مادة عزل مائي تحتوي على البولي يوريثان المعدّل بالبيتومين، تعمل على تشكيل طبقة مرنة قوية تحمي الاسطح من تسرب الماء وتقاوم حركة وتمدد وتقلّص المواد دون ان تتشقق، مخصصة للاستخدامات الخارجية تحت منسوب الأرض والجدران الاستنادية والحمامات والترسات أو بين البلاطات وفي التطبيقات الغير معرضة للشمس.','المظهر: سائل أسود لزج\nالكثافة: 1.2 – 1.3 كجم/لتر\nوقت التصلب الأولي: 3–5 ساعات\nدرجة الحرارة المناسبة للتطبيق: 5–35°م\nالوظيفة: غشاء عزل مرن للرطوبة والتشققات\nمقاومة الشد  >   2.0 MPa\nالاستطالة عند الانكسار  > 500 %	\nقوة الالتصاق  > 1 MPa	  \nمقاومة التمزّق	>  15 N/mm	','1- يجب حماية الطبقة من الحركة الثقيلة قبل أن تتصلّب تمامًا.\n2- انتبه الى ظروف التخزين وفترة صلاحية المنتج\n3- يجب ان يكون السطح نظيفا وخاليا من الغبار والزيوت والاوساخ','يُطبّق المنتج مباشرة على السطح باستخدام أدوات مناسبة حسب السطح.\nللتحقّق من عدم وجود تسربات، يمكن سدّ مساحة مائية على السطح لمدة 24 – 48 ساعة بعد التصلّب ثم فحصها بصريًا.\nتتكون خواص المنتج بشكل كامل تقريبًا خلال 24 – 48 ساعة عند 24 °C ورطوبة نسبية ~50 %.\n',0.00,NULL,0,'','مواد بناء','مواد البناء','/uploads/excel/row-10.png',NULL,NULL,NULL,1,0,1,'2026-02-25 19:53:39','2026-02-25 21:31:51'),
(31,'عازل بيتومين- زفتة باردة \nSika Igolflex 620','مستحلب بيتوميني مائي غير ليفي، لونه بني داكن ويجف ليكوّن طبقة حماية سوداء مرنة قوية ومقاومته للماء، حيث يشكّل حاجزًا يمنع نفاذ المياه وبخار الماء، حيث تستخدم في عزل المدماك الأول من الطوب والقواعد والاساسات والجدران الاستنادية الخارجية التي لا تعتبر جزء من المبنى','لمظهر: سائل بني داكن يتحوّل إلى أسود عند الجفاف\nالكثافة: 1.0 – 1.1 كجم/لتر\nالمحتوى الصلب: ~50 ٪ من الوزن الكلي.\nالمحتوى المطاطي: ~10 ٪ من الوزن.\nالاستهلاك: تقريبي 0.50 – 0.65 لتر/م² لكل طبقة (يُطبَّقان على الأقل طبقتان).\nدرجة حرارة السطح أثناء التطبيق: +5 °C إلى +55 °C.\nالمدة بين الطبقات: حوالي 6 – 8 ساعات لكل طبقة (قد تختلف حسب الظروف الجوية).\nوقت الجفاف الكامل: تقريباً 3 – 5 أيام (قد يطول في درجات الحرارة المنخفضة أو الرطوبة العالية).','1- إذا تم تطبيق طبقة أساس (برايمر)، فانتظر حتى تجف تمامًا قبل تطبيق الطبقة التالية.\n2- على الخرسانة الجافة والحارة والمسامية، ينصح بتخفيف المنتج بالماء بنسبة 1:1  كطبقة أساس.\n3- قبل التطبيق، املأ الثقوب والشقوق بمواد ترميم مناسبة لضمان سطح متساوٍ.\n4- يجب أن تكون الأسطح صلبة، خالية من الغبار والجزيئات غير المتماسكة والملوثات.','يطبّق المنتج بشكل متساوٍ في اتجاه واحد باستخدام فرشاة أو بكرة. ويطبق من خلال طبقتين لضمان عدم ظهور ثقوب في الغشاء. وتترك كل طبقة تجف تمامًا قبل تطبيق الطبقة التالية، ومن ثم يحمى المنتج بعد التطبيق من الأمطار حتى يجف بالكامل',0.00,NULL,0,'','مواد بناء','مواد البناء','/uploads/excel/row-11.png',NULL,NULL,NULL,1,0,1,'2026-02-25 19:53:39','2026-02-25 21:31:53');
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `site_banner`
--

DROP TABLE IF EXISTS `site_banner`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `site_banner` (
  `id` int(11) NOT NULL,
  `image_url` text DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `site_banner`
--

LOCK TABLES `site_banner` WRITE;
/*!40000 ALTER TABLE `site_banner` DISABLE KEYS */;
set autocommit=0;
/*!40000 ALTER TABLE `site_banner` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `smtp_settings`
--

DROP TABLE IF EXISTS `smtp_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `smtp_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `label` varchar(120) DEFAULT NULL,
  `host` varchar(255) DEFAULT NULL,
  `port` int(11) DEFAULT 587,
  `secure` tinyint(1) DEFAULT 0,
  `username` varchar(255) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `from_name` varchar(255) DEFAULT NULL,
  `from_email` varchar(255) DEFAULT NULL,
  `notify_email` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `smtp_settings`
--

LOCK TABLES `smtp_settings` WRITE;
/*!40000 ALTER TABLE `smtp_settings` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `smtp_settings` VALUES
(1,'SMTP الرئيسي','mail.shadi.ps',465,0,'store','','store.shadi.ps','haythemasad0@gmail.com','',1,'2026-02-26 15:17:49','2026-02-26 15:17:49');
/*!40000 ALTER TABLE `smtp_settings` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `types`
--

DROP TABLE IF EXISTS `types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `types` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `types`
--

LOCK TABLES `types` WRITE;
/*!40000 ALTER TABLE `types` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `types` VALUES
(1,'أنابيب','2026-02-24 21:09:06'),
(2,'صمامات','2026-02-24 21:09:06'),
(3,'أسمنت','2026-02-24 21:09:06'),
(4,'ركام','2026-02-24 21:09:06'),
(5,'ألواح','2026-02-24 21:09:06'),
(6,'رولات','2026-02-24 21:09:06');
/*!40000 ALTER TABLE `types` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Table structure for table `whatsapp_settings`
--

DROP TABLE IF EXISTS `whatsapp_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `whatsapp_settings` (
  `id` int(11) NOT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `message` text DEFAULT NULL,
  `qr_data_url` longtext DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `whatsapp_settings`
--

LOCK TABLES `whatsapp_settings` WRITE;
/*!40000 ALTER TABLE `whatsapp_settings` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `whatsapp_settings` VALUES
(1,'00972569688288','','','2026-02-26 18:48:07');
/*!40000 ALTER TABLE `whatsapp_settings` ENABLE KEYS */;
UNLOCK TABLES;
commit;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*M!100616 SET NOTE_VERBOSITY=@OLD_NOTE_VERBOSITY */;

-- Dump completed on 2026-03-07  1:01:32
