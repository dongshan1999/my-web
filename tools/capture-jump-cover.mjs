import { mkdir } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 840 }, deviceScaleFactor: 1 })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort())
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
  await page.goto('http://127.0.0.1:5173/my-web/#/games/jump')
  await page.locator('.jump-stage[data-renderer="ready"]').waitFor()
  await page.evaluate(() => document.fonts.ready)
  await mkdir('public/images', { recursive: true })
  const canvas = page.getByTestId('jump-canvas')
  const bounds = await canvas.boundingBox()
  await canvas.screenshot({ path: 'public/images/jump-game.jpg', type: 'jpeg', quality: 90 })
  if (errors.length) throw new Error(errors.join('\n'))
  console.log(`Captured actual gameplay: public/images/jump-game.jpg (${Math.round(bounds.width)} x ${Math.round(bounds.height)})`)
} finally {
  await browser.close()
}
