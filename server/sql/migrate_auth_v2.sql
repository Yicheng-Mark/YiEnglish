-- Add email verification columns to users table
ALTER TABLE users
  ADD COLUMN verify_code VARCHAR(6) DEFAULT NULL,
  ADD COLUMN code_expires_at TIMESTAMP NULL DEFAULT NULL,
  ADD COLUMN email_verified TINYINT(1) NOT NULL DEFAULT 0;

-- Login logs table
CREATE TABLE IF NOT EXISTS login_logs (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    BIGINT UNSIGNED NOT NULL,
  ip         VARCHAR(45) DEFAULT NULL,
  ua         TEXT DEFAULT NULL,
  success    TINYINT(1) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  CONSTRAINT fk_log_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
