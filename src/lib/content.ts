import fm from 'front-matter'

/** Markdown 文件头部的元信息（front-matter） */
export interface ContentMeta {
  title: string
  date?: string
  tags?: string[]
  description?: string
  cover?: string
  play?: string
}

/** 一篇内容 = 元信息 + Markdown 正文 */
export interface ContentItem extends ContentMeta {
  /** 文件名（不含 .md），同时是路由参数 */
  slug: string
  /** Markdown 原文 */
  body: string
}

/** YAML 里的日期会被解析成 Date 对象，统一归一化为 YYYY-MM-DD 字符串 */
function normalizeDate(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'string' && value.trim() !== '') return value
  return undefined
}

/** 把 glob 收集到的原始模块解析为内容列表，按日期倒序 */
function parseModules(modules: Record<string, string>): ContentItem[] {
  return Object.entries(modules)
    .map(([path, raw]) => {
      const slug = path.split('/').pop()!.replace(/\.md$/, '')
      const { attributes, body } = fm<ContentMeta>(raw)
      return {
        slug,
        ...attributes,
        date: normalizeDate(attributes.date),
        body,
      }
    })
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
}

// 注意：import.meta.glob 的模式必须是静态字符串字面量（Vite 编译期分析），
// 不能写成 `../content/${kind}/*.md` 这样的动态模板串。
const worksModules = import.meta.glob('../content/works/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const docsModules = import.meta.glob('../content/docs/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/**
 * 新增一篇内容 = 往对应目录放一个 .md 文件，列表自动更新，无需维护清单。
 */
export const works: ContentItem[] = parseModules(worksModules)
export const docs: ContentItem[] = parseModules(docsModules)

export function findItem(
  kind: 'works' | 'docs',
  slug: string,
): ContentItem | undefined {
  return (kind === 'works' ? works : docs).find((item) => item.slug === slug)
}
