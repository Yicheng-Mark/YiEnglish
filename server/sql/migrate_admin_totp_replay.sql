-- users.totp_last_counter：TOTP 防重放（RFC 6238 §5.2：验证成功的验证码不得被第二次接受）。
-- 存最近一次被接受的计数器（Unix 秒 / 30）；login / recover-reset / admin totp disable
-- 在验证命中后以「计数器严格递增」的原子 UPDATE 认领，同窗重放（肩窥/截屏的旧码）一律拒绝。
-- NULL = 从未验证过。停用 TOTP 不清此列：计数器是时间单调的，重新启用新密钥不受旧值影响。
ALTER TABLE users ADD COLUMN totp_last_counter BIGINT UNSIGNED NULL DEFAULT NULL COMMENT 'TOTP 防重放：最近一次接受的计数器（Unix 秒/30）' AFTER totp_secret;
