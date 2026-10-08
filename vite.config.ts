import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages 部署路径：
// - 子路径部署（https://<user>.github.io/<repo>/）：改成 '/<repo>/'
// - 根路径部署（仓库名为 <user>.github.io）：设为 '/'
// 也可用环境变量覆盖：BASE_PATH=/ pnpm build
const base = process.env.BASE_PATH ?? '/my-web/'

// dev 专用：把未带 base 的页面路径 302 到 base 下。
// 否则手输 http://localhost:5173/games/jump 会直接 404（Vite 只重定向根路径）。
function redirectToBase(): import('vite').Plugin {
  return {
    name: 'dev-redirect-to-base',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '/'
        const baseNoSlash = base.replace(/\/$/, '')
        const isInternal = url.startsWith('/@') || url.includes('/node_modules/')
        if (isInternal || url === base || url.startsWith(base) || url === baseNoSlash) {
          next()
          return
        }
        res.statusCode = 302
        res.setHeader('Location', baseNoSlash + url)
        res.end()
      })
    },
  }
}

export default defineConfig({
  base,
  plugins: [vue(), tailwindcss(), redirectToBase()],
})
