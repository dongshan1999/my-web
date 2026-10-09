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

## 基础分享信息与微信限制

`index.html` 的 `<head>` 提供静态 Open Graph 元信息，预览平台不需要执行 Vue
就能读取网站标题、简介和图片。默认标题为“作品与记录”，简介为
“把想法做成作品。作品展示与在线小游戏，持续更新中。”，图片使用
`public/images/jump-game.jpg` 的实际游戏截图。

- 修改标题时，同时更新 `src/profile.ts`、`<title>`、`og:title` 和 `og:site_name`。
- 修改简介时，同时更新 `description` 和 `og:description`。
- 替换图片时，更新 `og:image`、图片类型、尺寸及替代文字，确保图片可以公开访问。
- `og:url` 和 `og:image` 使用绝对 HTTPS 地址；其中 `%BASE_URL%` 由 Vite
  按 `base` 自动替换。更换账号或绑定自定义域名时，还需要修改这两项中的域名。
- hash 路由共享同一份 HTML，因此基础预览信息是站点级的，不能依靠这些标签
  为每个作品或游戏生成不同的预览。

**这些标签不是微信分享接口，不保证微信聊天中显示自定义卡片。** 直接粘贴网址发送
不等于网页分享，不能通过添加 HTML 标签强制变成卡片。可以在微信中打开网页后
从右上角菜单分享给朋友，但未接入 JS-SDK 时，标题和图片仍由客户端决定。

需要明确控制微信转发的标题、简介和图片时，应按
[微信 JS-SDK 官方说明](https://developers.weixin.qq.com/doc/subscription/guide/h5/jssdk.html)
接入 `wx.updateAppMessageShareData`。前提是具有分享接口权限的已认证公众号、
可配置为 JS 接口安全域名的备案域名，以及服务端签名接口。
GitHub Pages 本身不能运行签名服务；`AppSecret`、`access_token` 和 `jsapi_ticket`
不能放入前端代码或公开仓库。签名 URL 不包含 `#` 及其后面的路由，但实际分享链接
应保留完整路由。

构建后，启动预览服务并验证元信息及图片路径：

```bash
pnpm build
pnpm preview
TEST_BASE_URL=http://localhost:4173/my-web/ pnpm test:e2e tests/share-metadata.spec.ts
```

发布后还需检查公网 HTML 和图片地址，再在微信真机上打开并转发测试。
本地浏览器检查不能证明微信卡片的实际显示效果。

## 检查项

- Pages 的 Source 已设为 GitHub Actions。
- 推送分支与工作流中的 `main` 一致。
- `base` 与实际站点路径一致。
- `pnpm-lock.yaml` 与依赖一起提交，CI 不临时重算依赖版本。
- 封面、源码和配置已提交；依赖、缓存、环境秘密及测试截图未提交。
- 发布后检查首页、作品封面、文档空态、跳一跳和纸上公路赛车。
