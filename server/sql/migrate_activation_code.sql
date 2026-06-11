-- 激活码注册系统
-- 给 experience_codes 加 type 列区分激活码和体验码
ALTER TABLE experience_codes ADD COLUMN type ENUM('trial', 'activation') NOT NULL DEFAULT 'trial' AFTER description;

-- 给 users 表加 activation_code_id 记录注册来源
ALTER TABLE users ADD COLUMN activation_code_id BIGINT UNSIGNED NULL DEFAULT NULL AFTER is_guest
