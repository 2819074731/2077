export const DIRECTORY_CATEGORIES = [
  '站长工具',
  '博客大全',
  '开发工具',
  'AI 与模型',
  '设计创意',
  '图片素材',
  '效率办公',
  '学习文档',
  '社区资讯',
  '影音娱乐',
  '游戏娱乐',
  '购物电商',
  '生活服务',
  '旅游出行',
  '金融理财',
  '教育考试',
  '招聘求职',
  '云服务与主机',
  '运维监控',
  '安全防护',
  '软件下载',
  '移动应用',
  '其他'
] as const

export type DirectoryCategory = (typeof DIRECTORY_CATEGORIES)[number]
