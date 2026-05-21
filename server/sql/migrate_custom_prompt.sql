-- Add custom_prompt column to user_style_settings
-- Allows users to write a custom personality description for their AI companion
-- Also shrink custom_name from 50 to 12 chars
UPDATE user_style_settings SET custom_name = LEFT(custom_name, 12) WHERE CHAR_LENGTH(custom_name) > 12;
ALTER TABLE user_style_settings
  MODIFY COLUMN custom_name VARCHAR(12) DEFAULT NULL,
  ADD COLUMN custom_prompt TEXT DEFAULT NULL AFTER gender;
