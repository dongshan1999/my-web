<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { ArrowLeft, Flag, Gauge, Pause, Play, RotateCcw, Timer, TriangleAlert } from '@lucide/vue'
import { RacerGame, type RacerSnapshot } from '../../games/racer/game'
import { createRacerScene, type RacerScene } from '../../games/racer/scene'
import { RouterLink } from 'vue-router'

const stageRef = ref<HTMLElement | null>(null)
const hostRef = ref<HTMLElement | null>(null)
const startRef = ref<HTMLButtonElement | null>(null)
const resumeRef = ref<HTMLButtonElement | null>(null)
const restartRef = ref<HTMLButtonElement | null>(null)
const rendererReady = ref(false)
const error = ref('')
const state = ref<RacerSnapshot>({ phase: 'ready', speed: 0, time: 0, distance: 0, progress: 0, collisions: 0, lateral: 0, impact: 0 })
let game: RacerGame | null = null
let scene: RacerScene | null = null
let raf = 0
let lastTime = 0
let clock = 0
let pointerSteer: -1 | 0 | 1 = 0
const pressedKeys = new Set<string>()

function requestFrame() {
  if (!raf && !document.hidden && !error.value) raf = requestAnimationFrame(frame)
}
function frame(now: number) {
  raf = 0
  if (!game || !scene || document.hidden || error.value) return
  const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 1 / 60
  lastTime = now
  clock += dt
  game.tick(dt)
  game.setSteer(pointerSteer || (pressedKeys.has('ArrowLeft') || pressedKeys.has('a') ? -1 : pressedKeys.has('ArrowRight') || pressedKeys.has('d') ? 1 : 0))
  scene.render(dt, clock)
  if (game.phase === 'racing') requestFrame()
  else lastTime = 0
}
function onChange(next: RacerSnapshot) {
  state.value = next
  requestFrame()
}
function start() {
  game?.start()
  lastTime = 0
  stageRef.value?.focus({ preventScroll: true })
  requestFrame()
}
function pause() {
  game?.pause()
  requestFrame()
}
function resume() {
  game?.resume()
  lastTime = 0
  stageRef.value?.focus({ preventScroll: true })
  requestFrame()
}
function restart() {
  game?.restart()
  lastTime = 0
  clock = 0
  stageRef.value?.focus({ preventScroll: true })
  requestFrame()
}
function togglePause() {
  if (state.value.phase === 'paused') resume()
  else pause()
}
function onKeyDown(event: KeyboardEvent) {
  if (['ArrowLeft', 'ArrowRight', 'ArrowDown', ' ', 'a', 'd', 'A', 'D', 's', 'S', 'r', 'R', 'Escape'].includes(event.key)) event.preventDefault()
  if (event.key === 'Escape' && (state.value.phase === 'racing' || state.value.phase === 'paused')) {
    togglePause()
    return
  }
  if (event.key === ' ' || event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') {
    game?.setBrake(true)
    requestFrame()
    return
  }
  if (event.key === 'r' || event.key === 'R') {
    restart()
    return
  }
  pressedKeys.add(event.key)
  requestFrame()
}
function onKeyUp(event: KeyboardEvent) {
  pressedKeys.delete(event.key)
  if (event.key === ' ' || event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') game?.setBrake(false)
}
function setPointerSteer(value: -1 | 0 | 1) {
  pointerSteer = value
  game?.setSteer(value)
  requestFrame()
}
function setBrake(value: boolean) {
  game?.setBrake(value)
  requestFrame()
}
function onVisibility() {
  cancelAnimationFrame(raf)
  raf = 0
  lastTime = 0
  if (document.hidden && state.value.phase === 'racing') game?.pause()
  else requestFrame()
}
function onBlur() {
  pressedKeys.clear()
  pointerSteer = 0
  if (state.value.phase === 'racing') game?.pause()
  requestFrame()
}
function onContextLost(event: Event) {
  event.preventDefault()
  error.value = '赛车画面暂时中断'
  cancelAnimationFrame(raf)
  raf = 0
}
function onContextRestored() {
  error.value = ''
  requestFrame()
}
function reload() {
  window.location.reload()
}
const formattedTime = computed(() => state.value.time.toFixed(2))
const speedKmh = computed(() => Math.round(state.value.speed * 5.8))
const progress = computed(() => Math.round(state.value.progress))
watch(() => state.value.phase, async (phase) => {
  await nextTick()
  if (phase === 'ready') startRef.value?.focus({ preventScroll: true })
  if (phase === 'paused') resumeRef.value?.focus({ preventScroll: true })
  if (phase === 'finished') restartRef.value?.focus({ preventScroll: true })
})

onMounted(() => {
  game = new RacerGame(onChange)
  try {
    scene = createRacerScene(hostRef.value!, game, requestFrame)
    rendererReady.value = true
    scene.canvas.addEventListener('webglcontextlost', onContextLost)
    scene.canvas.addEventListener('webglcontextrestored', onContextRestored)
    requestFrame()
  } catch (caught) {
    console.warn('Racer scene unavailable:', caught)
    error.value = '当前浏览器无法创建赛车画面'
  }
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)
  document.addEventListener('visibilitychange', onVisibility)
})
onUnmounted(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('blur', onBlur)
  document.removeEventListener('visibilitychange', onVisibility)
  scene?.canvas.removeEventListener('webglcontextlost', onContextLost)
  scene?.canvas.removeEventListener('webglcontextrestored', onContextRestored)
  scene?.dispose()
})
</script>

<template>
  <section class="racer-page">
    <div class="racer-heading">
      <div class="racer-title">
        <RouterLink to="/" class="back-button" aria-label="返回首页" title="返回首页">
          <ArrowLeft :size="20" :stroke-width="1.6" />
        </RouterLink>
        <h1>纸上公路</h1>
      </div>
      <span class="racer-kicker">PAPER ROAD / SOLO RACE</span>
    </div>

    <div
      ref="stageRef"
      class="racer-stage"
      tabindex="0"
      role="application"
      aria-label="纸绘风格赛车游戏"
      :data-phase="state.phase"
      :data-renderer="error ? 'error' : rendererReady ? 'ready' : 'loading'"
      :data-impact="state.impact > 0 ? 'active' : 'idle'"
    >
      <div ref="hostRef" class="racer-render-host" />
      <div class="racer-hud">
        <div class="racer-stat"><Timer :size="14" :stroke-width="1.5" /><span>时间</span><strong>{{ formattedTime }}</strong></div>
        <div class="racer-stat"><Gauge :size="14" :stroke-width="1.5" /><span>速度</span><strong>{{ speedKmh }}<small> km/h</small></strong></div>
        <div class="racer-stat"><Flag :size="14" :stroke-width="1.5" /><span>进度</span><strong>{{ progress }}%</strong></div>
        <div v-if="state.collisions" class="racer-stat collision-stat"><TriangleAlert :size="14" :stroke-width="1.5" /><span>碰撞</span><strong>{{ state.collisions }}</strong></div>
      </div>
      <div class="racer-toolbar">
        <button v-if="state.phase === 'racing' || state.phase === 'paused'" class="racer-icon-button" type="button" :aria-label="state.phase === 'paused' ? '继续比赛' : '暂停比赛'" :title="state.phase === 'paused' ? '继续比赛' : '暂停比赛'" @click="togglePause">
          <Play v-if="state.phase === 'paused'" :size="18" :stroke-width="1.6" />
          <Pause v-else :size="18" :stroke-width="1.6" />
        </button>
        <button class="racer-icon-button" type="button" aria-label="重新开始" title="重新开始" @click="restart"><RotateCcw :size="18" :stroke-width="1.6" /></button>
      </div>
      <div class="racer-progress"><span :style="{ transform: `scaleX(${state.progress / 100})` }" /></div>
      <div v-if="error" class="racer-overlay" role="status">
        <h2>{{ error }}</h2>
        <button class="btn-pill btn-primary" type="button" @click="reload"><RotateCcw :size="16" />重新加载</button>
      </div>
      <div v-else-if="state.phase === 'ready'" class="racer-overlay" role="dialog" aria-label="准备开始比赛">
        <span class="paper-label">ONE LAP / NO MAP</span>
        <h2>准备出发</h2>
        <p>左右转向，避开路障，在纸上跑完一圈。</p>
        <button ref="startRef" class="btn-pill btn-primary" type="button" :disabled="!rendererReady" @click="start"><Play :size="16" />开始比赛</button>
      </div>
      <div v-else-if="state.phase === 'paused'" class="racer-overlay" role="dialog" aria-label="比赛已暂停">
        <h2>比赛暂停</h2>
        <button ref="resumeRef" class="btn-pill btn-primary" type="button" @click="resume"><Play :size="16" />继续比赛</button>
      </div>
      <div v-else-if="state.phase === 'finished'" class="racer-overlay" role="dialog" aria-label="比赛完成">
        <span class="paper-label">FINISH LINE</span>
        <h2>完成！</h2>
        <strong class="finish-time">{{ formattedTime }}<small> s</small></strong>
        <p>碰撞 {{ state.collisions }} 次 · 路线完成</p>
        <button ref="restartRef" class="btn-pill btn-primary" type="button" @click="restart"><RotateCcw :size="16" />再跑一次</button>
      </div>
      <div v-if="!error && state.phase === 'racing'" class="touch-controls" aria-label="触摸驾驶控制">
        <button type="button" aria-label="向左转" title="向左转" @pointerdown.prevent="setPointerSteer(-1)" @pointerup="setPointerSteer(0)" @pointercancel="setPointerSteer(0)" @pointerleave="setPointerSteer(0)">←</button>
        <button type="button" aria-label="刹车" title="刹车" @pointerdown.prevent="setBrake(true)" @pointerup="setBrake(false)" @pointercancel="setBrake(false)" @pointerleave="setBrake(false)">刹车</button>
        <span>左右转向</span>
        <button type="button" aria-label="向右转" title="向右转" @pointerdown.prevent="setPointerSteer(1)" @pointerup="setPointerSteer(0)" @pointercancel="setPointerSteer(0)" @pointerleave="setPointerSteer(0)">→</button>
      </div>
    </div>
    <p class="racer-note">纸张剪裁风格 · 单人计时 · 碰撞会减速</p>
  </section>
</template>

<style scoped>
.racer-page { padding-top: 112px; }
.racer-heading { width: min(calc(100% - 32px), 1140px); margin: 0 auto 18px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.racer-title { display: flex; align-items: center; gap: 14px; }
.racer-title h1 { font-family: var(--font-brand); font-size: 26px; font-weight: 500; }
.back-button { display: grid; place-items: center; width: 36px; height: 36px; color: var(--text-2); border-radius: 50%; }
.back-button:hover { color: var(--text-1); background: var(--line-1); }
.racer-kicker { color: var(--text-3); font-family: var(--font-brand); font-size: 11px; letter-spacing: .04em; }
.racer-stage { position: relative; width: 100%; height: min(720px, calc(100svh - 170px)); min-height: 470px; overflow: hidden; background: #dfe9e2; color: #23323a; outline-offset: -3px; touch-action: none; user-select: none; }
.racer-stage[data-impact='active'] { box-shadow: inset 0 0 0 3px rgba(205, 92, 76, .58); }
.racer-render-host, .racer-render-host :deep(canvas) { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
.racer-hud { position: absolute; z-index: 2; top: 24px; left: max(20px, calc((100% - 1140px) / 2)); display: flex; gap: 20px; pointer-events: none; }
.racer-stat { display: grid; grid-template-columns: 16px auto; column-gap: 5px; align-items: center; min-width: 62px; color: #334850; }
.racer-stat svg { grid-row: span 2; }
.racer-stat span { font-size: 11px; }
.racer-stat strong { font-family: var(--font-brand); font-size: 22px; font-weight: 500; line-height: 1.15; }
.racer-stat small { font-family: var(--font-sans); font-size: 10px; font-weight: 400; }
.collision-stat { color: #c45f54; }
.racer-toolbar { position: absolute; z-index: 3; top: 20px; right: max(20px, calc((100% - 1140px) / 2)); display: flex; gap: 8px; }
.racer-icon-button { display: grid; place-items: center; width: 38px; height: 38px; border: 1px solid rgba(38, 62, 70, .22); border-radius: 50%; color: #2d424b; background: rgba(255, 255, 255, .55); cursor: pointer; -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); }
.racer-icon-button:hover { background: rgba(255, 255, 255, .82); }
.racer-progress { position: absolute; z-index: 2; left: 50%; bottom: 22px; transform: translateX(-50%); width: min(calc(100% - 48px), 260px); height: 4px; overflow: hidden; border-radius: 2px; background: rgba(44, 67, 72, .18); }
.racer-progress span { display: block; width: 100%; height: 100%; transform-origin: left; background: #e29d69; }
.racer-overlay { position: absolute; z-index: 4; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 15px; padding: 24px; background: rgba(233, 240, 232, .76); text-align: center; -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); }
.racer-overlay h2 { color: #263740; font-size: 24px; font-weight: 500; }
.racer-overlay p { max-width: 330px; color: #52656a; font-size: 14px; line-height: 1.8; }
.paper-label { color: #ba705e; font-family: var(--font-brand); font-size: 11px; letter-spacing: .08em; }
.finish-time { color: #263740; font-family: var(--font-brand); font-size: 64px; font-weight: 500; line-height: 1; }
.finish-time small { font-family: var(--font-sans); font-size: 16px; font-weight: 400; }
.touch-controls { position: absolute; z-index: 5; right: 20px; bottom: 46px; left: 20px; display: none; align-items: center; justify-content: space-between; pointer-events: none; }
.touch-controls button { display: grid; place-items: center; width: 54px; height: 46px; border: 1px solid rgba(38, 62, 70, .24); border-radius: 14px; color: #2c434b; background: rgba(255,255,255,.72); font-size: 24px; pointer-events: auto; touch-action: none; }
.touch-controls span { color: #53666b; font-size: 11px; }
.racer-note { width: min(calc(100% - 32px), 1140px); margin: 10px auto 40px; color: var(--text-3); font-size: 12px; text-align: right; }
@media (max-width: 639px) {
  .racer-page { padding-top: 142px; }
  .racer-heading { margin-bottom: 12px; }
  .racer-kicker { display: none; }
  .racer-stage { min-height: 580px; height: calc(100svh - 205px); }
  .racer-hud { top: 16px; left: 16px; gap: 12px; }
  .racer-stat { min-width: 48px; }
  .racer-stat strong { font-size: 18px; }
  .racer-toolbar { top: 14px; right: 14px; }
  .touch-controls { display: flex; }
  .racer-note { margin-top: 8px; text-align: center; }
}
@media (prefers-reduced-motion: reduce) {
  .racer-icon-button { transition: none; }
}
</style>
