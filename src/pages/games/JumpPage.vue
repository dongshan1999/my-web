<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowLeft, ArrowUp, Pause, Play, RotateCcw, Trophy } from '@lucide/vue'
import { BEST_SCORE_KEY, JumpGame, readBestScore, type GameSnapshot } from '../../games/jump/game'
import { createJumpScene, type JumpScene } from '../../games/jump/scene'

const stageRef = ref<HTMLElement | null>(null)
const hostRef = ref<HTMLElement | null>(null)
const resumeRef = ref<HTMLButtonElement | null>(null)
const retryRef = ref<HTMLButtonElement | null>(null)
const renderError = ref('')
const rendererReady = ref(false)
const state = ref<GameSnapshot>({ phase: 'ready', score: 0, best: 0, streak: 0, charge: 0, feedback: '', runId: 0 })
const canCharge = computed(() => rendererReady.value && !renderError.value && ['ready', 'charging'].includes(state.value.phase))
let game: JumpGame | null = null
let scene: JumpScene | null = null
let raf = 0
let lastTime = 0
let gameTime = 0
let bestSaved = 0
let pointerId: number | null = null
let activeInput: 'pointer' | 'keyboard' | null = null
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')

function requestFrame() {
  if (!raf && !document.hidden && !renderError.value) raf = requestAnimationFrame(frame)
}
function frame(now: number) {
  raf = 0
  if (!game || !scene || document.hidden || renderError.value) return
  const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 1 / 60
  lastTime = now
  if (!game.paused) gameTime += dt
  game.tick(dt)
  scene.render(dt, gameTime)
  const active = !game.paused && game.phase !== 'gameover'
  if (active && (!reducedMotion.matches || game.phase !== 'ready' || game.feedback)) requestFrame()
  else lastTime = 0
}
function onStateChange(value: GameSnapshot) {
  state.value = value
  if (value.best > bestSaved) {
    bestSaved = value.best
    try {
      localStorage.setItem(BEST_SCORE_KEY, String(bestSaved))
    } catch {
      // 存储受限时，本次会话的最高分仍保留。
    }
  }
  requestFrame()
}
function clearInput() {
  const captured = pointerId
  activeInput = null
  pointerId = null
  game?.cancelCharge()
  if (captured !== null && stageRef.value?.hasPointerCapture(captured)) stageRef.value.releasePointerCapture(captured)
}
function onPointerDown(event: PointerEvent) {
  const target = event.target as Element
  if (target.closest('button, a') && !target.closest('[data-charge]')) return
  if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return
  if (activeInput || !canCharge.value || !game?.beginCharge()) return
  event.preventDefault()
  activeInput = 'pointer'
  pointerId = event.pointerId
  stageRef.value?.focus({ preventScroll: true })
  stageRef.value?.setPointerCapture(event.pointerId)
  requestFrame()
}
function onPointerUp(event: PointerEvent) {
  if (activeInput !== 'pointer' || pointerId !== event.pointerId) return
  event.preventDefault()
  const captured = pointerId
  activeInput = null
  pointerId = null
  game?.release()
  if (captured !== null && stageRef.value?.hasPointerCapture(captured)) stageRef.value.releasePointerCapture(captured)
  requestFrame()
}
function onPointerCancel(event: PointerEvent) {
  if (event.pointerId === pointerId) {
    clearInput()
    requestFrame()
  }
}
function onKeyDown(event: KeyboardEvent) {
  const target = event.target as Element
  if (target.closest('button, a') && !target.closest('[data-charge]')) return
  if (event.code === 'Escape') {
    event.preventDefault()
    togglePause()
  }
  if (event.code !== 'Space') return
  event.preventDefault()
  if (event.repeat || activeInput || !canCharge.value || !game?.beginCharge()) return
  activeInput = 'keyboard'
  requestFrame()
}
function onKeyUp(event: KeyboardEvent) {
  if (event.code !== 'Space' || activeInput !== 'keyboard') return
  event.preventDefault()
  activeInput = null
  game?.release()
  requestFrame()
}
function togglePause() {
  clearInput()
  if (game?.paused) resume()
  else game?.pause()
  requestFrame()
}
function resume() {
  game?.resume()
  lastTime = 0
  stageRef.value?.focus({ preventScroll: true })
  requestFrame()
}
function restart() {
  clearInput()
  game?.restart()
  lastTime = 0
  gameTime = 0
  stageRef.value?.focus({ preventScroll: true })
  requestFrame()
}
function onBlur() {
  clearInput()
  game?.pause()
  requestFrame()
}
function onVisibilityChange() {
  cancelAnimationFrame(raf)
  raf = 0
  lastTime = 0
  if (document.hidden) {
    clearInput()
    game?.pause()
  } else requestFrame()
}
function onContextLost(event: Event) {
  event.preventDefault()
  clearInput()
  game?.pause()
  cancelAnimationFrame(raf)
  raf = 0
  renderError.value = '游戏画面暂时中断'
}
function onContextRestored() {
  renderError.value = ''
  requestFrame()
}
function reload() {
  window.location.reload()
}
watch(() => state.value.phase, async (phase) => {
  await nextTick()
  if (phase === 'paused') resumeRef.value?.focus({ preventScroll: true })
  if (phase === 'gameover') retryRef.value?.focus({ preventScroll: true })
})

onMounted(() => {
  try {
    bestSaved = readBestScore(localStorage)
  } catch {
    bestSaved = 0
  }
  game = new JumpGame({ best: bestSaved, onChange: onStateChange })
  try {
    scene = createJumpScene(hostRef.value!, game, requestFrame)
    scene.render(0, 0)
    rendererReady.value = true
    scene.canvas.addEventListener('webglcontextlost', onContextLost)
    scene.canvas.addEventListener('webglcontextrestored', onContextRestored)
    stageRef.value?.focus({ preventScroll: true })
    requestFrame()
  } catch (error) {
    console.warn('Jump scene unavailable:', error)
    renderError.value = '当前浏览器无法创建游戏画面'
    cancelAnimationFrame(raf)
    raf = 0
  }
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)
  document.addEventListener('visibilitychange', onVisibilityChange)
  reducedMotion.addEventListener('change', requestFrame)
})
onUnmounted(() => {
  clearInput()
  cancelAnimationFrame(raf)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('blur', onBlur)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  reducedMotion.removeEventListener('change', requestFrame)
  scene?.canvas.removeEventListener('webglcontextlost', onContextLost)
  scene?.canvas.removeEventListener('webglcontextrestored', onContextRestored)
  scene?.dispose()
})
</script>

<template>
  <section class="jump-page">
    <div class="jump-heading">
      <div class="jump-title">
        <RouterLink to="/" class="back-button" aria-label="返回首页" title="返回首页">
          <ArrowLeft :size="20" :stroke-width="1.6" />
        </RouterLink>
        <h1>跳一跳</h1>
      </div>
      <span v-if="state.streak > 1" class="streak">连续中心 ×{{ state.streak }}</span>
    </div>

    <div
      ref="stageRef"
      class="jump-stage"
      tabindex="0"
      role="group"
      aria-label="跳一跳游戏"
      aria-describedby="jump-controls"
      :data-phase="state.phase"
      :data-renderer="renderError ? 'error' : rendererReady ? 'ready' : 'loading'"
      @pointerdown="onPointerDown"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
      @lostpointercapture="onPointerCancel"
      @keydown="onKeyDown"
      @contextmenu.prevent
    >
      <div ref="hostRef" class="jump-render-host" />
      <p id="jump-controls" class="sr-only">在游戏区域按住鼠标或触屏，或按住空格键蓄力，松开起跳。Escape 暂停。落在下一个平台得分，连续落在中心可加分。</p>
      <div class="game-hud">
        <div class="score-counter">
          <span>得分</span>
          <strong data-testid="current-score">{{ state.score }}</strong>
        </div>
        <div class="score-counter best-counter">
          <span><Trophy :size="12" :stroke-width="1.6" /> 最高</span>
          <strong data-testid="best-score">{{ state.best }}</strong>
        </div>
      </div>
      <div class="game-toolbar">
        <button
          class="game-icon-button"
          type="button"
          :disabled="!rendererReady || !!renderError || state.phase === 'gameover'"
          :aria-label="state.phase === 'paused' ? '继续游戏' : '暂停游戏'"
          :title="state.phase === 'paused' ? '继续游戏' : '暂停游戏'"
          @click="togglePause"
        >
          <Play v-if="state.phase === 'paused'" :size="18" :stroke-width="1.6" />
          <Pause v-else :size="18" :stroke-width="1.6" />
        </button>
        <button class="game-icon-button" type="button" aria-label="重新开始" title="重新开始" :disabled="!rendererReady || !!renderError" @click="restart">
          <RotateCcw :size="18" :stroke-width="1.6" />
        </button>
      </div>

      <div v-if="state.feedback" class="landing-feedback" aria-live="polite">{{ state.feedback }}</div>
      <div v-if="renderError" class="game-overlay" role="status">
        <h2>{{ renderError }}</h2>
        <button class="btn-pill btn-primary" type="button" @click="reload"><RotateCcw :size="16" />重新加载</button>
      </div>
      <div v-else-if="state.phase === 'paused'" class="game-overlay" role="dialog" aria-label="游戏已暂停">
        <h2>已暂停</h2>
        <button ref="resumeRef" class="btn-pill btn-primary" type="button" @click="resume"><Play :size="16" />继续游戏</button>
      </div>
      <div v-else-if="state.phase === 'gameover'" class="game-overlay" role="dialog" aria-label="本轮结束">
        <span class="result-label">本轮得分</span>
        <strong class="result-score">{{ state.score }}</strong>
        <p class="result-best">最高 {{ state.best }}</p>
        <button ref="retryRef" class="btn-pill btn-primary" type="button" @click="restart"><RotateCcw :size="16" />再来一次</button>
      </div>
      <div v-if="!renderError && !['paused', 'gameover'].includes(state.phase)" class="jump-input">
        <div class="charge-heading"><span>蓄力</span><span>{{ state.charge }}%</span></div>
        <div class="charge-track" role="progressbar" aria-label="蓄力" :aria-valuenow="state.charge" aria-valuemin="0" aria-valuemax="100">
          <span :style="{ transform: `scaleX(${state.charge / 100})` }" />
        </div>
        <button data-charge class="jump-charge-button" type="button" aria-label="蓄力起跳" title="蓄力起跳" :disabled="!canCharge">
          <ArrowUp :size="18" :stroke-width="1.8" />起跳
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.jump-page { padding-top: 124px; }
.jump-heading { width: min(calc(100% - 32px), 1140px); margin: 0 auto 20px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.jump-title { display: flex; align-items: center; gap: 14px; }
h1 { font-family: var(--font-brand); font-size: 26px; font-weight: 500; line-height: 1.4; }
.back-button { display: grid; place-items: center; width: 36px; height: 36px; color: var(--text-2); border-radius: 50%; }
.back-button:hover { color: var(--text-1); background: var(--line-1); }
.streak { font-size: 12px; color: var(--text-2); }
.jump-stage { position: relative; width: 100%; height: min(720px, calc(100svh - 185px)); min-height: 420px; overflow: hidden; touch-action: none; user-select: none; background: var(--bg-raised); color: var(--text-1); outline-offset: -3px; }
.jump-render-host { position: absolute; inset: 0; }
.jump-render-host :deep(canvas) { display: block; width: 100%; height: 100%; }
.game-hud { position: absolute; z-index: 2; top: 22px; left: max(20px, calc((100% - 1140px) / 2)); display: flex; gap: 24px; pointer-events: none; }
.score-counter { display: grid; gap: 4px; min-width: 56px; }
.score-counter > span { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-2); }
.score-counter strong { font-family: var(--font-brand); font-size: 36px; font-weight: 500; line-height: 1.15; font-variant-numeric: tabular-nums; }
.best-counter strong { font-size: 24px; color: var(--text-2); }
.game-toolbar { position: absolute; z-index: 4; top: 20px; right: max(20px, calc((100% - 1140px) / 2)); display: flex; gap: 8px; }
.game-icon-button { width: 38px; height: 38px; display: grid; place-items: center; border: 1px solid var(--line-2); border-radius: 50%; background: var(--glass-layer); color: var(--text-1); cursor: pointer; -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); }
.game-icon-button:hover:not(:disabled) { background: var(--glass-raised); }
.game-icon-button:disabled { cursor: default; opacity: 0.35; }
.jump-input { position: absolute; z-index: 2; left: 50%; bottom: 24px; transform: translateX(-50%); width: min(calc(100% - 48px), 260px); display: grid; gap: 9px; }
.charge-heading { display: flex; justify-content: space-between; font-size: 11px; color: var(--text-2); font-variant-numeric: tabular-nums; }
.charge-track { height: 4px; overflow: hidden; border-radius: 2px; background: var(--line-2); }
.charge-track > span { display: block; width: 100%; height: 100%; transform-origin: left; background: #70bca4; }
.jump-charge-button { margin: 6px auto 0; display: flex; align-items: center; justify-content: center; gap: 9px; width: 150px; height: 46px; border: 1px solid var(--line-2); border-radius: 100px; color: var(--btn-text); background: var(--btn-bg); font-size: 14px; font-weight: 500; cursor: pointer; touch-action: none; }
.jump-charge-button:active:not(:disabled) { transform: translateY(1px); }
.jump-charge-button:disabled { opacity: 0.5; cursor: default; }
.landing-feedback { position: absolute; z-index: 2; top: 110px; left: 50%; transform: translateX(-50%); padding: 7px 14px; font-size: 14px; font-weight: 500; color: var(--text-1); background: var(--glass-layer); border: 1px solid var(--line-2); border-radius: 100px; -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); white-space: nowrap; }
.game-overlay { position: absolute; z-index: 3; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; padding: 24px; background: var(--glass-panel); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); text-align: center; }
.game-overlay h2 { font-size: 22px; font-weight: 500; }
.result-label, .result-best { color: var(--text-2); font-size: 14px; }
.result-score { font-family: var(--font-brand); font-size: 64px; line-height: 1; font-weight: 500; }
.game-overlay .btn-pill { margin-top: 8px; }
@media (min-width: 640px) {
  .jump-page { padding-top: 104px; }
  .jump-stage { height: min(720px, calc(100svh - 165px)); }
}
@media (max-height: 520px) {
  .jump-stage { min-height: 360px; }
}
</style>
