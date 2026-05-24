#!/bin/bash
# 从本地运行：scp 整个项目到服务器并重启服务
# 用法：bash deploy/deploy.sh user@your-server-ip

SERVER=${1:-root@your-server-ip}
REMOTE_DIR=/home/lingoforge

echo ">>> 构建前端..."
npm run build

echo ">>> 同步文件到服务器..."
rsync -avz --delete \
  --exclude node_modules \
  --exclude .git \
  --exclude .env.local \
  --exclude dist \
  ./dist/ ${SERVER}:${REMOTE_DIR}/dist/

rsync -avz \
  --exclude node_modules \
  ./server/ ${SERVER}:${REMOTE_DIR}/server/

rsync -avz \
  ./package.json ./package-lock.json \
  ${SERVER}:${REMOTE_DIR}/

echo ">>> 在服务器上安装依赖并重启..."
ssh ${SERVER} << 'EOF'
cd /home/lingoforge
npm install --omit=dev
cd server && npm install
pm2 restart lingoforge || pm2 start deploy/ecosystem.config.js
pm2 save
echo ">>> 部署完成！"
EOF
