const base = String(process.env.BASE_URL || 'http://127.0.0.1:3100').replace(/\/+$/, '')
const concurrency = Math.max(1, Number(process.env.ICON_CONCURRENCY || 6))

const data = await fetch(`${base}/api/site`, { signal: AbortSignal.timeout(15_000) }).then(r => r.json())
const links = []
for (const group of data?.groups || []) {
  for (const link of group?.links || []) links.push(link)
}
for (const link of data?.recommended || []) links.push(link)

const hosts = new Set()
for (const link of links) {
  const icon = String(link?.icon || '')
  if (icon.startsWith('/api/icon')) {
    try { hosts.add(new URL(icon, base).searchParams.get('url') || '') } catch {}
    continue
  }
  try { hosts.add(new URL(String(link?.url || '')).hostname) } catch {}
}
hosts.delete('')

const queue = [...hosts]
let done = 0
let ok = 0
let failed = 0

async function worker() {
  while (queue.length) {
    const host = queue.shift()
    if (!host) break
    try {
      const res = await fetch(`${base}/api/icon?url=${encodeURIComponent(host)}`, { signal: AbortSignal.timeout(20_000) })
      if (res.ok) ok++
      else failed++
      await res.arrayBuffer().catch(() => {})
    } catch {
      failed++
    } finally {
      done++
      if (done % 10 === 0) console.log(`[icons] ${done}/${hosts.size}`)
    }
  }
}

console.log(`[icons] 预热 ${hosts.size} 个站点图标 (${base})`)
await Promise.all(Array.from({ length: concurrency }, () => worker()))
console.log(`[icons] 完成：成功 ${ok}，失败 ${failed}`)
