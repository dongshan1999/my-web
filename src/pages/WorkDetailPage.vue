<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ArrowUpRight } from '@lucide/vue'
import { assetUrl } from '../lib/assets'
import { findItem } from '../lib/content'
import { renderMarkdown } from '../lib/markdown'

const route = useRoute()
const item = computed(() => findItem('works', String(route.params.slug)))
const coverFailed = ref(false)
watch(() => route.params.slug, () => { coverFailed.value = false })
const html = computed(() =>
  item.value ? renderMarkdown(item.value.body) : '',
)
</script>

<template>
  <section class="mx-auto w-[min(calc(100%_-_32px),768px)] pb-20 pt-32 md:pt-36">
    <template v-if="item">
      <RouterLink
        to="/works"
        class="mb-8 inline-block text-sm text-ink-3 transition-colors hover:text-brand"
      >
        ← 返回作品列表
      </RouterLink>
      <h1 class="ds-hero-text mb-4 text-3xl text-ink md:text-4xl">
        {{ item.title }}
      </h1>
      <div class="mb-10 flex flex-wrap items-center gap-2 text-sm text-ink-4">
        <span v-if="item.date">{{ item.date }}</span>
        <span
          v-for="tag in item.tags ?? []"
          :key="tag"
          class="rounded-full bg-raised px-2.5 py-0.5 text-xs text-ink-3"
        >
          {{ tag }}
        </span>
      </div>
      <RouterLink v-if="item.play" :to="item.play" class="btn-pill btn-primary mb-8">
        在线游玩 <ArrowUpRight :size="16" :stroke-width="1.6" aria-hidden="true" />
      </RouterLink>
      <figure v-if="item.cover" class="work-preview mb-10">
        <img v-if="!coverFailed" :src="assetUrl(item.cover)" :alt="`${item.title}实际画面`" width="1200" height="675" @error="coverFailed = true" />
        <figcaption v-else>封面持续更新中</figcaption>
      </figure>
      <article class="prose max-w-none" v-html="html" />
    </template>
    <template v-else>
      <p class="text-ink-4">没有找到这个作品。</p>
      <RouterLink to="/works" class="text-brand hover:underline">
        返回作品列表
      </RouterLink>
    </template>
  </section>
</template>

<style scoped>
.work-preview { display: flex; align-items: center; justify-content: center; width: 100%; aspect-ratio: 16 / 9; overflow: hidden; border-radius: 8px; background: var(--bg-raised); }
.work-preview img { width: 100%; height: 100%; object-fit: cover; }
.work-preview figcaption { color: var(--text-3); font-size: 13px; }
</style>
