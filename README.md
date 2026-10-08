# my-web · 作品与记录

面向 GitHub Pages 的静态个人网站，包含作品展示、Markdown 文档和可在线游玩的跳一跳。
只展示实际发布的内容，没有文档或作品时显示持续更新状态。

## 技术栈

- Vite 8、Vue 3、TypeScript 5.9
- Vue Router hash 路由，支持 GitHub Pages 深链接刷新
- Tailwind CSS 4、Markdown-it、front-matter
- 程序化 WebGL 流水背景、鼠标与触屏交互、深浅主题
- Three.js 场景、cannon-es 跳跃物理与碰撞

## 本地运行

建议使用 Node.js 24 或更新版本。pnpm 版本由 `package.json` 的 `packageManager` 固定。

```bash
pnpm install --frozen-lockfile
pnpm dev
```

- 首页：`http://localhost:5173/my-web/#/`
- 跳一跳：`http://localhost:5173/my-web/#/games/jump`

```bash
pnpm build     # 类型检查并生成 dist/
pnpm preview   # 预览生产构建，默认 http://localhost:4173/my-web/
```

游戏支持鼠标、空格和触屏长按蓄力、松开起跳，包含中心连击、暂停、重开和最高分保存。
游戏资源按路由懒加载，进入游戏时停止网站流水背景，退出时释放场景资源。

## 目录

```text
.github/workflows/   GitHub Pages 自动部署
src/components/     导航、封面、内容空态、流水背景
src/content/works/  已发布作品
src/content/docs/   已发布文档，目前为空
src/games/jump/     跳一跳物理规则与三维场景
src/lib/            内容解析和资源地址
src/pages/          页面组件
src/profile.ts      站点标题和标语
public/images/      真实游戏截图封面
/docs/              仓库维护和部署说明，不作为站内文章发布
/tests/             浏览器回归与单元测试
/tools/             游戏封面制作工具
```

## 内容维护

- 修改站点标题和标语：编辑 `src/profile.ts`，导航、首页与页脚同步更新。
- 发布作品：在 `src/content/works/` 添加 `.md`，元信息可设置标题、简介、标签、封面和游玩路径。
- 发布文档：在 `src/content/docs/` 添加 `.md`，列表和详情路由自动生成。
- 封面以 `public/` 为根引用，例如 `images/jump-game.jpg`；资源地址自动跟随 Vite `base`。
- 没有封面或加载失败时显示更新中状态，不生成假封面。

更多说明见 [内容维护](docs/maintaining-content.md)。

跳一跳封面来自实际游戏截图。启动开发服务器后可重新拍摄：

```bash
node tools/capture-jump-cover.mjs
```

## 测试

```bash
pnpm test:game     # 跳跃物理、落点、连击和最高分
pnpm test:content  # 作品和文档为空时的实际 Vue 渲染
```

浏览器回归需要本机安装 Google Chrome，并先启动开发服务器：

```bash
pnpm test:e2e
```

测试覆盖流水像素变化、游戏输入、计分、暂停、主题、封面、空态和手机布局。
为保持截图稳定，测试屏蔽外部字体请求并使用系统字体回退。
截图和报告输出到 `test-results/`，不进入 Git。

生产版本验证：先执行 `pnpm build`、`pnpm preview`，再运行：

```bash
TEST_BASE_URL=http://localhost:4173/my-web/ pnpm test:e2e
```

## GitHub Pages

1. 将仓库推送到 GitHub 的 `main` 分支。
2. 首次部署前，在 `vite.config.ts` 中设置 `base`：项目站点为 `/仓库名/`，根站点为 `/`。
3. 仓库 Settings → Pages → Source 选择 **GitHub Actions**。
4. 之后推送到 `main` 时由 `.github/workflows/deploy.yml` 自动构建发布。

也可以通过 `BASE_PATH` 环境变量覆盖构建路径，例如 `BASE_PATH=/ pnpm build`。
对外分享页面时保留 `#/` 路由，例如 `https://user.github.io/repo/#/games/jump`。
GitHub Pages 没有服务器端 SPA fallback，不依赖开发服务器的无 hash 路径纠正。

更多说明见 [部署指南](docs/deployment.md)。
