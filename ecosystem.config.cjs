const fs = require('node:fs')
const path = require('node:path')

// 从同目录 .env 读取配置，避免把数据库口令、会话密钥写进仓库
function loadEnv(file) {
  const out = {}
  try {
    const text = fs.readFileSync(file, 'utf8')
    for (const line of text.split('\n')) {
      const m = /^\s*([\w.-]+)\s*=\s*(.*)\s*$/.exec(line)
      if (!m || line.trim().startsWith('#')) continue
      let v = m[2]
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      out[m[1]] = v
    }
  } catch {}
  return out
}

const env = loadEnv(path.join(__dirname, '.env'))

module.exports = {
  apps: [
    {
      name: 'my2077-nav',
      script: '.output/server/index.mjs',
      interpreter: '/www/server/nodejs/v24.21.0/bin/node',
      cwd: __dirname,
      instances: 2,
      exec_mode: 'cluster',
      kill_timeout: 5000,
      listen_timeout: 10000,
      env: {
        NODE_ENV: 'production',
        NODE_OPTIONS: '--no-network-family-autoselection',
        PORT: 3100,
        HOST: '127.0.0.1',
        NITRO_PORT: 3100,
        NITRO_HOST: '127.0.0.1',
        NUXT_DB_HOST: env.NUXT_DB_HOST || '127.0.0.1',
        NUXT_DB_PORT: env.NUXT_DB_PORT || '3306',
        NUXT_DB_USER: env.NUXT_DB_USER || 'my2077',
        NUXT_DB_PASS: env.NUXT_DB_PASS || '',
        NUXT_DB_NAME: env.NUXT_DB_NAME || 'my2077',
        NUXT_SESSION_SECRET: env.NUXT_SESSION_SECRET || '',
        NUXT_PUBLIC_SITE_URL: env.NUXT_PUBLIC_SITE_URL || 'https://my2077.com'
      }
    }
  ]
}
