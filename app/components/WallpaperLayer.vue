<script setup lang="ts">
import { onMounted, onBeforeUnmount, computed, watch, ref } from 'vue'
import { useWallpaper } from '~/composables/useWallpaper'

const wp = useWallpaper()
const colorMode = useColorMode()
const rawLum = ref(0.5)
let measuredUrl = ''

onMounted(() => {
  wp.loadLocal()
  if (wp.mode.value === 'bing') wp.restart()
})
onBeforeUnmount(() => wp.stop())

const style = computed(() => {
  if (!wp.bgUrl.value) return {}
  return {
    backgroundImage: `url("${wp.bgUrl.value}")`,
    opacity: String((wp.opacity.value ?? 100) / 100),
    filter: wp.blur.value ? `blur(${wp.blur.value}px)` : 'none'
  }
})

function toLinear(c: number) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function measure(url: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      try {
        const w = 32
        const h = 20
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return resolve(0.5)
        ctx.drawImage(img, 0, 0, w, h)
        const { data } = ctx.getImageData(0, 0, w, h)
        let sum = 0
        let count = 0
        for (let i = 0; i < data.length; i += 4) {
          sum += 0.2126 * toLinear(data[i] / 255)
            + 0.7152 * toLinear(data[i + 1] / 255)
            + 0.0722 * toLinear(data[i + 2] / 255)
          count++
        }
        resolve(count ? sum / count : 0.5)
      } catch {
        resolve(0.5)
      }
    }
    img.onerror = () => resolve(0.5)
    img.src = url
  })
}

function applyTone() {
  const op = Math.min(100, Math.max(0, wp.opacity.value ?? 100)) / 100
  const ov = Math.min(80, Math.max(0, wp.overlay.value ?? 45)) / 100
  const base = colorMode.value === 'dark' ? 0.03 : 0.96
  const effective = (rawLum.value * op + base * (1 - op)) * (1 - ov)
  wp.toneAuto.value = effective < 0.42 ? 'light' : 'dark'
}

async function refreshTone() {
  if (!import.meta.client || !wp.active.value) return
  const url = wp.current.value
  if (url && measuredUrl !== url) {
    measuredUrl = url
    rawLum.value = await measure(wp.proxy(url))
  }
  applyTone()
}

watch(
  [() => wp.current.value, () => wp.opacity.value, () => wp.overlay.value, () => wp.mode.value, () => colorMode.value],
  refreshTone,
  { immediate: true }
)
</script>

<template>
  <div v-if="wp.active.value" class="fixed inset-0 -z-20 overflow-hidden pointer-events-none">
    <div class="absolute inset-0" :style="{ background: 'var(--bg)' }" />
    <div class="absolute inset-0 bg-cover bg-center transition-[background-image] duration-700" :style="style" />
    <div class="absolute inset-0" :style="{ background: `rgba(0,0,0,${(wp.overlay.value ?? 55) / 100})` }" />
  </div>
</template>
