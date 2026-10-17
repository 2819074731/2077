<script setup lang="ts">
import { ref } from 'vue'
const { login } = useAuth()
const route = useRoute()
const email = ref('')
const password = ref('')
const err = ref('')
const loading = ref(false)
useSeoMeta({ title: '登录 · 2077 导航', robots: 'noindex' })

async function submit() {
  err.value = ''
  loading.value = true
  try {
    await login(email.value.trim(), password.value)
    const redirect = String(route.query.redirect || '/')
    await navigateTo(redirect.startsWith('/') ? redirect : '/')
  } catch (e: any) {
    err.value = e?.data?.statusMessage || e?.data?.message || '登录失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="max-w-wrap mx-auto px-4 py-16 flex justify-center">
    <form class="card w-full max-w-[380px] p-7 flex flex-col gap-3.5 animate-fade-up" @submit.prevent="submit">
      <div class="flex flex-col items-center gap-2 mb-1">
        <span class="grid place-items-center w-10 h-10 rounded-2xl bg-ink text-bg font-mono text-[11px] shadow-soft">2077</span>
        <h1 class="text-lg font-semibold">登录 2077</h1>
        <p class="text-ink2 text-[13px] -mt-1">同步你的导航配置与云端网址。</p>
      </div>
      <input v-model="email" class="field" type="email" placeholder="邮箱" autocomplete="email" required />
      <input v-model="password" class="field" type="password" placeholder="密码" autocomplete="current-password" required />
      <p v-if="err" class="text-[13px] text-red-500">{{ err }}</p>
      <button class="btn btn-primary w-full mt-1" :disabled="loading">{{ loading ? '登录中...' : '登录' }}</button>
      <p class="text-[13px] text-ink2 text-center mt-1">
        还没有账号？<NuxtLink to="/register" class="text-accent hover:underline">注册</NuxtLink>
      </p>
    </form>
  </div>
</template>
