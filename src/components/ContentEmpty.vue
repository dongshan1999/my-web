<script setup lang="ts">
import { FileText } from '@lucide/vue'

defineProps<{ title: string }>()
</script>

<template>
  <div class="content-empty" role="status">
    <FileText :size="26" :stroke-width="1.2" aria-hidden="true" />
    <h2>{{ title }}</h2>
    <p>持续更新中。</p>
  </div>
</template>

<style scoped>
.content-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 68px 24px;
  border-top: 1px solid var(--line-2);
  border-bottom: 1px solid var(--line-2);
  text-align: center;
}
.content-empty > svg { color: var(--text-3); margin-bottom: 4px; }
.content-empty h2 { color: var(--text-2); font-size: 16px; font-weight: 400; }
.content-empty p { color: var(--text-3); font-size: 13px; }
</style>
