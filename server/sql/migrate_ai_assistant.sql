-- AI 助手：人设/对话/记忆/用量 全套表结构（幂等，可重复执行）
-- 来源于 AI 助手模块：style_modes + user_style_settings + conversation_memory + chat_messages + ai_usage

CREATE TABLE IF NOT EXISTS style_modes (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  style_key     VARCHAR(30) NOT NULL UNIQUE,
  name          VARCHAR(50) NOT NULL,
  avatar        VARCHAR(10) DEFAULT NULL,
  system_prompt TEXT,
  description   VARCHAR(255) DEFAULT NULL,
  sort_order    SMALLINT DEFAULT 0,
  is_active     TINYINT(1) DEFAULT 1,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 内置四个人设（唯一键 style_key，重复执行自动跳过）
INSERT IGNORE INTO style_modes (style_key, name, avatar, system_prompt, description, sort_order) VALUES
('teacher', '严肃导师', '👔', '你是一位严谨专业的英语导师。用严肃认真的态度教学，注重准确性和规范性。指出错误时直接明确，解释清晰有条理。用中文解释，给出英文例句。回答简洁专业，不使用表情符号和语气词。对待学术问题一丝不苟，确保每一个语法点、每一个用词都准确无误。', '专业、严谨、注重准确性', 1),
('cute', '活泼伙伴', '🎉', '你是一位充满活力的英语学习伙伴！用轻松愉快的方式帮助用户学习英语，多用表情符号和鼓励的话语。把知识点讲得有趣好懂，用生动的例子帮助记忆。用中文解释，给出英文例句。回答活泼有趣，让学习充满乐趣！就像一个好朋友陪你一起学英语，每次对话都让人开心~', '活泼、有趣、充满鼓励', 2),
('gentle', '温柔学姐', '🌸', '你是一位温柔耐心的英语学习伙伴。用温和鼓励的方式帮助用户学习，即使犯错也用暖心的话语引导纠正。善于发现用户的进步并给予肯定。用中文解释，给出英文例句。回答温柔细致，让用户感到安心和被支持。像一个知心姐姐一样陪伴用户成长。', '温柔、耐心、善于鼓励', 3),
('custom', '自定义性格', '✨', '你是一位友好的英语学习助手。', '用你自己的方式定义 AI 伙伴', 4);

-- 用户人设设置（一人一行）：当前人设 + 自定义称呼 + 性别设定 + 自定义性格提示词
CREATE TABLE IF NOT EXISTS user_style_settings (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED NOT NULL UNIQUE,
  style_key     VARCHAR(30) NOT NULL DEFAULT 'teacher',
  custom_name   VARCHAR(12) DEFAULT NULL,
  gender        VARCHAR(10) DEFAULT NULL,
  custom_prompt TEXT,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (style_key) REFERENCES style_modes(style_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 长期记忆：从对话中启发式抽取的用户偏好/身份/指令
CREATE TABLE IF NOT EXISTS conversation_memory (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED NOT NULL,
  category      VARCHAR(50) DEFAULT 'general',
  content       TEXT,
  source_msg_id BIGINT UNSIGNED DEFAULT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_mem_user (user_id),
  INDEX idx_mem_user_cat (user_id, category),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 对话历史（含深度推理内容）
CREATE TABLE IF NOT EXISTS chat_messages (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id           BIGINT UNSIGNED NOT NULL,
  role              ENUM('user','assistant','system') NOT NULL,
  content           TEXT NOT NULL,
  reasoning_content MEDIUMTEXT DEFAULT NULL,
  style_key         VARCHAR(30) DEFAULT NULL,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_chat_user_time (user_id, created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 每日对话用量（独立计数，每账号每天 10 次）
CREATE TABLE IF NOT EXISTS ai_usage (
  id      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  date    DATE NOT NULL,
  count   INT UNSIGNED NOT NULL DEFAULT 1,
  UNIQUE KEY uq_ai_usage_user_date (user_id, date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
