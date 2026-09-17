-- 初始基线：users 主表（migrate_auth_v2 之前的原始 schema）。
-- 作用：让迁移链可从全空库自举——migrate_auth_v2/v3 的 ALTER 目标表由此建立，
-- 此前只有 schema.sql 打底才能收敛（新环境漏跑 schema.sql 时迁移会循环失败）。
-- 已有环境表已存在：CREATE TABLE IF NOT EXISTS 为空跑（幂等，版本照常记录）。
-- 字段与 schema.sql 头部注释的「初始 schema」清单一致；username 等后续列由 v3 追加。
CREATE TABLE IF NOT EXISTS users (
  id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nickname              VARCHAR(50)   NOT NULL DEFAULT '学习者',
  email                 VARCHAR(255)  DEFAULT NULL,
  password_hash         VARCHAR(255)  NOT NULL,
  avatar_url            TEXT          DEFAULT NULL,
  daily_goal_minutes    SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  created_at            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;
