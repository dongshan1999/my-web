# GitHub Pages 部署

网站是纯静态构建，不需要后端服务。生产文件由 Vite 输出到 `dist/`，
GitHub Actions 上传构建产物并发布到 GitHub Pages，不把构建目录提交到 Git。

## 本地准备

建议使用 Node.js 24 或更新版本。pnpm 版本固定在 `package.json` 的 `packageManager` 中。

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm preview
```

默认预览地址：`http://localhost:4173/my-web/`。

## 设置站点路径

首次推送部署前，需要确定访问地址并配置 `vite.config.ts` 中的 `base`：

| 站点类型 | 地址 | base |
| --- | --- | --- |
| 项目站点 | `https://user.github.io/repo/` | `/repo/` |
| 用户根站点 | `https://user.github.io/` | `/` |
| 自定义域名根路径 | `https://example.com/` | `/` |

当前默认值是 `/my-web/`，实际仓库名不同就需要调整。
也可以在构建时通过环境变量覆盖：

```bash
BASE_PATH=/ pnpm build
```

## 首次发布

1. 在 GitHub 创建仓库并将本地 `main` 分支推送过去。
2. 仓库 Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**。
3. 推送到 `main`，或在 Actions 中手动运行 **Deploy to GitHub Pages**。
4. 等待 `build` 和 `deploy` 两个任务完成，从部署任务中打开 Pages 地址。

工作流位于 `.github/workflows/deploy.yml`，读取项目固定的 pnpm 版本，
使用 `pnpm install --frozen-lockfile` 和 `pnpm build`，上传 `dist/` 后执行官方 Pages 部署。
后续每次推送到 `main` 自动更新。

## 页面链接

网站使用 hash 路由。对外分享时应保留 `#/`，例如：

```text
https://user.github.io/repo/#/works
https://user.github.io/repo/#/docs
https://user.github.io/repo/#/games/jump
```

GitHub Pages 不能为 SPA 配置服务端路径重写。开发服务器提供的无 hash 路径纠正
只方便本地预览，不保证部署后的 `/games/jump` 等路径可直接访问。

## 检查项

- Pages 的 Source 已设为 GitHub Actions。
- 推送分支与工作流中的 `main` 一致。
- `base` 与实际站点路径一致。
- `pnpm-lock.yaml` 与依赖一起提交，CI 不临时重算依赖版本。
- 封面、源码和配置已提交；依赖、缓存、环境秘密及测试截图未提交。
- 发布后检查首页、作品封面、文档空态和跳一跳。
