export async function getSetting<T = any>(key: string, fallback: T): Promise<T> {
  const db = useDb()
  const [rows]: any = await db.query('SELECT v FROM settings WHERE k = ? LIMIT 1', [key])
  if (!rows.length || rows[0].v == null) return fallback
  try {
    return typeof rows[0].v === 'string' ? JSON.parse(rows[0].v) : rows[0].v
  } catch {
    return fallback
  }
}

export async function setSetting(key: string, value: any): Promise<void> {
  const db = useDb()
  await db.execute(
    'INSERT INTO settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)',
    [key, JSON.stringify(value)]
  )
}
