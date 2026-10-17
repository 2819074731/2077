interface NotifyMeta {
  [key: string]: unknown
}

async function postJson(url: string, payload: unknown): Promise<void> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 3000)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    })
    if (!res.ok) throw new Error(String(res.status))
  } finally {
    clearTimeout(timer)
  }
}

/** 尽力向管理员推送通知，任何失败都不影响调用方。 */
export async function notifyAdmin(text: string, meta?: NotifyMeta): Promise<void> {
  const message = String(text || '').trim()
  if (!message) return

  const webhook = String(process.env.NOTIFY_WEBHOOK || '').trim()
  const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim()
  const chatId = String(process.env.TELEGRAM_CHAT_ID || '').trim()
  const tasks: Promise<void>[] = []

  if (webhook) {
    tasks.push(
      postJson(webhook, { text: message, ...(meta || {}) }).catch(() => {
        console.warn('[notify] webhook 推送失败')
      })
    )
  }

  if (token && chatId) {
    tasks.push(
      postJson(`https://api.telegram.org/bot${token}/sendMessage`, {
        chat_id: chatId,
        text: message,
        disable_web_page_preview: true
      }).catch(() => {
        console.warn('[notify] Telegram 推送失败')
      })
    )
  }

  if (!tasks.length) return
  await Promise.allSettled(tasks)
}
