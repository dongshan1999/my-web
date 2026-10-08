import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createServer } from 'vite'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'

let server
before(async () => {
  server = await createServer({ server: { middlewareMode: true }, logLevel: 'error' })
})
after(async () => { await server?.close() })

test('作品为空时渲染真实空态，不生成示例作品或开发提示', async () => {
  const content = await server.ssrLoadModule('/src/lib/content.ts')
  const saved = content.works.splice(0)
  try {
    const page = await server.ssrLoadModule('/src/pages/WorksPage.vue')
    const html = await renderToString(createSSRApp(page.default))
    assert.match(html, /暂无作品/)
    assert.match(html, /持续更新中/)
    assert.doesNotMatch(html, /示例作品|src\/content|work-card/)
  } finally {
    content.works.push(...saved)
  }
})

test('文档为空时只有更新状态，不输出空列表', async () => {
  const content = await server.ssrLoadModule('/src/lib/content.ts')
  assert.equal(content.docs.length, 0)
  const page = await server.ssrLoadModule('/src/pages/DocsPage.vue')
  const html = await renderToString(createSSRApp(page.default))
  assert.match(html, /暂无文档/)
  assert.match(html, /持续更新中/)
  assert.doesNotMatch(html, /doc-list|如何添加|部署指南|src\/content/)
})
