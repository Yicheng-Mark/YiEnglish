-- 体验码兑换：同 IP 累计终身上限
-- trial_activations.ip 记录领取时客户端 IP，demo/redeem 按 COUNT(ip) 做终身硬闸
-- （login_attempts 24h 滚动清理，承担不了终身计数；日限 DEMO_IP_DAILY_MAX 之外的第二道 IP 闸）
-- 存量行 ip 为 NULL：不参与计数，不影响既有 device_id/user 去重
-- 幂等：重跑撞 ER_DUP_FIELDNAME 由启动迁移器忽略
ALTER TABLE trial_activations
  ADD COLUMN ip VARCHAR(45) NULL DEFAULT NULL COMMENT '领取时客户端 IP（同 IP 累计终身上限）' AFTER device_id,
  ADD INDEX idx_ip (ip)
