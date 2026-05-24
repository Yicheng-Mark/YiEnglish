#!/bin/bash
# 在阿里云服务器上运行一次，初始化整个环境
# 用法：ssh root@your-server-ip 然后粘贴运行

set -e

echo "===== 1. 安装 MySQL ====="
apt update
apt install -y mysql-server
systemctl start mysql
systemctl enable mysql

echo "===== 2. 创建数据库 ====="
mysql -u root << 'SQL'
CREATE DATABASE IF NOT EXISTS lingoforge CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- 如果需要单独用户，取消下面注释并改密码
-- CREATE USER 'lingoforge'@'localhost' IDENTIFIED BY 'your-password';
-- GRANT ALL PRIVILEGES ON lingoforge.* TO 'lingoforge'@'localhost';
-- FLUSH PRIVILEGES;
SQL

echo "===== 3. 安装 Node.js 18 ====="
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

echo "===== 4. 安装 PM2 ====="
npm install -g pm2

echo "===== 5. 安装 Nginx ====="
apt install -y nginx

echo "===== 6. 创建项目目录 ====="
mkdir -p /home/lingoforge

echo ""
echo "===== 完成！接下来你需要：====="
echo "1. 把项目文件传到服务器："
echo "   rsync -avz --exclude node_modules --exclude .git ./ root@SERVER_IP:/home/lingoforge/"
echo ""
echo "2. 在服务器上创建 .env.local 文件："
echo "   cp .env.example /home/lingoforge/.env.local"
echo "   然后编辑填入真实值（数据库密码、JWT_SECRET、DEEPSEEK_API_KEY）"
echo ""
echo "3. 导入数据库表结构："
echo "   mysql -u root lingoforge < /home/lingoforge/server/sql/schema.sql"
echo ""
echo "4. 复制 Nginx 配置："
echo "   cp /home/lingoforge/deploy/nginx.conf /etc/nginx/sites-available/lingoforge"
echo "   ln -s /etc/nginx/sites-available/lingoforge /etc/nginx/sites-enabled/"
echo "   nginx -t && systemctl reload nginx"
echo ""
echo "5. 启动后端："
echo "   cd /home/lingoforge && pm2 start deploy/ecosystem.config.js"
echo "   pm2 save && pm2 startup"
