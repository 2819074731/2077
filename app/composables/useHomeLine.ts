import { dailyNetEaseComment } from '#shared/netEaseComments'

export type HomeLinePref = 'default' | 'stats' | 'comment'
export type HomeLineRotate = 'auto' | 'fixed'

export const HOME_LINE_INTERVALS = [1, 5, 15, 30, 60]

const LS_HOME_LINE = 'my2077.homeLine'
const LS_HOME_ROTATE = 'my2077.homeLine.rotate'
const LS_HOME_INTERVAL = 'my2077.homeLine.interval'
const LS_HOME_FIXED = 'my2077.homeLine.fixed'

let autoTimer: ReturnType<typeof setInterval> | null = null
let hintTimer: ReturnType<typeof setTimeout> | null = null

export function useHomeLine() {
  const route = useRoute()
  const homeLinePref = useState<HomeLinePref>('home-line-pref', () => 'default')
  const homeLineLoaded = useState<boolean>('home-line-loaded', () => false)
  const rotate = useState<HomeLineRotate>('home-line-rotate', () => 'auto')
  const intervalMin = useState<number>('home-line-interval', () => 5)
  const fixedText = useState<string>('home-line-fixed-text', () => '')
  const fixedSong = useState<string>('home-line-fixed-song', () => '')
  const liveText = useState<string>('home-line-live-text', () => '')
  const liveSong = useState<string>('home-line-live-song', () => '')
  const busy = useState<boolean>('home-line-busy', () => false)
  const hint = useState<string>('home-line-hint', () => '')

  const daily = dailyNetEaseComment()
  const currentText = computed(() => {
    if (rotate.value === 'fixed') return fixedText.value || liveText.value || daily
    return liveText.value || daily
  })
  const currentSong = computed(() => {
    if (rotate.value === 'fixed') return fixedText.value ? fixedSong.value : liveSong.value
    return liveSong.value
  })

  function flashHint(text: string) {
    hint.value = text
    if (hintTimer) clearTimeout(hintTimer)
    hintTimer = setTimeout(() => (hint.value = ''), 1800)
  }

  function loadHomeLine() {
    if (!import.meta.client || homeLineLoaded.value) return
    homeLineLoaded.value = true
    try {
      const pref = localStorage.getItem(LS_HOME_LINE)
      if (pref === 'default' || pref === 'stats' || pref === 'comment') homeLinePref.value = pref
      const rot = localStorage.getItem(LS_HOME_ROTATE)
      if (rot === 'auto' || rot === 'fixed') rotate.value = rot
      const iv = Number(localStorage.getItem(LS_HOME_INTERVAL))
      if (Number.isFinite(iv) && iv >= 1 && iv <= 1440) intervalMin.value = Math.round(iv)
      const fixedRaw = localStorage.getItem(LS_HOME_FIXED)
      if (fixedRaw) {
        const fixed = JSON.parse(fixedRaw)
        if (fixed && typeof fixed.text === 'string') {
          fixedText.value = fixed.text
          fixedSong.value = String(fixed.song || '')
        }
      }
    } catch {}
  }

  function saveFixed() {
    try {
      localStorage.setItem(LS_HOME_FIXED, JSON.stringify({ text: fixedText.value, song: fixedSong.value }))
    } catch {}
  }

  function setHomeLinePref(value: HomeLinePref) {
    homeLinePref.value = value
    homeLineLoaded.value = true
    try {
      localStorage.setItem(LS_HOME_LINE, value)
    } catch {}
  }

  function setIntervalMin(value: number) {
    const next = Math.min(1440, Math.max(1, Math.round(Number(value) || 5)))
    intervalMin.value = next
    try {
      localStorage.setItem(LS_HOME_INTERVAL, String(next))
    } catch {}
    startAuto()
  }

  async function fetchComment(exclude = '') {
    if (busy.value) return
    busy.value = true
    try {
      const d: any = await $fetch('/api/home/comment', { query: exclude ? { exclude } : {} })
      if (d?.text) {
        liveText.value = String(d.text).slice(0, 80)
        liveSong.value = String(d.song || '').slice(0, 40)
      }
    } catch {
      flashHint('换一句失败，请稍后再试')
    } finally {
      busy.value = false
    }
  }

  async function nextComment() {
    await fetchComment(currentText.value)
  }

  async function copyComment() {
    const text = `「${currentText.value}」—— 网易云热评`
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const el = document.createElement('textarea')
        el.value = text
        el.style.position = 'fixed'
        el.style.opacity = '0'
        document.body.appendChild(el)
        el.select()
        document.execCommand('copy')
        el.remove()
      }
      flashHint('已复制')
    } catch {
      flashHint('复制失败')
    }
  }

  function fixCurrent() {
    fixedText.value = currentText.value
    fixedSong.value = currentSong.value
    rotate.value = 'fixed'
    try {
      localStorage.setItem(LS_HOME_ROTATE, 'fixed')
    } catch {}
    saveFixed()
    stopAuto()
    flashHint('已固定当前这句')
  }

  async function nextAndFix() {
    await fetchComment(currentText.value)
    fixedText.value = liveText.value || currentText.value
    fixedSong.value = liveSong.value
    rotate.value = 'fixed'
    try {
      localStorage.setItem(LS_HOME_ROTATE, 'fixed')
    } catch {}
    saveFixed()
    stopAuto()
    flashHint('已换一句并固定')
  }

  function setRotate(value: HomeLineRotate) {
    if (value === 'fixed') {
      fixCurrent()
      return
    }
    rotate.value = 'auto'
    try {
      localStorage.setItem(LS_HOME_ROTATE, 'auto')
    } catch {}
    nextComment()
    startAuto()
  }

  function startAuto() {
    stopAuto()
    if (!import.meta.client || rotate.value === 'fixed' || route.path !== '/') return
    autoTimer = setInterval(() => {
      if (rotate.value === 'auto') nextComment()
    }, intervalMin.value * 60_000)
  }

  function stopAuto() {
    if (autoTimer) {
      clearInterval(autoTimer)
      autoTimer = null
    }
  }

  function resolveHomeLine(siteDefault: string): 'stats' | 'comment' {
    if (homeLinePref.value === 'comment') return 'comment'
    if (homeLinePref.value === 'stats') return 'stats'
    return siteDefault === 'comment' ? 'comment' : 'stats'
  }

  return {
    homeLinePref,
    rotate,
    intervalMin,
    fixedText,
    currentText,
    currentSong,
    busy,
    hint,
    loadHomeLine,
    setHomeLinePref,
    setIntervalMin,
    setRotate,
    fetchComment,
    nextComment,
    nextAndFix,
    copyComment,
    fixCurrent,
    startAuto,
    stopAuto,
    resolveHomeLine
  }
}
