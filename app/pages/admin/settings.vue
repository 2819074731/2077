<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { DEFAULT_SITE_SETTINGS, normalizeSiteSettings, type SiteSettings } from '#shared/siteSettings'
import { dailyNetEaseComment } from '#shared/netEaseComments'

definePageMeta({ layout: 'admin', middleware: 'admin' })

const form = reactive<SiteSettings>({ ...DEFAULT_SITE_SETTINGS })
const loading = ref(true)
const saving = ref(false)
const msg = ref('')
const msgKind = ref<'ok' | 'err'>('ok')
const commentPreview = dailyNetEaseComment()

useSeoMeta({ title: '网站设置 · 2077 管理后台', robots: 'noindex' })

function flash(text: string, kind: 'ok' | 'err' = 'ok') {
  msg.value = text
  msgKind.value = kind
  setTimeout(() => { if (msg.value === text) msg.value = '' }, kind === 'err' ? 4800 : 2200)
}

onMounted(async () => {
  try {
    const data: any = await $fetch('/api/admin/site-settings')
    Object.assign(form, normalizeSiteSettings(data))
  } catch (e: any) {
    flash(e?.data?.statusMessage || e?.data?.message || '配置读取失败', 'err')
  } finally {
    loading.value = false
  }
})

function validate(): string {
  if (!form.siteName.trim()) return '请填写站点名称'
  if (!form.siteShortName.trim()) return '请填写 LOGO 短名称'
  if (!form.submitAllowNav && !form.submitAllowDirectory) return '至少保留一种收录方式'
  if (!form.submitReviewDays.trim()) return '请填写审核时效'
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.maintenanceSchedule)) return '巡检时间格式应为 HH:MM'
  if (form.directoryPageSize < 12 || form.directoryPageSize > 48) return '目录每页数量需在 12-48 之间'
  if (form.linkTtlDays < 1 || form.linkTtlDays > 90) return '链接巡检周期需在 1-90 天之间'
  if (form.tdkTtlDays < 1 || form.tdkTtlDays > 90) return 'TDK 巡检周期需在 1-90 天之间'
  if (form.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail)) return '联系邮箱格式不正确'
  for (const link of form.footerLinks) {
    if (!link.label.trim() || !link.url.trim()) return '请填写完整的页脚导航名称和链接'
    if (!/^https?:\/\//i.test(link.url) && !/^\/(?!\/)/.test(link.url)) return '页脚导航链接需以 / 或 http(s):// 开头'
  }
  return ''
}

function addFooterLink() {
  if (form.footerLinks.length >= 8) return
  form.footerLinks.push({ label: '', url: '' })
}

function removeFooterLink(index: number) {
  form.footerLinks.splice(index, 1)
}

async function save() {
  if (saving.value) return
  const error = validate()
  if (error) { flash(error, 'err'); return }
  saving.value = true
  try {
    const data: any = await $fetch('/api/admin/site-settings', { method: 'PUT', body: { ...form } })
    Object.assign(form, normalizeSiteSettings(data?.settings || data))
    flash('已保存，前台约 15 秒内生效')
  } catch (e: any) {
    flash(e?.data?.statusMessage || e?.data?.message || '保存失败', 'err')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="animate-fade-up max-w-[900px]">
    <div class="flex items-center gap-2 mb-4 flex-wrap">
      <p class="text-[13px] text-ink2 flex-1 min-w-[240px]">
        维护站点名称、SEO、页脚、提交页文案与自动巡检参数。保存后前台约 15 秒内生效。
      </p>
      <span v-if="msg" class="text-[12.5px]" :class="msgKind === 'err' ? 'text-danger' : 'text-ink2'">{{ msg }}</span>
      <button class="btn btn-sm btn-primary" :disabled="saving || loading" @click="save">{{ saving ? '保存中…' : '保存设置' }}</button>
    </div>

    <div v-if="loading" class="card p-8 text-center text-ink2 text-[13px]">加载中…</div>

    <form v-else class="card" @submit.prevent="save">
      <section class="p-4 sm:p-5">
        <h2 class="font-semibold text-[15px]">基础信息</h2>
        <p class="text-[12.5px] text-ink2 mt-1">用于前台头部、页脚、首页标题与默认 SEO。</p>
        <div class="grid sm:grid-cols-2 gap-3.5 mt-4">
          <label class="flex flex-col gap-1.5">
            <span class="text-[13px] font-medium">站点名称</span>
            <input v-model="form.siteName" class="field" maxlength="40" placeholder="例如 2077 导航" />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-[13px] font-medium">LOGO 短名称</span>
            <input v-model="form.siteShortName" class="field" maxlength="12" placeholder="例如 2077" />
            <span class="text-[11.5px] text-ink3">显示在头部与侧边抽屉的方形标识内，建议 2-4 个字符。</span>
          </label>
          <label class="flex flex-col gap-1.5 sm:col-span-2">
            <span class="text-[13px] font-medium">副标题</span>
            <input v-model="form.siteTagline" class="field" maxlength="80" placeholder="可自定义的浏览器起始页" />
          </label>
          <label class="flex flex-col gap-1.5 sm:col-span-2">
            <span class="text-[13px] font-medium">SEO 默认描述</span>
            <textarea v-model="form.siteDescription" class="field !h-20 py-2.5 resize-y leading-6" maxlength="300" />
          </label>
          <label class="flex flex-col gap-1.5 sm:col-span-2">
            <span class="text-[13px] font-medium">SEO 默认关键词</span>
            <input v-model="form.siteKeywords" class="field" maxlength="300" placeholder="网址导航,网站目录,浏览器起始页" />
            <span class="text-[11.5px] text-ink3">多个关键词用英文逗号分隔。</span>
          </label>
        </div>
      </section>

      <div class="h-px bg-line" />

      <section class="p-4 sm:p-5">
        <h2 class="font-semibold text-[15px]">首页展示</h2>
        <p class="text-[12.5px] text-ink2 mt-1">控制首页标题下方信息栏的内容，保存后前台约 15 秒内生效。</p>
        <div class="grid sm:grid-cols-2 gap-3.5 mt-4">
          <label class="flex flex-col gap-1.5">
            <span class="text-[13px] font-medium">信息栏内容</span>
            <select v-model="form.homeLineMode" class="field cursor-pointer">
              <option value="stats">分类与站点统计</option>
              <option value="comment">网易云热评</option>
            </select>
            <span class="text-[11.5px] text-ink3">热评通过网易云接口获取，失败时自动回退到本地文案。</span>
          </label>
          <div v-if="form.homeLineMode === 'comment'" class="rounded-xl border border-line bg-card2 px-3.5 py-3 flex flex-col justify-center gap-1">
            <span class="text-[11px] text-ink3">效果预览</span>
            <p class="text-[12.5px] leading-6 text-ink2">「{{ commentPreview }}」<span class="text-[11px] text-ink3 whitespace-nowrap">—— 网易云热评</span></p>
          </div>
        </div>
      </section>

      <div class="h-px bg-line" />

      <section class="p-4 sm:p-5">
        <h2 class="font-semibold text-[15px]">提交收录</h2>
        <p class="text-[12.5px] text-ink2 mt-1">控制提交页默认选中的收录方式、可选项与审核文案。</p>
        <div class="grid sm:grid-cols-2 gap-3.5 mt-4">
          <label class="flex flex-col gap-1.5">
            <span class="text-[13px] font-medium">默认收录方式</span>
            <select v-model="form.submitDefaultTarget" class="field cursor-pointer">
              <option value="directory">分类目录</option>
              <option value="nav">首页导航</option>
            </select>
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-[13px] font-medium">审核时效</span>
            <div class="flex items-center gap-2">
              <input v-model="form.submitReviewDays" class="field" maxlength="20" placeholder="1-3" />
              <span class="text-[13px] text-ink2 shrink-0">个工作日</span>
            </div>
            <span class="text-[11.5px] text-ink3">填写纯数字或区间，例如 1-3。</span>
          </label>
          <div class="sm:col-span-2 flex flex-wrap gap-5">
            <label class="flex items-center gap-2 text-[13.5px]">
              <input v-model="form.submitAllowNav" type="checkbox" class="w-4 h-4 accent-current" />
              允许提交到首页导航
            </label>
            <label class="flex items-center gap-2 text-[13.5px]">
              <input v-model="form.submitAllowDirectory" type="checkbox" class="w-4 h-4 accent-current" />
              允许提交到分类目录
            </label>
          </div>
          <label class="flex flex-col gap-1.5 sm:col-span-2">
            <span class="text-[13px] font-medium">提交页提示</span>
            <textarea v-model="form.submitNotice" class="field !h-20 py-2.5 resize-y leading-6" maxlength="300" />
          </label>
        </div>
      </section>

      <div class="h-px bg-line" />

      <section class="p-4 sm:p-5">
        <h2 class="font-semibold text-[15px]">目录与巡检</h2>
        <p class="text-[12.5px] text-ink2 mt-1">目录分页数量与自动巡检节奏，保存后下一次巡检生效。</p>
        <div class="grid sm:grid-cols-2 gap-3.5 mt-4">
          <label class="flex flex-col gap-1.5">
            <span class="text-[13px] font-medium">目录每页数量</span>
            <input v-model.number="form.directoryPageSize" type="number" min="12" max="48" class="field" />
            <span class="text-[11.5px] text-ink3">范围 12-48，默认 20。</span>
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-[13px] font-medium">每日巡检时间</span>
            <input v-model="form.maintenanceSchedule" type="time" class="field" />
            <span class="text-[11.5px] text-ink3">服务器到达该时间后执行当日巡检，每天最多一次。</span>
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-[13px] font-medium">链接巡检周期</span>
            <div class="flex items-center gap-2">
              <input v-model.number="form.linkTtlDays" type="number" min="1" max="90" class="field" />
              <span class="text-[13px] text-ink2 shrink-0">天</span>
            </div>
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-[13px] font-medium">TDK 巡检周期</span>
            <div class="flex items-center gap-2">
              <input v-model.number="form.tdkTtlDays" type="number" min="1" max="90" class="field" />
              <span class="text-[13px] text-ink2 shrink-0">天</span>
            </div>
          </label>
        </div>
      </section>

      <div class="h-px bg-line" />

      <section class="p-4 sm:p-5">
        <h2 class="font-semibold text-[15px]">页脚信息</h2>
        <p class="text-[12.5px] text-ink2 mt-1">页脚导航的名称与链接均可修改，全部删除后前台隐藏该行。</p>
        <div class="grid sm:grid-cols-2 gap-3.5 mt-4">
          <label class="flex flex-col gap-1.5">
            <span class="text-[13px] font-medium">ICP 备案号</span>
            <input v-model="form.icpNumber" class="field" maxlength="60" placeholder="例如 京ICP备00000000号" />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-[13px] font-medium">联系邮箱</span>
            <input v-model="form.contactEmail" type="email" class="field" maxlength="120" placeholder="admin@example.com" />
          </label>
          <div class="sm:col-span-2 flex flex-col gap-2">
            <div class="flex items-start justify-between gap-3">
              <div>
                <span class="text-[13px] font-medium">页脚导航</span>
                <p class="text-[11.5px] text-ink3 mt-0.5">显示在页脚右侧，最多 8 个入口；全部删除则隐藏该行。</p>
              </div>
              <button type="button" class="btn btn-sm btn-ghost shrink-0" :disabled="form.footerLinks.length >= 8" @click="addFooterLink">添加入口</button>
            </div>
            <div v-if="form.footerLinks.length" class="flex flex-col gap-2">
              <div v-for="(link, index) in form.footerLinks" :key="index" class="flex flex-col sm:flex-row gap-2">
                <input v-model="link.label" class="field sm:!w-36" maxlength="20" placeholder="名称，例如 分类目录" />
                <input v-model="link.url" class="field flex-1" maxlength="300" placeholder="/site 或 https://example.com" />
                <button type="button" class="btn btn-sm btn-ghost text-danger shrink-0" @click="removeFooterLink(index)">删除</button>
              </div>
            </div>
            <div v-else class="rounded-xl border border-dashed border-line px-4 py-3 text-[12px] text-ink3">
              当前未展示页脚导航，点击「添加入口」恢复。
            </div>
          </div>
        </div>
      </section>

      <div class="p-4 sm:px-5 sm:py-4 border-t border-line flex items-center justify-end gap-2">
        <span v-if="msg" class="text-[12.5px] mr-auto" :class="msgKind === 'err' ? 'text-danger' : 'text-ink2'">{{ msg }}</span>
        <button class="btn btn-primary" type="submit" :disabled="saving">{{ saving ? '保存中…' : '保存设置' }}</button>
      </div>
    </form>
  </div>
</template>
