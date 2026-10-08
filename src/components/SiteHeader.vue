<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { CodeXml, Moon, Sun } from '@lucide/vue'
import { site } from '../profile'

const links = [
  { to: '/', label: '首页' },
  { to: '/works', label: '作品' },
  { to: '/docs', label: '文档' },
  { to: '/games/jump', label: '小游戏' },
]
const scrolled = ref(false)
const isDark = ref(false)
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')

function onScroll() {
  scrolled.value = window.scrollY > 8
}
function syncTheme() {
  const theme = document.documentElement.dataset.theme
  isDark.value = theme ? theme === 'dark' : systemTheme.matches
}
function toggleTheme() {
  const next = isDark.value ? 'light' : 'dark'
  document.documentElement.dataset.theme = next
  try {
    localStorage.setItem('theme', next)
  } catch {
    // 隐私模式下仍允许本次会话切换主题。
  }
  syncTheme()
}
onMounted(() => {
  onScroll()
  syncTheme()
  window.addEventListener('scroll', onScroll, { passive: true })
  systemTheme.addEventListener('change', syncTheme)
})
onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
  systemTheme.removeEventListener('change', syncTheme)
})
</script>

<template>
  <header class="site-header">
    <div class="header-bar" :class="scrolled ? 'header-glass' : 'header-rest'">
      <RouterLink to="/" class="site-brand" :aria-label="`${site.title} · 首页`">
        <span class="brand-mark" aria-hidden="true"><CodeXml :size="18" :stroke-width="1.5" /></span>
        <span class="brand-name">{{ site.title }}</span>
      </RouterLink>
      <nav aria-label="主导航" class="site-navigation">
        <RouterLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="navigation-link"
          active-class="is-active"
        >
          {{ link.label }}
        </RouterLink>
      </nav>
      <button
        type="button"
        class="theme-toggle"
        :aria-label="isDark ? '切换到浅色模式' : '切换到深色模式'"
        :title="isDark ? '切换到浅色模式' : '切换到深色模式'"
        @click="toggleTheme"
      >
        <Sun v-if="isDark" :size="17" :stroke-width="1.5" aria-hidden="true" />
        <Moon v-else :size="17" :stroke-width="1.5" aria-hidden="true" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.site-header {
  position: fixed;
  inset: 0 0 auto;
  z-index: 50;
  padding-top: 12px;
  pointer-events: none;
}
.header-bar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 16px;
  width: min(calc(100% - 32px), 1140px);
  margin: 0 auto;
  padding: 10px 16px;
  border: 1px solid transparent;
  border-radius: 16px;
  pointer-events: auto;
  transition: background-color 200ms ease, border-color 200ms ease, box-shadow 200ms ease;
}
.header-rest { background: transparent; }
.site-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  width: fit-content;
  max-width: 100%;
  color: var(--text-1);
}
.brand-mark {
  display: grid;
  place-items: center;
  flex: 0 0 32px;
  width: 32px;
  height: 32px;
  border: 1px solid var(--line-2);
  border-radius: 8px;
  background: var(--glass-layer);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
}
.brand-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-brand);
  font-size: 14px;
  font-weight: 500;
}
.site-navigation {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}
.navigation-link {
  position: relative;
  padding: 8px 9px;
  color: var(--text-2);
  font-size: 13px;
  line-height: 20px;
  white-space: nowrap;
  transition: color 160ms ease;
}
.navigation-link:hover,
.navigation-link.is-active { color: var(--text-1); }
.navigation-link::after {
  content: '';
  position: absolute;
  inset: auto 10px 2px;
  height: 1px;
  background: currentColor;
  transform: scaleX(0);
  transition: transform 160ms ease;
}
.navigation-link.is-active::after { transform: scaleX(1); }
.theme-toggle {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  color: var(--text-2);
  cursor: pointer;
  transition: color 160ms ease, background-color 160ms ease;
}
.theme-toggle:hover { color: var(--text-1); background: var(--line-1); }
@media (max-width: 639px) {
  .header-bar {
    grid-template-columns: minmax(0, 1fr) auto;
    row-gap: 3px;
    padding: 8px 12px;
  }
  .site-navigation {
    grid-column: 1 / -1;
    grid-row: 2;
    justify-content: center;
    gap: 12px;
  }
  .navigation-link { padding: 8px 6px; }
  .navigation-link::after { left: 6px; right: 6px; }
  .theme-toggle { grid-column: 2; grid-row: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .header-bar, .navigation-link, .navigation-link::after, .theme-toggle { transition: none; }
}
</style>
