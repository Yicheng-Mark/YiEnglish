-- 单词进度追踪表
-- 记录每个用户在每个词库每章中完成的单词

CREATE TABLE IF NOT EXISTS word_progress (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED NOT NULL,
  dict_id       VARCHAR(50)   NOT NULL,
  chapter_id    INT           NOT NULL,
  word_name     VARCHAR(255)  NOT NULL,
  completed_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_chapter_word (user_id, dict_id, chapter_id, word_name),
  INDEX idx_user_dict (user_id, dict_id),
  CONSTRAINT fk_progress_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
