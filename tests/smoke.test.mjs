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
  assert.equal(data.db, true)
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
