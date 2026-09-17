-- 管理后台：admin 标识 + 操作审计 + 激活码发放备注
-- users.is_admin：管理员标识，无界面、手工 SQL 提升（UPDATE users SET is_admin=1 WHERE username='xxx'）。
--   requireAdmin 每请求查库验证（不嵌入 JWT），权限授予/收回即时生效。
-- admin_audit_log：管理操作审计（谁在何时从哪个 IP 对什么对象做了什么），所有管理写操作自动落一条。
-- experience_codes.issued_note：激活码发放备注（发给谁/渠道），补齐「发出去的码」追踪。
-- 幂等：ER_DUP_FIELDNAME / ER_DUP_KEYNAME 由启动迁移器忽略；CREATE TABLE IF NOT EXISTS 天然幂等
ALTER TABLE users ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0 COMMENT '管理员标识（手工 SQL 设置）' AFTER is_guest;

ALTER TABLE experience_codes ADD COLUMN issued_note VARCHAR(255) NULL DEFAULT NULL COMMENT '发放备注（发给谁/渠道）' AFTER trial_hours;

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
) ENGINE=InnoDB
