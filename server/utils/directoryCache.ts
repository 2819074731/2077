import { setSetting } from './settings'

/**
 * 目录列表的分类/总数缓存分散在各 PM2 实例内。
 * 用一个共享版本号通知所有实例失效，避免分类同步后统计延迟。
 */
export async function touchDirectoryCache(): Promise<void> {
  try {
    await setSetting('directory_cache_version', Date.now())
  } catch {}
}
