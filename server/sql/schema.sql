CREATE DATABASE IF NOT EXISTS lingoforge
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE lingoforge;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nickname          VARCHAR(50)   NOT NULL DEFAULT '学习者',
  email             VARCHAR(255)  NOT NULL,
  password_hash     VARCHAR(255)  NOT NULL,
  avatar_url        TEXT          DEFAULT NULL,
  daily_goal_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_email (email)
) ENGINE=InnoDB;

-- 助手基础人格
CREATE TABLE IF NOT EXISTS assistant_profile (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(50)  NOT NULL,
  description   VARCHAR(255) NOT NULL DEFAULT '',
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 风格模式
CREATE TABLE IF NOT EXISTS style_modes (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  style_key     VARCHAR(30)  NOT NULL,
  name          VARCHAR(50)  NOT NULL,
  avatar        VARCHAR(10)  NOT NULL,
  system_prompt TEXT         NOT NULL,
  description   VARCHAR(255) NOT NULL DEFAULT '',
  sort_order    SMALLINT     NOT NULL DEFAULT 0,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_style_key (style_key)
) ENGINE=InnoDB;

-- 长期记忆
CREATE TABLE IF NOT EXISTS conversation_memory (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED NOT NULL,
  category      VARCHAR(50)  NOT NULL DEFAULT 'general',
  content       TEXT         NOT NULL,
  source_msg_id BIGINT UNSIGNED DEFAULT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_user_category (user_id, category),
  CONSTRAINT fk_memory_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 聊天消息
CREATE TABLE IF NOT EXISTS chat_messages (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id           BIGINT UNSIGNED NOT NULL,
  role              ENUM('user','assistant','system') NOT NULL,
  content           TEXT         NOT NULL,
  reasoning_content MEDIUMTEXT   DEFAULT NULL,
  style_key         VARCHAR(30)  DEFAULT NULL,
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_created (user_id, created_at),
  CONSTRAINT fk_msg_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 风格示例
CREATE TABLE IF NOT EXISTS style_examples (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  style_key     VARCHAR(30)  NOT NULL,
  user_input    TEXT         NOT NULL,
  bot_response  TEXT         NOT NULL,
  sort_order    SMALLINT     NOT NULL DEFAULT 0,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_style_key (style_key),
  CONSTRAINT fk_example_style FOREIGN KEY (style_key) REFERENCES style_modes(style_key) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 用户风格设置
CREATE TABLE IF NOT EXISTS user_style_settings (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED NOT NULL,
  style_key     VARCHAR(30)  NOT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user (user_id),
  CONSTRAINT fk_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_settings_style FOREIGN KEY (style_key) REFERENCES style_modes(style_key) ON DELETE CASCADE
) ENGINE=InnoDB;
