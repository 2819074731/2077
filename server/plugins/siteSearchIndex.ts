import { ensureSiteSearchIndex } from '../utils/siteSearch'

/** 启动后预热拼音别名索引，避免首个搜索请求承担构建开销。 */
export default defineNitroPlugin(() => {
  setTimeout(() => {
    Promise.resolve()
      .then(() => ensureSiteSearchIndex(useDb()))
      .catch((error: any) => {
        console.warn('[search] 拼音索引预热失败', String(error?.message || error))
      })
  }, 1500)
})
