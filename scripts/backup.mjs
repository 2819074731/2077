import { spawn } from 'node:child_process'
import { createWriteStream, existsSync } from 'node:fs'
import { mkdir, readFile, readdir, rename, stat, unlink } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { once } from 'node:events'
import { createGzip } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

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
    ) value = value.slice(1, -1)
    out[m[1]] = value
  }
  return out
}

async function loadEnv() {
  const file = join(ROOT, '.env')
  if (!existsSync(file)) return {}
  return parseEnv(await readFile(file, 'utf8'))
}

function run(command, args, env = process.env) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { env, stdio: ['ignore', 'inherit', 'inherit'] })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolvePromise()
      else reject(new Error(`${command} 退出码 ${code}`))
    })
  })
}

function quoteName(name) {
  return '`' + String(name).replace(/`/g, '``') + '`'
}

function sqlValue(connection, value) {
  if (value === null || value === undefined) return 'NULL'
  if (Buffer.isBuffer(value)) return `X'${value.toString('hex')}'`
  if (value instanceof Date) {
    const pad = (n) => String(n).padStart(2, '0')
    return `'${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}'`
  }
  if (typeof value === 'number') return String(value)
  if (typeof value === 'bigint') return String(value)
  return connection.escape(value)
}

async function main() {
  const env = await loadEnv()
  const pick = (...keys) => keys.map((key) => process.env[key] ?? env[key]).find((value) => value !== undefined && value !== '')
  const config = {
    host: pick('NUXT_DB_HOST', 'DB_HOST') || '127.0.0.1',
    port: Number(pick('NUXT_DB_PORT', 'DB_PORT') || 3306),
    user: pick('NUXT_DB_USER', 'DB_USER') || 'my2077',
    password: pick('NUXT_DB_PASS', 'DB_PASS') || '',
    database: pick('NUXT_DB_NAME', 'DB_NAME') || 'my2077'
  }
  const backupDir = process.env.BACKUP_DIR || '/www/backup/my2077'
  const retentionDays = Math.max(1, Number(process.env.RETENTION_DAYS || 14))

  const now = new Date()
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('') + '-' + [now.getHours(), now.getMinutes()].map((n) => String(n).padStart(2, '0')).join('')
  await mkdir(backupDir, { recursive: true })
  const file = join(backupDir, `db-${stamp}.sql.gz`)
  const tmp = file + '.tmp'

  console.log(`[backup] 开始备份数据库 ${config.database}`)
  const connection = await mysql.createConnection({
    ...config,
    charset: 'utf8mb4',
    dateStrings: true
  })
  const output = createWriteStream(tmp)
  const gzip = createGzip()
  gzip.pipe(output)

  let writeError = null
  output.on('error', (error) => { writeError = error })

  async function write(text) {
    if (writeError) throw writeError
    if (!gzip.write(text)) await once(gzip, 'drain')
  }

  try {
    await write('SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\n\n')
    const [tables] = await connection.query('SHOW TABLES')
    const key = Object.keys(tables[0] || {})[0]
    const names = tables.map((row) => String(row[key])).filter(Boolean)

    for (const name of names) {
      const [[created]] = await connection.query(`SHOW CREATE TABLE ${quoteName(name)}`)
      const ddl = created['Create Table']
      await write(`DROP TABLE IF EXISTS ${quoteName(name)};\n${ddl};\n\n`)

      const [columnRows] = await connection.query(`SHOW COLUMNS FROM ${quoteName(name)}`)
      const columns = columnRows
        .filter((column) => !String(column.Extra || '').toUpperCase().includes('GENERATED'))
        .map((column) => column.Field)
      if (!columns.length) continue
      const columnSql = columns.map((column) => quoteName(column)).join(', ')
      const [rows] = await connection.query(
        `SELECT ${columnSql} FROM ${quoteName(name)}`
      )
      if (!rows.length) continue
      for (let offset = 0; offset < rows.length; offset += 100) {
        const chunk = rows.slice(offset, offset + 100)
        const values = chunk.map((row) => '(' + columns.map((column) => sqlValue(connection, row[column])).join(', ') + ')').join(',\n')
        await write(`INSERT INTO ${quoteName(name)} (${columnSql}) VALUES\n${values};\n`)
      }
      await write('\n')
    }

    await write('SET FOREIGN_KEY_CHECKS=1;\n')
    gzip.end()
    await once(output, 'close')
    if (writeError) throw writeError
    await rename(tmp, file)
  } catch (error) {
    try { gzip.destroy() } catch {}
    try { output.destroy() } catch {}
    try { await unlink(tmp) } catch {}
    throw error
  } finally {
    await connection.end().catch(() => {})
  }

  console.log(`[backup] 备份完成：${file}`)

  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000
  for (const name of await readdir(backupDir)) {
    if (!/^db-\d{8}-\d{4}\.sql\.gz$/.test(name)) continue
    const path = join(backupDir, name)
    try {
      const info = await stat(path)
      if (info.mtimeMs < cutoff) await unlink(path)
    } catch {}
  }

  const remote = String(process.env.RCLONE_REMOTE || '').trim()
  if (remote) {
    await run('rclone', ['copy', file, remote])
    console.log(`[backup] 已上传到 ${remote}`)
  }
}

try {
  await main()
} catch (error) {
  console.error(`[backup] 失败: ${error?.message || error}`)
  process.exitCode = 1
}
