import { resolveGoogleRelays } from '../../utils/google'
import { getGoogleSearchSettings } from '../../utils/googleSettings'
import { probeGoogleRelays } from '../../utils/googleRelayHealth'
import { rateLimit } from '../../utils/rateLimit'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await rateLimit(event, 'google-relay-health', 10, 60_000)

  const settings = await getGoogleSearchSettings()
  const relays = resolveGoogleRelays(settings)
  const rows = await probeGoogleRelays(relays)

  return {
    enabled: settings.enabled,
    relays: rows
      .map((row, index) => ({ ...row, index }))
      .sort((a, b) => Number(b.ok) - Number(a.ok) || a.ms - b.ms || a.index - b.index)
      .map(({ index, ...row }) => row)
  }
})
