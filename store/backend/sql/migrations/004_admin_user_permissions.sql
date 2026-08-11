ALTER TABLE `admin_users` ADD COLUMN `is_super_admin` TINYINT(1) NOT NULL DEFAULT 0 AFTER `password_hash`;
ALTER TABLE `admin_users` ADD COLUMN `permissions` JSON NULL AFTER `is_super_admin`;

UPDATE `admin_users`
SET `is_super_admin` = 1
WHERE LOWER(TRIM(`email`)) = 'haythemasad5@gmail.com';
