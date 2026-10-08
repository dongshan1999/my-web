<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { findItem } from '../lib/content'
import { renderMarkdown } from '../lib/markdown'

const route = useRoute()
const item = computed(() => findItem('docs', String(route.params.slug)))
const html = computed(() =>
  item.value ? renderMarkdown(item.value.body) : '',
)
</script>

<template>
  <section class="mx-auto w-[min(calc(100%_-_32px),768px)] pb-20 pt-32 md:pt-36">
    <template v-if="item">
      <RouterLink
        to="/docs"
        class="mb-8 inline-block text-sm text-ink-3 transition-colors hover:text-brand"
      >
        ← 返回文档列表
      </RouterLink>
      <h1 class="ds-hero-text mb-4 text-3xl text-ink md:text-4xl">
        {{ item.title }}
      </h1>
      <p v-if="item.date" class="mb-10 text-sm text-ink-4">{{ item.date }}</p>
      <!-- eslint-disable-next-line vue/no-v-html —— 内容来自仓库内受信 Markdown -->
      <article class="prose max-w-none" v-html="html" />
    </template>
    <template v-else>
      <p class="text-ink-3">这篇文档暂未发布。</p>
      <RouterLink to="/docs" class="text-brand hover:underline">
        返回文档列表
      </RouterLink>
    </template>
  </section>
</template>
