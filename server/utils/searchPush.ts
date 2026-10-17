const INDEXNOW_KEY = 'c4f9a63d8e2b47f1a5c0d9e7b3f61284'

function siteBase(): string {
  return String(process.env.NUXT_PUBLIC_SITE_URL || 'https://my2077.com').replace(/\/+$/, '')
}

function normalizeUrls(input: string[]): string[] {
  const base = siteBase()
  const host = new URL(base).host
  const out = new Set<string>()
  for (const raw of input) {
    const value = String(raw || '').trim()
    if (!value) continue
    try {
      const u = new URL(value, base)
      if (u.host !== host) continue
      u.hash = ''
      out.add(u.href)
    } catch {}
  }
  return [...out]
}

async function submitIndexNow(urls: string[]): Promise<{ ok: boolean; status: number; skipped?: boolean; error?: string }> {
  if (process.env.NODE_ENV !== 'production' && process.env.INDEXNOW_FORCE !== '1') {
    return { ok: false, status: 0, skipped: true, error: '非生产环境已跳过' }
  }
  const base = siteBase()
  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: new URL(base).host,
        key: INDEXNOW_KEY,
        keyLocation: `${base}/${INDEXNOW_KEY}.txt`,
        urlList: urls
      }),
      signal: AbortSignal.timeout(8000)
    })
    const text = await res.text().catch(() => '')
    return {
      ok: res.status === 200 || res.status === 202,
      status: res.status,
      error: res.ok ? undefined : text.slice(0, 200)
    }
  } catch (err: any) {
    return { ok: false, status: 0, error: String(err?.message || err).slice(0, 200) }
  }
}

async function submitBaidu(urls: string[]): Promise<{ ok: boolean; status?: number; skipped?: boolean; pushed?: number; error?: string }> {
  const token = String(process.env.BAIDU_PUSH_TOKEN || '').trim()
  if (!token) return { ok: false, skipped: true, error: '未配置 BAIDU_PUSH_TOKEN' }
  const base = siteBase()
  try {
    const res = await fetch(`http://data.zz.baidu.com/urls?site=${encodeURIComponent(base)}&token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: urls.join('\n'),
      signal: AbortSignal.timeout(10000)
    })
    const text = await res.text().catch(() => '')
    let data: any = null
    try { data = JSON.parse(text) } catch {}
    return {
      ok: res.ok && !data?.error,
      status: res.status,
      pushed: Number(data?.success || 0),
      error: data?.error || (res.ok ? undefined : text.slice(0, 200))
    }
  } catch (err: any) {
    return { ok: false, status: 0, error: String(err?.message || err).slice(0, 200) }
  }
}

export async function pushSearchUrls(input: string[]): Promise<{
  count: number
  indexnow: { ok: boolean; status: number; skipped?: boolean; error?: string }
  baidu: { ok: boolean; status?: number; skipped?: boolean; pushed?: number; error?: string }
}> {
  const urls = normalizeUrls(input)
  if (!urls.length) {
    return { count: 0, indexnow: { ok: false, status: 0, error: '没有可推送的 URL' }, baidu: { ok: false, skipped: true } }
  }
  const [indexnow, baidu] = await Promise.all([submitIndexNow(urls), submitBaidu(urls)])
  return { count: urls.length, indexnow, baidu }
}

export function notifySearchUrls(input: string[]): void {
  const urls = normalizeUrls(input)
  if (!urls.length) return
  void pushSearchUrls(urls)
    .then((r) => {
      if (!r.indexnow.ok && !r.indexnow.skipped) {
        console.warn('[seo] IndexNow 推送失败', r.indexnow.status, r.indexnow.error || '')
      }
    })
    .catch((err) => console.warn('[seo] 推送异常', String(err?.message || err)))
}
