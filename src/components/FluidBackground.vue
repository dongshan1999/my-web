<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const renderState = ref('initializing')
let cleanup = () => {}

function initRenderer(canvas: HTMLCanvasElement): () => void {
  const context = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'low-power',
  })
  if (!context) {
    renderState.value = 'fallback'
    return () => {}
  }
  const gl = context
  const shaders: WebGLShader[] = []
  const program = gl.createProgram()
  const buffer = gl.createBuffer()
  if (!program || !buffer) {
    gl.deleteProgram(program)
    gl.deleteBuffer(buffer)
    renderState.value = 'fallback'
    return () => {}
  }

  const precision = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)
  const vertexSource = `
    attribute vec2 aPosition;
    void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
  `
  const fragmentSource = `
    precision ${precision?.precision ? 'highp' : 'mediump'} float;
    uniform vec2 uResolution;
    uniform float uTime;
    uniform vec2 uPointer;
    uniform vec2 uVelocity;
    uniform float uActivity;
    uniform vec3 uBase;
    uniform vec3 uMist;
    uniform float uContrast;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 345.45));
      p += dot(p, p + 34.345);
      return fract(p.x * p.y);
    }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 s = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), s.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), s.x), s.y);
    }
    float fbm(vec2 p) {
      float value = 0.0;
      float amplitude = 0.5;
      mat2 rotation = mat2(0.8, -0.6, 0.6, 0.8);
      for (int i = 0; i < 4; i++) {
        value += noise(p) * amplitude;
        p = rotation * p * 2.04 + 3.7;
        amplitude *= 0.5;
      }
      return value;
    }
    void main() {
      vec2 uv = gl_FragCoord.xy / uResolution;
      float aspect = uResolution.x / uResolution.y;
      vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
      vec2 pointer = (uPointer - 0.5) * vec2(aspect, 1.0);
      vec2 offset = p - pointer;
      float influence = exp(-dot(offset, offset) * 13.0) * uActivity;

      // 平滑位移和切向偏转改变流水本身，指针中心不产生尖锐折痕。
      p += offset * influence * 0.7;
      p += vec2(-offset.y, offset.x) * influence * 0.65;
      p -= uVelocity * influence * 0.45;

      float t = uTime * 0.12;
      p *= 2.1;
      vec2 drift = vec2(t * 0.32, -t * 0.24);
      vec2 warp = vec2(fbm(p + drift), fbm(p + vec2(4.8, 1.7) - drift));
      vec2 flow = p + (warp - 0.5) * 2.9;
      float folded = fbm(flow + vec2(2.3, t * 0.38));
      float wave = sin(flow.x * 2.8 + flow.y * 3.3 + folded * 5.5 - t);
      float ribbon = pow(0.5 + 0.5 * wave, 7.0);
      float edge = pow(0.5 + 0.5 * sin(flow.x * 2.8 + flow.y * 3.3 + folded * 5.5 - t + 0.45), 20.0);
      float body = smoothstep(0.23, 0.78, folded);
      float field = ribbon * 0.68 + edge * 0.25 + body * 0.18;

      // 保留标题区域的对比度，亮纹向两侧延伸。
      vec2 readingArea = (uv - vec2(0.5, 0.62)) * vec2(2.0, 3.2);
      float readability = 1.0 - 0.62 * exp(-dot(readingArea, readingArea) * 3.0);
      float vignette = 1.0 - smoothstep(0.35, 0.95, length(uv - 0.5)) * 0.5;
      float amount = clamp(field * uContrast * readability * vignette, 0.0, 0.86);

      // mix 同时支持深色增亮和浅色压暗，避免白底加光被截成纯白。
      vec3 color = mix(uBase, uMist, amount);
      float grain = (hash(gl_FragCoord.xy + fract(uTime) * 20.0) - 0.5) / 255.0;
      gl_FragColor = vec4(color + grain, 1.0);
    }
  `

  function disposeGpu() {
    for (const shader of shaders) gl.deleteShader(shader)
    gl.deleteProgram(program)
    gl.deleteBuffer(buffer)
  }
  function compile(type: number, source: string) {
    const shader = gl.createShader(type)
    if (!shader) throw new Error('Unable to allocate background shader')
    shaders.push(shader)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) ?? 'Background shader compilation failed')
    }
    gl.attachShader(program, shader)
  }
  try {
    compile(gl.VERTEX_SHADER, vertexSource)
    compile(gl.FRAGMENT_SHADER, fragmentSource)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) ?? 'Background shader linking failed')
    }
  } catch (error) {
    console.warn('Fluid background unavailable:', error)
    disposeGpu()
    renderState.value = 'fallback'
    return () => {}
  }
  gl.useProgram(program)
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const position = gl.getAttribLocation(program, 'aPosition')
  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
  const uniforms = Object.fromEntries(
    ['uResolution', 'uTime', 'uPointer', 'uVelocity', 'uActivity', 'uBase', 'uMist', 'uContrast']
      .map((name) => [name, gl.getUniformLocation(program, name)]),
  )

  const palettes = {
    dark: { base: [0.035, 0.04, 0.047], mist: [0.63, 0.66, 0.7], contrast: 0.92 },
    light: { base: [0.97, 0.978, 0.985], mist: [0.38, 0.46, 0.53], contrast: 0.6 },
  }
  const systemTheme = matchMedia('(prefers-color-scheme: dark)')
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)')
  function getPalette() {
    const theme = document.documentElement.dataset.theme
    return palettes[theme === 'dark' || (theme !== 'light' && systemTheme.matches) ? 'dark' : 'light']
  }
  let targetPalette = getPalette()
  const palette = {
    base: [...targetPalette.base],
    mist: [...targetPalette.mist],
    contrast: targetPalette.contrast,
  }
  const pointer = { x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5, vx: 0, vy: 0, activity: 0 }
  let raf = 0
  let lastFrame = 0
  let elapsed = 12
  let disposed = false
  let lost = false

  function resize() {
    // 低频流水不需要满屏 Retina 分辨率，限制像素总量以控制 GPU 开销。
    const scale = Math.min(0.8, Math.sqrt(650000 / (innerWidth * innerHeight)))
    canvas.width = Math.max(1, Math.round(innerWidth * scale))
    canvas.height = Math.max(1, Math.round(innerHeight * scale))
    gl.viewport(0, 0, canvas.width, canvas.height)
  }
  function requestFrame() {
    if (!raf && !disposed && !lost && !document.hidden) raf = requestAnimationFrame(draw)
  }
  function draw(now: number) {
    raf = 0
    if (disposed || lost || document.hidden) return
    const reduced = motionPreference.matches
    if (!reduced && lastFrame && now - lastFrame < 1000 / 30) {
      requestFrame()
      return
    }
    const dt = lastFrame ? Math.min((now - lastFrame) / 1000, 0.1) : 1 / 30
    lastFrame = now
    const smoothing = reduced ? 1 : 1 - Math.exp(-dt * 7)
    if (!reduced) {
      elapsed += dt
      pointer.x += (pointer.targetX - pointer.x) * smoothing
      pointer.y += (pointer.targetY - pointer.y) * smoothing
      pointer.vx *= Math.exp(-dt * 5)
      pointer.vy *= Math.exp(-dt * 5)
      pointer.activity *= Math.exp(-dt * 0.9)
    }
    for (let i = 0; i < 3; i++) {
      palette.base[i] += (targetPalette.base[i] - palette.base[i]) * smoothing
      palette.mist[i] += (targetPalette.mist[i] - palette.mist[i]) * smoothing
    }
    palette.contrast += (targetPalette.contrast - palette.contrast) * smoothing
    gl.uniform2f(uniforms.uResolution, canvas.width, canvas.height)
    gl.uniform1f(uniforms.uTime, elapsed)
    gl.uniform2f(uniforms.uPointer, pointer.x, 1 - pointer.y)
    gl.uniform2f(uniforms.uVelocity, pointer.vx, -pointer.vy)
    gl.uniform1f(uniforms.uActivity, reduced ? 0 : pointer.activity)
    gl.uniform3fv(uniforms.uBase, palette.base)
    gl.uniform3fv(uniforms.uMist, palette.mist)
    gl.uniform1f(uniforms.uContrast, palette.contrast)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    if (!reduced) requestFrame()
  }
  function onPointerMove(event: PointerEvent) {
    if (motionPreference.matches) return
    const x = event.clientX / innerWidth
    const y = event.clientY / innerHeight
    pointer.vx = Math.max(-0.4, Math.min(0.4, (x - pointer.targetX) * 4))
    pointer.vy = Math.max(-0.4, Math.min(0.4, (y - pointer.targetY) * 4))
    pointer.targetX = x
    pointer.targetY = y
    pointer.activity = 1
  }
  function onResize() {
    resize()
    requestFrame()
  }
  function onThemeChange() {
    targetPalette = getPalette()
    requestFrame()
  }
  function onMotionChange() {
    cancelAnimationFrame(raf)
    raf = 0
    lastFrame = 0
    requestFrame()
  }
  function onVisibilityChange() {
    cancelAnimationFrame(raf)
    raf = 0
    lastFrame = 0
    requestFrame()
  }
  function onContextLost(event: Event) {
    event.preventDefault()
    lost = true
    cancelAnimationFrame(raf)
    raf = 0
    renderState.value = 'fallback'
  }
  function onContextRestored() {
    dispose()
    cleanup = initRenderer(canvas)
  }
  const observer = new MutationObserver(onThemeChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  systemTheme.addEventListener('change', onThemeChange)
  motionPreference.addEventListener('change', onMotionChange)
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('pointerdown', onPointerMove, { passive: true })
  window.addEventListener('resize', onResize, { passive: true })
  document.addEventListener('visibilitychange', onVisibilityChange)
  canvas.addEventListener('webglcontextlost', onContextLost)
  canvas.addEventListener('webglcontextrestored', onContextRestored)
  resize()
  renderState.value = 'webgl'
  requestFrame()

  function dispose() {
    disposed = true
    cancelAnimationFrame(raf)
    observer.disconnect()
    systemTheme.removeEventListener('change', onThemeChange)
    motionPreference.removeEventListener('change', onMotionChange)
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerdown', onPointerMove)
    window.removeEventListener('resize', onResize)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    canvas.removeEventListener('webglcontextlost', onContextLost)
    canvas.removeEventListener('webglcontextrestored', onContextRestored)
    disposeGpu()
  }
  return dispose
}

onMounted(() => {
  if (canvasRef.value) cleanup = initRenderer(canvasRef.value)
})
onUnmounted(() => cleanup())
</script>

<template>
  <div class="fluid-bg" :data-renderer="renderState" aria-hidden="true">
    <canvas ref="canvasRef" />
  </div>
</template>

<style scoped>
.fluid-bg {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  overflow: hidden;
  background: var(--bg-base);
}
.fluid-bg canvas {
  display: block;
  width: 100%;
  height: 100%;
}
.fluid-bg[data-renderer='fallback'] {
  background: var(--flow-fallback);
}
.fluid-bg[data-renderer='fallback'] canvas {
  visibility: hidden;
}
.fluid-bg::after {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0.55;
  background-image:
    linear-gradient(var(--flow-grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--flow-grid) 1px, transparent 1px);
  background-size: 96px 96px;
  mask-image: linear-gradient(to bottom, black, transparent 85%);
}
</style>
