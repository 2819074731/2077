const MOBILE_RE = /Android|iPhone|iPad|iPod|Mobile|Windows Phone|HarmonyOS|webOS|BlackBerry|Opera Mini/i

export function isMobileUA(ua: string): boolean {
  return MOBILE_RE.test(ua || '')
}

export function useDevice() {
  /** 由 UA 判定的移动端（SSR 与客户端首帧一致，跟随浏览器/设备）。 */
  const uaMobile = useState<boolean>('dev-ua-mobile', () => false)

  const isMobile = computed(() => uaMobile.value)

  /** 服务端：读取请求 UA。 */
  function initServer() {
    if (!import.meta.server) return
    const headers = useRequestHeaders(['user-agent'])
    uaMobile.value = isMobileUA(headers['user-agent'] || '')
  }

  /** 客户端：按浏览器 UA 刷新。 */
  function initClient() {
    if (!import.meta.client) return
    uaMobile.value = isMobileUA(navigator.userAgent || '')
  }

  return { isMobile, initServer, initClient }
}
