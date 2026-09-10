-- refresh_tokens 加 (user_id, device_id) 唯一键，一台设备同一账号同时只保留一条会话行
-- 背景：
--   1) 旧登录流程「COUNT 检查 → DELETE 本设备行 → INSERT」无原子性，并发登录可产生
--      同 (user_id, device_id) 重复行，COUNT(*) 按行数虚报设备占用，导致他人被误 403
--   2) migrate_device_sessions 之前的旧会话行 device_id=''：不占名额、不出现在设备
--      管理列表、无法被踢出，却能无限 rotation 续期（不可见永生会话），一并清理
-- 加键前先按 (user_id, device_id) 去重，保留 id 最大（最新）的一行
-- 幂等：DELETE 均可重复执行（命中 0 行）；ALTER 撞 ER_DUP_KEYNAME 由启动迁移器忽略
-- （与 ER_DUP_FIELDNAME 同一约定），不会阻塞版本记录
DELETE FROM refresh_tokens WHERE device_id = '';
DELETE r FROM refresh_tokens r
JOIN (
  SELECT user_id, device_id, MAX(id) AS keep_id
  FROM refresh_tokens
  GROUP BY user_id, device_id
) k ON r.user_id = k.user_id AND r.device_id = k.device_id AND r.id < k.keep_id;
ALTER TABLE refresh_tokens ADD UNIQUE KEY uk_user_device (user_id, device_id)
