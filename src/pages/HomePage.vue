<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { ArrowRight, BookOpen, Gamepad2 } from '@lucide/vue'
import { site } from '../profile'
import { docs, works } from '../lib/content'
import WorkCard from '../components/WorkCard.vue'
import ContentEmpty from '../components/ContentEmpty.vue'

const featured = works.slice(0, 3)
</script>

<template>
  <div>
    <section class="site-banner" aria-labelledby="site-title">
      <p class="site-status"><span aria-hidden="true" />持续更新中</p>
      <h1 id="site-title" class="site-title">{{ site.title }}</h1>
      <p class="site-tagline">{{ site.tagline }}</p>
      <div class="site-actions">
        <RouterLink to="/works" class="btn-pill btn-primary site-primary">
          浏览作品 <ArrowRight :size="16" :stroke-width="1.6" aria-hidden="true" />
        </RouterLink>
        <RouterLink to="/games/racer" class="btn-pill btn-secondary">
          纸上公路
        </RouterLink>
      </div>
    </section>

    <section class="content-section" aria-labelledby="home-works">
      <div class="section-heading">
        <h2 id="home-works" class="ds-subtitle">作品</h2>
        <RouterLink to="/works" class="section-more">
          全部作品 <ArrowRight :size="15" :stroke-width="1.6" aria-hidden="true" />
        </RouterLink>
      </div>
      <div v-if="featured.length" class="work-grid" :class="{ 'work-grid-single': featured.length === 1 }">
        <WorkCard v-for="item in featured" :key="item.slug" :item="item" :featured="featured.length === 1" />
      </div>
      <ContentEmpty v-else title="暂无作品" />
    </section>

    <section class="content-overview" aria-label="更多内容">
      <div class="overview-row">
        <BookOpen :size="20" :stroke-width="1.4" aria-hidden="true" />
        <div class="overview-copy">
          <h2>文档</h2>
          <p>{{ docs.length ? `${docs.length} 篇文档` : '暂无文档，持续更新中。' }}</p>
        </div>
        <RouterLink to="/docs" class="section-more" aria-label="查看文档">
          查看 <ArrowRight :size="15" :stroke-width="1.6" aria-hidden="true" />
        </RouterLink>
      </div>
      <div class="overview-row">
        <Gamepad2 :size="20" :stroke-width="1.4" aria-hidden="true" />
        <div class="overview-copy">
          <h2>小游戏</h2>
          <p>纸上公路 · 赛车</p>
        </div>
        <RouterLink to="/games/racer" class="section-more" aria-label="游玩纸上公路">
          赛车 <ArrowRight :size="15" :stroke-width="1.6" aria-hidden="true" />
        </RouterLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.site-banner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: min(520px, calc(100svh - 156px));
  padding: 124px 24px 64px;
  text-align: center;
}
.site-status { display: inline-flex; align-items: center; gap: 8px; color: var(--text-2); font-size: 12px; line-height: 1.6; }
.site-status > span { width: 5px; height: 5px; border-radius: 50%; background: #78ad99; }
.site-title {
  max-width: min(100%, 920px);
  margin-top: 18px;
  color: var(--text-1);
  font-family: var(--font-brand);
  font-size: 64px;
  font-weight: 500;
  line-height: 1.25;
  letter-spacing: 0;
  overflow-wrap: anywhere;
  text-wrap: balance;
}
.site-tagline { max-width: 100%; margin-top: 22px; color: var(--text-2); font-size: 18px; line-height: 1.7; text-wrap: balance; }
.site-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-top: 32px; }
.site-actions .btn-pill { min-width: 134px; }
.site-primary :deep(svg) { transition: transform 180ms ease; }
.site-primary:hover :deep(svg) { transform: translateX(3px); }
.content-section { width: min(calc(100% - 32px), 1140px); margin: 0 auto; padding-bottom: 56px; }
.section-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
.section-more { display: inline-flex; align-items: center; gap: 8px; color: var(--text-3); font-size: 13px; white-space: nowrap; }
.section-more:hover { color: var(--text-1); }
.work-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }
.work-grid-single { grid-template-columns: minmax(0, 1fr); }
.content-overview { width: min(calc(100% - 32px), 1140px); margin: 0 auto; padding-bottom: 80px; }
.overview-row { display: grid; grid-template-columns: 24px minmax(0, 1fr) auto; align-items: center; gap: 18px; padding: 28px 0; border-top: 1px solid var(--line-2); }
.overview-row:last-child { border-bottom: 1px solid var(--line-2); }
.overview-row > svg { color: var(--text-2); }
.overview-copy { display: grid; gap: 7px; }
.overview-copy h2 { font-size: 16px; font-weight: 500; color: var(--text-1); }
.overview-copy p { color: var(--text-3); font-size: 13px; line-height: 1.7; }
@media (max-width: 1023px) {
  .site-title { font-size: 56px; }
  .work-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .work-grid-single { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 639px) {
  .site-banner { min-height: min(480px, calc(100svh - 92px)); padding: 140px 24px 48px; }
  .site-title { font-size: 40px; }
  .site-tagline { margin-top: 18px; font-size: 16px; }
  .site-actions { gap: 10px; margin-top: 26px; }
  .site-actions .btn-pill { min-width: 124px; padding: 0 18px; }
  .work-grid { grid-template-columns: minmax(0, 1fr); }
  .content-section { padding-bottom: 40px; }
  .overview-row { gap: 12px; padding: 24px 0; }
}
@media (max-height: 650px) and (min-width: 640px) {
  .site-banner { padding-top: 100px; padding-bottom: 40px; }
  .site-title { font-size: 48px; }
  .site-tagline { margin-top: 18px; font-size: 16px; }
  .site-actions { margin-top: 22px; }
}
@media (prefers-reduced-motion: reduce) {
  .site-primary :deep(svg) { transition: none; }
  .site-primary:hover :deep(svg) { transform: none; }
}
</style>
