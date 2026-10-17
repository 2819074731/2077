<script setup lang="ts">
import { ref, computed } from 'vue'
import type { NavGroup } from '~/data/nav'
const props = defineProps<{ group: NavGroup }>()
const { diy, renameGroup, removeGroup, addLink, orderLinks, isFeatured } = useNav()
const { isMobile, linkCols, formRow } = useDevice()
const adding = ref(false)
const draft = ref({ name: '', url: '' })

const shown = computed(() => (diy.value ? props.group.links : orderLinks(props.group.links)))

function save() {
  if (!draft.value.name || !draft.value.url) return
  let url = draft.value.url
  if (!/^https?:\/\//.test(url)) url = 'https://' + url
  addLink(props.group.id, { name: draft.value.name, url })
  draft.value = { name: '', url: '' }
  adding.value = false
}
</script>

<template>
  <section class="mb-8">
    <div class="flex items-center gap-2.5 mb-3.5">
      <span class="h-4 w-1 rounded-full accent-bar" />
      <template v-if="diy">
        <input
          class="field !h-8 !w-44 text-[14px] font-semibold"
          :value="group.name"
          @change="renameGroup(group.id, ($event.target as HTMLInputElement).value)"
        />
        <button class="btn btn-sm btn-ghost text-ink2" title="删除分组" @click="removeGroup(group.id)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14" /></svg>
        </button>
      </template>
      <template v-else>
        <h2 class="text-[15px] font-semibold tracking-tight">{{ group.name }}</h2>
      </template>
      <span class="chip">{{ group.links.length }}</span>
      <div class="flex-1" />
      <button v-if="diy" class="btn btn-sm btn-ghost" @click="adding = !adding">+ 链接</button>
    </div>

    <div v-if="adding" class="card p-3 mb-4 flex gap-2 animate-fade-up" :class="formRow">
      <input v-model="draft.name" class="field" :class="!isMobile && '!w-44'" placeholder="名称" @keyup.enter="save" />
      <input v-model="draft.url" class="field grow" placeholder="网址" @keyup.enter="save" />
      <div class="flex gap-2">
        <button class="btn" @click="adding = false">取消</button>
        <button class="btn btn-primary" @click="save">添加</button>
      </div>
    </div>

    <div class="grid gap-3" :class="linkCols">
      <LinkItem v-for="link in shown" :key="link.id" :gid="group.id" :link="link" :featured="isFeatured(link.url)" />
    </div>
  </section>
</template>
