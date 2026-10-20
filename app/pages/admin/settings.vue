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
const footerPreview = ref<'desktop' | 'mobile'>('desktop')

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
    const url = link.url.trim()
    if (!link.label.trim() || !url) return '请填写完整的页脚导航名称和链接'
    if (!/^https?:\/\//i.test(url) && !/^\/(?!\/)/.test(url)) return '页脚导航链接需以 / 或 http(s):// 开头'
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

function moveFooterLink(index: number, offset: number) {
  const target = index + offset
  if (target < 0 || target >= form.footerLinks.length) return
  const [item] = form.footerLinks.splice(index, 1)
  if (!item) return
  form.footerLinks.splice(target, 0, item)
}

function resetFooterLinks() {
  form.footerLinks = DEFAULT_SITE_SETTINGS.footerLinks.map((link) => ({ ...link }))
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
        <p class="text-[12.5px] text-ink2 mt-1">设置备案号、联系邮箱与页脚导航入口，留空则不在页脚展示。</p>
        <div class="grid sm:grid-cols-2 gap-3.5 mt-4">
          <label class="flex flex-col gap-1.5">
            <span class="text-[13px] font-medium">ICP 备案号</span>
            <input v-model="form.icpNumber" class="field" maxlength="60" placeholder="例如 京ICP备00000000号" />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-[13px] font-medium">联系邮箱</span>
            <input v-model="form.contactEmail" type="email" autocomplete="email" class="field" maxlength="120" placeholder="admin@example.com" />
          </label>
        </div>

        <div class="mt-4 rounded-xl border border-line bg-card2/40 p-3 sm:p-4">
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-[13px] font-medium">页脚导航</span>
                <span class="text-[11px] text-ink3 tabular-nums">{{ form.footerLinks.length }} / 8</span>
              </div>
              <p class="text-[11.5px] text-ink3 mt-0.5">名称与链接均可修改，全部删除后前台隐藏该行。</p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <button type="button" class="btn btn-sm btn-ghost" @click="resetFooterLinks">恢复默认</button>
              <button v-if="form.footerLinks.length" type="button" class="btn btn-sm shrink-0" :disabled="form.footerLinks.length >= 8" @click="addFooterLink">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" /></svg>
                添加入口
              </button>
            </div>
          </div>

          <div v-if="form.footerLinks.length" class="mt-3">
            <div class="hidden sm:grid sm:grid-cols-[10rem_minmax(0,1fr)_6.5rem] gap-2 px-1 pb-1.5 text-[11px] text-ink3">
              <span>名称</span>
              <span>链接地址</span>
              <span class="text-right">操作</span>
            </div>
            <div class="flex flex-col gap-2">
              <div v-for="(link, index) in form.footerLinks" :key="index" class="flex items-start gap-2 rounded-xl border border-line bg-card p-2.5 sm:border-0 sm:bg-transparent sm:p-0">
                <div class="grid min-w-0 flex-1 gap-2 sm:grid-cols-[10rem_minmax(0,1fr)]">
                  <label class="flex min-w-0 flex-col gap-1 sm:block">
                    <span class="text-[11px] text-ink3 sm:hidden">名称</span>
                    <input v-model="link.label" class="field" maxlength="20" autocomplete="off" aria-label="页脚入口名称" placeholder="例如 分类目录" />
                  </label>
                  <label class="flex min-w-0 flex-col gap-1 sm:block">
                    <span class="text-[11px] text-ink3 sm:hidden">链接</span>
                    <input v-model="link.url" class="field" maxlength="300" autocomplete="off" spellcheck="false" aria-label="页脚入口链接" placeholder="/site 或 https://example.com" />
                  </label>
                </div>
                <div class="mt-[20px] flex shrink-0 items-center gap-1 sm:mt-0 sm:self-end">
                  <button type="button" class="btn btn-icon-sm btn-ghost !h-8 !w-8 text-ink3 disabled:pointer-events-none disabled:opacity-30" :disabled="index === 0" aria-label="上移入口" title="上移" @click="moveFooterLink(index, -1)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m18 15-6-6-6 6" /></svg>
                  </button>
                  <button type="button" class="btn btn-icon-sm btn-ghost !h-8 !w-8 text-ink3 disabled:pointer-events-none disabled:opacity-30" :disabled="index === form.footerLinks.length - 1" aria-label="下移入口" title="下移" @click="moveFooterLink(index, 1)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6" /></svg>
                  </button>
                  <button type="button" class="btn btn-icon-sm btn-ghost !h-8 !w-8 text-ink3 hover:!text-danger" :aria-label="`删除${link.label || '页脚入口'}`" title="删除入口" @click="removeFooterLink(index)">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14" /></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <button v-else type="button" class="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line px-4 py-3 text-[12.5px] text-ink2 transition-colors hover:bg-card hover:text-ink" @click="addFooterLink">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" /></svg>
            添加第一个入口
          </button>
        </div>

        <div class="mt-4 rounded-xl border border-line bg-card p-3 sm:p-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span class="text-[13px] font-medium">页脚预览</span>
              <span class="text-[11.5px] text-ink3 ml-2">随输入实时更新</span>
            </div>
            <div class="inline-flex rounded-lg border border-line bg-card2 p-0.5" role="group" aria-label="预览设备">
              <button type="button" class="h-7 px-3 rounded-md text-[11.5px] transition-colors" :class="footerPreview === 'desktop' ? 'bg-card text-ink shadow-sm' : 'text-ink3 hover:text-ink'" :aria-pressed="footerPreview === 'desktop'" @click="footerPreview = 'desktop'">桌面</button>
              <button type="button" class="h-7 px-3 rounded-md text-[11.5px] transition-colors" :class="footerPreview === 'mobile' ? 'bg-card text-ink shadow-sm' : 'text-ink3 hover:text-ink'" :aria-pressed="footerPreview === 'mobile'" @click="footerPreview = 'mobile'">手机</button>
            </div>
          </div>
          <div class="mt-3 rounded-xl border border-line bg-card2/30 p-3 sm:p-4">
            <div class="rounded-lg border border-line bg-card px-3 py-3 text-xs text-ink2 pointer-events-none select-none" :class="footerPreview === 'mobile' ? 'mx-auto w-full max-w-[320px]' : 'w-full'">
              <div class="flex flex-col-reverse gap-3" :class="footerPreview === 'desktop' ? 'sm:flex-row sm:items-center sm:justify-between' : ''">
                <div class="flex min-w-0 flex-col gap-1.5">
                  <CopyrightBar />
                  <div v-if="form.icpNumber || form.contactEmail" class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink3">
                    <span v-if="form.icpNumber">{{ form.icpNumber }}</span>
                    <span v-if="form.contactEmail">{{ form.contactEmail }}</span>
                  </div>
                </div>
                <nav v-if="form.footerLinks.length" class="flex flex-wrap items-center gap-x-4 gap-y-1 shrink-0">
                  <span v-for="(link, index) in form.footerLinks" :key="index" :title="link.url">{{ link.label || '未命名入口' }}</span>
                </nav>
                <span v-else class="text-ink3">未配置页脚导航</span>
              </div>
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
