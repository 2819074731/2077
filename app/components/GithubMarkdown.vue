<script setup lang="ts">
defineProps<{ html: string }>()
</script>

<template>
  <div class="gh-md" v-html="html" />
</template>

<style scoped>
.gh-md {
  color: var(--text);
  font-size: 13.5px;
  line-height: 1.72;
  overflow-wrap: anywhere;
  min-width: 0;
}
.gh-md :deep(h1),
.gh-md :deep(h2),
.gh-md :deep(h3),
.gh-md :deep(h4),
.gh-md :deep(h5),
.gh-md :deep(h6) {
  margin: 1.4em 0 0.6em;
  font-weight: 650;
  line-height: 1.3;
}
.gh-md :deep(h1),
.gh-md :deep(h2) {
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--border);
}
.gh-md :deep(h1) { font-size: 1.6em; }
.gh-md :deep(h2) { font-size: 1.35em; }
.gh-md :deep(h3) { font-size: 1.18em; }
.gh-md :deep(h4) { font-size: 1.05em; }
.gh-md :deep(p),
.gh-md :deep(ul),
.gh-md :deep(ol),
.gh-md :deep(blockquote),
.gh-md :deep(pre) {
  margin: 0.8em 0;
}
.gh-md :deep(ul),
.gh-md :deep(ol) {
  padding-left: 1.6em;
}
.gh-md :deep(ul) { list-style: disc; }
.gh-md :deep(ol) { list-style: decimal; }
.gh-md :deep(li) { margin: 0.25em 0; }
.gh-md :deep(a) {
  color: var(--text);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.gh-md :deep(a:hover) { color: var(--accent); }
.gh-md :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
}
.gh-md :deep(code) {
  padding: 0.15em 0.35em;
  border-radius: 5px;
  background: var(--card-2);
  font-size: 0.9em;
}
.gh-md :deep(pre) {
  padding: 0.85rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--card-2);
  overflow-x: auto;
}
.gh-md :deep(pre code) {
  padding: 0;
  background: transparent;
  white-space: pre;
}
.gh-md :deep(blockquote) {
  padding-left: 0.9em;
  border-left: 3px solid var(--border);
  color: var(--text-2);
}
.gh-md :deep(table) {
  display: block;
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
}
.gh-md :deep(th),
.gh-md :deep(td) {
  padding: 0.4em 0.6em;
  border: 1px solid var(--border);
}
.gh-md :deep(hr) {
  margin: 1.4em 0;
  border: 0;
  border-top: 1px solid var(--border);
}
</style>
