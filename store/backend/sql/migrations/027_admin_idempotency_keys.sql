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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
