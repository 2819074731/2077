export default defineEventHandler(async (event) => {
  const siteUrl = useRuntimeConfig().public.siteUrl
  const db = useDb()
  const [categories]: any = await db.query(
    `SELECT category, COUNT(*) AS n FROM directory_entries WHERE status = 'published'
     GROUP BY category ORDER BY n DESC, category ASC`
  )
  const [[all]]: any = await db.query(
    "SELECT COUNT(*) AS n FROM directory_entries WHERE status = 'published'"
  )

  const lines = [
    '# 2077 导航',
    '',
    '> 2077 导航是中文网址导航与网站目录，提供可自定义的浏览器起始页、首页精选导航和带独立详情页的分类目录。',
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
    '',
    '## 分类',
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
    '## 数据',
    '',
    `- 目录站点数量：${Number(all?.n || 0)}`,
    `- 分类数量：${categories.length}`,
    `- 更新日期：${new Date().toISOString().slice(0, 10)}`,
    ''
  )

  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=600, stale-while-revalidate=600')
  return lines.join('\n')
})
