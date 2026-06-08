-- ============================================================
-- 全量用户数据迁移：localStorage → MySQL
-- 替代: lingoforge_favorite_words, typingword_wrong,
--       lingoforge_reading_words, lingoforge_corpus_words,
--       lf_favorite_dicts, typingword_config, lingoforge-theme,
--       lingoforge_profile (signature 部分)
-- ============================================================

USE lingoforge;

-- 1. 统一词本表（收藏 / 错题 / 阅读词本 / 语料词本）
CREATE TABLE IF NOT EXISTS user_word_books (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         BIGINT UNSIGNED NOT NULL,
  book_type       ENUM('favorite','error','reading','corpus') NOT NULL,
  word_name       VARCHAR(255)    NOT NULL,
  trans           JSON            DEFAULT NULL,
  notation        VARCHAR(255)    DEFAULT NULL,
  usphone         VARCHAR(100)    DEFAULT NULL,
  ukphone         VARCHAR(100)    DEFAULT NULL,
  us_audio        VARCHAR(255)    DEFAULT NULL,
  uk_audio        VARCHAR(255)    DEFAULT NULL,
  wrong_count     SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  last_wrong_at   TIMESTAMP       NULL DEFAULT NULL,
  dict_name       VARCHAR(100)    DEFAULT NULL,
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_book_word (user_id, book_type, word_name),
  INDEX idx_user_book_type (user_id, book_type),
  CONSTRAINT fk_wordbook_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 2. 收藏词库表
CREATE TABLE IF NOT EXISTS user_favorite_dicts (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         BIGINT UNSIGNED NOT NULL,
  dict_id         VARCHAR(50)     NOT NULL,
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_dict (user_id, dict_id),
  INDEX idx_user_id (user_id),
  CONSTRAINT fk_favdict_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3. 用户设置表（打字配置 + 主题）
CREATE TABLE IF NOT EXISTS user_settings (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id             BIGINT UNSIGNED NOT NULL,
  sound_enabled       TINYINT(1)   NOT NULL DEFAULT 1,
  show_translation    TINYINT(1)   NOT NULL DEFAULT 1,
  show_phonetic       TINYINT(1)   NOT NULL DEFAULT 1,
  dictation_mode      TINYINT(1)   NOT NULL DEFAULT 0,
  word_repeat_count   SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  auto_remove_error_word TINYINT(1) NOT NULL DEFAULT 1,
  theme               VARCHAR(20)  NOT NULL DEFAULT 'light',
  created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user (user_id),
  CONSTRAINT fk_settings2_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4. users 表增加 signature 字段
-- （已由 migrate_auth_v3.sql 通过 INFORMATION_SCHEMA + PREPARE 模式处理，此处无需重复）
