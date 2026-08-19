module.exports = {
  apps: [{
    name: 'lingoforge',
    script: 'server/index.js',
    cwd: '/home/lingoforge',
    env: {
      NODE_ENV: 'production',
    },
    instances: 1,
    autorestart: true,
    max_memory_restart: '300M',
  }]
}
