<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

definePageMeta({ layout: 'admin', middleware: 'admin' })

const days = ref(14)
const stats = ref<any>(null)
const sources = ref<any[]>([])
const indexStatus = ref<any>(null)
const indexLoading = ref(true)
const indexRebuilding = ref(false)
const indexMsg = ref('')
const loading = ref(true)
const statusLoading = ref(true)
const refreshing = ref(false)
const error = ref('')

useSeoMeta({ title: '搜索分析 · 2077 管理后台', robots: 'noindex' })

async function loadStats() {
  loading.value = true
  error.value = ''
  try {
    stats.value = await $fetch(`/api/admin/search-stats?days=${days.value}`)
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.data?.message || '搜索统计加载失败'
  } finally {
    loading.value = false
  }
}

async function loadSources() {
  statusLoading.value = true
  try {
    const data: any = await $fetch('/api/admin/hot-search-status')
    sources.value = data?.engines || []
  } catch {
    sources.value = []
  } finally {
    statusLoading.value = false
  }
}

function setDays(n: number) {
  days.value = n
  loadStats()
}

async function refreshAll() {
  if (refreshing.value) return
  refreshing.value = true
  try {
    await Promise.allSettled(
      sources.value.filter(s => s.provider).map(s =>
        $fetch('/api/admin/hot-search-refresh', { method: 'POST', body: { engine: s.engine } })
      )
    )
    await loadSources()
  } finally {
    refreshing.value = false
  }
}

async function loadIndex() {
  indexLoading.value = true
  try {
    const data: any = await $fetch('/api/admin/search-index')
    indexStatus.value = data?.status || null
  } catch {
    indexStatus.value = null
  } finally {
    indexLoading.value = false
  }
}

async function rebuildIndex() {
  if (indexRebuilding.value) return
  indexRebuilding.value = true
  indexMsg.value = ''
  try {
    const data: any = await $fetch('/api/admin/search-index', { method: 'POST', body: { action: 'rebuild' } })
    indexStatus.value = data?.status || indexStatus.value
    indexMsg.value = '索引已重建'
  } catch (e: any) {
    indexMsg.value = e?.data?.statusMessage || e?.data?.message || '索引重建失败'
  } finally {
    indexRebuilding.value = false
    setTimeout(() => { if (indexMsg.value === '索引已重建') indexMsg.value = '' }, 2200)
  }
}

onMounted(() => {
  loadStats()
  loadSources()
  loadIndex()
})

const summary = computed(() => stats.value?.summary || { total: 0, today: 0, tracked: 0, zero: 0, site: 0, siteClicks: 0, ctr: 0, avgTook: 0, p95Took: 0, maxTook: 0 })
const zeroRate = computed(() => summary.value.tracked ? Math.round(summary.value.zero / summary.value.tracked * 100) : 0)
const engines = computed<any[]>(() => stats.value?.engines || [])
const terms = computed<any[]>(() => stats.value?.terms || [])
const daily = computed<any[]>(() => stats.value?.daily || [])
const zeroTerms = computed<any[]>(() => stats.value?.zeroTerms || [])
const kinds = computed<any[]>(() => stats.value?.kinds || [])
const maxEngine = computed(() => Math.max(1, ...engines.value.map(e => Number(e.n) || 0)))
const maxTerm = computed(() => Math.max(1, ...terms.value.map(t => Number(t.n) || 0)))
const maxDaily = computed(() => Math.max(1, ...daily.value.map(d => Number(d.n) || 0)))
const hotCount = computed(() => Number(kinds.value.find(k => k.kind === 'hot')?.n || 0))
const inputCount = computed(() => Number(kinds.value.find(k => k.kind === 'input')?.n || 0))
const hotRate = computed(() => {
  const total = hotCount.value + inputCount.value
  return total ? Math.round(hotCount.value / total * 100) : 0
})
const nameMap = computed(() => new Map(sources.value.map(s => [s.engine, s.name])))
const specialEngines = new Map([['site', '站内搜索']])

function engineName(id: string) {
  return specialEngines.get(id) || nameMap.value.get(id) || id
}

function pct(v: number, max: number) {
  return Math.max(2, Math.round((Number(v) || 0) / max * 100)) + '%'
}

function ago(checkedAt: number | null) {
  if (!checkedAt) return '尚未抓取'
  const sec = Math.max(0, Math.round((Date.now() - checkedAt) / 1000))
  if (sec < 60) return `${sec} 秒前`
  if (sec < 3600) return `${Math.floor(sec / 60)} 分钟前`
  if (sec < 86400) return `${Math.floor(sec / 3600)} 小时前`
  return `${Math.floor(sec / 86400)} 天前`
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
      <button class="btn btn-sm btn-ghost" :disabled="loading" @click="loadStats">刷新统计</button>
      <span class="text-[12px] text-ink3 ml-auto">搜索事件匿名统计，保留 180 天</span>
    </div>

    <p v-if="error" class="card p-4 text-danger text-[13px] mb-4">{{ error }}</p>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      <div class="card p-4">
        <div class="text-ink2 text-[12px]">搜索次数</div>
        <div class="text-[24px] font-semibold leading-none mt-1">{{ loading ? '—' : summary.total }}</div>
      </div>
      <div class="card p-4">
        <div class="text-ink2 text-[12px]">今日搜索</div>
        <div class="text-[24px] font-semibold leading-none mt-1">{{ loading ? '—' : summary.today }}</div>
      </div>
      <div class="card p-4">
        <div class="text-ink2 text-[12px]">热搜词点击占比</div>
        <div class="text-[24px] font-semibold leading-none mt-1">{{ loading ? '—' : hotRate + '%' }}</div>
      </div>
      <div class="card p-4">
        <div class="text-ink2 text-[12px]">手动输入</div>
        <div class="text-[24px] font-semibold leading-none mt-1">{{ loading ? '—' : inputCount }}</div>
      </div>
    </div>

    <div class="card px-4 py-3 mb-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px] text-ink2">
      <span>站内搜索 <b class="text-ink">{{ loading ? '—' : summary.site }}</b> 次</span>
      <span>结果点击 <b class="text-ink">{{ loading ? '—' : summary.siteClicks }}</b> 次</span>
      <span>点击率 <b class="text-ink">{{ loading ? '—' : summary.ctr + '%' }}</b></span>
      <span>平均耗时 <b class="text-ink">{{ loading ? '—' : summary.avgTook + ' ms' }}</b></span>
      <span>P95 <b class="text-ink">{{ loading ? '—' : summary.p95Took + ' ms' }}</b></span>
      <span>峰值 <b class="text-ink">{{ loading ? '—' : summary.maxTook + ' ms' }}</b></span>
    </div>

    <section class="card overflow-hidden mb-3">
      <div class="px-4 py-3 border-b border-line flex items-center gap-2 flex-wrap">
        <h2 class="font-semibold text-[14px]">站内搜索索引</h2>
        <span class="text-[11.5px] text-ink3">{{ indexStatus?.engine || 'MariaDB LIKE + pinyin-pro' }}</span>
        <span v-if="indexMsg" class="text-[11.5px] text-ink3">{{ indexMsg }}</span>
        <button class="btn btn-sm btn-ghost ml-auto" :disabled="indexLoading || indexRebuilding" @click="rebuildIndex">
          {{ indexRebuilding ? '重建中…' : '全量重建' }}
        </button>
      </div>
      <div v-if="indexLoading" class="p-5 text-center text-ink2 text-[13px]">加载中…</div>
      <div v-else-if="!indexStatus" class="p-5 text-center text-ink2 text-[13px]">索引状态不可用</div>
      <div v-else class="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-[12px]">
        <div class="rounded-xl border border-line bg-card2/60 p-3">
          <div class="text-ink3">目录文档</div>
          <div class="mt-1 text-[17px] font-semibold leading-none">{{ indexStatus.directory }}</div>
        </div>
        <div class="rounded-xl border border-line bg-card2/60 p-3">
          <div class="text-ink3">公开收藏</div>
          <div class="mt-1 text-[17px] font-semibold leading-none">{{ indexStatus.links }}</div>
        </div>
        <div class="rounded-xl border border-line bg-card2/60 p-3">
          <div class="text-ink3">拼音别名</div>
          <div class="mt-1 text-[17px] font-semibold leading-none">{{ indexStatus.aliases }}</div>
        </div>
        <div class="rounded-xl border border-line bg-card2/60 p-3">
          <div class="text-ink3">构建耗时</div>
          <div class="mt-1 text-[17px] font-semibold leading-none">{{ indexStatus.durationMs }} ms</div>
        </div>
        <div class="rounded-xl border border-line bg-card2/60 p-3">
          <div class="text-ink3">构建时间</div>
          <div class="mt-1 text-[13px] font-medium leading-tight">{{ ago(indexStatus.builtAt) }}</div>
        </div>
      </div>
      <p class="px-4 pb-3 text-[11px] text-ink3">目录变更会自动失效并重建；多实例下最长约 15 秒同步。公开收藏实时查询，无需重建。</p>
    </section>

    <section class="card overflow-hidden mb-3">
      <div class="px-4 py-3 border-b border-line flex items-center gap-2 flex-wrap">
        <h2 class="font-semibold text-[14px]">每日搜索</h2>
        <span class="text-[11.5px] text-ink3">近 {{ days }} 天共 {{ summary.total }} 次</span>
        <span class="ml-auto inline-flex items-center gap-2 text-[11px] text-ink3">
          <span class="inline-flex items-center gap-1"><i class="w-2 h-2 rounded-sm bg-ink/70" />有搜索</span>
          <span class="inline-flex items-center gap-1"><i class="w-2 h-2 rounded-sm bg-line" />无搜索</span>
        </span>
      </div>
      <div v-if="loading" class="p-8 text-center text-ink2 text-[13px]">加载中…</div>
      <div v-else-if="!summary.total" class="p-8 text-center text-ink2 text-[13px]">暂无搜索数据，前台产生搜索后自动统计</div>
      <div v-else class="p-4">
        <div class="flex items-center gap-2 text-[11.5px] text-ink2 mb-2">
          <span class="font-medium text-ink">今日 {{ summary.today }} 次</span>
          <span class="text-ink3">峰值 {{ maxDaily }} 次</span>
        </div>
        <div class="relative h-28 rounded-lg bg-card2/60 overflow-hidden">
          <div class="absolute inset-0 flex flex-col justify-between py-1 pointer-events-none">
            <span v-for="n in 4" :key="n" class="block border-t border-line/70" />
          </div>
          <div class="absolute inset-0 flex items-end px-1.5 pb-1.5" :class="daily.length > 30 ? 'gap-px' : 'gap-[3px]'">
            <div
              v-for="d in daily"
              :key="d.d"
              class="flex-1 min-w-0 rounded-t transition-colors"
              :class="Number(d.n) > 0 ? 'bg-ink/70 hover:bg-ink' : 'bg-line'"
              :style="{ height: Number(d.n) > 0 ? Math.max(8, Math.round(Number(d.n) / maxDaily * 100)) + '%' : '3px' }"
              :title="`${d.d}：${d.n} 次`"
            />
          </div>
        </div>
        <div class="flex justify-between text-[10.5px] text-ink3 mt-2">
          <span>{{ daily[0]?.d }}</span>
          <span>{{ daily[daily.length - 1]?.d }}</span>
        </div>
      </div>
    </section>

    <div class="grid lg:grid-cols-2 gap-3 mb-3">
      <section class="card overflow-hidden">
        <div class="px-4 py-3 border-b border-line flex items-center gap-2">
          <h2 class="font-semibold text-[14px]">搜索引擎分布</h2>
          <span class="text-[11.5px] text-ink3">{{ engines.length }} 个</span>
        </div>
        <div v-if="loading" class="p-6 text-center text-ink2 text-[13px]">加载中…</div>
        <div v-else-if="!engines.length" class="p-6 text-center text-ink2 text-[13px]">暂无数据</div>
        <div v-else class="divide-y divide-line">
          <div v-for="e in engines" :key="e.engine" class="px-4 py-2.5">
            <div class="flex items-center gap-2">
              <span class="min-w-0 flex-1 text-[12.5px] truncate">{{ engineName(e.engine) }}</span>
              <span class="text-[12px] text-ink2 tabular-nums shrink-0">{{ e.n }}</span>
            </div>
            <div class="h-1.5 rounded-full bg-card2 overflow-hidden mt-1.5">
              <div class="h-full rounded-full bg-ink" :style="{ width: pct(e.n, maxEngine) }" />
            </div>
          </div>
        </div>
      </section>

      <section class="card overflow-hidden">
        <div class="px-4 py-3 border-b border-line flex items-center gap-2">
          <h2 class="font-semibold text-[14px]">热门搜索词</h2>
          <span class="text-[11.5px] text-ink3">Top {{ terms.length }}</span>
        </div>
        <div v-if="loading" class="p-6 text-center text-ink2 text-[13px]">加载中…</div>
        <div v-else-if="!terms.length" class="p-6 text-center text-ink2 text-[13px]">暂无数据</div>
        <div v-else class="divide-y divide-line max-h-[360px] overflow-y-auto">
          <div v-for="t in terms" :key="t.term" class="px-4 py-2.5">
            <div class="flex items-center gap-2">
              <span class="min-w-0 flex-1 text-[12.5px] truncate">{{ t.term }}</span>
              <span class="text-[12px] text-ink2 tabular-nums shrink-0">{{ t.n }}</span>
            </div>
            <div class="h-1.5 rounded-full bg-card2 overflow-hidden mt-1.5">
              <div class="h-full rounded-full bg-accent" :style="{ width: pct(t.n, maxTerm) }" />
            </div>
          </div>
        </div>
      </section>
    </div>

    <section class="card overflow-hidden mb-3">
      <div class="px-4 py-3 border-b border-line flex items-center gap-2 flex-wrap">
        <h2 class="font-semibold text-[14px]">无结果搜索词</h2>
        <span class="text-[11.5px] text-ink3">
          已记录 {{ summary.tracked }} 次站内搜索，其中 {{ summary.zero }} 次无结果（{{ zeroRate }}%）
        </span>
      </div>
      <div v-if="loading" class="p-6 text-center text-ink2 text-[13px]">加载中…</div>
      <div v-else-if="!zeroTerms.length" class="p-6 text-center text-ink2 text-[13px]">
        暂无无结果搜索，或统计尚未产生
      </div>
      <div v-else class="divide-y divide-line max-h-[300px] overflow-y-auto">
        <div v-for="t in zeroTerms" :key="t.term" class="px-4 py-2.5 flex items-center gap-2">
          <span class="min-w-0 flex-1 text-[12.5px] truncate">{{ t.term }}</span>
          <span class="text-[12px] text-ink2 tabular-nums shrink-0">{{ t.n }} 次</span>
          <a
            :href="`/github?q=${encodeURIComponent(t.term)}`"
            target="_blank"
            rel="noopener"
            class="text-[11.5px] text-ink3 hover:text-ink shrink-0"
          >去搜索</a>
        </div>
      </div>
      <p class="px-4 py-2.5 text-[11px] text-ink3 border-t border-line">
        统计站内搜索与 GitHub 搜索的首次结果；命中 0 条时记录，可用于补充内容或同义词。
      </p>
    </section>

    <section class="card overflow-hidden">
      <div class="px-4 py-3 border-b border-line flex items-center gap-2 flex-wrap">
        <h2 class="font-semibold text-[14px]">热搜源状态</h2>
        <span class="text-[11.5px] text-ink3">进程内缓存 10 分钟</span>
        <button class="btn btn-sm btn-ghost ml-auto" :disabled="refreshing || statusLoading" @click="refreshAll">
          {{ refreshing ? '抓取中…' : '刷新抓取' }}
        </button>
      </div>
      <div v-if="statusLoading" class="p-6 text-center text-ink2 text-[13px]">加载中…</div>
      <div v-else class="divide-y divide-line">
        <div v-for="s in sources" :key="s.engine" class="px-4 py-2.5 flex items-center gap-2 flex-wrap">
          <span class="text-[13px] font-medium w-24 shrink-0">{{ s.name }}</span>
          <span
            class="inline-flex items-center h-[20px] px-2 rounded-md text-[10.5px] shrink-0"
            :class="s.live ? 'bg-card2 text-ink' : 'bg-card2 text-ink3'"
          >
            <i class="w-1.5 h-1.5 rounded-full mr-1.5" :class="s.live ? 'bg-success' : 'bg-ink3'" />
            {{ s.live ? '实时' : (s.provider ? '兜底' : '内置') }}
          </span>
          <span class="text-[11.5px] text-ink3">{{ s.items }} 条</span>
          <span class="text-[11.5px] text-ink3">{{ ago(s.checkedAt) }}</span>
          <span v-if="s.cached" class="text-[10.5px] text-ink3">缓存中</span>
          <span v-if="s.error" class="text-[11px] text-warning truncate max-w-full sm:max-w-[40%] sm:ml-auto" :title="s.error">{{ s.error }}</span>
        </div>
      </div>
    </section>
  </div>
</template>
