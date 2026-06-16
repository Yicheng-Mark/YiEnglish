-- 设备级会话管理：在 refresh_tokens 上记录每台登录设备的标识/名称/IP/最后活跃时间
-- 用于"每账号最多 N 台设备同时在线"的名额判定与设备管理页。
-- 重复执行时 ADD COLUMN 触发 ER_DUP_FIELDNAME，被 runMigrations 吞掉，幂等安全。

ALTER TABLE refresh_tokens ADD COLUMN device_id VARCHAR(64) NOT NULL DEFAULT '' AFTER token_hash;
ALTER TABLE refresh_tokens ADD COLUMN device_name VARCHAR(150) NULL AFTER device_id;
ALTER TABLE refresh_tokens ADD COLUMN ip VARCHAR(45) NULL AFTER device_name;
ALTER TABLE refresh_tokens ADD COLUMN last_active_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER ip;
