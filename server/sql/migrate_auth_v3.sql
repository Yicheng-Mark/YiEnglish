-- Auth v3: username+password, no email verification
-- Compatible with MySQL 8.0

USE lingoforge;

-- Add username column if not exists
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'lingoforge' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'username');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE users ADD COLUMN username VARCHAR(30) NOT NULL DEFAULT "" AFTER id', 'SELECT "username column already exists" AS msg');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Drop email unique key if exists
SET @uk_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = 'lingoforge' AND TABLE_NAME = 'users' AND INDEX_NAME = 'uk_email');
SET @sql = IF(@uk_exists > 0, 'ALTER TABLE users DROP INDEX uk_email', 'SELECT "uk_email already dropped" AS msg');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Make email nullable
ALTER TABLE users MODIFY COLUMN email VARCHAR(255) DEFAULT NULL;

-- Remove dormant email verification columns
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'lingoforge' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'verify_code');
SET @sql = IF(@col_exists > 0, 'ALTER TABLE users DROP COLUMN verify_code', 'SELECT "verify_code already dropped" AS msg');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'lingoforge' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'code_expires_at');
SET @sql = IF(@col_exists > 0, 'ALTER TABLE users DROP COLUMN code_expires_at', 'SELECT "code_expires_at already dropped" AS msg');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'lingoforge' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'email_verified');
SET @sql = IF(@col_exists > 0, 'ALTER TABLE users DROP COLUMN email_verified', 'SELECT "email_verified already dropped" AS msg');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Set default usernames for existing rows
UPDATE users SET username = CONCAT('user_', id) WHERE username = '';

-- Add unique constraint on username if not exists
SET @uk_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = 'lingoforge' AND TABLE_NAME = 'users' AND INDEX_NAME = 'uk_username');
SET @sql = IF(@uk_exists = 0, 'ALTER TABLE users ADD UNIQUE KEY uk_username (username)', 'SELECT "uk_username already exists" AS msg');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add signature column if not exists
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'lingoforge' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'signature');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE users ADD COLUMN signature VARCHAR(200) DEFAULT NULL AFTER avatar_url', 'SELECT "signature column already exists" AS msg');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add password_changed_at column if not exists
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'lingoforge' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'password_changed_at');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMP NULL DEFAULT NULL AFTER password_hash', 'SELECT "password_changed_at column already exists" AS msg');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Refresh tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NOT NULL,
  token_hash  CHAR(64)       NOT NULL COMMENT 'SHA-256 of the refresh token',
  expires_at  TIMESTAMP      NOT NULL,
  created_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_expires (expires_at),
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Login attempts table for rate limiting
CREATE TABLE IF NOT EXISTS login_attempts (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  identifier  VARCHAR(255)   NOT NULL COMMENT 'username or IP',
  ip_address  VARCHAR(45)    NOT NULL,
  success     TINYINT(1)     NOT NULL DEFAULT 0,
  created_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_identifier_time (identifier, created_at),
  INDEX idx_ip_time (ip_address, created_at)
) ENGINE=InnoDB;

-- Drop old login_logs table (replaced by login_attempts)
DROP TABLE IF EXISTS login_logs;
