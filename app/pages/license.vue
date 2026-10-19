<script setup lang="ts">
import { COPYRIGHT } from '#shared/copyright'

const siteUrl = useRuntimeConfig().public.siteUrl

useSeoMeta({
  title: `License · ${COPYRIGHT.owner}`,
  description: COPYRIGHT.notice,
  ogTitle: `License · ${COPYRIGHT.owner}`,
  ogDescription: COPYRIGHT.notice,
  ogUrl: siteUrl + '/license'
})

useHead(() => ({
  link: [{ rel: 'canonical', href: siteUrl + '/license' }]
}))
</script>

<template>
  <div class="max-w-wrap mx-auto px-4 py-10">
    <article class="card p-6 sm:p-8 max-w-[760px] mx-auto">
      <h1 class="text-[24px] font-extrabold tracking-tight">{{ COPYRIGHT.license }}</h1>
      <p class="mt-3 text-[13.5px] leading-6 text-ink2">{{ COPYRIGHT.notice }}</p>

      <div class="mt-6 grid gap-3 text-[13px] leading-6">
        <div class="rounded-xl border border-line bg-card2 px-4 py-3">
          <p class="font-semibold text-ink">Allowed</p>
          <p class="mt-1 text-ink2">Personal study, research, experiments, hobby projects, and use by noncommercial organizations. You may read, modify, and redistribute the source under the same terms.</p>
        </div>
        <div class="rounded-xl border border-line bg-card2 px-4 py-3">
          <p class="font-semibold text-ink">Not allowed</p>
          <p class="mt-1 text-ink2">Any commercial use, including paid products, paid hosting, advertising-supported deployments, and commercial internal use, without a separate written license.</p>
        </div>
        <div class="rounded-xl border border-line bg-card2 px-4 py-3">
          <p class="font-semibold text-ink">Required notice</p>
          <p class="mt-1 text-ink2 break-all">{{ COPYRIGHT.required }}</p>
        </div>
      </div>

      <div class="mt-6 flex flex-wrap items-center gap-3 text-[13px]">
        <a :href="COPYRIGHT.official" target="_blank" rel="noopener" class="btn btn-sm btn-primary">Official license text</a>
        <a :href="`https://${COPYRIGHT.site}/`" class="btn btn-sm">Back to {{ COPYRIGHT.site }}</a>
      </div>

      <p class="mt-6 text-[12px] text-ink3">{{ COPYRIGHT.zh }}</p>
    </article>
  </div>
</template>
