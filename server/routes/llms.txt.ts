import { getSiteCategories } from '../utils/categories'
import { getSiteSettings } from '../utils/siteSettings'
import { COPYRIGHT } from '#shared/copyright'

export default defineEventHandler(async (event) => {
  const siteUrl = useRuntimeConfig().public.siteUrl
  const siteCategories = await getSiteCategories()
  const settings = await getSiteSettings()
  const db = useDb()
  const [categories]: any = await db.query(
    `SELECT category, COUNT(*) AS n FROM directory_entries WHERE status = 'published'
     GROUP BY category ORDER BY n DESC, category ASC`
  )
  const [[all]]: any = await db.query(
    "SELECT COUNT(*) AS n FROM directory_entries WHERE status = 'published'"
  )

  const lines = [
    `# ${settings.siteName}`,
    '',
    `> ${settings.siteDescription}`,
    '',
    '## 主要页面',
    '',
    `- [首页导航](${siteUrl}/)：精选站点导航，按分类浏览常用网站。`,
    `- [分类目录](${siteUrl}/site)：按主题收录网站，提供分类筛选、搜索与站点详情。`,
    `- [站点地图](${siteUrl}/sitemap)：全站页面与全部目录站点的索引。`,
    `- [提交收录](${siteUrl}/submit)：推荐网站加入首页导航或分类目录。`,
    '',
    '## 收录方式',
    '',
    '- 首页导航：审核标准较高，只展示精选站点。',
    '- 分类目录：按分类长期收录，符合条件的站点会生成独立详情页。',
    '- 提交入口：' + siteUrl + '/submit，免费提交，通常 ' + settings.submitReviewDays + ' 个工作日完成人工审核。',
    '- 收录标准：网站需合法合规、可正常访问，并提供原创或有长期价值的内容；拒绝采集站、镜像站、恶意跳转和弹窗站点。',
    '- 同一网址只保留一条记录，重复提交会被自动拦截。',
    '',
    '## 已收录分类',
    ''
  ]

  if (categories.length) {
    for (const c of categories) {
      lines.push(`- [${c.category}](${siteUrl}/site?category=${encodeURIComponent(c.category)})：${c.n} 个站点。`)
    }
  } else {
    lines.push('- 分类目录暂无已发布站点。')
  }

  lines.push(
    '',
    '## 可提交分类（首页导航与分类目录共用）',
    '',
    ...siteCategories.map(c => `- ${c}`),
    '',
    '## 数据',
    '',
    `- 目录站点数量：${Number(all?.n || 0)}`,
    `- 分类数量：${categories.length}`,
    `- 更新日期：${new Date().toISOString().slice(0, 10)}`,
    '',
    '## License',
    '',
    `- ${COPYRIGHT.en}`,
    `- ${COPYRIGHT.license}: ${COPYRIGHT.licenseUrl}`,
    `- ${COPYRIGHT.required}`,
    ''
  )

  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=600, stale-while-revalidate=600')
  return lines.join('\n')
})
