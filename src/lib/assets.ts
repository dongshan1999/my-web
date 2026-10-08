export function assetUrl(path?: string): string {
  if (!path) return ''
  if (/^(https?:\/\/|\/\/|data:)/i.test(path)) return path
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`
}
