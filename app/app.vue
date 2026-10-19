<script setup lang="ts">
import { COPYRIGHT, COPYRIGHT_JSON_LD } from '#shared/copyright'

const { restore } = useAuth()

useHead({
  script: [{
    type: 'application/ld+json',
    innerHTML: JSON.stringify(COPYRIGHT_JSON_LD)
  }],
  meta: [
    { name: 'copyright', content: COPYRIGHT.zh },
    { name: 'rights', content: COPYRIGHT.en },
    { name: 'license', content: COPYRIGHT.license }
  ],
  link: [
    { rel: 'license', href: COPYRIGHT.licenseUrl, title: COPYRIGHT.license }
  ]
})

onMounted(() => {
  restore()
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
