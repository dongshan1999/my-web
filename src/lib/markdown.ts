import MarkdownIt from 'markdown-it'

/** 全站共用的 Markdown 渲染器 */
export const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true,
})

/** 渲染 Markdown 文本为 HTML 字符串（配合 v-html 使用） */
export function renderMarkdown(source: string): string {
  return md.render(source)
}
