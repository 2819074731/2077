<script setup lang="ts">
import { onMounted, onBeforeUnmount, computed } from 'vue'
import { useWallpaper } from '~/composables/useWallpaper'

const wp = useWallpaper()

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
</script>

<template>
  <div v-if="wp.active.value" class="fixed inset-0 -z-20 overflow-hidden pointer-events-none">
    <div class="absolute inset-0 bg-cover bg-center transition-[background-image] duration-700" :style="style" />
    <div class="absolute inset-0" :style="{ background: `rgba(0,0,0,${(wp.overlay.value ?? 55) / 100})` }" />
  </div>
</template>
