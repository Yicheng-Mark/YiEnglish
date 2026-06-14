-- 体验码试用：每台设备只能体验一次
-- 给 trial_activations 加 device_id 列（全局每设备唯一）
ALTER TABLE trial_activations
  ADD COLUMN device_id VARCHAR(64) NULL AFTER code_id,
  ADD UNIQUE KEY uk_device (device_id);
