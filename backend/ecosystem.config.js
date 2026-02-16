module.exports = {
  apps: [{
    name: 'etudesk-api',
    script: 'dist/index.js',
    instances: process.env.PM2_INSTANCES || 'max', // Cluster mode — use all CPU cores
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    max_memory_restart: '500M',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    // Graceful restart
    listen_timeout: 10000,
    kill_timeout: 5000,
    // Auto-restart on crash
    autorestart: true,
    watch: false,
    // Cluster-specific: stagger restart to avoid downtime
    restart_delay: 1000,
  }],
};
