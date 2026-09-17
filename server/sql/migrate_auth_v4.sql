-- Auth v4: refresh_tokens.token_hash 唯一索引
-- 1) refresh 查询靠 WHERE token_hash = ? 定位，加索引避免全表扫
-- 2) 唯一约束防止极端情况下重复 token 行
-- Compatible with MySQL 8.0；幂等（已存在则跳过）
-- 库名判断走 DATABASE()（迁移器连接已按 DB_NAME 指定默认库）：硬编码 'lingoforge'
-- 在 DB_NAME 不同的环境会把条件检查打到错误的库（与 migrate_auth_v3 同款修复）。
-- 不写 USE：连接池上 USE 的效果随机绑定到某条连接，行为不确定。

SET @uk_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'refresh_tokens' AND INDEX_NAME = 'uk_token_hash');
SET @sql = IF(@uk_exists = 0, 'ALTER TABLE refresh_tokens ADD UNIQUE KEY uk_token_hash (token_hash)', 'SELECT "uk_token_hash already exists" AS msg');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
