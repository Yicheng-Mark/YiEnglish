-- ============================================================
-- LingoForge 数据库最终结构（schema.sql）
-- 本文件汇总 server/sql/migrate_*.sql 按文件名顺序执行后的最终态，
-- 仅作为文档参考。新建库时可直接跑本文件；已建库走 migrate_*.sql。
-- 迁移来源：
--   migrate_auth_v1         users 基表（让迁移链可从全空库自举，2026-09-17 补）
--   migrate_auth_v2         email 验证字段 + login_logs（已被 v3 删除）
--   migrate_auth_v3         username/password 体系 + refresh_tokens + login_attempts
--   migrate_demo_trial      experience_codes + trial_activations + users.is_guest
--   migrate_activation_code experience_codes.type + users.activation_code_id
--   migrate_progress        word_progress
--   migrate_review          user_review_cards
--   migrate_user_data       user_word_books + user_favorite_dicts + user_settings
--   migrate_device_sessions refresh_tokens 设备级字段
--   migrate_device_trial    trial_activations.device_id
--   migrate_auth_v4         refresh_tokens.uk_token_hash
--   migrate_idx_v1          login_attempts.idx_login_attempts_limiter + experience_codes.idx_experience_codes_type_active
--   migrate_ai_assistant     AI 助手：style_modes + user_style_settings + conversation_memory + chat_messages + ai_usage
--   migrate_user_device_limit users.max_devices 用户级设备登录上限覆盖
--   migrate_refresh_device_unique refresh_tokens.uk_user_device + 清理 device_id='' 历史行
--   migrate_subscription_expire users.subscription_expires_at 订阅到期（月/季/年卡）
--   migrate_activation_hours_default experience_codes.trial_hours 默认值 1→0（防漏写变 1 小时卡）
--   migrate_theme_cleanup   user_settings.theme 存量 gray/star/dark 回落 light
--   migrate_trial_activation_ip trial_activations.ip 同 IP 累计终身领取上限
--   migrate_trial_ip_totals   trial_ip_totals IP 终身计数归档（防访客清理级联删除导致计数回血）
--   migrate_admin_backoffice users.is_admin + admin_audit_log 操作审计 + experience_codes.issued_note 发放备注
--   migrate_admin_totp      users.totp_secret 管理员两步验证（AES-256-GCM 加密，NULL=未启用）
-- ============================================================

CREATE DATABASE IF NOT EXISTS lingoforge
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE lingoforge;

-- ------------------------------------------------------------
-- users：用户主表
-- 字段来源：
--   初始 schema     id/nickname/email/password_hash/avatar_url/daily_goal_minutes/created_at/updated_at
--   migrate_auth_v2 verify_code/code_expires_at/email_verified（已被 v3 删除，不在此出现）
--   migrate_auth_v3 username/uk_username，email 改为可空并删除唯一键，signature，password_changed_at
--   migrate_user_device_limit max_devices（NULL=全局默认，0=不限，>0=覆盖）
--   migrate_subscription_expire subscription_expires_at（NULL=永久；月/季/年卡按激活码 trial_hours 写入）
--   migrate_demo_trial is_guest
--   migrate_activation_code activation_code_id
--   migrate_admin_backoffice is_admin
--   migrate_admin_totp totp_secret（管理员两步验证密钥，AES-256-GCM 加密，NULL=未启用）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                     BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username               VARCHAR(30)   NOT NULL DEFAULT '',
  is_guest               TINYINT(1)    NOT NULL DEFAULT 0,
  is_admin               TINYINT(1)    NOT NULL DEFAULT 0 COMMENT '管理员标识（手工 SQL 设置）',
  activation_code_id     BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '注册来源激活码（experience_codes.id）',
  nickname               VARCHAR(50)   NOT NULL DEFAULT '学习者',
  email                  VARCHAR(255)  DEFAULT NULL,
  password_hash          VARCHAR(255)  NOT NULL,
  password_changed_at    TIMESTAMP     NULL DEFAULT NULL,
  avatar_url             TEXT          DEFAULT NULL,
  signature              VARCHAR(200)  DEFAULT NULL,
  daily_goal_minutes     SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  max_devices            SMALLINT UNSIGNED NULL DEFAULT NULL COMMENT '设备登录数上限：NULL=全局默认，0=不限，>0=覆盖值',
  subscription_expires_at TIMESTAMP    NULL DEFAULT NULL COMMENT '订阅到期：NULL=永久',
  created_at             TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  totp_secret            VARCHAR(255)  NULL DEFAULT NULL COMMENT '管理员 TOTP 密钥（AES-256-GCM 加密，NULL=未启用）',
  UNIQUE KEY uk_username (username)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- refresh_tokens：刷新令牌（每行=一台登录设备）
-- 来源：migrate_auth_v3（建表）+ migrate_device_sessions（设备字段）+ migrate_auth_v4（uk_token_hash）
--       + migrate_refresh_device_unique（uk_user_device：一台设备同一账号只保留一条会话行）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         BIGINT UNSIGNED NOT NULL,
  token_hash      CHAR(64)       NOT NULL COMMENT 'SHA-256 of the refresh token',
  device_id       VARCHAR(64)    NOT NULL DEFAULT '',
  device_name     VARCHAR(150)   DEFAULT NULL,
  ip              VARCHAR(45)    DEFAULT NULL,
  last_active_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at      TIMESTAMP      NOT NULL,
  created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_token_hash (token_hash),
  UNIQUE KEY uk_user_device (user_id, device_id),
  INDEX idx_user_id (user_id),
  INDEX idx_expires (expires_at),
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- login_attempts：登录限流日志（替代已被 v3 删除的 login_logs）
-- 来源：migrate_auth_v3 + migrate_idx_v1（限流 COUNT(*) 的覆盖索引）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS login_attempts (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  identifier   VARCHAR(255)   NOT NULL COMMENT 'username or IP',
  ip_address   VARCHAR(45)    NOT NULL,
  success      TINYINT(1)     NOT NULL DEFAULT 0,
  created_at   TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_identifier_time (identifier, created_at),
  INDEX idx_ip_time (ip_address, created_at),
  INDEX idx_login_attempts_limiter (identifier, success, created_at)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- admin_audit_log：管理后台操作审计
-- 来源：migrate_admin_backoffice。所有管理写操作（续期/设备上限/生成码/改码）自动落一条
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admin_user_id BIGINT UNSIGNED NOT NULL,
  action        VARCHAR(50)    NOT NULL COMMENT 'renew_subscription / set_max_devices / create_codes / update_code',
  target_type   VARCHAR(20)    NOT NULL COMMENT 'user / code',
  target_id     BIGINT UNSIGNED NULL,
  detail        VARCHAR(500)   NULL COMMENT '操作参数摘要(JSON)',
  ip            VARCHAR(45)    NULL,
  created_at    TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_admin_time (admin_user_id, created_at),
  CONSTRAINT fk_audit_admin FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- experience_codes：激活码 / 体验码
-- 来源：migrate_demo_trial（建表）+ migrate_activation_code（type）+ migrate_activation_hours_default（默认值）
--       + migrate_idx_v1（按 type 查询的复合索引）
-- type='trial' 体验码（试用 N 小时）；type='activation' 激活码（注册来源，trial_hours 携带订阅时长，0=永久）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS experience_codes (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code            VARCHAR(50)    NOT NULL,
  description     VARCHAR(255)   NOT NULL DEFAULT '',
  type            ENUM('trial','activation') NOT NULL DEFAULT 'trial',
  max_uses        INT UNSIGNED   NOT NULL DEFAULT 0       COMMENT '0 = unlimited',
  current_uses    INT UNSIGNED   NOT NULL DEFAULT 0,
  trial_hours     SMALLINT UNSIGNED NOT NULL DEFAULT 0    COMMENT 'trial duration in hours',
  issued_note     VARCHAR(255)   NULL DEFAULT NULL COMMENT '发放备注（发给谁/渠道）',
  is_active       TINYINT(1)     NOT NULL DEFAULT 1,
  created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at      TIMESTAMP      NULL DEFAULT NULL         COMMENT 'NULL = never expires',
  UNIQUE KEY uk_code (code),
  INDEX idx_active (is_active),
  INDEX idx_experience_codes_type_active (type, is_active)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- trial_activations：体验码激活记录（每用户/每设备唯一）
-- 来源：migrate_demo_trial（建表）+ migrate_device_trial（device_id + uk_device）
-- uk_user  限制每用户只能激活一次；uk_device 限制每台设备只能体验一次
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trial_activations (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         BIGINT UNSIGNED NOT NULL,
  code_id         BIGINT UNSIGNED NOT NULL,
  device_id       VARCHAR(64)    DEFAULT NULL,
  ip              VARCHAR(45)    NULL DEFAULT NULL        COMMENT '领取时客户端 IP（同 IP 累计终身上限）',
  expires_at      TIMESTAMP      NOT NULL,
  converted       TINYINT(1)     NOT NULL DEFAULT 0       COMMENT '1 = upgraded to real account',
  converted_at    TIMESTAMP      NULL DEFAULT NULL,
  created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user (user_id),
  UNIQUE KEY uk_device (device_id),
  INDEX idx_expires (expires_at),
  INDEX idx_code (code_id),
  INDEX idx_ip (ip),
  CONSTRAINT fk_trial_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_trial_code FOREIGN KEY (code_id) REFERENCES experience_codes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- trial_ip_totals：体验 IP 终身计数归档
-- 来源：migrate_trial_ip_totals。trial_activations 行随过期访客清理级联删除，
-- 同 IP 终身上限若只按原表计数会「回血」；清理删除前 UPSERT 归档到这里，
-- demo/redeem 的终身闸按「原表存量 + 本表归档」合并口径计数
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trial_ip_totals (
  ip         VARCHAR(45)   NOT NULL PRIMARY KEY,
  total      INT UNSIGNED  NOT NULL DEFAULT 0 COMMENT '该 IP 历史成功领取体验总数（含已清理访客）',
  updated_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- word_progress：单词进度（每用户每词库每章每词唯一）
-- 来源：migrate_progress
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- user_review_cards：间隔重复复习卡（SRS）
-- 来源：migrate_review
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- user_word_books：统一词本（favorite/error/reading/corpus）
-- 替代原 localStorage 的收藏词/错题/阅读词本/语料词本
-- 来源：migrate_user_data
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- user_favorite_dicts：收藏词库
-- 来源：migrate_user_data
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_favorite_dicts (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         BIGINT UNSIGNED NOT NULL,
  dict_id         VARCHAR(50)     NOT NULL,
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_dict (user_id, dict_id),
  INDEX idx_user_id (user_id),
  CONSTRAINT fk_favdict_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- user_settings：打字配置 + 主题（每用户一行）
-- 来源：migrate_user_data
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_settings (
  id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id               BIGINT UNSIGNED NOT NULL,
  sound_enabled         TINYINT(1)   NOT NULL DEFAULT 1,
  show_translation      TINYINT(1)   NOT NULL DEFAULT 1,
  show_phonetic         TINYINT(1)   NOT NULL DEFAULT 1,
  dictation_mode        TINYINT(1)   NOT NULL DEFAULT 0,
  word_repeat_count     SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  auto_remove_error_word TINYINT(1)  NOT NULL DEFAULT 1,
  theme                 VARCHAR(20)  NOT NULL DEFAULT 'light',
  created_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user (user_id),
  CONSTRAINT fk_settings2_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- style_modes：AI 人设模式（内置四种，seed 随迁移写入）
-- 来源：migrate_ai_assistant
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS style_modes (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  style_key     VARCHAR(30) NOT NULL UNIQUE,
  name          VARCHAR(50) NOT NULL,
  avatar        VARCHAR(10) DEFAULT NULL,
  system_prompt TEXT,
  description   VARCHAR(255) DEFAULT NULL,
  sort_order    SMALLINT DEFAULT 0,
  is_active     TINYINT(1) DEFAULT 1,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- user_style_settings：用户 AI 人设设置（每用户一行）
-- 来源：migrate_ai_assistant
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_style_settings (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED NOT NULL UNIQUE,
  style_key     VARCHAR(30) NOT NULL DEFAULT 'teacher',
  custom_name   VARCHAR(12) DEFAULT NULL,
  gender        VARCHAR(10) DEFAULT NULL,
  custom_prompt TEXT,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (style_key) REFERENCES style_modes(style_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- conversation_memory：AI 长期记忆（从对话中启发式抽取）
-- 来源：migrate_ai_assistant
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversation_memory (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED NOT NULL,
  category      VARCHAR(50) DEFAULT 'general',
  content       TEXT,
  source_msg_id BIGINT UNSIGNED DEFAULT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_mem_user (user_id),
  INDEX idx_mem_user_cat (user_id, category),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- chat_messages：AI 对话历史（含深度推理内容）
-- 来源：migrate_ai_assistant
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_messages (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id           BIGINT UNSIGNED NOT NULL,
  role              ENUM('user','assistant','system') NOT NULL,
  content           TEXT NOT NULL,
  reasoning_content MEDIUMTEXT DEFAULT NULL,
  style_key         VARCHAR(30) DEFAULT NULL,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_chat_user_time (user_id, created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- ai_usage：AI 每日对话用量（独立计数，每账号每天 10 次）
-- 来源：migrate_ai_assistant
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_usage (
  id      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  date    DATE NOT NULL,
  count   INT UNSIGNED NOT NULL DEFAULT 1,
  UNIQUE KEY uq_ai_usage_user_date (user_id, date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
