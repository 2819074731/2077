<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useWallpaper, ROTATE_INTERVALS, EFFECT_PRESETS, TONE_MODES } from '~/composables/useWallpaper'
import { useHomeLine, HOME_LINE_INTERVALS } from '~/composables/useHomeLine'

const open = useState<boolean>('wp-settings-open', () => false)
const wp = useWallpaper()
const {
  homeLinePref, rotate, intervalMin, currentText, busy, hint,
  loadHomeLine, setHomeLinePref, setIntervalMin, setRotate,
  nextComment, nextAndFix, copyComment, startAuto, stopAuto
} = useHomeLine()
const { settings, loadSiteSettings } = useSiteSettings()
const { isMobile } = useDevice()

const commentActive = computed(() => {
  const mode = homeLinePref.value === 'default' ? settings.value.homeLineMode : homeLinePref.value
  return mode === 'comment'
})

function chooseLine(value: 'default' | 'stats' | 'comment') {
  setHomeLinePref(value)
  const mode = value === 'default' ? settings.value.homeLineMode : value
  if (mode === 'comment') {
    if (rotate.value === 'auto') nextComment()
    startAuto()
  } else {
    stopAuto()
  }
}

const tab = ref<'wallpaper' | 'appearance'>('wallpaper')

onMounted(() => {
  wp.loadLocal()
  loadHomeLine()
  loadSiteSettings()
  if (wp.mode.value === 'bing' && !wp.items.value.length) wp.fetchList(8)
})

watch(open, (v) => {
  if (v && wp.mode.value === 'bing' && !wp.items.value.length) wp.fetchList(8)
})

const intervalLabel = (m: number) => {
  if (m >= 1440) return '1 天'
  if (m >= 60) return `${m / 60} 小时`
  return `${m} 分钟`
}

const list = computed(() => wp.items.value)
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-[60] flex justify-center" :class="isMobile ? 'items-end p-0' : 'items-center p-4'">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="open = false" />

      <div
        class="relative w-full bg-bg border border-line shadow-pop flex flex-col overflow-hidden animate-fade-up"
        :class="isMobile ? 'max-w-none max-h-[88vh] rounded-t-3xl' : 'max-w-[560px] max-h-[82vh] rounded-2xl'"
      >
        <div class="h-14 shrink-0 flex items-center gap-2 border-b border-line" :class="isMobile ? 'px-4' : 'px-5'">
          <span class="grid place-items-center w-8 h-8 rounded-xl bg-ink text-bg shrink-0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
          </span>
          <div class="min-w-0">
            <h3 class="font-semibold text-[15px] leading-tight">外观设置</h3>
            <p class="text-[11.5px] text-ink2 leading-tight">壁纸与显示偏好，仅保存在本机</p>
          </div>
          <div class="flex-1" />
          <button class="grid place-items-center w-8 h-8 rounded-lg text-ink2 hover:bg-card2 hover:text-ink" aria-label="关闭" @click="open = false">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div class="shrink-0 flex gap-1 p-2 border-b border-line" :class="!isMobile && 'px-5'">
          <button
            v-for="t in [{ v: 'wallpaper', l: '背景壁纸' }, { v: 'appearance', l: '显示效果' }]"
            :key="t.v"
            class="h-9 px-4 rounded-lg text-[13px] font-medium transition-colors"
            :class="[isMobile ? 'flex-1' : 'flex-none', tab === t.v ? 'bg-ink text-bg' : 'text-ink2 hover:bg-card2 hover:text-ink']"
            @click="tab = t.v as any"
          >{{ t.l }}</button>
        </div>

        <div class="flex-1 overflow-y-auto p-4" :class="!isMobile && 'p-5'">
          <!-- 壁纸 -->
          <template v-if="tab === 'wallpaper'">
            <div class="grid grid-cols-2 gap-3 mb-6">
              <button
                class="relative rounded-2xl border-2 p-4 flex flex-col items-center gap-2 transition-colors"
                :class="wp.mode.value === 'minimal' ? 'border-ink bg-card' : 'border-line bg-card hover:border-line2'"
                @click="wp.setMode('minimal')"
              >
                <span class="grid place-items-center w-10 h-10 rounded-xl bg-card2">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M3 12h18M12 3v18" /></svg>
                </span>
                <span class="text-[13px] font-medium">极简</span>
                <span class="text-[11px] text-ink2">纯色背景</span>
                <span v-if="wp.mode.value === 'minimal'" class="absolute top-2 right-2 grid place-items-center w-5 h-5 rounded-full bg-ink text-bg">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5" /></svg>
                </span>
              </button>

              <button
                class="relative rounded-2xl border-2 p-4 flex flex-col items-center gap-2 transition-colors overflow-hidden"
                :class="wp.mode.value === 'bing' ? 'border-ink bg-card' : 'border-line bg-card hover:border-line2'"
                @click="wp.setMode('bing')"
              >
                <span class="grid place-items-center w-10 h-10 rounded-xl bg-card2 overflow-hidden">
                  <img v-if="list.length" :src="wp.proxy(list[0].thumb)" alt="" class="w-full h-full object-cover" referrerpolicy="no-referrer" />
                  <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2" /><path d="m4 17 5-5 4 4 3-3 4 4" /></svg>
                </span>
                <span class="text-[13px] font-medium">必应每日</span>
                <span class="text-[11px] text-ink2">每日高清壁纸</span>
                <span v-if="wp.mode.value === 'bing'" class="absolute top-2 right-2 grid place-items-center w-5 h-5 rounded-full bg-ink text-bg">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5" /></svg>
                </span>
              </button>
            </div>

            <template v-if="wp.mode.value === 'bing'">
              <div class="flex items-center gap-2 mb-3">
                <span class="h-4 w-1 rounded-full accent-bar" />
                <span class="text-[13.5px] font-semibold">定时轮播</span>
                <label class="ml-auto inline-flex items-center gap-2 text-[12.5px] text-ink2 cursor-pointer select-none">
                  <input type="checkbox" class="accent-ink" :checked="wp.rotate.value" @change="wp.setRotate(($event.target as HTMLInputElement).checked)" />
                  开启
                </label>
              </div>
              <div class="flex flex-wrap gap-1.5 mb-6" :class="{ 'opacity-40 pointer-events-none': !wp.rotate.value || !!wp.fixed.value }">
                <button
                  v-for="iv in ROTATE_INTERVALS"
                  :key="iv"
                  class="h-8 px-3 rounded-lg text-[12.5px] border transition-colors"
                  :class="wp.interval.value === iv ? 'bg-ink text-bg border-transparent font-medium' : 'bg-card border-line text-ink2 hover:text-ink'"
                  @click="wp.setIntervalMin(iv)"
                >{{ intervalLabel(iv) }}</button>
              </div>
              <p v-if="wp.fixed.value" class="text-[11.5px] text-ink2 -mt-4 mb-6">已选定固定壁纸，轮播已暂停。点「随机」或「自动」恢复轮播。</p>

              <div class="flex items-center gap-2 mb-3">
                <span class="h-4 w-1 rounded-full accent-bar" />
                <span class="text-[13.5px] font-semibold">选择壁纸</span>
                <div class="flex-1" />
                <button class="btn btn-sm btn-ghost" @click="wp.setFixed('')">恢复自动</button>
                <button class="btn btn-sm btn-ghost" @click="wp.pickRandom()">随机</button>
              </div>

              <div v-if="wp.loading.value && !list.length" class="grid gap-2.5" :class="isMobile ? 'grid-cols-2' : 'grid-cols-3'">
                <div v-for="i in 6" :key="i" class="aspect-[16/10] rounded-xl bg-card2 animate-pulse" />
              </div>
              <div v-else-if="!list.length" class="text-[12.5px] text-ink2 py-6 text-center border border-dashed border-line rounded-xl">
                壁纸加载失败，请稍后重试。
              </div>
              <div v-else class="grid gap-2.5" :class="isMobile ? 'grid-cols-2' : 'grid-cols-3'">
                <button
                  v-for="w in list"
                  :key="w.id"
                  class="relative aspect-[16/10] rounded-xl overflow-hidden border-2 transition-colors"
                  :class="wp.fixed.value === w.full ? 'border-ink' : 'border-transparent hover:border-line2'"
                  @click="wp.setFixed(w.full)"
                >
                  <img :src="wp.proxy(w.thumb)" alt="" class="w-full h-full object-cover" loading="lazy" referrerpolicy="no-referrer" />
                  <span class="absolute inset-x-0 bottom-0 px-2 py-1 bg-gradient-to-t from-black/70 to-transparent text-[10.5px] text-white truncate text-left">
                    {{ w.title || w.date }}
                  </span>
                  <span v-if="wp.fixed.value === w.full" class="absolute top-1.5 right-1.5 grid place-items-center w-5 h-5 rounded-full bg-ink text-bg">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5" /></svg>
                  </span>
                </button>
              </div>
            </template>
          </template>

          <!-- 显示效果 -->
          <template v-else>
            <div class="mb-6">
              <div class="flex items-center gap-2 mb-3">
                <span class="h-4 w-1 rounded-full accent-bar" />
                <span class="text-[13.5px] font-semibold">首页信息栏</span>
                <span class="text-[11.5px] text-ink2">搜索框下方显示的内容</span>
              </div>
              <div class="grid grid-cols-3 gap-2.5">
                <button
                  v-for="opt in [{ v: 'default', l: '跟随默认', d: '使用站点设置' }, { v: 'stats', l: '站点统计', d: '分类与站点数' }, { v: 'comment', l: '网易云热评', d: '每日热评' }]"
                  :key="opt.v"
                  class="rounded-xl border-2 p-3 flex flex-col items-center gap-1 transition-colors text-center"
                  :class="homeLinePref === opt.v ? 'border-ink bg-card' : 'border-line bg-card hover:border-line2'"
                  @click="chooseLine(opt.v as any)"
                >
                  <span class="text-[13px] font-medium">{{ opt.l }}</span>
                  <span class="text-[10.5px] text-ink2 leading-tight">{{ opt.d }}</span>
                </button>
              </div>
              <p class="text-[11.5px] text-ink3 mt-2">仅保存在本机，默认选项跟随后台「首页展示」设置。</p>

              <div v-if="commentActive" class="mt-3 rounded-xl border border-line bg-card2 p-3.5">
                <div class="flex items-center gap-1.5 mb-2">
                  <span class="text-[12.5px] font-medium">当前热评</span>
                  <div class="flex-1" />
                  <button class="btn btn-sm btn-ghost h-7" :disabled="busy" @click="nextComment">{{ busy ? '换一句中…' : '换一句' }}</button>
                  <button class="btn btn-sm btn-ghost h-7" @click="copyComment">复制</button>
                </div>
                <div class="overflow-x-auto no-scrollbar">
                  <p class="w-max min-w-full text-[12.5px] leading-6 text-ink2 whitespace-nowrap" :title="currentText">「{{ currentText }}」</p>
                </div>
                <p v-if="hint" class="text-[11px] text-accent mt-1">{{ hint }}</p>

                <div class="flex items-center gap-2 mt-3.5">
                  <span class="text-[12px] text-ink2 shrink-0">切换方式</span>
                  <button
                    v-for="opt in [{ v: 'auto', l: '自动切换' }, { v: 'fixed', l: '固定一句' }]"
                    :key="opt.v"
                    class="h-8 px-3 rounded-lg border text-[12px] transition-colors"
                    :class="rotate === opt.v ? 'bg-ink text-bg border-transparent font-medium' : 'bg-card border-line text-ink2 hover:text-ink'"
                    @click="setRotate(opt.v as any)"
                  >{{ opt.l }}</button>
                </div>

                <div v-if="rotate === 'auto'" class="mt-2.5">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <button
                      v-for="iv in HOME_LINE_INTERVALS"
                      :key="iv"
                      class="h-7 px-2.5 rounded-lg border text-[11.5px] transition-colors"
                      :class="intervalMin === iv ? 'bg-ink text-bg border-transparent font-medium' : 'bg-card border-line text-ink2 hover:text-ink'"
                      @click="setIntervalMin(iv)"
                    >{{ iv === 60 ? '1 小时' : iv + ' 分钟' }}</button>
                    <label class="inline-flex items-center gap-1 text-[11px] text-ink3">
                      自定义
                      <input
                        type="number"
                        min="1"
                        max="1440"
                        class="field h-7 w-[62px] px-1 text-center text-[11.5px]"
                        :value="intervalMin"
                        @change="setIntervalMin(Number(($event.target as HTMLInputElement).value))"
                      />
                      分钟
                    </label>
                  </div>
                  <p class="text-[11px] text-ink3 mt-1.5">每 {{ intervalMin }} 分钟自动换一条。</p>
                </div>

                <div v-else class="mt-2.5 flex items-center gap-2 flex-wrap">
                  <span class="text-[11.5px] text-ink2">已固定当前这句，首页不再自动切换。</span>
                  <button class="btn btn-sm h-7" @click="nextAndFix">换一条并固定</button>
                </div>
              </div>
            </div>

            <template v-if="wp.mode.value === 'bing'">
              <div class="mb-6">
                <div class="flex items-center gap-2 mb-3">
                  <span class="h-4 w-1 rounded-full accent-bar" />
                  <span class="text-[13.5px] font-semibold">效果预设</span>
                  <span class="text-[11.5px] text-ink2">一键套用，推荐「通用」</span>
                </div>
                <div class="grid grid-cols-3 gap-2.5">
                  <button
                    v-for="p in EFFECT_PRESETS"
                    :key="p.id"
                    class="rounded-xl border-2 p-3 flex flex-col items-center gap-1 transition-colors text-center"
                    :class="wp.effect.value === p.id ? 'border-ink bg-card' : 'border-line bg-card hover:border-line2'"
                    @click="wp.applyEffect(p.id)"
                  >
                    <span class="text-[13px] font-medium">{{ p.name }}</span>
                    <span class="text-[10.5px] text-ink2 leading-tight">{{ p.desc }}</span>
                  </button>
                </div>
                <p v-if="wp.effect.value === 'custom'" class="text-[11.5px] text-ink2 mt-2">当前为自定义效果，可拖动下方滑块微调。</p>
              </div>

              <div class="mb-6">
                <div class="flex items-center gap-2 mb-3">
                  <span class="h-4 w-1 rounded-full accent-bar" />
                  <span class="text-[13.5px] font-semibold">文字颜色</span>
                  <span class="text-[11.5px] text-ink2">保证壁纸上的内容清晰可见</span>
                </div>
                <div class="grid grid-cols-3 gap-2.5">
                  <button
                    v-for="t in TONE_MODES"
                    :key="t.id"
                    class="rounded-xl border-2 p-3 flex flex-col items-center gap-1 transition-colors text-center"
                    :class="wp.toneMode.value === t.id ? 'border-ink bg-card' : 'border-line bg-card hover:border-line2'"
                    @click="wp.setToneMode(t.id)"
                  >
                    <span class="text-[13px] font-medium">{{ t.name }}</span>
                    <span class="text-[10.5px] text-ink2 leading-tight">{{ t.desc }}</span>
                  </button>
                </div>
                <p class="text-[11.5px] text-ink3 mt-2">
                  当前判定为{{ wp.tone.value === 'light' ? '深色底，使用白色文字' : '浅色底，使用深色文字' }}；自动判定不准时可手动指定。
                </p>
              </div>

              <div class="mb-6">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-[13px] font-medium">壁纸不透明度</span>
                  <span class="text-[12px] text-ink2">{{ wp.opacity.value }}%</span>
                </div>
                <input type="range" min="30" max="100" step="5" :value="wp.opacity.value" class="w-full accent-ink" @input="wp.setOpacity(Number(($event.target as HTMLInputElement).value))" />
              </div>
              <div class="mb-6">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-[13px] font-medium">背景模糊</span>
                  <span class="text-[12px] text-ink2">{{ wp.blur.value }}px</span>
                </div>
                <input type="range" min="0" max="24" step="1" :value="wp.blur.value" class="w-full accent-ink" @input="wp.setBlur(Number(($event.target as HTMLInputElement).value))" />
              </div>
              <div class="mb-2">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-[13px] font-medium">暗色遮罩</span>
                  <span class="text-[12px] text-ink2">{{ wp.overlay.value }}%</span>
                </div>
                <input type="range" min="0" max="80" step="5" :value="wp.overlay.value" class="w-full accent-ink" @input="wp.setOverlay(Number(($event.target as HTMLInputElement).value))" />
                <p class="text-[11.5px] text-ink3 mt-2">提高遮罩可增强文字可读性。</p>
              </div>
            </template>
            <div v-else class="text-[13px] text-ink2 py-10 text-center border border-dashed border-line rounded-xl">
              当前为极简模式，切换到「必应每日」后可调节显示效果。
            </div>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>
