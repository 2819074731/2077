import { getGithubSettings } from '../utils/githubSettings'
import { resolveSearchRelays } from '../utils/github'
import { probeRelays } from '../utils/githubRelayHealth'

const INTERVAL = 10 * 60 * 1000

export default defineNitroPlugin(() => {
  if (!import.meta.server) return

  async function refresh() {
    try {
      const settings = await getGithubSettings()
      if (!settings.searchFallback) return
      const relays = resolveSearchRelays(settings)
      if (relays.length) await probeRelays(relays)
    } catch (error) {
      console.warn('[relay-health] 探测失败', error)
    }
  }

  const first = setTimeout(() => { void refresh() }, 30_000 + Math.floor(Math.random() * 30_000))
  first.unref()

  const timer = setInterval(() => { void refresh() }, INTERVAL)
  timer.unref()
})
