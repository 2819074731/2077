export default defineEventHandler(async (event) => {
  await rateLimit(event, 'csp-report', 30, 60_000)
  const raw = await readRawBody(event).catch(() => '')
  if (raw && raw.length < 8192) {
    console.warn('[csp]', raw.slice(0, 4000))
  }
  setResponseStatus(event, 204)
  return ''
})
