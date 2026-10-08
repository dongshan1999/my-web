<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { docs } from '../lib/content'
import ContentEmpty from '../components/ContentEmpty.vue'
</script>

<template>
  <section class="mx-auto w-[min(calc(100%_-_32px),768px)] pb-20 pt-32 md:pt-36">
    <h1 class="ds-subtitle mb-8 text-2xl text-ink">文档</h1>
    <ul v-if="docs.length" class="doc-list">
      <li v-for="doc in docs" :key="doc.slug">
        <RouterLink :to="`/docs/${doc.slug}`" class="doc-link">
          <div class="doc-heading">
            <span>{{ doc.title }}</span>
            <time v-if="doc.date">{{ doc.date }}</time>
          </div>
          <p v-if="doc.description">{{ doc.description }}</p>
        </RouterLink>
      </li>
    </ul>
    <ContentEmpty v-else title="暂无文档" />
  </section>
</template>

<style scoped>
.doc-list { border-top: 1px solid var(--line-2); }
.doc-list li { border-bottom: 1px solid var(--line-2); }
.doc-link { display: grid; gap: 9px; padding: 24px 0; }
.doc-heading { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px 16px; }
.doc-heading span { color: var(--text-1); font-size: 16px; font-weight: 500; }
.doc-heading time { color: var(--text-3); font-size: 12px; }
.doc-link:hover .doc-heading span { color: var(--brand); }
.doc-link p { color: var(--text-2); font-size: 14px; line-height: 1.8; }
</style>
