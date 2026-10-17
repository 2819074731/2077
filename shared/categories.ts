/**
 * 首页导航与分类目录共用的网站分类。
 * 后台审核、公开提交、目录管理与导航分组均以此清单为准。
 */
export const SITE_CATEGORIES = [
  '开发工具',
  'AI 与模型',
  '资讯阅读',
  '论坛门户',
  '影音娱乐',
  '云服务',
  '运维监控',
  '学习文档',
  '校园',
  '效率工具',
  '购物生活',
  '社交平台',
  '站长工具',
  '博客大全',
  '设计创意',
  '图片素材',
  '游戏娱乐',
  '生活服务',
  '旅游出行',
  '金融理财',
  '教育考试',
  '招聘求职',
  '安全防护',
  '软件下载',
  '移动应用',
  '其他'
] as const

export type SiteCategory = (typeof SITE_CATEGORIES)[number]

export const DEFAULT_CATEGORY: SiteCategory = '其他'

export function isSiteCategory(value: unknown): value is SiteCategory {
  return typeof value === 'string' && (SITE_CATEGORIES as readonly string[]).includes(value)
}
