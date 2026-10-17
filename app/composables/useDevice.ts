const LS_DEVICE = 'my2077.device'

export type DeviceMode = 'auto' | 'pc' | 'mobile'

const MOBILE_RE = /Android|iPhone|iPad|iPod|Mobile|Windows Phone|HarmonyOS|webOS|BlackBerry|Opera Mini/i

export function isMobileUA(ua: string): boolean {
  return MOBILE_RE.test(ua || '')
}

export function useDevice() {
  /** 由 UA 判定的移动端（SSR 与客户端首帧一致）。 */
  const uaMobile = useState<boolean>('dev-ua-mobile', () => false)
  /** 用户手动偏好：null 表示跟随 UA。仅客户端挂载后读取。 */
  const override = useState<DeviceMode | null>('dev-override', () => null)

  const isMobile = computed(() => {
    if (override.value === 'mobile') return true
    if (override.value === 'pc') return false
    return uaMobile.value
  })
  const mode = computed<DeviceMode>(() => override.value || 'auto')

  /** 服务端：读取请求 UA。 */
  function initServer() {
    if (!import.meta.server) return
    const headers = useRequestHeaders(['user-agent'])
    uaMobile.value = isMobileUA(headers['user-agent'] || '')
  }

  /** 客户端：刷新 UA，并读取本地手动偏好。 */
  function initClient() {
    uaMobile.value = isMobileUA(navigator.userAgent || '')
    const saved = localStorage.getItem(LS_DEVICE)
    if (saved === 'pc' || saved === 'mobile') override.value = saved
  }

  function setMode(m: DeviceMode) {
    override.value = m === 'auto' ? null : m
    if (import.meta.client) localStorage.setItem(LS_DEVICE, m)
  }

  return { mode, isMobile, initServer, initClient, setMode }
}
