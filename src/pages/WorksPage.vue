<script setup lang="ts">
import { works } from '../lib/content'
import WorkCard from '../components/WorkCard.vue'
import ContentEmpty from '../components/ContentEmpty.vue'
</script>

<template>
  <section class="works-page">
    <h1 class="ds-subtitle mb-8 text-2xl text-ink">作品</h1>
    <div v-if="works.length" class="works-grid" :class="{ 'works-grid-single': works.length === 1 }">
      <WorkCard v-for="item in works" :key="item.slug" :item="item" :featured="works.length === 1" />
    </div>
    <ContentEmpty v-else title="暂无作品" />
  </section>
</template>

<style scoped>
.works-page { width: min(calc(100% - 32px), 1140px); margin: 0 auto; padding: 128px 0 80px; }
.works-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }
.works-grid-single { grid-template-columns: minmax(0, 1fr); }
@media (max-width: 1023px) {
  .works-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .works-grid-single { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 639px) {
  .works-grid { grid-template-columns: minmax(0, 1fr); }
}
</style>
