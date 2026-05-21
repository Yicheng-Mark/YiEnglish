CREATE TABLE IF NOT EXISTS user_review_cards (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         BIGINT UNSIGNED    NOT NULL,
  word_name       VARCHAR(255)       NOT NULL,
  dict_id         VARCHAR(50)        NOT NULL DEFAULT '',
  next_review     TIMESTAMP          NOT NULL,
  interval_days   DECIMAL(6,2)       NOT NULL DEFAULT 1.00,
  ease_factor     DECIMAL(4,2)       NOT NULL DEFAULT 2.50,
  repetitions     TINYINT UNSIGNED   NOT NULL DEFAULT 0,
  last_review_at  TIMESTAMP          NULL DEFAULT NULL,
  last_quality    TINYINT UNSIGNED   NOT NULL DEFAULT 0,
  created_at      TIMESTAMP          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_word (user_id, word_name),
  INDEX idx_user_next_review (user_id, next_review),
  CONSTRAINT fk_review_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
