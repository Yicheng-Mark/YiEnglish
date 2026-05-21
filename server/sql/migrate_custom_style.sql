USE lingoforge;

-- Add "custom" as a 4th independent style option
INSERT IGNORE INTO style_modes (style_key, name, avatar, system_prompt, description, sort_order, is_active)
VALUES ('custom', '自定义性格', '✨', '你是一位友好的英语学习助手。', '用你自己的方式定义 AI 伙伴', 4, 1);
