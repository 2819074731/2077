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
      <p class="mt-2 text-[13px] leading-6 text-ink2">你可以商用、修改和分发本项目，但通过网络向用户提供修改版时，必须提供完整对应源码，并保留来源标注。</p>

      <div class="mt-6 grid gap-3 text-[13px] leading-6">
        <div class="rounded-xl border border-line bg-card2 px-4 py-3">
          <p class="font-semibold text-ink">Allowed</p>
          <p class="mt-1 text-ink2">Commercial and noncommercial use, modification, distribution, and network deployment, provided you comply with AGPL-3.0-only. You may charge for services and support.</p>
        </div>
        <div class="rounded-xl border border-line bg-card2 px-4 py-3">
          <p class="font-semibold text-ink">Required</p>
          <p class="mt-1 text-ink2">Provide the complete Corresponding Source when you distribute the software, and to users who interact with a modified version over a network. Preserve copyright, license, and attribution notices. Mark modified files and include the Section 7(b) notice below.</p>
        </div>
        <div class="rounded-xl border border-line bg-card2 px-4 py-3">
          <p class="font-semibold text-ink">Not allowed</p>
          <p class="mt-1 text-ink2">Removing or hiding required notices, distributing under terms that forbid the rights AGPL grants, or using the project marks to imply official status or endorsement.</p>
        </div>
        <div class="rounded-xl border border-line bg-card2 px-4 py-3">
          <p class="font-semibold text-ink">Required notice</p>
          <p class="mt-1 text-ink2 break-all">{{ COPYRIGHT.required }}</p>
        </div>
      </div>

      <div class="mt-6 flex flex-wrap items-center gap-3 text-[13px]">
        <a :href="COPYRIGHT.official" target="_blank" rel="noopener" class="btn btn-sm btn-primary">Official license text</a>
        <a :href="COPYRIGHT.source" target="_blank" rel="noopener" class="btn btn-sm">Source code</a>
        <a :href="COPYRIGHT.termsUrl" target="_blank" rel="noopener" class="btn btn-sm">Additional terms</a>
        <a :href="COPYRIGHT.trademarkUrl" target="_blank" rel="noopener" class="btn btn-sm">Trademark policy</a>
        <a :href="`https://${COPYRIGHT.site}/`" class="btn btn-sm">Back to {{ COPYRIGHT.site }}</a>
      </div>

      <p class="mt-6 text-[12px] text-ink3">{{ COPYRIGHT.zh }}</p>
    </article>
  </div>
</template>
