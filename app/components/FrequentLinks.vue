<script setup lang="ts">
import { computed, ref } from 'vue'
import { iconFor, hostOf } from '~/data/nav'

const { frequentList, frequentManageList, recordClick, togglePin, hideFreq, unhideFreq } = useNav()
const { linkCols } = useDevice()
const managing = ref(false)
const items = computed(() => managing.value ? frequentManageList(60) : frequentList(12))
const hasHistory = computed(() => frequentManageList(1).length > 0)
</script>

<template>
  <section v-if="items.length" class="mb-8">
    <div class="flex items-center gap-2.5 mb-3.5">
      <span class="h-4 w-1 rounded-full accent-bar" />
      <h2 class="text-[15px] font-semibold tracking-tight">常用</h2>
      <span class="chip">按近期使用习惯</span>
      <button
        v-if="hasHistory"
        class="ml-auto text-[12px] text-ink2 hover:text-ink transition-colors"
        :class="managing && 'text-ink font-medium'"
        @click="managing = !managing"
      >{{ managing ? '完成' : '管理' }}</button>
    </div>
    <div class="grid gap-3" :class="linkCols">
      <div
        v-for="l in items"
        :key="l.key"
        class="linkcard overflow-hidden"
        :class="managing && l.hidden && 'opacity-55'"
      >
        <a
          :href="l.url"
          target="_blank"
          rel="noopener"
          class="flex items-center gap-3 px-3.5 h-[58px] overflow-hidden"
          @click="recordClick(l.url, l.name)"
        >
          <span class="grid place-items-center w-9 h-9 rounded-xl bg-card2 border border-line shrink-0 overflow-hidden">
            <img :src="iconFor(l.url)" :alt="l.name" class="w-[18px] h-[18px] object-contain" loading="lazy" referrerpolicy="no-referrer" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-[13.5px] font-medium leading-tight truncate">{{ l.name }}</span>
            <span class="block text-[11px] text-ink2 leading-tight truncate mt-0.5">
              <template v-if="l.pinned">置顶 · </template>{{ hostOf(l.url) }} · {{ l.count }} 次
            </span>
          </span>
        </a>
        <div v-if="managing" class="flex items-center gap-1.5 px-2.5 pb-2.5">
          <button
            class="h-7 px-2.5 rounded-lg text-[11.5px] border border-line text-ink2 hover:bg-card2 hover:text-ink transition-colors"
            :class="l.pinned && 'bg-accentsoft text-accent border-transparent'"
            @click="togglePin(l.url)"
          >{{ l.pinned ? '取消置顶' : '置顶' }}</button>
          <button
            v-if="l.hidden"
            class="h-7 px-2.5 rounded-lg text-[11.5px] text-ink2 hover:bg-card2 hover:text-ink transition-colors"
            @click="unhideFreq(l.url)"
          >恢复显示</button>
          <button
            v-else
            class="h-7 px-2.5 rounded-lg text-[11.5px] text-ink2 hover:bg-card2 hover:text-ink transition-colors"
            @click="hideFreq(l.url)"
          >隐藏</button>
          <span v-if="l.hidden" class="ml-auto text-[10.5px] text-ink3">已隐藏</span>
        </div>
      </div>
    </div>
  </section>
</template>
