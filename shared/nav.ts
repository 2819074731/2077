export interface NavLink { id: string; name: string; url: string; icon?: string }
export interface NavGroup { id: string; name: string; links: NavLink[]; recommended?: boolean }
export interface Engine { id: string; name: string; url: string; custom?: boolean }

/** 内置搜索引擎；默认使用必应，用户可切换或自定义。 */
export const ENGINES: Engine[] = [
  { id: 'bing', name: '必应', url: 'https://www.bing.com/search?q=%s' },
  { id: 'google', name: 'Google', url: 'https://www.google.com/search?q=%s' },
  { id: 'baidu', name: '百度', url: 'https://www.baidu.com/s?wd=%s' },
  { id: 'ddg', name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s' },
  { id: 'github', name: 'GitHub', url: 'https://github.com/search?q=%s' }
]

export const DEFAULT_ENGINE = 'bing'

/** 站长推荐站点池：按 URL 匹配，命中后在各分类内置顶展示（不单独成区块）。 */
export const RECOMMENDED_LINKS: NavLink[] = [
  { id: 'r1', name: 'GitHub', url: 'https://github.com' },
  { id: 'r2', name: 'ChatGPT', url: 'https://chat.openai.com' },
  { id: 'r3', name: 'Google', url: 'https://www.google.com' },
  { id: 'r4', name: 'Bilibili', url: 'https://www.bilibili.com' },
  { id: 'r5', name: '知乎', url: 'https://www.zhihu.com' },
  { id: 'r6', name: 'YouTube', url: 'https://www.youtube.com' },
  { id: 'r7', name: 'V2EX', url: 'https://www.v2ex.com' },
  { id: 'r8', name: 'MDN', url: 'https://developer.mozilla.org' }
]

export const DEFAULT_GROUPS: NavGroup[] = [
  { id: 'g-dev', name: '开发工具', recommended: true, links: [
    { id: 'l1', name: 'GitHub', url: 'https://github.com' },
    { id: 'l2', name: 'Stack Overflow', url: 'https://stackoverflow.com' },
    { id: 'l3', name: 'MDN', url: 'https://developer.mozilla.org' },
    { id: 'l4', name: 'npm', url: 'https://www.npmjs.com' },
    { id: 'l5', name: 'DevDocs', url: 'https://devdocs.io' },
    { id: 'l6', name: 'Can I use', url: 'https://caniuse.com' },
    { id: 'l7', name: 'GitLab', url: 'https://gitlab.com' },
    { id: 'l8', name: 'Gitea', url: 'https://gitea.com' },
    { id: 'l9', name: 'CodePen', url: 'https://codepen.io' },
    { id: 'l10', name: 'Regex101', url: 'https://regex101.com' },
    { id: 'l11', name: 'Carbon', url: 'https://carbon.now.sh' },
    { id: 'l12', name: 'Postman', url: 'https://www.postman.com' }
  ]},
  { id: 'g-ai', name: 'AI 与模型', recommended: true, links: [
    { id: 'l13', name: 'ChatGPT', url: 'https://chat.openai.com' },
    { id: 'l14', name: 'Claude', url: 'https://claude.ai' },
    { id: 'l15', name: 'Gemini', url: 'https://gemini.google.com' },
    { id: 'l16', name: 'Hugging Face', url: 'https://huggingface.co' },
    { id: 'l17', name: 'Perplexity', url: 'https://www.perplexity.ai' },
    { id: 'l18', name: 'Poe', url: 'https://poe.com' },
    { id: 'l19', name: 'Midjourney', url: 'https://www.midjourney.com' },
    { id: 'l20', name: 'Suno', url: 'https://suno.com' },
    { id: 'l21', name: '通义千问', url: 'https://tongyi.aliyun.com' },
    { id: 'l22', name: 'Kimi', url: 'https://kimi.moonshot.cn' },
    { id: 'l23', name: '智谱清言', url: 'https://chatglm.cn' },
    { id: 'l24', name: 'Ollama', url: 'https://ollama.com' }
  ]},
  { id: 'g-geek', name: '社区资讯', recommended: true, links: [
    { id: 'l25', name: 'Hacker News', url: 'https://news.ycombinator.com' },
    { id: 'l26', name: 'V2EX', url: 'https://www.v2ex.com' },
    { id: 'l27', name: 'LINUX DO', url: 'https://linux.do' },
    { id: 'l28', name: '掘金', url: 'https://juejin.cn' },
    { id: 'l29', name: '少数派', url: 'https://sspai.com' },
    { id: 'l30', name: 'GitHub Trending', url: 'https://github.com/trending' },
    { id: 'l31', name: '知乎', url: 'https://www.zhihu.com' },
    { id: 'l32', name: '博客园', url: 'https://www.cnblogs.com' },
    { id: 'l33', name: 'Reddit', url: 'https://www.reddit.com' },
    { id: 'l34', name: 'Product Hunt', url: 'https://www.producthunt.com' }
  ]},
  { id: 'g-media', name: '影音娱乐', recommended: true, links: [
    { id: 'l35', name: 'Bilibili', url: 'https://www.bilibili.com' },
    { id: 'l36', name: 'YouTube', url: 'https://www.youtube.com' },
    { id: 'l37', name: 'Netflix', url: 'https://www.netflix.com' },
    { id: 'l38', name: 'Spotify', url: 'https://open.spotify.com' },
    { id: 'l39', name: '网易云音乐', url: 'https://music.163.com' },
    { id: 'l40', name: '腾讯视频', url: 'https://v.qq.com' },
    { id: 'l41', name: '爱奇艺', url: 'https://www.iqiyi.com' }
  ]},
  { id: 'g-cloud', name: '云与控制台', links: [
    { id: 'l42', name: 'Cloudflare', url: 'https://dash.cloudflare.com' },
    { id: 'l43', name: 'Vercel', url: 'https://vercel.com/dashboard' },
    { id: 'l44', name: '阿里云', url: 'https://home.console.aliyun.com' },
    { id: 'l45', name: '腾讯云', url: 'https://console.cloud.tencent.com' },
    { id: 'l46', name: 'Docker Hub', url: 'https://hub.docker.com' },
    { id: 'l47', name: 'Netlify', url: 'https://app.netlify.com' },
    { id: 'l48', name: 'AWS', url: 'https://console.aws.amazon.com' },
    { id: 'l49', name: '华为云', url: 'https://console.huaweicloud.com' }
  ]},
  { id: 'g-ops', name: '运维监控', links: [
    { id: 'l50', name: 'Grafana', url: 'https://grafana.com' },
    { id: 'l51', name: 'Prometheus', url: 'https://prometheus.io' },
    { id: 'l52', name: 'Uptime Kuma', url: 'https://github.com/louislam/uptime-kuma' },
    { id: 'l53', name: '宝塔面板', url: 'https://www.bt.cn' },
    { id: 'l54', name: 'Jenkins', url: 'https://www.jenkins.io' },
    { id: 'l55', name: 'Nginx', url: 'https://nginx.org' }
  ]},
  { id: 'g-learn', name: '学习文档', links: [
    { id: 'l56', name: '菜鸟教程', url: 'https://www.runoob.com' },
    { id: 'l57', name: 'LeetCode', url: 'https://leetcode.cn' },
    { id: 'l58', name: 'freeCodeCamp', url: 'https://www.freecodecamp.org' },
    { id: 'l59', name: 'Coursera', url: 'https://www.coursera.org' },
    { id: 'l60', name: 'W3Schools', url: 'https://www.w3schools.com' },
    { id: 'l61', name: 'C语言中文网', url: 'https://c.biancheng.net' }
  ]},
  { id: 'g-tool', name: '效率工具', links: [
    { id: 'l62', name: 'Notion', url: 'https://www.notion.so' },
    { id: 'l63', name: 'Figma', url: 'https://www.figma.com' },
    { id: 'l64', name: 'TinyPNG', url: 'https://tinypng.com' },
    { id: 'l65', name: 'JSON 格式化', url: 'https://jsonformatter.org' },
    { id: 'l66', name: 'Excalidraw', url: 'https://excalidraw.com' },
    { id: 'l67', name: '在线 PS', url: 'https://www.photopea.com' }
  ]},
  { id: 'g-shop', name: '购物生活', links: [
    { id: 'l68', name: '淘宝', url: 'https://www.taobao.com' },
    { id: 'l69', name: '京东', url: 'https://www.jd.com' },
    { id: 'l70', name: '拼多多', url: 'https://www.pinduoduo.com' },
    { id: 'l71', name: '美团', url: 'https://www.meituan.com' },
    { id: 'l72', name: '大众点评', url: 'https://www.dianping.com' },
    { id: 'l73', name: '12306', url: 'https://www.12306.cn' }
  ]},
  { id: 'g-social', name: '社交平台', links: [
    { id: 'l74', name: '微博', url: 'https://weibo.com' },
    { id: 'l75', name: '小红书', url: 'https://www.xiaohongshu.com' },
    { id: 'l76', name: '抖音', url: 'https://www.douyin.com' },
    { id: 'l77', name: 'Twitter / X', url: 'https://x.com' },
    { id: 'l78', name: 'Telegram', url: 'https://web.telegram.org' },
    { id: 'l79', name: 'Discord', url: 'https://discord.com' }
  ]}
]

/** 首页内联展示的分组数量，其余进入抽屉菜单。 */
export const INLINE_GROUP_COUNT = 4

/** 比较网址是否指向同一站点：忽略协议大小写、hash 与末尾斜杠。 */
export function urlKey(url: string): string {
  try {
    const u = new URL(String(url || '').trim())
    u.hash = ''
    return (u.origin + u.pathname + u.search).replace(/\/+$/, '')
  } catch {
    return ''
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

/** 图标统一走服务端代理 /api/icon，自动多级回退并缓存。 */
export function iconFor(url: string): string {
  const host = hostOf(url)
  return host ? `/api/icon?url=${encodeURIComponent(host)}` : ''
}
