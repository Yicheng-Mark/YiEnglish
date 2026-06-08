-- 体验码试用系统
CREATE TABLE IF NOT EXISTS experience_codes (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code            VARCHAR(50)    NOT NULL,
  description     VARCHAR(255)   NOT NULL DEFAULT '',
  max_uses        INT UNSIGNED   NOT NULL DEFAULT 0       COMMENT '0 = unlimited',
  current_uses    INT UNSIGNED   NOT NULL DEFAULT 0,
  trial_hours     SMALLINT UNSIGNED NOT NULL DEFAULT 1    COMMENT 'trial duration in hours',
  is_active       TINYINT(1)     NOT NULL DEFAULT 1,
  created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at      TIMESTAMP      NULL DEFAULT NULL         COMMENT 'NULL = never expires',
  UNIQUE KEY uk_code (code),
  INDEX idx_active (is_active)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS trial_activations (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         BIGINT UNSIGNED NOT NULL,
  code_id         BIGINT UNSIGNED NOT NULL,
  expires_at      TIMESTAMP      NOT NULL,
  converted       TINYINT(1)     NOT NULL DEFAULT 0       COMMENT '1 = upgraded to real account',
  converted_at    TIMESTAMP      NULL DEFAULT NULL,
  created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user (user_id),
  INDEX idx_expires (expires_at),
  INDEX idx_code (code_id),
  CONSTRAINT fk_trial_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_trial_code FOREIGN KEY (code_id) REFERENCES experience_codes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

ALTER TABLE users ADD COLUMN is_guest TINYINT(1) NOT NULL DEFAULT 0 AFTER username
