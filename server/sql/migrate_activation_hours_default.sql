-- experience_codes.trial_hours 列默认值 1 → 0
-- 新语义下该列对 activation 码表示订阅时长（0=永久 720=月 2160=季 8760=年）
-- 旧默认 1 是个运维陷阱：手工 INSERT 永久激活码漏写该列会默认变成 1 小时卡
-- 改为 0 后两个方向都失败安全：activation 码漏写=永久（宁送不坑），trial 码漏写=立即到期（宁废不送）
-- ALTER COLUMN SET DEFAULT 天然幂等，重复执行无副作用
ALTER TABLE experience_codes ALTER COLUMN trial_hours SET DEFAULT 0
