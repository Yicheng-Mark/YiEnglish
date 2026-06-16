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
