<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import SiteHeader from './components/SiteHeader.vue'
import SiteFooter from './components/SiteFooter.vue'
import FluidBackground from './components/FluidBackground.vue'

const route = useRoute()
</script>

<template>
  <div class="site-shell flex min-h-screen flex-col">
    <!-- 流体烟雾背景：WebGL，鼠标划过扰动流体 -->
    <FluidBackground v-if="!['game-jump', 'game-racer'].includes(String(route.name))" />
    <SiteHeader />
    <main class="flex-1">
      <RouterView />
    </main>
    <SiteFooter />
  </div>
</template>
