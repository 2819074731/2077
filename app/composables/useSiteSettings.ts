import { DEFAULT_SITE_SETTINGS, normalizeSiteSettings, type SiteSettings } from '#shared/siteSettings'

export function useSiteSettings() {
  const settings = useState<SiteSettings>('site-settings', () => ({ ...DEFAULT_SITE_SETTINGS }))
  const loaded = useState<boolean>('site-settings-loaded', () => false)

  async function loadSiteSettings(force = false): Promise<SiteSettings> {
    if (loaded.value && !force) return settings.value
    try {
      const data: any = await $fetch('/api/site/settings')
      settings.value = normalizeSiteSettings(data)
      loaded.value = true
    } catch {
      // 配置读取失败时保留内置默认值，不阻塞页面渲染。
    }
    return settings.value
  }

  return { settings, loaded, loadSiteSettings }
}
