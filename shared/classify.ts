export interface ClassifyInput {
  name?: string
  url?: string
  title?: string
  description?: string
  keywords?: string
}

const RULES: Array<{ group: string; words: string[] }> = [
  { group: 'AI 与模型', words: ['openai', 'anthropic', 'claude', 'chatgpt', 'gemini', 'midjourney', 'huggingface', 'stable diffusion', 'llm', '人工智能', '大模型', 'ai 工具'] },
  { group: '开发工具', words: ['github', 'gitlab', 'gitee', 'stackoverflow', 'npmjs', 'pypi', 'docker', 'kubernetes', 'vercel', 'netlify', 'cloudflare', 'postman', 'jetbrains', 'vscode', 'developer', '编程', '开发', '代码', 'api 文档'] },
  { group: '论坛门户', words: ['v2ex', 'linux.do', 'reddit', 'bbs', 'forum', '论坛', '社区', '大佬论坛', '侠客岛'] },
  { group: '资讯阅读', words: ['hacker news', 'zhihu', 'juejin', 'sspai', '36kr', '少数派', '知乎', '掘金', '资讯'] },
  { group: '影音娱乐', words: ['youtube', 'bilibili', 'netflix', 'spotify', 'twitch', '音乐', '视频', '电影', '影视', '动漫', '游戏'] },
  { group: '云服务', words: ['aws', 'azure', 'cloud.google', 'aliyun', 'aliyun.com', 'tencent cloud', 'cloud.tencent', 'console', '控制台', '云服务', '服务器'] },
  { group: '运维监控', words: ['uptime', 'statuspage', 'grafana', 'prometheus', '监控', '状态页', '运维'] },
  { group: '高校', words: ['edu.cn', '大学', '学院', '高校', 'university', '招生', '本科'] },
  { group: '学习文档', words: ['mdn', 'w3schools', 'coursera', 'wikipedia', 'docs', '文档', '教程', '课程', '学习'] },
  { group: '效率工具', words: ['notion', 'obsidian', 'figma', 'canva', 'trello', 'todoist', 'calendar', 'drive.google', '效率', '笔记', '待办'] },
  { group: '购物生活', words: ['taobao', 'tmall', 'jd.com', 'amazon', 'meituan', '淘宝', '天猫', '京东', '美团', '购物', '生活'] },
  { group: '社交平台', words: ['weibo', 'twitter', 'telegram', 'discord', 'facebook', 'instagram', '小红书', '抖音', '微博', '社交'] }
]

/**
 * 基于域名与文本的关键词分类。返回已有分组名，无法判断时返回空串。
 */
export function suggestGroupName(input: ClassifyInput, groups: string[]): string {
  let host = ''
  try {
    host = new URL(String(input.url || '')).hostname.toLowerCase()
  } catch {}
  const hay = [
    host,
    input.name,
    input.title,
    input.description,
    input.keywords
  ].filter(Boolean).join(' ').toLowerCase()
  if (!hay.trim()) return ''

  for (const g of groups) {
    const core = String(g || '').toLowerCase().replace(/[与和及\s]/g, '')
    if (core.length >= 2 && hay.replace(/\s/g, '').includes(core)) return g
  }

  let best = ''
  let bestScore = 0
  for (const rule of RULES) {
    let score = 0
    for (const w of rule.words) {
      if (hay.includes(w)) score += 1
    }
    if (score > bestScore) {
      bestScore = score
      best = rule.group
    }
  }
  if (!best) return ''
  return groups.find(g => g.includes(best) || best.includes(g)) || ''
}
