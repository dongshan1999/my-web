<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowRight, ArrowUpRight, ImageOff } from '@lucide/vue'
import type { ContentItem } from '../lib/content'
import { assetUrl } from '../lib/assets'

const props = defineProps<{ item: ContentItem; featured?: boolean }>()
const coverFailed = ref(false)
const coverUrl = computed(() => assetUrl(props.item.cover))
watch(() => props.item.cover, () => { coverFailed.value = false })
</script>

<template>
  <article class="work-card ds-card" :class="{ 'work-card-featured': featured }">
    <RouterLink :to="`/works/${item.slug}`" class="work-cover" :aria-label="`${item.title} · 作品详情`">
      <img
        v-if="coverUrl && !coverFailed"
        :src="coverUrl"
        :alt="`${item.title}实际画面`"
        width="1200"
        height="675"
        :loading="featured ? 'eager' : 'lazy'"
        :decoding="featured ? 'sync' : 'async'"
        :fetchpriority="featured ? 'high' : 'auto'"
        @error="coverFailed = true"
      />
      <div v-else class="cover-empty">
        <ImageOff :size="22" :stroke-width="1.3" aria-hidden="true" />
        <span>封面持续更新中</span>
      </div>
    </RouterLink>
    <div class="work-details">
      <div v-if="item.tags?.length" class="work-tags">
        <span v-for="tag in item.tags" :key="tag">{{ tag }}</span>
      </div>
      <RouterLink :to="`/works/${item.slug}`" class="work-title-link">
        <h3>{{ item.title }}</h3>
      </RouterLink>
      <p v-if="item.description" class="work-description">{{ item.description }}</p>
      <div class="work-actions">
        <RouterLink v-if="item.play" :to="item.play" class="btn-pill btn-primary">
          在线游玩 <ArrowUpRight :size="16" :stroke-width="1.6" aria-hidden="true" />
        </RouterLink>
        <RouterLink :to="`/works/${item.slug}`" class="work-more">
          作品详情 <ArrowRight :size="15" :stroke-width="1.6" aria-hidden="true" />
        </RouterLink>
      </div>
    </div>
  </article>
</template>

<style scoped>
.work-card { overflow: hidden; }
.work-cover {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: var(--bg-raised);
}
.work-cover img { display: block; width: 100%; height: 100%; object-fit: cover; }
.cover-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 100%;
  height: 100%;
  color: var(--text-3);
  font-size: 13px;
}
.work-details { display: flex; flex-direction: column; align-items: flex-start; gap: 16px; padding: 26px; }
.work-tags { display: flex; flex-wrap: wrap; gap: 8px 14px; color: var(--text-3); font-size: 11px; }
.work-title-link { color: var(--text-1); }
.work-title-link:hover { color: var(--brand); }
.work-title-link h3 { font-size: 24px; font-weight: 500; line-height: 1.4; }
.work-description { color: var(--text-2); font-size: 14px; line-height: 1.85; text-wrap: pretty; }
.work-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 16px 22px; margin-top: 10px; }
.work-actions .btn-pill { height: 42px; padding-inline: 20px; }
.work-more { display: inline-flex; align-items: center; gap: 8px; color: var(--text-2); font-size: 13px; }
.work-more:hover { color: var(--text-1); }
@media (min-width: 768px) {
  .work-card-featured { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr); align-items: stretch; }
  .work-card-featured .work-cover { height: 100%; }
  .work-card-featured .work-details { justify-content: center; padding: 32px; }
  .work-card-featured .work-title-link h3 { font-size: 30px; }
}
@media (max-width: 359px) {
  .work-details { padding: 22px; }
  .work-actions { column-gap: 16px; }
  .work-actions .btn-pill { padding-inline: 16px; }
}
</style>
