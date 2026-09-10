-- 用户级设备登录上限覆盖
-- users.max_devices：NULL=跟随全局 MAX_DEVICES_PER_USER（默认 2），0=不限台数，>0=精确上限
ALTER TABLE users ADD COLUMN max_devices SMALLINT UNSIGNED NULL DEFAULT NULL COMMENT '设备登录数上限：NULL=全局默认，0=不限，>0=覆盖值' AFTER daily_goal_minutes
