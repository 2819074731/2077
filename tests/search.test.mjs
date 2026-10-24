import test from 'node:test'
import assert from 'node:assert/strict'
import {
  escapeHtml,
  highlightHtml,
  isValidSearchSort,
  isValidSearchType,
  normalizeQuery,
  splitTokens
} from '../shared/search.ts'

test('normalizeQuery 压缩空白并限制长度', () => {
  assert.equal(normalizeQuery('  百度   一下  '), '百度 一下')
  assert.equal(normalizeQuery('a\u0000b'), 'a b')
  assert.equal(normalizeQuery('abcdef', 3), 'abc')
})

test('splitTokens 去重并限制数量', () => {
  assert.deepEqual(splitTokens('GitHub github 百度'), ['GitHub', '百度'])
  assert.deepEqual(splitTokens('a b c d e f g h', 3), ['a', 'b', 'c'])
})

test('搜索类型与排序只接受白名单值', () => {
  assert.equal(isValidSearchSort('relevance'), true)
  assert.equal(isValidSearchSort('latest'), true)
  assert.equal(isValidSearchSort('drop'), false)
  assert.equal(isValidSearchType('directory'), true)
  assert.equal(isValidSearchType('link'), true)
  assert.equal(isValidSearchType('all'), true)
  assert.equal(isValidSearchType('admin'), false)
})

test('escapeHtml 转义危险字符', () => {
  assert.equal(escapeHtml('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;')
})

test('highlightHtml 高亮关键词且保持转义', () => {
  assert.equal(highlightHtml('百度一下', '百度'), '<mark>百度</mark>一下')
  assert.equal(highlightHtml('GitHub 搜索', 'git'), '<mark>Git</mark>Hub 搜索')
  assert.equal(
    highlightHtml('<script>alert(1)</script>百度', '百度'),
    '&lt;script&gt;alert(1)&lt;/script&gt;<mark>百度</mark>'
  )
})

test('highlightHtml 支持多个关键词', () => {
  assert.equal(
    highlightHtml('百度 baidu', '百度 baidu'),
    '<mark>百度</mark> <mark>baidu</mark>'
  )
})
