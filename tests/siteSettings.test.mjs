import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_SITE_SETTINGS, normalizeSiteSettings } from '../shared/siteSettings.ts'

const defaults = DEFAULT_SITE_SETTINGS.footerLinks

test('页脚导航缺省使用三个默认入口', () => {
  assert.deepEqual(normalizeSiteSettings({}).footerLinks, defaults)
  assert.deepEqual(normalizeSiteSettings({ footerLinks: 'invalid' }).footerLinks, defaults)
})

test('页脚导航会清洗名称与链接', () => {
  const settings = normalizeSiteSettings({
    footerLinks: [
      { label: '  友链  ', url: ' https://example.com ' },
      { label: '脚本', url: 'javascript:alert(1)' },
      { label: '相对协议', url: '//evil.example.com' },
      { label: '', url: '/empty-label' },
      { label: '目录', url: '/site' }
    ]
  })
  assert.deepEqual(settings.footerLinks, [
    { label: '友链', url: 'https://example.com' },
    { label: '目录', url: '/site' }
  ])
})

test('页脚导航最多保留 8 个入口', () => {
  const settings = normalizeSiteSettings({
    footerLinks: Array.from({ length: 12 }, (_, i) => ({ label: `入口${i}`, url: `/p${i}` }))
  })
  assert.equal(settings.footerLinks.length, 8)
  assert.equal(settings.footerLinks[7].url, '/p7')
})

test('空数组允许隐藏页脚导航，且不污染默认值', () => {
  const settings = normalizeSiteSettings({ footerLinks: [] })
  assert.deepEqual(settings.footerLinks, [])
  settings.footerLinks.push({ label: '新增', url: '/new' })
  assert.equal(defaults.length, 3)
})

test('Google 搜索默认关闭线路并保留开关', () => {
  const settings = normalizeSiteSettings({})
  assert.equal(settings.google.enabled, true)
  assert.deepEqual(settings.google.relays, [])
  assert.equal(settings.google.language, 'zh-CN')
})

test('Google 中转线路只接受 https 且最多 6 条', () => {
  const settings = normalizeSiteSettings({
    google: {
      relays: [
        'https://searx.example.com',
        'http://plain.example.com',
        'https://user:pass@auth.example.com',
        'https://a.example.com/search?q=%s&format=json',
        'https://searx.example.com',
        'https://b.example.com',
        'https://c.example.com',
        'https://d.example.com',
        'https://e.example.com',
        'https://f.example.com'
      ]
    }
  })
  assert.deepEqual(settings.google.relays, [
    'https://searx.example.com',
    'https://a.example.com/search?q=%s&format=json',
    'https://b.example.com',
    'https://c.example.com',
    'https://d.example.com',
    'https://e.example.com'
  ])
})

test('Google 搜索数值范围与语言会被清洗', () => {
  const settings = normalizeSiteSettings({
    google: { pageSize: 999, maxPages: 0, cacheSec: 10, timeoutMs: 99999, language: 'not a lang' }
  })
  assert.equal(settings.google.pageSize, 30)
  assert.equal(settings.google.maxPages, 1)
  assert.equal(settings.google.cacheSec, 60)
  assert.equal(settings.google.timeoutMs, 15000)
  assert.equal(settings.google.language, 'zh-CN')
})

test('Google中转访问令牌会被清洗', () => {
  const token = 'a'.repeat(24)
  assert.equal(normalizeSiteSettings({ google: { relayToken: token } }).google.relayToken, token)
  assert.equal(normalizeSiteSettings({ google: { relayToken: 'short' } }).google.relayToken, '')
  assert.equal(normalizeSiteSettings({ google: { relayToken: 'has space here' } }).google.relayToken, '')
  assert.equal(normalizeSiteSettings({}).google.relayToken, '')
})
