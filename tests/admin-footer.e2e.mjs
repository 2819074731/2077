import test from 'node:test'
import assert from 'node:assert/strict'

const base = (process.env.BASE_URL || 'https://my2077.com').replace(/\/+$/, '')
const sid = process.env.ADMIN_SID || ''
const cookie = `sid=${sid}`
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const TEST_LINKS = [
  { label: 'E2E 目录', url: '/site' },
  { label: 'E2E 外链', url: 'https://example.com/' }
]

async function adminSettings() {
  const res = await fetch(base + '/api/admin/site-settings', {
    headers: { cookie },
    redirect: 'manual'
  })
  assert.equal(res.status, 200)
  return await res.json()
}

async function saveFooterLinks(footerLinks, withAuth = true) {
  return await fetch(base + '/api/admin/site-settings', {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      ...(withAuth ? { cookie } : {})
    },
    body: JSON.stringify({ ...TEST_BASE, footerLinks })
  })
}

async function publicFooterLinks() {
  const res = await fetch(base + '/api/site/settings')
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.ok(Array.isArray(data.footerLinks))
  return data.footerLinks
}

async function waitForFooterLinks(expected, timeout = 20000) {
  const target = JSON.stringify(expected)
  const deadline = Date.now() + timeout
  let last = null
  while (Date.now() < deadline) {
    last = await publicFooterLinks()
    if (JSON.stringify(last) === target) return last
    await sleep(500)
  }
  assert.equal(JSON.stringify(last), target, '等待公开接口同步页脚导航超时')
}

let TEST_BASE = null

test('管理员页脚配置端到端', { skip: !sid && '未设置 ADMIN_SID，跳过需要管理员会话的端到端测试' }, async (t) => {
  const original = await adminSettings()
  TEST_BASE = original
  const originalLinks = original.footerLinks
  assert.ok(Array.isArray(originalLinks))

  try {
    await t.test('未登录保存被拒绝', async () => {
      const res = await saveFooterLinks(TEST_LINKS, false)
      assert.equal(res.status, 401)
    })

    await t.test('非法链接与超量入口被拒绝', async () => {
      const bad = await saveFooterLinks([{ label: '脚本', url: 'javascript:alert(1)' }])
      assert.equal(bad.status, 400)

      const many = await saveFooterLinks(
        Array.from({ length: 9 }, (_, i) => ({ label: `入口${i}`, url: `/p${i}` }))
      )
      assert.equal(many.status, 400)
    })

    await t.test('保存后公开接口与首页同步渲染', async () => {
      const saved = await saveFooterLinks(TEST_LINKS)
      assert.equal(saved.status, 200)
      await waitForFooterLinks(TEST_LINKS)

      const res = await fetch(base + '/?e2e=' + Date.now())
      assert.equal(res.status, 200)
      const html = await res.text()
      for (const link of TEST_LINKS) assert.ok(html.includes(link.label), link.label)
      assert.match(html, /href="https:\/\/example\.com\/"/)
    })
  } finally {
    if (TEST_BASE) {
      const res = await saveFooterLinks(originalLinks)
      if (res.ok) await waitForFooterLinks(originalLinks).catch(() => {})
    }
  }
})
