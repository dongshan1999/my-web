# 内容维护

这里是仓库维护说明，不会出现在网站的公开文档列表中。
公开内容分别放在 `src/content/works/` 和 `src/content/docs/`，每个目录只收集当前层级的 `.md` 文件。
没有实际发布的内容时保留空目录，页面显示持续更新状态，不添加占位文章。

## 发布作品

在 `src/content/works/` 添加英文文件名的 Markdown 文件，文件名就是详情页 slug。
现有作品的元信息如下：

```yaml
---
title: 跳一跳
tags: [单机游戏, 可在线游玩]
description: 一个平台跳跃小游戏。
cover: images/jump-game.jpg
play: /games/jump
---
```

- `title`：必填，展示标题。
- `description`：可选，一句话简介；缺少时不显示虚构简介。
- `tags`：可选，标签数组。
- `cover`：可选，真实封面图片；本地文件放在 `public/`，填写相对该目录的路径。
- `play`：可选，网站内的游玩路由，例如 `/games/jump`。
- `date`：可选，真实发布日期，建议写成引号包裹的 `YYYY-MM-DD` 字符串；列表按日期倒序。

访问地址为 `/#/works/文件名`。没有封面或图片加载失败时显示封面持续更新状态。

## 发布文档

在 `src/content/docs/` 新建 `.md` 文件，使用相同的 `title`、`description`、`tags` 和 `date` 元信息。
正文使用 Markdown，文档自动出现在列表中，详情地址为 `/#/docs/文件名`。
不要把未完成的草稿放入这个目录；仓库说明和开发记录放在 `docs/`。

## Markdown 范围

目前支持标题、列表、表格、链接、图片、引用和代码块。
代码块使用等宽排版，没有接入语法高亮或数学公式渲染插件。
Markdown 来自仓库内受信文件，允许 HTML；不要直接发布未审查的外部内容。

## 站点与资源

- 站点标题和标语：`src/profile.ts`。
- 路由：`src/router/index.ts`。
- GitHub Pages 部署路径：`vite.config.ts` 的 `base`，或构建环境变量 `BASE_PATH`。
- 游戏真实封面：`public/images/jump-game.jpg`。
- 重新拍摄封面：开发服务器运行时执行 `node tools/capture-jump-cover.mjs`。

正文中指向站内页面的链接应使用 hash 路由，例如 `[游玩跳一跳](#/games/jump)`。
