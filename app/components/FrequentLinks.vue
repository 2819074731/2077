<script setup lang="ts">
import { computed } from 'vue'
import { iconFor, hostOf } from '~/data/nav'

const { frequentList, recordClick } = useNav()
const items = computed(() => frequentList(12))
</script>

<template>
  <section v-if="items.length" class="mb-8">
    <div class="flex items-center gap-2.5 mb-3.5">
      <span class="h-4 w-1 rounded-full accent-bar" />
      <h2 class="text-[15px] font-semibold tracking-tight">常用</h2>
      <span class="chip">按你的使用习惯</span>
    </div>
    <div class="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      <a
        v-for="l in items"
        :key="l.url"
        :href="l.url"
        target="_blank"
        rel="noopener"
        class="linkcard flex items-center gap-3 px-3.5 h-[58px] overflow-hidden"
        @click="recordClick(l.url, l.name)"
      >
        <span class="grid place-items-center w-9 h-9 rounded-xl bg-card2 border border-line shrink-0 overflow-hidden">
          <img :src="iconFor(l.url)" :alt="l.name" class="w-[18px] h-[18px] object-contain" loading="lazy" referrerpolicy="no-referrer" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-[13.5px] font-medium leading-tight truncate">{{ l.name }}</span>
          <span class="block text-[11px] text-ink2 leading-tight truncate mt-0.5">{{ hostOf(l.url) }} · {{ l.count }} 次</span>
        </span>
      </a>
    </div>
  </section>
</template>
