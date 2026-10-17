export interface WallpaperItem {
  id: string
  full: string
  uhd: string
  thumb: string
  title: string
  copyright: string
  date: string
}

export type WallpaperMode = 'minimal' | 'bing'

const LS_MODE = 'my2077.wallpaper.mode'
const LS_ROTATE = 'my2077.wallpaper.rotate'
const LS_INTERVAL = 'my2077.wallpaper.interval'
const LS_FIXED = 'my2077.wallpaper.fixed'
const LS_OPACITY = 'my2077.wallpaper.opacity'
const LS_BLUR = 'my2077.wallpaper.blur'
const LS_OVERLAY = 'my2077.wallpaper.overlay'
const LS_EFFECT = 'my2077.wallpaper.effect'
const LS_TONE = 'my2077.wallpaper.tone'

/** 轮播间隔可选值（分钟）。 */
export const ROTATE_INTERVALS = [5, 10, 30, 60, 180, 1440]

export interface EffectPreset {
  id: string
  name: string
  desc: string
  opacity: number
  blur: number
  overlay: number
}

/** 显示效果预设：一套通用默认，另有柔和 / 沉浸可选。 */
export const EFFECT_PRESETS: EffectPreset[] = [
  { id: 'general', name: '通用', desc: '清晰壁纸 + 适度遮罩', opacity: 100, blur: 0, overlay: 45 },
  { id: 'soft', name: '柔和', desc: '轻微模糊，文字更清晰', opacity: 92, blur: 8, overlay: 55 },
  { id: 'immersive', name: '沉浸', desc: '低遮罩，突出壁纸', opacity: 100, blur: 0, overlay: 18 }
]

export const DEFAULT_EFFECT = EFFECT_PRESETS[0]

export type ToneMode = 'auto' | 'light' | 'dark'

/** 壁纸文字颜色：自动按亮度判定，也可手动锁定。 */
export const TONE_MODES: { id: ToneMode; name: string; desc: string }[] = [
  { id: 'auto', name: '自动', desc: '跟随壁纸明暗' },
  { id: 'light', name: '浅色', desc: '白色文字' },
  { id: 'dark', name: '深色', desc: '深色文字' }
]

/** 轮播定时器（模块级，避免多处 useWallpaper 实例各起一个 interval）。 */
let timer: any = null

export function useWallpaper() {
  const mode = useState<WallpaperMode>('wp-mode', () => 'minimal')
  const rotate = useState<boolean>('wp-rotate', () => true)
  const interval = useState<number>('wp-interval', () => 60)
  const fixed = useState<string>('wp-fixed', () => '')
  const opacity = useState<number>('wp-opacity', () => DEFAULT_EFFECT.opacity)
  const blur = useState<number>('wp-blur', () => DEFAULT_EFFECT.blur)
  const current = useState<string>('wp-current', () => '')
  const items = useState<WallpaperItem[]>('wp-items', () => [])
  const loading = useState<boolean>('wp-loading', () => false)
  const overlay = useState<number>('wp-overlay', () => DEFAULT_EFFECT.overlay)
  const effect = useState<string>('wp-effect', () => DEFAULT_EFFECT.id)
  const toneMode = useState<ToneMode>('wp-tone-mode', () => 'auto')
  const toneAuto = useState<'light' | 'dark'>('wp-tone-auto', () => 'light')

  /** 代理后的图片地址（走服务端缓存，避免跨域与防盗链）。 */
  function proxy(url: string): string {
    return url ? `/api/wallpaper/image?url=${encodeURIComponent(url)}` : ''
  }

  function persist() {
    if (!import.meta.client) return
    localStorage.setItem(LS_MODE, mode.value)
    localStorage.setItem(LS_ROTATE, rotate.value ? '1' : '0')
    localStorage.setItem(LS_INTERVAL, String(interval.value))
    localStorage.setItem(LS_FIXED, fixed.value)
    localStorage.setItem(LS_OPACITY, String(opacity.value))
    localStorage.setItem(LS_BLUR, String(blur.value))
    localStorage.setItem(LS_OVERLAY, String(overlay.value))
    localStorage.setItem(LS_EFFECT, effect.value)
    localStorage.setItem(LS_TONE, toneMode.value)
  }

  function loadLocal() {
    if (!import.meta.client) return
    const m = localStorage.getItem(LS_MODE)
    if (m === 'bing' || m === 'minimal') mode.value = m
    const r = localStorage.getItem(LS_ROTATE)
    if (r != null) rotate.value = r === '1'
    const iv = Number(localStorage.getItem(LS_INTERVAL))
    if (ROTATE_INTERVALS.includes(iv)) interval.value = iv
    fixed.value = localStorage.getItem(LS_FIXED) || ''
    const op = Number(localStorage.getItem(LS_OPACITY))
    if (!Number.isNaN(op) && op >= 0 && op <= 100) opacity.value = op
    const bl = Number(localStorage.getItem(LS_BLUR))
    if (!Number.isNaN(bl) && bl >= 0 && bl <= 40) blur.value = bl
    const ov = Number(localStorage.getItem(LS_OVERLAY))
    if (!Number.isNaN(ov) && ov >= 0 && ov <= 100) overlay.value = ov
    const ef = localStorage.getItem(LS_EFFECT)
    effect.value = EFFECT_PRESETS.some(p => p.id === ef) ? (ef as string) : 'custom'
    const tm = localStorage.getItem(LS_TONE)
    toneMode.value = tm === 'light' || tm === 'dark' || tm === 'auto' ? tm : 'auto'
  }

  async function fetchList(n = 8) {
    loading.value = true
    try {
      const d: any = await $fetch(`/api/wallpaper?n=${n}`)
      if (Array.isArray(d?.items)) items.value = d.items
    } catch {
    } finally {
      loading.value = false
    }
  }

  function pickRandom() {
    if (!items.value.length) return
    const pool = items.value.filter(w => w.full !== current.value)
    const list = pool.length ? pool : items.value
    current.value = list[Math.floor(Math.random() * list.length)].full
  }

  function setFixed(url: string) {
    fixed.value = url
    if (url) current.value = url
    persist()
    restart()
  }

  /** 根据当前设置启动/重启定时轮播。 */
  function restart() {
    if (!import.meta.client) return
    clearInterval(timer)
    if (mode.value !== 'bing' || !rotate.value || fixed.value) return
    if (!items.value.length) fetchList().then(() => { if (items.value.length) pickRandom() })
    else if (!current.value) pickRandom()
    timer = setInterval(pickRandom, Math.max(1, interval.value) * 60 * 1000)
  }

  function stop() {
    clearInterval(timer)
    timer = null
  }

  function setMode(m: WallpaperMode) {
    mode.value = m
    if (m === 'minimal') stop()
    persist()
    if (m === 'bing') restart()
  }

  function setRotate(v: boolean) { rotate.value = v; persist(); restart() }
  function setIntervalMin(v: number) { interval.value = v; persist(); restart() }
  function setOpacity(v: number) { opacity.value = v; effect.value = 'custom'; persist() }
  function setBlur(v: number) { blur.value = v; effect.value = 'custom'; persist() }
  function setOverlay(v: number) { overlay.value = v; effect.value = 'custom'; persist() }

  /** 套用显示效果预设。 */
  function setToneMode(v: ToneMode) {
    toneMode.value = v
    persist()
  }

  function applyEffect(id: string) {
    const p = EFFECT_PRESETS.find(x => x.id === id)
    if (!p) return
    effect.value = p.id
    opacity.value = p.opacity
    blur.value = p.blur
    overlay.value = p.overlay
    persist()
  }

  /** 壁纸是否生效（用于布局层）。 */
  const active = computed(() => mode.value === 'bing' && !!current.value)
  const bgUrl = computed(() => active.value ? proxy(current.value) : '')
  const tone = computed<'light' | 'dark'>(() => toneMode.value === 'auto' ? toneAuto.value : toneMode.value)

  return {
    mode, rotate, interval, fixed, opacity, blur, overlay, effect, toneMode, toneAuto, tone, items, loading, current,
    active, bgUrl,
    proxy,
    loadLocal,
    fetchList,
    pickRandom,
    setMode,
    setRotate,
    setIntervalMin,
    setFixed,
    setOpacity,
    setBlur,
    setOverlay,
    setToneMode,
    applyEffect,
    restart,
    stop
  }
}
