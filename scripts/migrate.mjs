import { existsSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MIGRATION_DIR = join(ROOT, 'server', 'database', 'migrations')

function parseEnv(text) {
  const out = {}
  for (const line of text.split(/\r?\n/)) {
    const raw = line.trim()
    if (!raw || raw.startsWith('#')) continue
    const m = /^(?:export\s+)?([\w.-]+)\s*=\s*(.*)$/.exec(raw)
    if (!m) continue
    let value = m[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[m[1]] = value
  }
  return out
}

async function loadEnv() {
  const file = join(ROOT, '.env')
  if (!existsSync(file)) return {}
  try {
    return parseEnv(await readFile(file, 'utf8'))
  } catch {
    return {}
  }
}

function pick(keys, fallback, env) {
  for (const key of keys) {
    const value = process.env[key] ?? env[key]
    if (value !== undefined && value !== '') return value
  }
  return fallback
}

async function main() {
  const env = await loadEnv()
  const config = {
    host: pick(['NUXT_DB_HOST', 'DB_HOST'], '127.0.0.1', env),
    port: Number(pick(['NUXT_DB_PORT', 'DB_PORT'], '3306', env)),
    user: pick(['NUXT_DB_USER', 'DB_USER'], 'my2077', env),
    password: pick(['NUXT_DB_PASS', 'DB_PASS'], '', env),
    database: pick(['NUXT_DB_NAME', 'DB_NAME'], 'my2077', env)
  }

  if (!existsSync(MIGRATION_DIR)) {
    throw new Error(`迁移目录不存在: ${MIGRATION_DIR}`)
  }

  console.log(`[migrate] 连接 ${config.user}@${config.host}:${config.port}/${config.database}`)
  const conn = await mysql.createConnection({
    ...config,
    multipleStatements: true,
    charset: 'utf8mb4_general_ci',
    timezone: '+08:00'
  })

  try {
    await conn.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        name VARCHAR(191) NOT NULL,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`
    )

    const [appliedRows] = await conn.query('SELECT name FROM schema_migrations')
    const applied = new Set(appliedRows.map((row) => String(row.name)))

    const files = (await readdir(MIGRATION_DIR))
      .filter((name) => name.endsWith('.sql'))
      .sort()

    if (!files.length) {
      console.log('[migrate] 没有可执行的迁移文件')
      return
    }

    let count = 0
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`[migrate] 跳过 ${file}（已执行）`)
        continue
      }
      console.log(`[migrate] 执行 ${file}`)
      const sql = await readFile(join(MIGRATION_DIR, file), 'utf8')
      if (!sql.trim()) {
        console.log(`[migrate] 跳过 ${file}（空文件）`)
        continue
      }
      await conn.query(sql)
      // 迁移文件可能包含 USE，执行后切回目标库，确保记录写入正确的库。
      await conn.query('USE ??', [config.database])
      await conn.query('INSERT INTO schema_migrations (name) VALUES (?)', [file])
      count += 1
      console.log(`[migrate] 完成 ${file}`)
    }

    console.log(`[migrate] 全部完成，本次执行 ${count} 个迁移`)
  } finally {
    await conn.end()
  }
}

try {
  await main()
} catch (error) {
  console.error(`[migrate] 失败: ${error?.message || error}`)
  process.exitCode = 1
}
