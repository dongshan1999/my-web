<script setup lang="ts">
import { site } from '../profile'
</script>

<template>
  <footer class="border-t border-line-1">
    <div
      class="mx-auto flex w-[min(calc(100%_-_32px),1140px)] flex-col items-center justify-between gap-2 py-8 text-sm text-ink-3 sm:flex-row"
    >
      <p>© {{ new Date().getFullYear() }} {{ site.title }}</p>
      <p>
        部署于
        <a
          href="https://pages.github.com"
          target="_blank"
          rel="noopener"
          class="text-brand hover:underline"
          >GitHub Pages</a
        >
      </p>
    </div>
  </footer>
</template>
