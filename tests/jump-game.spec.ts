import { expect, test, type Page } from '@playwright/test'

declare global {
  interface Window { __jumpDraws: number }
}
const errors = new WeakMap<Page, string[]>()

test.beforeEach(async ({ page }) => {
  errors.set(page, [])
  page.on('pageerror', (error) => errors.get(page)!.push(error.message))
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort())
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
  await page.addInitScript(() => {
    window.__jumpDraws = 0
    const proto = WebGL2RenderingContext.prototype
    const draw = proto.drawElements
    proto.drawElements = function (mode, count, type, offset) {
      draw.call(this, mode, count, type, offset)
      if ((this.canvas as HTMLCanvasElement).dataset.testid === 'jump-canvas') window.__jumpDraws++
    }
  })
  const start = new Date('2026-01-01T00:00:00Z')
  await page.clock.install({ time: start })
  await page.clock.pauseAt(new Date(start.getTime() + 1000))
})

test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([])
})

async function openGame(page: Page, theme: 'light' | 'dark' = 'light') {
  await page.emulateMedia({ colorScheme: theme })
  await page.goto('./#/games/jump')
  await expect(page.locator('.jump-stage')).toHaveAttribute('data-renderer', 'ready')
  await page.clock.runFor(100)
  await expect(page.locator('.fluid-bg')).toHaveCount(0)
}

async function pressMouse(page: Page, milliseconds = 460) {
  const button = await page.getByRole('button', { name: '蓄力起跳' }).boundingBox()
  await page.mouse.move(button!.x + button!.width / 2, button!.y + button!.height / 2)
  await page.mouse.down()
  await expect(page.locator('.jump-stage')).toHaveAttribute('data-phase', 'charging')
  await page.clock.runFor(milliseconds)
}

async function finishMouseJump(page: Page) {
  await page.mouse.up()
  await expect(page.locator('.jump-stage')).toHaveAttribute('data-phase', 'flying')
  await page.clock.runFor(1100)
}

async function imagePixels(page: Page, buffer: Buffer) {
  return page.evaluate(async (base64) => {
    const image = new Image()
    image.src = `data:image/png;base64,${base64}`
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 96
    const ctx = canvas.getContext('2d')!
    // 排除 HUD 与蓄力条，仅检查三维场景的中央区域。
    ctx.drawImage(image, image.width * 0.1, image.height * 0.2, image.width * 0.8, image.height * 0.5, 0, 0, 128, 96)
    const data = ctx.getImageData(0, 0, 128, 96).data
    const samples: number[] = []
    let colored = 0
    for (let i = 0; i < data.length; i += 4) {
      samples.push((data[i] + data[i + 1] + data[i + 2]) / 3)
      if (Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]) > 20) colored++
    }
    const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length
    return {
      samples,
      range: Math.max(...samples) - Math.min(...samples),
      deviation: Math.sqrt(samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) / samples.length),
      colored: colored / samples.length,
    }
  }, buffer.toString('base64'))
}

for (const theme of ['light', 'dark'] as const) {
  test(`${theme}: 三维画面非空白，鼠标蓄力落地得分`, async ({ page }, info) => {
    await openGame(page, theme)
    const canvas = page.getByTestId('jump-canvas')
    const initial = await imagePixels(page, await canvas.screenshot())
    expect(initial.range).toBeGreaterThan(50)
    expect(initial.deviation).toBeGreaterThan(7)
    expect(initial.colored).toBeGreaterThan(0.01)
    await page.screenshot({ path: info.outputPath(`jump-${theme}-ready.png`) })
    await pressMouse(page)
    await expect(page.getByRole('progressbar', { name: '蓄力' })).toHaveAttribute('aria-valuenow', /^(3[5-9]|40)$/)
    await page.mouse.up()
    await expect(page.locator('.jump-stage')).toHaveAttribute('data-phase', 'flying')
    await page.clock.runFor(160)
    const flying = await imagePixels(page, await canvas.screenshot())
    const delta = initial.samples.reduce((sum, value, index) => sum + Math.abs(value - flying.samples[index]), 0) / initial.samples.length
    expect(delta).toBeGreaterThan(0.1)
    await page.screenshot({ path: info.outputPath(`jump-${theme}-flying.png`) })
    await page.clock.runFor(1100)
    await expect(page.locator('.jump-stage')).toHaveAttribute('data-phase', 'ready')
    await expect(page.getByTestId('current-score')).toHaveText('2')
    await expect(page.getByTestId('best-score')).toHaveText('2')
    await expect(page.locator('.landing-feedback')).toContainText('正中中心')
    await page.screenshot({ path: info.outputPath(`jump-${theme}-landed.png`) })
    console.log(`${theme} scene: range=${initial.range.toFixed(2)}, colored=${initial.colored.toFixed(3)}, flying delta=${delta.toFixed(2)}`)
  })
}

test('空格蓄力松开跳跃，按键重复不重置蓄力', async ({ page }) => {
  await openGame(page)
  const scroll = await page.evaluate(() => scrollY)
  await page.keyboard.down('Space')
  await page.clock.runFor(200)
  await page.keyboard.down('Space')
  await page.clock.runFor(260)
  await page.keyboard.up('Space')
  await page.clock.runFor(1100)
  await expect(page.locator('.jump-stage')).toHaveAttribute('data-phase', 'ready')
  await expect(page.getByTestId('current-score')).toHaveText('2')
  expect(await page.evaluate(() => scrollY)).toBe(scroll)
})

test('蓄力封顶后跳空结束，重新开始清空本局', async ({ page }, info) => {
  await openGame(page)
  await pressMouse(page, 1500)
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  await page.mouse.up()
  await page.clock.runFor(1700)
  await expect(page.getByRole('dialog', { name: '本轮结束' })).toBeVisible()
  await expect(page.getByTestId('current-score')).toHaveText('0')
  await page.screenshot({ path: info.outputPath('jump-gameover.png') })
  await page.getByRole('button', { name: '再来一次' }).click({ force: true })
  await page.clock.runFor(100)
  await expect(page.locator('.jump-stage')).toHaveAttribute('data-phase', 'ready')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByTestId('current-score')).toHaveText('0')
})

test('指针在游戏区域外松开仍起跳', async ({ page }) => {
  await openGame(page)
  await pressMouse(page)
  await page.mouse.move(1, 1)
  await finishMouseJump(page)
  await expect(page.getByTestId('current-score')).toHaveText('2')
})

test('指针取消释放蓄力，不会意外起跳', async ({ page }) => {
  await openGame(page)
  await pressMouse(page, 300)
  await page.locator('.jump-stage').dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse', isPrimary: true })
  await page.mouse.up()
  await page.clock.runFor(1100)
  await expect(page.locator('.jump-stage')).toHaveAttribute('data-phase', 'ready')
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  await expect(page.getByTestId('current-score')).toHaveText('0')
})

test('飞行中暂停不继续绘制，恢复后完成落地', async ({ page }) => {
  await openGame(page)
  await pressMouse(page)
  await page.mouse.up()
  await page.clock.runFor(180)
  await page.getByRole('button', { name: '暂停游戏', exact: true }).click({ force: true })
  await page.clock.runFor(100)
  await expect(page.getByRole('dialog', { name: '游戏已暂停' })).toBeVisible()
  const draws = await page.evaluate(() => window.__jumpDraws)
  await page.clock.runFor(1600)
  expect(await page.evaluate(() => window.__jumpDraws)).toBe(draws)
  await expect(page.getByTestId('current-score')).toHaveText('0')
  await page.getByRole('dialog').getByRole('button', { name: '继续游戏' }).click({ force: true })
  await page.clock.runFor(1000)
  await expect(page.getByTestId('current-score')).toHaveText('2')
})

test('切后台取消蓄力并暂停，返回后需要显式继续', async ({ page }) => {
  await openGame(page)
  await pressMouse(page, 300)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.mouse.up()
  await page.clock.runFor(1000)
  await page.evaluate(() => {
    delete (document as unknown as Record<string, unknown>).hidden
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.clock.runFor(100)
  await expect(page.locator('.jump-stage')).toHaveAttribute('data-phase', 'paused')
  await page.getByRole('dialog').getByRole('button', { name: '继续游戏' }).click({ force: true })
  await page.clock.runFor(100)
  await expect(page.locator('.jump-stage')).toHaveAttribute('data-phase', 'ready')
  await expect(page.getByTestId('current-score')).toHaveText('0')
})

test('最高分跨刷新保存，本局得分重置', async ({ page }) => {
  await openGame(page)
  await pressMouse(page)
  await finishMouseJump(page)
  await expect(page.getByTestId('best-score')).toHaveText('2')
  await page.reload()
  await page.clock.runFor(100)
  await expect(page.locator('.jump-stage')).toHaveAttribute('data-renderer', 'ready')
  await expect(page.getByTestId('current-score')).toHaveText('0')
  await expect(page.getByTestId('best-score')).toHaveText('2')
})

test('存储不可用仍可游玩，重开保留本次会话最高分', async ({ page }) => {
  await page.addInitScript(() => {
    const getItem = Storage.prototype.getItem
    const setItem = Storage.prototype.setItem
    Storage.prototype.getItem = function (key) {
      if (key === 'my-web.jump.best.v1') throw new DOMException('Storage denied', 'SecurityError')
      return getItem.call(this, key)
    }
    Storage.prototype.setItem = function (key, value) {
      if (key === 'my-web.jump.best.v1') throw new DOMException('Storage denied', 'SecurityError')
      return setItem.call(this, key, value)
    }
  })
  await openGame(page)
  await pressMouse(page)
  await finishMouseJump(page)
  await expect(page.getByTestId('best-score')).toHaveText('2')
  await page.getByRole('button', { name: '重新开始', exact: true }).click({ force: true })
  await page.clock.runFor(100)
  await expect(page.getByTestId('current-score')).toHaveText('0')
  await expect(page.getByTestId('best-score')).toHaveText('2')
})

test('WebGL2 不可用时呈现明确错误，仍能离开游戏页', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type: string, options: any) {
      if (type === 'webgl2') return null
      return getContext.call(this, type as any, options)
    } as typeof getContext
  })
  await page.goto('./#/games/jump')
  await expect(page.locator('.jump-stage')).toHaveAttribute('data-renderer', 'error')
  await expect(page.getByRole('button', { name: '重新加载' })).toBeVisible()
  await expect(page.getByRole('button', { name: '蓄力起跳' })).toHaveCount(0)
  await page.getByRole('link', { name: '返回首页', exact: true }).click({ force: true })
  await page.clock.runFor(100)
  await expect(page.getByRole('heading', { name: '作品与记录', exact: true })).toBeVisible()
})

test('离开游戏后恢复网站背景，返回无重复画布', async ({ page }) => {
  await openGame(page)
  await page.getByRole('link', { name: '返回首页', exact: true }).click({ force: true })
  await page.clock.runFor(100)
  await expect(page.locator('.fluid-bg')).toHaveAttribute('data-renderer', 'webgl')
  await expect(page.getByTestId('jump-canvas')).toHaveCount(0)
  await page.getByRole('navigation').getByRole('link', { name: '小游戏', exact: true }).click({ force: true })
  await page.clock.runFor(100)
  await expect(page.getByTestId('jump-canvas')).toHaveCount(1)
  await expect(page.locator('.jump-stage')).toHaveAttribute('data-phase', 'ready')
})

test.describe('触屏', () => {
  test.use({ hasTouch: true, isMobile: true })
  for (const width of [390, 320]) {
    test(`手机 ${width}px: 画面完整、长按松开得分`, async ({ page, context }, info) => {
      await page.setViewportSize({ width, height: 844 })
      await openGame(page, 'dark')
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      const initial = await imagePixels(page, await page.getByTestId('jump-canvas').screenshot())
      expect(initial.range).toBeGreaterThan(50)
      expect(initial.colored).toBeGreaterThan(0.01)
      const header = await page.locator('header').boundingBox()
      const stage = await page.locator('.jump-stage').boundingBox()
      expect(stage!.y).toBeGreaterThan(header!.y + header!.height)
      const chargeButton = await page.getByRole('button', { name: '蓄力起跳' }).boundingBox()
      expect(chargeButton!.x).toBeGreaterThanOrEqual(0)
      expect(chargeButton!.x + chargeButton!.width).toBeLessThanOrEqual(width)
      const cdp = await context.newCDPSession(page)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: chargeButton!.x + chargeButton!.width / 2, y: chargeButton!.y + chargeButton!.height / 2, id: 1 }] })
      await expect(page.locator('.jump-stage')).toHaveAttribute('data-phase', 'charging')
      await page.clock.runFor(460)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await page.clock.runFor(1100)
      await expect(page.locator('.jump-stage')).toHaveAttribute('data-phase', 'ready')
      await expect(page.getByTestId('current-score')).toHaveText('2')
      await page.screenshot({ path: info.outputPath(`jump-mobile-${width}.png`) })
      await cdp.detach()
    })
  }
})
