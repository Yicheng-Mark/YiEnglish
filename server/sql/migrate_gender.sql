-- Add gender column to user_style_settings
-- Allows users to set gender for their AI companion
ALTER TABLE user_style_settings
  ADD COLUMN gender VARCHAR(10) DEFAULT NULL AFTER custom_name;
