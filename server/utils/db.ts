import mysql from 'mysql2/promise'

let pool: mysql.Pool | null = null

export function useDb(): mysql.Pool {
  if (pool) return pool
  const c = useRuntimeConfig()
  pool = mysql.createPool({
    host: c.dbHost,
    port: Number(c.dbPort),
    user: c.dbUser,
    password: c.dbPass,
    database: c.dbName,
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4_general_ci',
    timezone: '+08:00'
  })
  return pool
}
