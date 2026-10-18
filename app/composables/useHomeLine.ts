export type HomeLinePref = 'default' | 'stats' | 'comment'

const LS_HOME_LINE = 'my2077.homeLine'

export function useHomeLine() {
  const homeLinePref = useState<HomeLinePref>('home-line-pref', () => 'default')
  const homeLineLoaded = useState<boolean>('home-line-loaded', () => false)

  function loadHomeLine() {
    if (!import.meta.client || homeLineLoaded.value) return
    homeLineLoaded.value = true
    try {
      const value = localStorage.getItem(LS_HOME_LINE)
      if (value === 'default' || value === 'stats' || value === 'comment') homeLinePref.value = value
    } catch {}
  }

  function setHomeLinePref(value: HomeLinePref) {
    homeLinePref.value = value
    homeLineLoaded.value = true
    try {
      localStorage.setItem(LS_HOME_LINE, value)
    } catch {}
  }

  function resolveHomeLine(siteDefault: string): 'stats' | 'comment' {
    if (homeLinePref.value === 'comment') return 'comment'
    if (homeLinePref.value === 'stats') return 'stats'
    return siteDefault === 'comment' ? 'comment' : 'stats'
  }

  return { homeLinePref, loadHomeLine, setHomeLinePref, resolveHomeLine }
}
