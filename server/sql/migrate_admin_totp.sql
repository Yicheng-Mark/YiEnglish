-- 管理员 TOTP 两步验证：users.totp_secret（AES-256-GCM 加密存储，NULL=未启用）。
-- 启用后 /api/auth/login 与 /api/auth/recover-reset 在密码之外还需 6 位动态验证码。
-- 密钥加密 key 由 JWT_SECRET 派生（sha256）：轮换 JWT_SECRET 会使存量密钥不可解密，
-- 管理员将被锁在登录外——届时手工 SQL 置 NULL 重新开启即可：
--   UPDATE users SET totp_secret = NULL WHERE username = 'xxx';
ALTER TABLE users ADD COLUMN totp_secret VARCHAR(255) NULL DEFAULT NULL COMMENT '管理员 TOTP 密钥（AES-256-GCM 加密，NULL=未启用）';
