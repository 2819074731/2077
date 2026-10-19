<script setup lang="ts">
import { COPYRIGHT } from '#shared/copyright'
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-2 gap-y-1" data-copyright-bar>
    <a
      :href="`https://${COPYRIGHT.site}/`"
      rel="noopener"
      class="hover:text-ink"
      :title="COPYRIGHT.owner"
      data-copyright-home
    >{{ COPYRIGHT.short }}</a>
    <span class="opacity-40">·</span>
    <span>{{ COPYRIGHT.footer }}</span>
    <a
      :href="COPYRIGHT.licenseUrl"
      rel="license noopener"
      class="underline underline-offset-2 hover:text-ink"
      :title="COPYRIGHT.notice"
    >{{ COPYRIGHT.license }}</a>
    <span class="opacity-40">·</span>
    <a :href="`https://${COPYRIGHT.site}/`" rel="noopener" class="hover:text-ink">{{ COPYRIGHT.site }}</a>
  </div>
</template>
