import { expect, test, type Page } from '@playwright/test'

type Pixels = { samples: number[]; min: number; max: number; mean: number; deviation: number }

declare global {
  interface Window {
    __fluidDraws: number
    __fluidFreeze: boolean
    __captureFluid?: (result: Pixels) => void
  }
}

const errors = new WeakMap<Page, string[]>()

test.beforeEach(async ({ page }) => {
  errors.set(page, [])
  page.on('pageerror', (error) => errors.get(page)!.push(error.message))
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort())
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
  // 绘制后立即读取 framebuffer，避免默认清空绘图缓冲造成假空白。
  await page.addInitScript(() => {
    window.__fluidDraws = 0
    window.__fluidFreeze = false
    const locations = new Map<WebGLUniformLocation, string>()
    const proto = WebGLRenderingContext.prototype
    const getLocation = proto.getUniformLocation
    proto.getUniformLocation = function (program, name) {
      const location = getLocation.call(this, program, name)
      if (location) locations.set(location, name)
      return location
    }
    const uniform = proto.uniform1f
    proto.uniform1f = function (location, value) {
      uniform.call(this, location, window.__fluidFreeze && location && locations.get(location) === 'uTime' ? 12 : value)
    }
    const draw = proto.drawArrays
    proto.drawArrays = function (mode, first, count) {
      draw.call(this, mode, first, count)
      const canvas = this.canvas as HTMLCanvasElement
      if (!canvas.closest('.fluid-bg')) return
      window.__fluidDraws++
      const capture = window.__captureFluid
      if (!capture) return
      window.__captureFluid = undefined
      const width = this.drawingBufferWidth
      const height = this.drawingBufferHeight
      const buffer = new Uint8Array(width * height * 4)
      this.readPixels(0, 0, width, height, this.RGBA, this.UNSIGNED_BYTE, buffer)
      const samples: number[] = []
      for (let y = 0; y < height; y += Math.max(1, Math.floor(height / 36))) {
        for (let x = 0; x < width; x += Math.max(1, Math.floor(width / 64))) {
          const index = (y * width + x) * 4
          samples.push((buffer[index] + buffer[index + 1] + buffer[index + 2]) / 3)
        }
      }
      const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length
      capture({
        samples,
        min: Math.min(...samples),
        max: Math.max(...samples),
        mean,
        deviation: Math.sqrt(samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) / samples.length),
      })
    }
  })
})

test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([])
})

async function capture(page: Page): Promise<Pixels> {
  return page.evaluate(() => new Promise<Pixels>((resolve) => {
    window.__captureFluid = resolve
    window.dispatchEvent(new Event('resize'))
  }))
}

function difference(a: Pixels, b: Pixels) {
  return a.samples.reduce((sum, value, index) => sum + Math.abs(value - b.samples[index]), 0) / a.samples.length
}

for (const theme of ['dark', 'light'] as const) {
  test(`${theme}: 流水非空白且随时间变化`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'no-preference' })
    await page.goto('./#/')
    await expect(page.locator('.fluid-bg')).toHaveAttribute('data-renderer', 'webgl')
    const first = await capture(page)
    expect(first.max - first.min).toBeGreaterThan(35)
    expect(first.deviation).toBeGreaterThan(7)
    if (theme === 'light') expect(first.min).toBeLessThan(220)
    else expect(first.max).toBeGreaterThan(60)
    await page.waitForTimeout(800)
    const next = await capture(page)
    const delta = difference(first, next)
    console.log(`${theme} framebuffer: range=${(first.max - first.min).toFixed(2)}, deviation=${first.deviation.toFixed(2)}, animation delta=${delta.toFixed(2)}`)
    expect(delta).toBeGreaterThan(0.3)
    await page.screenshot({ path: info.outputPath(`home-${theme}.png`) })
  })
}

test('鼠标移动真实改变流水形状（冻结流动时间隔离验证）', async ({ page }, info) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('./#/')
  await expect(page.locator('.fluid-bg')).toHaveAttribute('data-renderer', 'webgl')
  await page.evaluate(() => { window.__fluidFreeze = true })
  const first = await capture(page)
  await page.mouse.move(310, 220, { steps: 12 })
  await page.waitForTimeout(200)
  const afterPointer = await capture(page)
  const delta = difference(first, afterPointer)
  console.log(`pointer-only framebuffer delta=${delta.toFixed(2)}`)
  expect(delta).toBeGreaterThan(0.5)
  await page.screenshot({ path: info.outputPath('mouse-interaction.png') })
})

for (const width of [390, 320]) {
  test(`手机 ${width}px: 无横向溢出，导航不重叠`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 })
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('./#/')
    await expect(page.locator('.fluid-bg')).toHaveAttribute('data-renderer', 'webgl')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    const navigation = await page.locator('header nav a').evaluateAll((links) => links.map((link) => {
      const box = link.getBoundingClientRect()
      return { left: box.left, right: box.right, bottom: box.bottom }
    }))
    for (let i = 0; i < navigation.length; i++) {
      expect(navigation[i].left).toBeGreaterThanOrEqual(0)
      expect(navigation[i].right).toBeLessThanOrEqual(width)
      if (i) expect(navigation[i].left).toBeGreaterThanOrEqual(navigation[i - 1].right)
    }
    const title = await page.locator('h1').boundingBox()
    expect(title!.y).toBeGreaterThan(navigation[0].bottom)
    await page.screenshot({ path: info.outputPath(`mobile-${width}.png`) })
  })
}

test('减少动画时停止重绘，切主题仍刷新一次', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  await page.goto('./#/')
  await expect(page.locator('.fluid-bg')).toHaveAttribute('data-renderer', 'webgl')
  await capture(page)
  const start = await page.evaluate(() => window.__fluidDraws)
  await page.waitForTimeout(400)
  expect(await page.evaluate(() => window.__fluidDraws)).toBe(start)
  await page.getByRole('button', { name: '切换到浅色模式' }).click()
  const light = await capture(page)
  expect(light.mean).toBeGreaterThan(170)
  const changed = await page.evaluate(() => window.__fluidDraws)
  await page.waitForTimeout(300)
  expect(await page.evaluate(() => window.__fluidDraws)).toBe(changed)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await expect.poll(() => page.evaluate(() => window.__fluidDraws)).toBeGreaterThan(changed + 2)
})

test('主题选择刷新保留，玻璃背景属性有效', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  await page.goto('./#/')
  await page.getByRole('button', { name: '切换到深色模式' }).click()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  const pixels = await capture(page)
  expect(pixels.mean).toBeLessThan(120)
  const glass = await page.locator('.ds-card').first().evaluate((element) => {
    const style = getComputedStyle(element)
    return { background: style.backgroundColor, blur: style.backdropFilter || style.getPropertyValue('-webkit-backdrop-filter') }
  })
  expect(glass.background).toMatch(/rgba/)
  expect(glass.blur).toContain('blur')
})

test('WebGL 不可用时正常降级，导航仍可使用', async ({ page }, info) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type: string, options: any) {
      if (type === 'webgl') return null
      return getContext.call(this, type as any, options)
    } as typeof getContext
  })
  await page.goto('./#/')
  await expect(page.locator('.fluid-bg')).toHaveAttribute('data-renderer', 'fallback')
  expect(await page.locator('.fluid-bg').evaluate((element) => getComputedStyle(element).backgroundImage)).not.toBe('none')
  await page.getByRole('navigation').getByRole('link', { name: '文档' }).click()
  await expect(page.getByRole('heading', { name: '文档', exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('webgl-fallback.png') })
})

test('WebGL 上下文丢失后可以恢复渲染', async ({ page }) => {
  await page.goto('./#/')
  await expect(page.locator('.fluid-bg')).toHaveAttribute('data-renderer', 'webgl')
  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('.fluid-bg canvas')!
    const extension = canvas.getContext('webgl')!.getExtension('WEBGL_lose_context')!
    extension.loseContext()
    setTimeout(() => extension.restoreContext(), 300)
  })
  await expect(page.locator('.fluid-bg')).toHaveAttribute('data-renderer', 'fallback')
  await expect(page.locator('.fluid-bg')).toHaveAttribute('data-renderer', 'webgl')
  expect((await capture(page)).deviation).toBeGreaterThan(7)
})

test.describe('触屏输入', () => {
  test.use({ hasTouch: true })
  test('手机触摸改变流水形状', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('./#/')
    await expect(page.locator('.fluid-bg')).toHaveAttribute('data-renderer', 'webgl')
    await page.evaluate(() => { window.__fluidFreeze = true })
    const first = await capture(page)
    await page.touchscreen.tap(90, 130)
    await page.waitForTimeout(200)
    const next = await capture(page)
    expect(difference(first, next)).toBeGreaterThan(0.5)
  })
})

test('页面隐藏时暂停绘制，恢复后继续动画', async ({ page }) => {
  await page.goto('./#/')
  await expect(page.locator('.fluid-bg')).toHaveAttribute('data-renderer', 'webgl')
  await capture(page)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  const paused = await page.evaluate(() => window.__fluidDraws)
  await page.waitForTimeout(300)
  expect(await page.evaluate(() => window.__fluidDraws)).toBe(paused)
  await page.evaluate(() => {
    delete (document as unknown as Record<string, unknown>).hidden
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect.poll(() => page.evaluate(() => window.__fluidDraws)).toBeGreaterThan(paused + 2)
})

test('真实作品、文档空态和游戏页面路由正常', async ({ page }) => {
  await page.goto('./#/')
  await page.getByRole('navigation').getByRole('link', { name: '作品', exact: true }).click()
  await page.locator('.work-title-link').first().click()
  await expect(page.locator('article')).toBeVisible()
  await page.getByRole('navigation').getByRole('link', { name: '文档', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('暂无文档')
  await expect(page.getByRole('status')).toContainText('持续更新中')
  await page.getByRole('navigation').getByRole('link', { name: '跳一跳', exact: true }).click()
  await expect(page.getByRole('heading', { name: '跳一跳', exact: true })).toBeVisible()
})
