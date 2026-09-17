-- 体验 IP 终身计数归档表
-- 背景：demo/redeem 的「同 IP 累计终身上限（DEMO_IP_LIFETIME_MAX）」按 trial_activations.ip 计数，
-- 但过期访客清理（cleanupGuests，试用到期超 30 天整行删 users）经 FK CASCADE 级联删掉
-- trial_activations 行 → 计数回血，终身闸实际退化为「约 2 个月滚动窗口」。
-- 本表独立于 FK 链：清理删除前把待删行的 ip 计数 UPSERT 归档到这里，计数永久不回退。
-- 存量：当前 trial_activations 存量行仍走原表计数，合并口径见 demo.js（两表相加）；
-- 本表只在未来清理发生时累积，无需回填。
-- 幂等：CREATE TABLE IF NOT EXISTS，重跑安全
CREATE TABLE IF NOT EXISTS trial_ip_totals (
  ip         VARCHAR(45)   NOT NULL PRIMARY KEY,
  total      INT UNSIGNED  NOT NULL DEFAULT 0 COMMENT '该 IP 历史成功领取体验总数（含已清理访客）',
  updated_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB
