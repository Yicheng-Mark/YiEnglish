-- Auth v4: refresh_tokens.token_hash 唯一索引
-- 1) refresh 查询靠 WHERE token_hash = ? 定位，加索引避免全表扫
-- 2) 唯一约束防止极端情况下重复 token 行
-- Compatible with MySQL 8.0；幂等（已存在则跳过）

USE lingoforge;

SET @uk_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = 'lingoforge' AND TABLE_NAME = 'refresh_tokens' AND INDEX_NAME = 'uk_token_hash');
SET @sql = IF(@uk_exists = 0, 'ALTER TABLE refresh_tokens ADD UNIQUE KEY uk_token_hash (token_hash)', 'SELECT "uk_token_hash already exists" AS msg');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
