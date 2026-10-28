import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildGoogleRelayUrl,
  decodeEntities,
  isHttpRelay,
  normalizeGoogleQuery,
  parseSearchJson,
  parseSearchResponse,
  parseSerpHtml,
  unwrapSearchUrl
} from '../shared/googleSearch.ts'

test('normalizeGoogleQuery 压缩空白并限制长度', () => {
  assert.equal(normalizeGoogleQuery('  nuxt   4  '), 'nuxt 4')
  assert.equal(normalizeGoogleQuery('a\u0000b'), 'a b')
  assert.equal(normalizeGoogleQuery('abcdef', 3), 'abc')
})

test('unwrapSearchUrl 解析 Google 跳转并拒绝站内链接', () => {
  assert.equal(
    unwrapSearchUrl('/url?q=https://nuxt.com/&amp;sa=U', 'https://relay.example.com/'),
    'https://nuxt.com/'
  )
  assert.equal(
    unwrapSearchUrl('https://www.google.com/url?url=https%3A%2F%2Fvuejs.org%2F', 'https://relay.example.com/'),
    'https://vuejs.org/'
  )
  assert.equal(unwrapSearchUrl('https://www.google.com/search?q=nuxt', 'https://relay.example.com/'), '')
  assert.equal(unwrapSearchUrl('https://support.google.com/websearch', 'https://relay.example.com/'), '')
  assert.equal(unwrapSearchUrl('javascript:alert(1)', 'https://relay.example.com/'), '')
})

test('decodeEntities 支持命名与数字实体', () => {
  assert.equal(decodeEntities('a&amp;b&#38;c&#x26;d'), 'a&b&c&d')
  assert.equal(decodeEntities('&unknown;'), '&unknown;')
})

test('parseSerpHtml 提取标题、链接与摘要并去重', () => {
  const html = `
    <div class="g">
      <a href="/url?q=https://nuxt.com/&amp;sa=U">
        <h3 class="LC20lb">Nuxt: The Intuitive Vue Framework</h3>
      </a>
      <div class="VwiC3b">Build your next Vue.js application with confidence.</div>
    </div>
    <div class="g">
      <a href="https://vuejs.org/"><h3>Vue.js</h3></a>
      <div>渐进式 JavaScript 框架</div>
    </div>
    <a href="https://nuxt.com/"><h3>Nuxt 重复项</h3></a>
    <a href="https://support.google.com/websearch">帮助</a>
  `
  const items = parseSerpHtml(html, 'https://relay.example.com/')
  assert.equal(items.length, 2)
  assert.equal(items[0].title, 'Nuxt: The Intuitive Vue Framework')
  assert.equal(items[0].url, 'https://nuxt.com/')
  assert.equal(items[0].displayUrl, 'nuxt.com')
  assert.match(items[0].snippet, /Build your next/)
  assert.equal(items[1].url, 'https://vuejs.org/')
})

test('parseSerpHtml 支持 result-link 结构', () => {
  const html = `
    <a rel="nofollow" href="https://example.com/page" class="result__a">示例标题</a>
    <a rel="nofollow" href="https://second.example.com/" class="result-link">第二个标题</a>
  `
  const items = parseSerpHtml(html, 'https://relay.example.com/')
  assert.equal(items.length, 2)
  assert.equal(items[0].url, 'https://example.com/page')
})

test('parseSearchJson 兼容 SearXNG、CSE 与 organic 结构', () => {
  const searx = parseSearchJson({
    results: [
      { title: 'Nuxt', url: 'https://nuxt.com', content: 'Framework' },
      { title: '重复', url: 'https://nuxt.com/', content: '' }
    ]
  }, 'https://relay.example.com/', 10)
  assert.equal(searx.items.length, 1)
  assert.equal(searx.items[0].snippet, 'Framework')

  const cse = parseSearchJson({
    items: [{ title: 'Vue', link: 'https://vuejs.org/', snippet: 'Progressive' }],
    queries: { nextPage: [{ startIndex: 11 }] }
  }, 'https://www.googleapis.com/', 10)
  assert.equal(cse.items.length, 1)
  assert.equal(cse.hasMore, true)

  const organic = parseSearchJson({
    organic: [{ title: 'Vite', link: 'https://vite.dev/', snippet: 'Build tool' }]
  }, 'https://relay.example.com/', 10)
  assert.equal(organic.items[0].displayUrl, 'vite.dev')
})

test('parseSearchResponse 自动识别 JSON 与 HTML', () => {
  const json = parseSearchResponse(JSON.stringify({
    results: [{ title: 'Nuxt', url: 'https://nuxt.com', content: 'ok' }]
  }), 'text/plain', 'https://relay.example.com/', 10)
  assert.equal(json.items.length, 1)

  const html = parseSearchResponse(
    '<a href="https://nuxt.com"><h3>Nuxt</h3></a>',
    'text/html',
    'https://relay.example.com/',
    10
  )
  assert.equal(html.items.length, 1)
})

test('buildGoogleRelayUrl 支持根地址与模板占位符', () => {
  const base = buildGoogleRelayUrl('https://searx.example.com/', {
    q: 'hello world',
    page: 1,
    pageSize: 10,
    language: 'zh-CN'
  })
  assert.equal(
    base,
    'https://searx.example.com/search?q=hello%20world&format=json&language=zh-CN&safesearch=0'
  )

  const paged = buildGoogleRelayUrl('https://searx.example.com', {
    q: 'nuxt',
    page: 3,
    pageSize: 10,
    language: 'zh-CN'
  })
  assert.match(paged, /pageno=3$/)

  const cse = buildGoogleRelayUrl(
    'https://www.googleapis.com/customsearch/v1?key=K&cx=C&q=%s&start=%start%',
    { q: 'nuxt', page: 2, pageSize: 10, language: 'zh-CN' }
  )
  assert.equal(cse, 'https://www.googleapis.com/customsearch/v1?key=K&cx=C&q=nuxt&start=11')

  const templated = buildGoogleRelayUrl(
    'https://relay.example.com/search?q=%s&pageno=%pageno%&lang=%lang%',
    { q: 'nuxt', page: 2, pageSize: 10, language: 'en' }
  )
  assert.equal(templated, 'https://relay.example.com/search?q=nuxt&pageno=2&lang=en')
})

test('isHttpRelay 只接受无凭据的 https 地址', () => {
  assert.equal(isHttpRelay('https://searx.example.com'), true)
  assert.equal(isHttpRelay('https://searx.example.com/search?q=%s'), true)
  assert.equal(isHttpRelay('http://searx.example.com'), false)
  assert.equal(isHttpRelay('https://user:pass@searx.example.com'), false)
  assert.equal(isHttpRelay('https://searx.example.com/#hash'), false)
})
