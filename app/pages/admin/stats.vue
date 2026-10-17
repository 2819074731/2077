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

const summary = computed(() => data.value?.summary || { today: {}, total: {}, clicks: {} })
const daily = computed<any[]>(() => data.value?.daily || [])
const maxDaily = computed(() => Math.max(1, ...daily.value.map(d => Math.max(d.pv || 0, d.bot || 0))))
const tops = computed<any[]>(() => data.value?.topPages || [])
const maxTop = computed(() => Math.max(1, ...tops.value.map(t => Number(t.pv) || 0)))
const referers = computed<any[]>(() => data.value?.referers || [])
const devices = computed<any[]>(() => data.value?.devices || [])
const maxDevice = computed(() => Math.max(1, ...devices.value.map(d => Number(d.n) || 0)))
const bots = computed<any[]>(() => data.value?.bots || [])
const botPaths = computed<any[]>(() => data.value?.botPaths || [])
const recentBots = computed<any[]>(() => data.value?.recentBots || [])

function pct(v: number, max: number) {
  return Math.max(2, Math.round((Number(v) || 0) / max * 100)) + '%'
}

function deviceLabel(d: string) {
  return d === 'mobile' ? '手机' : d === 'desktop' ? '桌面' : d || '未知'
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
      <span class="text-[12px] text-ink3 ml-auto">蜘蛛与访客均按页面访问统计</span>
    </div>

    <p v-if="error" class="card p-4 text-danger text-[13px] mb-4">{{ error }}</p>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      <div v-for="c in [
        { l: '今日访客', v: summary.today.uv },
        { l: '今日浏览', v: summary.today.pv },
        { l: '今日蜘蛛', v: summary.today.bot },
        { l: '今日点击', v: summary.clicks.today }
      ]" :key="c.l" class="card p-4">
        <div class="text-ink2 text-[12px]">{{ c.l }}</div>
        <div class="text-[24px] font-semibold mt-1">{{ loading ? '—' : (c.v ?? 0) }}</div>
      </div>
    </div>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      <div v-for="c in [
        { l: '累计访客', v: summary.total.uv },
        { l: '累计浏览', v: summary.total.pv },
        { l: '累计蜘蛛', v: summary.total.bot },
        { l: '累计点击', v: summary.clicks.total }
      ]" :key="c.l" class="card p-3.5">
        <div class="text-ink2 text-[11.5px]">{{ c.l }}</div>
        <div class="text-[18px] font-semibold mt-0.5">{{ loading ? '—' : (c.v ?? 0) }}</div>
      </div>
    </div>

    <section class="card overflow-hidden mb-5">
      <div class="px-4 py-3 border-b border-line flex items-center gap-2 flex-wrap">
        <h2 class="font-semibold text-[14px]">每日趋势</h2>
        <span class="text-[11.5px] text-ink3">访客 / 蜘蛛 / 点击</span>
        <div class="flex items-center gap-3 ml-auto text-[11.5px] text-ink2">
          <span><i class="inline-block w-2.5 h-2.5 rounded-sm bg-ink align-middle mr-1" />浏览</span>
          <span><i class="inline-block w-2.5 h-2.5 rounded-sm bg-accent align-middle mr-1" />蜘蛛</span>
        </div>
      </div>
      <div v-if="loading" class="p-6 text-center text-ink2 text-[13px]">加载中…</div>
      <div v-else class="p-3 sm:p-4">
        <div class="flex flex-col gap-2">
          <div v-for="d in daily" :key="d.d" class="flex items-center gap-2 text-[11.5px]">
            <span class="w-[68px] shrink-0 text-ink3 tabular-nums">{{ d.d.slice(5) }}</span>
            <div class="flex-1 min-w-0 flex flex-col gap-1">
              <div class="h-2 rounded-full bg-card2 overflow-hidden">
                <div class="h-full rounded-full bg-ink" :style="{ width: pct(d.pv, maxDaily) }" />
              </div>
              <div class="h-2 rounded-full bg-card2 overflow-hidden">
                <div class="h-full rounded-full bg-accent" :style="{ width: pct(d.bot, maxDaily) }" />
              </div>
            </div>
            <span class="w-[92px] shrink-0 text-right text-ink2 tabular-nums">
              {{ d.pv }} / {{ d.bot }} / {{ d.clicks || 0 }}
            </span>
          </div>
        </div>
        <p class="text-[11px] text-ink3 mt-3">右侧依次为：浏览 / 蜘蛛 / 点击</p>
      </div>
    </section>

    <div class="grid lg:grid-cols-2 gap-4">
      <section class="card overflow-hidden">
        <div class="px-4 py-3 border-b border-line"><h2 class="font-semibold text-[14px]">热门页面（访客）</h2></div>
        <div v-if="!tops.length" class="p-6 text-center text-ink2 text-[13px]">暂无数据</div>
        <div v-else class="divide-y divide-line">
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
      </section>

      <section class="card overflow-hidden">
        <div class="px-4 py-3 border-b border-line"><h2 class="font-semibold text-[14px]">搜索引擎蜘蛛</h2></div>
        <div v-if="!bots.length" class="p-6 text-center text-ink2 text-[13px]">暂无蜘蛛访问</div>
        <div v-else class="divide-y divide-line">
          <div v-for="b in bots" :key="b.bot" class="flex items-center gap-2 px-4 py-2.5">
            <span class="min-w-0 flex-1 text-[13px] font-medium truncate">{{ b.bot }}</span>
            <span class="text-[11.5px] text-ink3 shrink-0">{{ b.ips }} IP</span>
            <span class="text-[12px] text-ink2 tabular-nums shrink-0 w-[52px] text-right">{{ b.hits }} 次</span>
          </div>
        </div>
      </section>

      <section class="card overflow-hidden">
        <div class="px-4 py-3 border-b border-line"><h2 class="font-semibold text-[14px]">来源域名</h2></div>
        <div v-if="!referers.length" class="p-6 text-center text-ink2 text-[13px]">暂无外部来源</div>
        <div v-else class="divide-y divide-line">
          <div v-for="r in referers" :key="r.referer" class="flex items-center gap-2 px-4 py-2.5">
            <span class="min-w-0 flex-1 text-[12.5px] truncate">{{ r.referer }}</span>
            <span class="text-[12px] text-ink2 tabular-nums shrink-0">{{ r.n }}</span>
          </div>
        </div>
      </section>

      <section class="card overflow-hidden">
        <div class="px-4 py-3 border-b border-line"><h2 class="font-semibold text-[14px]">访客设备</h2></div>
        <div v-if="!devices.length" class="p-6 text-center text-ink2 text-[13px]">暂无数据</div>
        <div v-else class="p-4 flex flex-col gap-3">
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
      </section>

      <section class="card overflow-hidden">
        <div class="px-4 py-3 border-b border-line"><h2 class="font-semibold text-[14px]">蜘蛛抓取路径</h2></div>
        <div v-if="!botPaths.length" class="p-6 text-center text-ink2 text-[13px]">暂无数据</div>
        <div v-else class="divide-y divide-line max-h-[360px] overflow-y-auto">
          <div v-for="(p, i) in botPaths" :key="i" class="px-4 py-2.5">
            <div class="text-[12.5px] truncate">{{ p.path }}</div>
            <div class="text-[11.5px] text-ink3 mt-0.5">{{ p.bot }} · {{ p.n }} 次</div>
          </div>
        </div>
      </section>

      <section class="card overflow-hidden">
        <div class="px-4 py-3 border-b border-line"><h2 class="font-semibold text-[14px]">最近蜘蛛访问</h2></div>
        <div v-if="!recentBots.length" class="p-6 text-center text-ink2 text-[13px]">暂无记录</div>
        <div v-else class="divide-y divide-line max-h-[360px] overflow-y-auto">
          <div v-for="(b, i) in recentBots" :key="i" class="px-4 py-2.5">
            <div class="flex items-center gap-2">
              <span class="text-[12.5px] font-medium">{{ b.bot }}</span>
              <span class="text-[11px] text-ink3">{{ fmtTime(b.created_at) }}</span>
              <span class="text-[11px] text-ink3 ml-auto">HTTP {{ b.status }}</span>
            </div>
            <div class="text-[11.5px] text-ink2 truncate mt-0.5">{{ b.path }}</div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
