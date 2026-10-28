<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

definePageMeta({ layout: 'admin', middleware: 'admin' })

const days = ref(14)
const data = ref<any>(null)
const loading = ref(true)
const error = ref('')

useSeoMeta({ title: '流量与蜘蛛 · 2077 管理后台', robots: 'noindex' })

async function load() {
  loading.value = true
  error.value = ''
  try {
    data.value = await $fetch(`/api/admin/traffic?days=${days.value}`)
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.data?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function setDays(n: number) {
  days.value = n
  load()
}

onMounted(load)

const summary = computed(() => data.value?.summary || { today: {}, total: {}, clicks: {}, realtime: {}, search: {} })
const daily = computed<any[]>(() => data.value?.daily || [])
const tops = computed<any[]>(() => data.value?.topPages || [])
const maxTop = computed(() => Math.max(1, ...tops.value.map(t => Number(t.pv) || 0)))
const referers = computed<any[]>(() => data.value?.referers || [])
const devices = computed<any[]>(() => data.value?.devices || [])
const maxDevice = computed(() => Math.max(1, ...devices.value.map(d => Number(d.n) || 0)))
const bots = computed<any[]>(() => data.value?.bots || [])
const botPaths = computed<any[]>(() => data.value?.botPaths || [])
const recentBots = computed<any[]>(() => data.value?.recentBots || [])
const hourly = computed<any[]>(() => data.value?.hourly || [])
const statuses = computed<any[]>(() => data.value?.statuses || [])
const topClicks = computed<any[]>(() => data.value?.topClicks || [])
const search = computed(() => summary.value.search || {})

const summaryCards = computed(() => [
  { l: '今日访客', v: summary.value.today.uv, total: summary.value.total.uv },
  { l: '今日浏览', v: summary.value.today.pv, total: summary.value.total.pv },
  { l: '今日蜘蛛', v: summary.value.today.bot, total: summary.value.total.bot },
  { l: '今日点击', v: summary.value.clicks.today, total: summary.value.clicks.total }
])

const secondaryCards = computed(() => [
  { l: '近 30 分钟浏览', v: summary.value.realtime?.pv ?? 0, sub: `访客 ${summary.value.realtime?.uv ?? 0}` },
  { l: '近 30 分钟蜘蛛', v: summary.value.realtime?.bot ?? 0, sub: '抓取请求' },
  { l: '搜索次数', v: search.value.searches ?? 0, sub: `零结果率 ${search.value.zeroRate ?? 0}%` },
  { l: '站内搜索点击率', v: `${search.value.ctr ?? 0}%`, sub: `点击 ${search.value.siteClicks ?? 0} 次` }
])

const maxHour = computed(() => Math.max(1, ...hourly.value.map((h) => Math.max(Number(h.pv) || 0, Number(h.bot) || 0))))
const maxStatus = computed(() => Math.max(1, ...statuses.value.map((s) => Number(s.n) || 0)))

const chart = computed(() => {
  const rows = daily.value
  const width = 720
  const height = 228
  const pad = { l: 46, r: 16, t: 16, b: 28 }
  const plotW = width - pad.l - pad.r
  const plotH = height - pad.t - pad.b
  const values = rows.flatMap((d) => [Number(d.pv) || 0, Number(d.bot) || 0, Number(d.clicks) || 0])
  const rawMax = Math.max(1, ...values)
  const mag = 10 ** Math.floor(Math.log10(rawMax))
  const norm = rawMax / mag
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10
  const max = nice * mag
  const x = (i: number) => (rows.length <= 1 ? pad.l + plotW / 2 : pad.l + (i / (rows.length - 1)) * plotW)
  const y = (v: number) => pad.t + plotH * (1 - (Number(v) || 0) / max)
  const line = (key: string) => rows.map((d, i) => `${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(' ')
  const series = [
    { key: 'pv', label: '浏览', cls: 'text-ink', points: line('pv') },
    { key: 'bot', label: '蜘蛛', cls: 'text-accent', points: line('bot') },
    { key: 'clicks', label: '点击', cls: 'text-warning', points: line('clicks') }
  ]
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((r) => ({
    y: pad.t + plotH * (1 - r),
    label: fmtAxis(Math.round(max * r))
  }))
  const wanted = rows.length <= 7 ? rows.map((_, i) => i) : [0, 0.25, 0.5, 0.75, 1].map((r) => Math.round((rows.length - 1) * r))
  const xLabels = [...new Set(wanted)].map((i) => ({ x: x(i), text: String(rows[i]?.d || '').slice(5) }))
  return { width, height, pad, plotW, x, y, series, ticks, xLabels, showDots: rows.length <= 14, empty: !rows.length || rawMax <= 1 && values.every((v) => v === 0) }
})

function fmtAxis(v: number) {
  if (v >= 10000) return `${(v / 10000).toFixed(v % 10000 ? 1 : 0)}w`
  return String(v)
}

function pct(v: number, max: number) {
  return Math.max(2, Math.round((Number(v) || 0) / max * 100)) + '%'
}

function bar(v: number, max: number) {
  return Math.min(100, Math.max(0, Math.round((Number(v) || 0) / max * 100))) + '%'
}

function deviceLabel(d: string) {
  return d === 'mobile' ? '手机' : d === 'desktop' ? '桌面' : d || '未知'
}

function statusLabel(code: number) {
  if (code === 404) return '未找到'
  if (code === 403) return '禁止访问'
  if (code === 410) return '已删除'
  if (code === 429) return '限流'
  if (code >= 500) return '服务端错误'
  return '客户端错误'
}

function fmtTime(v: string) {
  try {
    const d = new Date(v)
    const p = (n: number) => String(n).padStart(2, '0')
    return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
  } catch { return '' }
}
</script>

<template>
  <div class="animate-fade-up">
    <div class="flex flex-wrap items-center gap-2 mb-4">
      <div class="flex gap-1 p-1 rounded-xl bg-card2 border border-line">
        <button
          v-for="n in [7, 14, 30, 90]"
          :key="n"
          class="h-8 px-3 rounded-lg text-[12.5px] transition-colors"
          :class="days === n ? 'bg-ink text-bg font-medium' : 'text-ink2 hover:text-ink'"
          @click="setDays(n)"
        >近 {{ n }} 天</button>
      </div>
      <button class="btn btn-sm btn-ghost" :disabled="loading" @click="load">刷新</button>
      <NuxtLink to="/admin/search" class="text-[12px] text-ink2 hover:text-ink">搜索分析 →</NuxtLink>
      <span class="text-[12px] text-ink3 ml-auto">统计首页、目录、搜索页与站点详情，已排除接口与后台</span>
    </div>

    <p v-if="error" class="card p-4 text-danger text-[13px] mb-4">{{ error }}</p>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
      <div v-for="c in summaryCards" :key="c.l" class="card p-4">
        <div class="text-ink2 text-[12px]">{{ c.l }}</div>
        <div class="flex items-end gap-2 mt-1">
          <span class="text-[24px] font-semibold leading-none">{{ loading ? '—' : (c.v ?? 0) }}</span>
          <span class="text-[11px] text-ink3 mb-0.5">累计 {{ loading ? '—' : (c.total ?? 0) }}</span>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      <div v-for="c in secondaryCards" :key="c.l" class="rounded-xl border border-line bg-card2/50 px-3.5 py-3">
        <div class="text-[11.5px] text-ink2">{{ c.l }}</div>
        <div class="mt-0.5 flex items-baseline gap-1.5">
          <span class="text-[18px] font-semibold leading-none tabular-nums">{{ loading ? '—' : c.v }}</span>
          <span class="text-[11px] text-ink3">{{ c.sub }}</span>
        </div>
      </div>
    </div>

    <section class="card overflow-hidden mb-3">
      <div class="px-4 py-3 border-b border-line flex items-center gap-3 flex-wrap">
        <h2 class="font-semibold text-[14px]">每日趋势</h2>
        <div class="flex items-center gap-3 text-[11.5px] text-ink2">
          <span v-for="s in chart.series" :key="s.key" :class="s.cls">
            <i class="inline-block w-2.5 h-2.5 rounded-sm bg-current align-middle mr-1" />{{ s.label }}
          </span>
        </div>
        <span class="text-[11.5px] text-ink3 ml-auto">悬停查看单日数据</span>
      </div>
      <div v-if="loading" class="p-8 text-center text-ink2 text-[13px]">加载中…</div>
      <div v-else-if="chart.empty" class="p-8 text-center text-ink2 text-[13px]">暂无流量数据</div>
      <div v-else class="p-2 sm:p-4 overflow-x-auto">
        <svg :viewBox="`0 0 ${chart.width} ${chart.height}`" class="w-full h-auto min-w-[560px]" role="img" aria-label="每日浏览、蜘蛛与点击趋势">
          <g class="text-ink3">
            <g v-for="t in chart.ticks" :key="t.y">
              <line :x1="chart.pad.l" :x2="chart.width - chart.pad.r" :y1="t.y" :y2="t.y" stroke="currentColor" stroke-opacity="0.12" stroke-dasharray="3 4" />
              <text :x="chart.pad.l - 8" :y="t.y + 3.5" text-anchor="end" fill="currentColor" class="text-[10px]">{{ t.label }}</text>
            </g>
            <text v-for="l in chart.xLabels" :key="l.text" :x="l.x" :y="chart.height - 8" text-anchor="middle" fill="currentColor" class="text-[10px]">{{ l.text }}</text>
          </g>
          <g v-for="s in chart.series" :key="s.key" :class="s.cls">
            <polyline :points="s.points" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
            <template v-if="chart.showDots">
              <circle v-for="(d, i) in daily" :key="s.key + i" :cx="chart.x(i)" :cy="chart.y(d[s.key])" r="2.5" fill="currentColor" />
            </template>
          </g>
          <g>
            <circle v-for="(d, i) in daily" :key="'hit-' + d.d" :cx="chart.x(i)" :cy="chart.y(d.pv)" r="7" fill="transparent">
              <title>{{ d.d }}：浏览 {{ d.pv }} · 访客 {{ d.uv }} · 蜘蛛 {{ d.bot }} · 点击 {{ d.clicks || 0 }}</title>
            </circle>
          </g>
        </svg>
      </div>
    </section>

    <section class="card overflow-hidden mb-3">
      <div class="px-4 py-3 border-b border-line flex items-center gap-3 flex-wrap">
        <h2 class="font-semibold text-[14px]">今日分时</h2>
        <span class="text-[11.5px] text-ink3">按小时统计，蜘蛛单独着色</span>
        <div class="ml-auto flex items-center gap-3 text-[11px] text-ink2">
          <span class="text-ink"><i class="inline-block w-2.5 h-2.5 rounded-sm bg-current align-middle mr-1" />浏览</span>
          <span class="text-accent"><i class="inline-block w-2.5 h-2.5 rounded-sm bg-current align-middle mr-1" />蜘蛛</span>
        </div>
      </div>
      <div v-if="loading" class="p-6 text-center text-ink2 text-[13px]">加载中…</div>
      <div v-else class="p-4">
        <div class="flex h-28 items-end gap-[3px]" role="img" aria-label="今日每小时浏览与蜘蛛">
          <div
            v-for="h in hourly"
            :key="h.h"
            class="group relative flex h-full min-w-0 flex-1 flex-col justify-end"
            :title="`${String(h.h).padStart(2, '0')}:00 浏览 ${h.pv} · 访客 ${h.uv} · 蜘蛛 ${h.bot}`"
          >
            <div class="w-full rounded-t-sm bg-accent/70" :style="{ height: bar(h.bot, maxHour) }" />
            <div class="w-full rounded-b-sm bg-ink" :style="{ height: bar(h.pv, maxHour) }" />
          </div>
        </div>
        <div class="mt-1.5 flex justify-between text-[10px] text-ink3">
          <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
        </div>
      </div>
    </section>

    <div class="grid lg:grid-cols-2 gap-3">
      <details open class="card overflow-hidden group">
        <summary class="flex items-center gap-2 px-4 py-3 cursor-pointer select-none list-none">
          <h2 class="font-semibold text-[14px]">热门页面</h2>
          <span class="text-[11.5px] text-ink3">{{ tops.length }} 条</span>
          <svg class="ml-auto transition-transform group-open:rotate-180" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m6 9 6 6 6-6" /></svg>
        </summary>
        <div v-if="!tops.length" class="p-6 text-center text-ink2 text-[13px]">暂无数据</div>
        <div v-else class="divide-y divide-line border-t border-line">
          <div v-for="t in tops" :key="t.path" class="px-4 py-2.5">
            <div class="flex items-center gap-2">
              <span class="min-w-0 flex-1 text-[12.5px] truncate">{{ t.path }}</span>
              <span class="text-[12px] text-ink2 tabular-nums shrink-0">{{ t.pv }} PV · {{ t.uv }} UV</span>
            </div>
            <div class="h-1.5 rounded-full bg-card2 overflow-hidden mt-1.5">
              <div class="h-full rounded-full bg-ink" :style="{ width: pct(t.pv, maxTop) }" />
            </div>
          </div>
        </div>
      </details>

      <details open class="card overflow-hidden group">
        <summary class="flex items-center gap-2 px-4 py-3 cursor-pointer select-none list-none">
          <h2 class="font-semibold text-[14px]">搜索引擎蜘蛛</h2>
          <span class="text-[11.5px] text-ink3">{{ bots.length }} 种</span>
          <svg class="ml-auto transition-transform group-open:rotate-180" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m6 9 6 6 6-6" /></svg>
        </summary>
        <div v-if="!bots.length" class="p-6 text-center text-ink2 text-[13px]">暂无蜘蛛访问</div>
        <div v-else class="divide-y divide-line border-t border-line">
          <div v-for="b in bots" :key="b.bot" class="flex items-center gap-2 px-4 py-2.5">
            <span class="min-w-0 flex-1 text-[13px] font-medium truncate">{{ b.bot }}</span>
            <span class="text-[11.5px] text-ink3 shrink-0">{{ b.ips }} IP</span>
            <span class="text-[12px] text-ink2 tabular-nums shrink-0 w-[52px] text-right">{{ b.hits }} 次</span>
          </div>
        </div>
      </details>

      <details class="card overflow-hidden group">
        <summary class="flex items-center gap-2 px-4 py-3 cursor-pointer select-none list-none">
          <h2 class="font-semibold text-[14px]">来源域名</h2>
          <span class="text-[11.5px] text-ink3">{{ referers.length }} 个</span>
          <svg class="ml-auto transition-transform group-open:rotate-180" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m6 9 6 6 6-6" /></svg>
        </summary>
        <div v-if="!referers.length" class="p-6 text-center text-ink2 text-[13px]">暂无外部来源</div>
        <div v-else class="divide-y divide-line border-t border-line max-h-[320px] overflow-y-auto">
          <div v-for="r in referers" :key="r.referer" class="flex items-center gap-2 px-4 py-2.5">
            <span class="min-w-0 flex-1 text-[12.5px] truncate">{{ r.referer }}</span>
            <span class="text-[12px] text-ink2 tabular-nums shrink-0">{{ r.n }}</span>
          </div>
        </div>
      </details>

      <details class="card overflow-hidden group">
        <summary class="flex items-center gap-2 px-4 py-3 cursor-pointer select-none list-none">
          <h2 class="font-semibold text-[14px]">访客设备</h2>
          <span class="text-[11.5px] text-ink3">{{ devices.length }} 类</span>
          <svg class="ml-auto transition-transform group-open:rotate-180" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m6 9 6 6 6-6" /></svg>
        </summary>
        <div v-if="!devices.length" class="p-6 text-center text-ink2 text-[13px]">暂无数据</div>
        <div v-else class="p-4 flex flex-col gap-3 border-t border-line">
          <div v-for="d in devices" :key="d.device">
            <div class="flex items-center gap-2 text-[12.5px]">
              <span class="flex-1">{{ deviceLabel(d.device) }}</span>
              <span class="text-ink2 tabular-nums">{{ d.n }}</span>
            </div>
            <div class="h-2 rounded-full bg-card2 overflow-hidden mt-1.5">
              <div class="h-full rounded-full bg-ink" :style="{ width: pct(d.n, maxDevice) }" />
            </div>
          </div>
        </div>
      </details>

      <details class="card overflow-hidden group">
        <summary class="flex items-center gap-2 px-4 py-3 cursor-pointer select-none list-none">
          <h2 class="font-semibold text-[14px]">错误状态</h2>
          <span class="text-[11.5px] text-ink3">{{ statuses.length }} 类</span>
          <svg class="ml-auto transition-transform group-open:rotate-180" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m6 9 6 6 6-6" /></svg>
        </summary>
        <div v-if="!statuses.length" class="p-6 text-center text-ink2 text-[13px]">没有 4xx/5xx 访问</div>
        <div v-else class="divide-y divide-line border-t border-line">
          <div v-for="s in statuses" :key="s.status" class="px-4 py-2.5">
            <div class="flex items-center gap-2">
              <span class="text-[12.5px] font-medium tabular-nums">HTTP {{ s.status }}</span>
              <span class="text-[11px] text-ink3">{{ statusLabel(s.status) }}</span>
              <span class="ml-auto text-[12px] text-ink2 tabular-nums">{{ s.n }} 次</span>
            </div>
            <div class="mt-1.5 h-1.5 rounded-full bg-card2 overflow-hidden">
              <div class="h-full rounded-full bg-warning" :style="{ width: pct(s.n, maxStatus) }" />
            </div>
          </div>
        </div>
      </details>

      <details class="card overflow-hidden group">
        <summary class="flex items-center gap-2 px-4 py-3 cursor-pointer select-none list-none">
          <h2 class="font-semibold text-[14px]">搜索概览</h2>
          <span class="text-[11.5px] text-ink3">近 {{ days }} 天</span>
          <NuxtLink to="/admin/search" class="ml-auto text-[11.5px] text-ink2 hover:text-ink">详情 →</NuxtLink>
        </summary>
        <div class="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line p-4 text-[12.5px]">
          <div>
            <div class="text-ink3 text-[11.5px]">搜索次数</div>
            <div class="mt-0.5 text-[16px] font-semibold tabular-nums">{{ search.searches ?? 0 }}</div>
          </div>
          <div>
            <div class="text-ink3 text-[11.5px]">记录结果数</div>
            <div class="mt-0.5 text-[16px] font-semibold tabular-nums">{{ search.tracked ?? 0 }}</div>
          </div>
          <div>
            <div class="text-ink3 text-[11.5px]">零结果</div>
            <div class="mt-0.5 text-[16px] font-semibold tabular-nums">{{ search.zero ?? 0 }}<span class="ml-1 text-[11px] font-normal text-ink3">{{ search.zeroRate ?? 0 }}%</span></div>
          </div>
          <div>
            <div class="text-ink3 text-[11.5px]">站内点击</div>
            <div class="mt-0.5 text-[16px] font-semibold tabular-nums">{{ search.siteClicks ?? 0 }}<span class="ml-1 text-[11px] font-normal text-ink3">{{ search.ctr ?? 0 }}%</span></div>
          </div>
          <div class="col-span-2 flex flex-wrap gap-2 border-t border-line pt-2.5">
            <span class="chip">GitHub {{ search.github ?? 0 }}</span>
            <span class="chip">Google {{ search.google ?? 0 }}</span>
            <span class="chip">全部 {{ search.total ?? 0 }}</span>
          </div>
        </div>
      </details>

      <details class="card overflow-hidden group">
        <summary class="flex items-center gap-2 px-4 py-3 cursor-pointer select-none list-none">
          <h2 class="font-semibold text-[14px]">蜘蛛抓取路径</h2>
          <span class="text-[11.5px] text-ink3">{{ botPaths.length }} 条</span>
          <svg class="ml-auto transition-transform group-open:rotate-180" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m6 9 6 6 6-6" /></svg>
        </summary>
        <div v-if="!botPaths.length" class="p-6 text-center text-ink2 text-[13px]">暂无数据</div>
        <div v-else class="divide-y divide-line border-t border-line max-h-[320px] overflow-y-auto">
          <div v-for="(p, i) in botPaths" :key="i" class="px-4 py-2.5">
            <div class="text-[12.5px] truncate">{{ p.path }}</div>
            <div class="text-[11.5px] text-ink3 mt-0.5">{{ p.bot }} · {{ p.n }} 次</div>
          </div>
        </div>
      </details>

      <details class="card overflow-hidden group">
        <summary class="flex items-center gap-2 px-4 py-3 cursor-pointer select-none list-none">
          <h2 class="font-semibold text-[14px]">最近蜘蛛访问</h2>
          <span class="text-[11.5px] text-ink3">{{ recentBots.length }} 条</span>
          <svg class="ml-auto transition-transform group-open:rotate-180" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m6 9 6 6 6-6" /></svg>
        </summary>
        <div v-if="!recentBots.length" class="p-6 text-center text-ink2 text-[13px]">暂无记录</div>
        <div v-else class="divide-y divide-line border-t border-line max-h-[320px] overflow-y-auto">
          <div v-for="(b, i) in recentBots" :key="i" class="px-4 py-2.5">
            <div class="flex items-center gap-2">
              <span class="text-[12.5px] font-medium">{{ b.bot }}</span>
              <span class="text-[11px] text-ink3">{{ fmtTime(b.created_at) }}</span>
              <span class="text-[11px] text-ink3 ml-auto">HTTP {{ b.status }}</span>
            </div>
            <div class="text-[11.5px] text-ink2 truncate mt-0.5">{{ b.path }}</div>
          </div>
        </div>
      </details>

      <details class="card overflow-hidden group">
        <summary class="flex items-center gap-2 px-4 py-3 cursor-pointer select-none list-none">
          <h2 class="font-semibold text-[14px]">热门点击</h2>
          <span class="text-[11.5px] text-ink3">{{ topClicks.length }} 条</span>
          <NuxtLink to="/admin/clicks" class="ml-auto text-[11.5px] text-ink2 hover:text-ink">详情 →</NuxtLink>
        </summary>
        <div v-if="!topClicks.length" class="p-6 text-center text-ink2 text-[13px]">暂无点击记录</div>
        <div v-else class="divide-y divide-line border-t border-line">
          <div v-for="c in topClicks" :key="c.url" class="flex items-center gap-2 px-4 py-2.5">
            <span class="min-w-0 flex-1 truncate text-[12.5px]">{{ c.name || c.url }}</span>
            <span class="shrink-0 text-[12px] tabular-nums text-ink2">{{ c.hits }} 次</span>
          </div>
        </div>
      </details>
    </div>
  </div>
</template>
