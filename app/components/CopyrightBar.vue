<script setup lang="ts">
import { COPYRIGHT } from '#shared/copyright'
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-2 gap-y-1" data-copyright-bar>
    <a
      :href="`https://${COPYRIGHT.site}/`"
      rel="noopener"
      class="whitespace-nowrap hover:text-ink"
      :title="COPYRIGHT.owner"
      data-copyright-home
    >{{ COPYRIGHT.short }}</a>
    <span class="opacity-40" aria-hidden="true">·</span>
    <a
      :href="COPYRIGHT.licenseUrl"
      rel="license noopener"
      class="whitespace-nowrap underline underline-offset-2 hover:text-ink"
      :title="COPYRIGHT.notice"
    >{{ COPYRIGHT.licenseShort }}</a>
  </div>
</template>
