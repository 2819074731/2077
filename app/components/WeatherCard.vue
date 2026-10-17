<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

const props = defineProps<{ variant?: 'header' | 'panel' }>()

interface WDay { date: string; label: string; icon: string; max: number; min: number }
interface WData {
  place: string
  temp: number
  feels: number
  humidity: number
  wind: number
  label: string
  icon: string
  days: WDay[]
}

const data = ref<WData | null>(null)
const loading = ref(true)
const err = ref('')
const expanded = ref(false)
const editing = ref(false)
const cityInput = ref('')

const LS_CITY = 'my2077.weather.city'
const LS_COORD = 'my2077.weather.coord'
const LS_CACHE = 'my2077.weather.cache'
const CACHE_TTL = 30 * 60 * 1000

interface CacheHit { at: number; data: WData }
const memCache = new Map<string, CacheHit>()
const inflight = new Map<string, Promise<WData>>()

const isHeader = computed(() => props.variant === 'header')

const ICONS: Record<string, string> = {
  sun: 'M12 4V2m0 20v-2m8-8h2M2 12h2m13.7-5.7 1.4-1.4M4.9 19.1l1.4-1.4m11.4 0 1.4 1.4M4.9 4.9l1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  cloud: 'M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.6 1.5A4 4 0 0 0 7 19h10.5Z',
  'sun-cloud': 'M12 3V2m0 6a4 4 0 1 0 0 8M5.6 5.6 5 5m12.4.6L18 5M5 12H4m16 4h1M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.6 1.5A4 4 0 0 0 7 19h10.5Z',
  rain: 'M7 15a4.5 4.5 0 0 1 .3-9 6 6 0 0 1 11.4 2A4 4 0 0 1 17 15H7Zm2 3.5-1 2m5-2-1 2m5-2-1 2',
  snow: 'M8 12h8M12 8v8m-3-1.5 6 3m-6 0 6-3M7 15a4.5 4.5 0 0 1 .3-9 6 6 0 0 1 11.4 2A4 4 0 0 1 17 15',
  storm: 'M7 14a4.5 4.5 0 0 1 .3-9 6 6 0 0 1 11.4 2A4 4.5 4.5 0 0 1 17 14H7Zm5 3-2 4h4l-2 4',
  fog: 'M4 9a4.5 4.5 0 0 1 .3-9M5 14h14M4 18h12'
}

function cacheKeyOf(p: { city?: string; lat?: number; lon?: number } = {}) {
  if (p.city) return 'city:' + p.city.trim().toLowerCase()
  if (p.lat != null && p.lon != null) return `coord:${p.lat.toFixed(2)},${p.lon.toFixed(2)}`
  return 'auto'
}

function readCache(key: string): CacheHit | null {
  const mem = memCache.get(key)
  if (mem) return mem
  try {
    const raw = localStorage.getItem(LS_CACHE)
    if (!raw) return null
    const o = JSON.parse(raw)
    if (o?.key !== key || !o?.data) return null
    const hit = { at: Number(o.at) || 0, data: o.data as WData }
    memCache.set(key, hit)
    return hit
  } catch {
    return null
  }
}

function writeCache(key: string, d: WData) {
  const hit = { at: Date.now(), data: d }
  memCache.set(key, hit)
  try { localStorage.setItem(LS_CACHE, JSON.stringify({ key, ...hit })) } catch {}
}

function requestWeather(url: string): Promise<WData> {
  const running = inflight.get(url)
  if (running) return running
  const p = ($fetch(url) as Promise<WData>).finally(() => inflight.delete(url))
  inflight.set(url, p)
  return p
}

async function load(params: { city?: string; lat?: number; lon?: number } = {}, force = false) {
  const key = cacheKeyOf(params)
  if (!force) {
    const hit = readCache(key)
    if (hit) {
      data.value = hit.data
      err.value = ''
      loading.value = false
      if (Date.now() - hit.at < CACHE_TTL) return
    }
  }

  const silent = !!data.value && !force
  if (!silent) loading.value = true
  err.value = ''
  try {
    const qs = new URLSearchParams()
    if (params.city) qs.set('city', params.city)
    else if (params.lat != null && params.lon != null) { qs.set('lat', String(params.lat)); qs.set('lon', String(params.lon)) }
    const url = params.city ? `/api/weather/city?${qs}` : `/api/weather?${qs}`
    const d = await requestWeather(url)
    data.value = d
    writeCache(key, d)
  } catch (e: any) {
    err.value = e?.data?.message || '天气加载失败'
  } finally {
    loading.value = false
  }
}

function detect(force = false) {
  if (!import.meta.client) return
  if (!('geolocation' in navigator)) { load({}, force); return }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      localStorage.setItem(LS_COORD, JSON.stringify([pos.coords.latitude, pos.coords.longitude]))
      load({ lat: pos.coords.latitude, lon: pos.coords.longitude }, force)
    },
    () => load({}, force),
    { timeout: 6000, maximumAge: 600000 }
  )
}

function applyCity() {
  const c = cityInput.value.trim()
  if (!c) return
  if (import.meta.client) { localStorage.setItem(LS_CITY, c); localStorage.removeItem(LS_COORD) }
  editing.value = false
  load({ city: c }, true)
}

function useAuto() {
  if (import.meta.client) { localStorage.removeItem(LS_CITY); localStorage.removeItem(LS_COORD) }
  editing.value = false
  detect(true)
}

let bootKey = ''
let bootFresh = false
if (import.meta.client) {
  let p: { city?: string; lat?: number; lon?: number } | null = null
  const savedCity = localStorage.getItem(LS_CITY)
  const savedCoord = localStorage.getItem(LS_COORD)
  if (savedCity) p = { city: savedCity }
  else if (savedCoord) {
    try { const [lat, lon] = JSON.parse(savedCoord); p = { lat, lon } } catch {}
  }
  bootKey = cacheKeyOf(p || {})
  const hit = readCache(bootKey)
  if (hit) {
    data.value = hit.data
    loading.value = false
    bootFresh = Date.now() - hit.at < CACHE_TTL
  }
}

onMounted(() => {
  const savedCity = localStorage.getItem(LS_CITY)
  if (savedCity) { cityInput.value = savedCity; load({ city: savedCity }); return }
  const savedCoord = localStorage.getItem(LS_COORD)
  if (savedCoord) {
    try { const [lat, lon] = JSON.parse(savedCoord); load({ lat, lon }); return } catch {}
  }
  if (bootKey === 'auto' && bootFresh) return
  detect()
})
</script>

<template>
  <!-- 头部内联天气：无边框，悬停/点击展开详情面板 -->
  <div v-if="isHeader" class="relative">
    <button
      class="flex items-center gap-2 h-9 px-2.5 rounded-xl text-ink2 hover:text-ink hover:bg-card2 transition-colors"
      @click="expanded = !expanded"
    >
      <template v-if="loading">
        <span class="w-5 h-5 rounded-full bg-card2 animate-pulse" />
        <span class="text-[13px]">定位中…</span>
      </template>
      <template v-else-if="err">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.6 1.5A4 4 0 0 0 7 19h10.5Z" /></svg>
        <span class="text-[13px]">天气</span>
      </template>
      <template v-else-if="data">
        <svg class="w-[18px] h-[18px] text-ink shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
          <path :d="ICONS[data.icon] || ICONS.cloud" />
        </svg>
        <span class="text-[13.5px] font-medium text-ink leading-none">{{ data.temp }}°</span>
        <span class="text-[12.5px] truncate max-w-[92px] leading-none">{{ data.place }}</span>
      </template>
    </button>

    <div v-if="expanded" class="fixed inset-0 z-40" @click="expanded = false" />
    <div v-if="expanded && data" class="absolute right-0 top-full mt-2 z-50 w-[260px] card p-3.5 animate-fade-up">
      <div class="flex items-center gap-3">
        <svg class="w-9 h-9 text-ink shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <path :d="ICONS[data.icon] || ICONS.cloud" />
        </svg>
        <div class="min-w-0">
          <div class="flex items-baseline gap-2">
            <span class="text-[22px] font-semibold leading-none">{{ data.temp }}°</span>
            <span class="text-[12.5px] text-ink2">{{ data.label }}</span>
          </div>
          <span class="block text-[11.5px] text-ink2 truncate mt-0.5">{{ data.place }}</span>
        </div>
      </div>
      <div class="mt-3 pt-3 border-t border-line text-[12px] text-ink2 flex flex-col gap-2.5">
        <div class="flex gap-4">
          <span>体感 {{ data.feels }}°</span>
          <span>湿度 {{ data.humidity }}%</span>
          <span>风速 {{ data.wind }}km/h</span>
        </div>
        <div class="flex gap-2">
          <div v-for="d in data.days" :key="d.date" class="flex-1 rounded-lg bg-card2 py-1.5 text-center">
            <div class="text-[11px]">{{ d.date.slice(5) }}</div>
            <div class="text-[12px] font-medium text-ink">{{ d.max }}° / {{ d.min }}°</div>
            <div class="text-[10px]">{{ d.label }}</div>
          </div>
        </div>
        <div v-if="editing" class="flex gap-2">
          <input v-model="cityInput" class="field !h-8 grow text-[12.5px]" placeholder="输入城市，如 北京" @keyup.enter="applyCity" />
          <button class="btn btn-sm shrink-0" @click="applyCity">确定</button>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn btn-sm btn-ghost" @click="editing = !editing">{{ editing ? '取消' : '切换城市' }}</button>
          <button class="btn btn-sm btn-ghost" @click="useAuto">自动定位</button>
        </div>
      </div>
    </div>
  </div>

  <!-- 面板形态（抽屉内）：卡片样式 -->
  <div v-else class="card px-4 py-3 min-w-[210px] animate-fade-up">
    <div v-if="loading" class="flex items-center gap-2.5 text-ink2 text-[13px] py-1.5">
      <span class="grid place-items-center w-7 h-7 rounded-lg bg-card2 animate-pulse" />
      <span>定位中…</span>
    </div>

    <div v-else-if="err" class="flex items-center gap-2 text-[12.5px] py-1">
      <span class="text-ink2">{{ err }}</span>
      <button class="btn btn-sm btn-ghost !h-7 !px-2" @click="useAuto">重试</button>
    </div>

    <template v-else-if="data">
      <div class="flex items-center gap-2.5">
        <svg class="w-8 h-8 text-ink shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
          <path :d="ICONS[data.icon] || ICONS.cloud" />
        </svg>
        <div class="min-w-0">
          <div class="flex items-baseline gap-1.5">
            <span class="text-[22px] font-semibold leading-none">{{ data.temp }}°</span>
            <span class="text-[12px] text-ink2">{{ data.label }}</span>
          </div>
          <button class="block text-[11.5px] text-ink2 hover:text-ink truncate max-w-[110px] text-left" @click="expanded = !expanded">
            {{ data.place }} <span class="opacity-50">{{ expanded ? '收起' : '详情' }}</span>
          </button>
        </div>
      </div>

      <div v-if="expanded" class="mt-3 pt-3 border-t border-line text-[12px] text-ink2 flex flex-col gap-2.5">
        <div class="flex gap-4">
          <span>体感 {{ data.feels }}°</span>
          <span>湿度 {{ data.humidity }}%</span>
          <span>风速 {{ data.wind }}km/h</span>
        </div>
        <div class="flex gap-2">
          <div v-for="d in data.days" :key="d.date" class="flex-1 rounded-lg bg-card2 py-1.5 text-center">
            <div class="text-[11px]">{{ d.date.slice(5) }}</div>
            <div class="text-[12px] font-medium text-ink">{{ d.max }}° / {{ d.min }}°</div>
            <div class="text-[10px]">{{ d.label }}</div>
          </div>
        </div>
        <div v-if="editing" class="flex gap-2">
          <input v-model="cityInput" class="field !h-8 grow text-[12.5px]" placeholder="输入城市，如 北京" @keyup.enter="applyCity" />
          <button class="btn btn-sm shrink-0" @click="applyCity">确定</button>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn btn-sm btn-ghost" @click="editing = !editing">{{ editing ? '取消' : '切换城市' }}</button>
          <button class="btn btn-sm btn-ghost" @click="useAuto">自动定位</button>
        </div>
      </div>
    </template>
  </div>
</template>
