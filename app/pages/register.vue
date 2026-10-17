<script setup lang="ts">
import { ref } from 'vue'
const { register } = useAuth()
const email = ref('')
const nickname = ref('')
const username = ref('')
const password = ref('')
const err = ref('')
const loading = ref(false)
useSeoMeta({ title: '注册 · 2077 导航', robots: 'noindex' })

async function submit() {
  err.value = ''
  loading.value = true
  try {
    await register(email.value.trim(), password.value, nickname.value.trim() || email.value.split('@')[0], username.value.trim() || undefined)
    await navigateTo('/settings')
  } catch (e: any) {
    err.value = e?.data?.statusMessage || e?.data?.message || '注册失败'
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
        <h1 class="text-lg font-semibold">创建账号</h1>
        <p class="text-ink2 text-[13px] -mt-1">注册后即可云端同步导航配置。</p>
      </div>
      <input v-model="email" class="field" type="email" placeholder="邮箱" autocomplete="email" required />
      <input v-model="username" class="field" placeholder="用户名（可选，用于登录）" autocomplete="username" />
      <input v-model="nickname" class="field" placeholder="昵称（可选）" />
      <input v-model="password" class="field" type="password" placeholder="密码（至少 6 位）" autocomplete="new-password" required />
      <p v-if="err" class="text-[13px] text-red-500">{{ err }}</p>
      <button class="btn btn-primary w-full mt-1" :disabled="loading">{{ loading ? '注册中...' : '注册' }}</button>
      <p class="text-[13px] text-ink2 text-center mt-1">
        已有账号？<NuxtLink to="/login" class="text-accent hover:underline">登录</NuxtLink>
      </p>
    </form>
  </div>
</template>
