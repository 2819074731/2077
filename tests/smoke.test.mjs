import test from 'node:test'
import assert from 'node:assert/strict'

const base = (process.env.BASE_URL || 'https://my2077.com').replace(/\/+$/, '')

async function get(path) {
  const res = await fetch(base + path, { redirect: 'manual' })
  return res
}

test('首页可访问', async () => {
  const res = await get('/')
  assert.equal(res.status, 200)
  assert.match(await res.text(), /2077/)
})

test('目录与站点地图可访问', async () => {
  for (const path of ['/site', '/sitemap.xml', '/llms.txt', '/offline']) {
    const res = await get(path)
    assert.equal(res.status, 200, path)
  }
})

test('公开配置接口返回分组', async () => {
  const res = await get('/api/site')
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.ok(Array.isArray(data.groups))
})

test('站点设置接口可用', async () => {
  const res = await get('/api/site/settings')
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.equal(typeof data.siteName, 'string')
  assert.ok(data.siteName.length > 0)
  assert.ok(['nav', 'directory'].includes(data.submitDefaultTarget))
  assert.equal(typeof data.directoryPageSize, 'number')
})

test('分类接口可用', async () => {
  const res = await get('/api/categories')
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.ok(Array.isArray(data.categories))
})

test('分类已完成去重整理', async () => {
  const res = await get('/api/categories')
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.ok(data.categories.includes('资讯阅读'))
  assert.ok(data.categories.includes('论坛门户'))
  assert.ok(!data.categories.includes('社区资讯'))
})

test('健康检查正常', async () => {
  const res = await get('/api/health')
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.ok(['ok', 'degraded'].includes(data.status))
  assert.equal(typeof data.time, 'string')
  assert.equal(data.db, undefined)
  assert.equal(data.uptime, undefined)
})

test('提交预检查不落库', async () => {
  const res = await fetch(base + '/api/submit/check', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.com/' })
  })
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.equal(typeof data.exists, 'boolean')
  assert.equal(typeof data.inDirectory, 'boolean')
})

test('提交页与状态页可访问', async () => {
  for (const path of ['/submit', '/submit/status']) {
    const res = await get(path)
    assert.equal(res.status, 200, path)
  }
})

test('安全响应头生效', async () => {
  const res = await get('/')
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(res.headers.get('x-frame-options'), 'DENY')
})

test('版权与许可信息全站可见', async () => {
  const res = await get('/')
  assert.equal(res.status, 200)
  const html = await res.text()
  assert.match(html, /PolyForm Noncommercial License 1\.0\.0/)
  assert.match(html, /data-copyright="/)
  assert.equal(res.headers.get('x-license'), 'PolyForm Noncommercial License 1.0.0')
  assert.match(res.headers.get('link') || '', /rel="license"/)
  const license = await get('/license')
  assert.equal(license.status, 200)
})

test('验证文件已删除', async () => {
  const res = await get('/BingSiteAuth.xml')
  assert.equal(res.status, 404)
})

test('目录热门接口可用', async () => {
  const res = await get('/api/directory/popular?days=7&limit=4')
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.ok(Array.isArray(data.items))
  assert.ok(data.items.length <= 4)
  if (data.items.length) assert.equal(typeof data.items[0].hits, 'number')
})

test('高校分类与导航可用', async () => {
  const [cats, dir, site] = await Promise.all([
    get('/api/categories'),
    get('/api/directory?category=' + encodeURIComponent('高校') + '&size=1'),
    get('/api/site')
  ])
  assert.equal(cats.status, 200)
  assert.ok((await cats.json()).categories.includes('高校'))
  assert.equal(dir.status, 200)
  assert.ok(Number((await dir.json()).total) >= 40)
  assert.equal(site.status, 200)
  const group = (await site.json()).groups.find((g) => g.name === '高校')
  assert.ok(group && group.links.length >= 10)
})

test('热搜接口返回对应引擎词条', async () => {
  for (const engine of ['baidu', 'google', 'github']) {
    const res = await get('/api/hot-search?engine=' + engine)
    assert.equal(res.status, 200, engine)
    const data = await res.json()
    assert.equal(data.engine, engine)
    assert.ok(Array.isArray(data.items))
    assert.ok(data.items.length > 0, engine)
    assert.equal(typeof data.live, 'boolean')
  }
})

test('搜索事件接口可用且忽略网址', async () => {
  const res = await fetch(base + '/api/search/event', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ engine: 'baidu', term: 'https://example.com/', kind: 'input' })
  })
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.equal(data.ok, true)
})

test('搜索分析接口要求管理员权限', async () => {
  for (const path of ['/api/admin/search-stats', '/api/admin/hot-search-status']) {
    const res = await get(path)
    assert.equal(res.status, 401, path)
  }
})
