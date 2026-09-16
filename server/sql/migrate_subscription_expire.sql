-- 正式账号订阅到期（月卡/季卡/年卡）
-- users.subscription_expires_at：NULL=永久（存量账号，以及 trial_hours=0/NULL 激活码注册的新账号）
-- 注册流程按激活码 trial_hours 写入 NOW()+N 小时（月 720/季 2160/年 8760）
-- 到期拦截三道闸：middleware 每请求比对 token 内嵌 subExp + login 查库 + refresh 查库
-- 续期为手工 SQL：UPDATE users SET subscription_expires_at = DATE_ADD(NOW(), INTERVAL 30 DAY) WHERE id = 用户id
-- 幂等：重跑撞 ER_DUP_FIELDNAME 由启动迁移器忽略
ALTER TABLE users ADD COLUMN subscription_expires_at TIMESTAMP NULL DEFAULT NULL COMMENT '订阅到期：NULL=永久' AFTER max_devices
