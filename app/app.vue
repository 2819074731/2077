<script setup lang="ts">
const { restore } = useAuth()

onMounted(() => {
  restore()
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
