-- Index v1: 复合索引优化限流与体验码查询
-- 1) login_attempts 限流查询 WHERE identifier=? AND success=0 AND created_at>?
--    现有 idx_identifier_time (identifier, created_at) 不含 success，无法走覆盖索引
--    新增 idx_login_attempts_limiter (identifier, success, created_at) 让限流 COUNT(*) 走覆盖索引
-- 2) experience_codes WHERE code=? AND type=? 及未来按 type 列表
--    现有 uk_code (code)、idx_active (is_active) 均不含 type
--    新增 idx_experience_codes_type_active (type, is_active) 服务于按 type 的查询
--
-- 幂等：参考 migrate_auth_v3.sql 的 INFORMATION_SCHEMA + PREPARE/EXECUTE 风格。
-- 每条 SQL 以 ; 结尾；语句内部不含分号字面量（runMigrations 用 ; 朴素 split）。
-- 注意：runMigrations 仅显式吞 ER_DUP_FIELDNAME，不吞 ER_DUP_KEYNAME，
--       故不用裸 ALTER TABLE ADD INDEX（重复执行会刷 error 日志），
--       而是先查 INFORMATION_SCHEMA.STATISTICS 判断索引是否存在，存在则跳过。

USE lingoforge;

-- 1) login_attempts: 复合索引 (identifier, success, created_at)
SET @idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = 'lingoforge' AND TABLE_NAME = 'login_attempts' AND INDEX_NAME = 'idx_login_attempts_limiter');
SET @sql = IF(@idx_exists = 0, 'ALTER TABLE login_attempts ADD INDEX idx_login_attempts_limiter (identifier, success, created_at)', 'SELECT "idx_login_attempts_limiter already exists" AS msg');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2) experience_codes: 复合索引 (type, is_active)
SET @idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = 'lingoforge' AND TABLE_NAME = 'experience_codes' AND INDEX_NAME = 'idx_experience_codes_type_active');
SET @sql = IF(@idx_exists = 0, 'ALTER TABLE experience_codes ADD INDEX idx_experience_codes_type_active (type, is_active)', 'SELECT "idx_experience_codes_type_active already exists" AS msg');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
