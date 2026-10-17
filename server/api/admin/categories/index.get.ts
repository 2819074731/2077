import { getSiteCategories } from '../../../utils/categories'
import { getSiteConfig } from '../../../utils/siteConfig'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = useDb()
  const categories = await getSiteCategories()
  const cfg = await getSiteConfig()

  const [directoryRows]: any = await db.query(
    'SELECT category, COUNT(*) AS n FROM directory_entries GROUP BY category'
  )
  const [submissionRows]: any = await db.query(
    'SELECT grp, COUNT(*) AS n FROM submissions WHERE grp <> \'\' GROUP BY grp'
  )

  const directory = new Map<string, number>()
  for (const row of directoryRows) {
    const name = String(row.category || '').trim()
    if (name) directory.set(name, Number(row.n || 0))
  }
  const submissions = new Map<string, number>()
  for (const row of submissionRows) {
    const name = String(row.grp || '').trim()
    if (name) submissions.set(name, Number(row.n || 0))
  }
  const nav = new Map<string, number>()
  for (const group of cfg.groups) {
    nav.set(group.name, (nav.get(group.name) || 0) + group.links.length)
  }

  const all = new Set<string>([
    ...categories,
    ...directory.keys(),
    ...submissions.keys(),
    ...nav.keys()
  ])

  return {
    categories: [...all].map((name) => ({
      name,
      directory: directory.get(name) || 0,
      nav: nav.get(name) || 0,
      submissions: submissions.get(name) || 0,
      managed: categories.includes(name)
    })),
    managed: categories
  }
})
