import { getGithubSettings } from '../../utils/githubSettings'
import { resolveSearchRelays } from '../../utils/github'
import { probeRelays } from '../../utils/githubRelayHealth'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await rateLimit(event, 'relay-health', 10, 60_000)

  const settings = await getGithubSettings()
  const relays = resolveSearchRelays(settings)
  const rows = await probeRelays(relays)

  return {
    enabled: settings.searchFallback,
    relays: rows
      .map((row, index) => ({ ...row, index }))
      .sort((a, b) => Number(b.ok) - Number(a.ok) || a.ms - b.ms || a.index - b.index)
      .map(({ index, ...row }) => row)
  }
})
