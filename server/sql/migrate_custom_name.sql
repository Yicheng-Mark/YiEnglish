-- Add custom_name column to user_style_settings
-- Allows users to set a custom name for their AI companion
ALTER TABLE user_style_settings
  ADD COLUMN custom_name VARCHAR(50) DEFAULT NULL AFTER style_key;
