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
