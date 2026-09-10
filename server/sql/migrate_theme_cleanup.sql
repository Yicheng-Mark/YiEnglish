-- 暗夜主题下线（light/warm 双主题收敛）后的存量数据清洗：
-- DB 里 theme 列仍残留 gray/star/legacy dark 的行统一回落 light。
-- 读侧（GET /api/settings、前端 useUserConfig）已做白名单回落，本迁移清掉脏值，
-- 避免未来任何直接消费 user_settings.theme 的新代码拿到已下线的主题值。
-- 幂等：可重复执行，清洗后 WHERE 命中 0 行
UPDATE user_settings SET theme = 'light' WHERE theme NOT IN ('light', 'warm')
