ALTER TABLE `categories` ADD COLUMN `sort_order` INT NOT NULL DEFAULT 0 AFTER `name`;

UPDATE `categories` c
JOIN (
  SELECT `id`, ROW_NUMBER() OVER (ORDER BY `name` ASC, `id` ASC) AS seq
  FROM `categories`
) ordered ON ordered.id = c.id
SET c.sort_order = ordered.seq
WHERE c.sort_order = 0;
