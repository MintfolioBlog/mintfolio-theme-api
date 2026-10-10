# Mintfolio Theme API

[Mintfolio](https://github.com/MintfolioBlog/mintfolio) 的主题公共契约：主题能读取哪些资料、页面会收到什么参数，以及配置清单怎样声明。

普通站点作者不需要单独使用这个仓库。开发主题时，通常从 @mintfolio/core/theme 和 @mintfolio/core/astro 导入即可，它们会转出这里的契约。

## 一个最小清单

~~~js
import { defineTheme } from '@mintfolio/theme-api';

export default defineTheme({
  manifest: {
    id: 'paper', name: 'Paper', version: '1.0.0',
    engine: '^1.1.0', author: 'Your name',
    description: '一个专注阅读的主题。',
  },
  pages: { home: './pages/home.astro', post: './pages/post.astro' },
  settings: {
    accent: { type: 'color', label: '链接颜色', default: '#2255aa' },
  },
});
~~~

engine 对应主题契约版本，不是 Core 的 0.x 包版本。defineTheme 保留类型信息，实际路径和配置值由 Core 在构建时校验。

## 入口

| 导入 | 用途 |
| --- | --- |
| @mintfolio/theme-api | 清单、公开内容类型、InferSettings |
| @mintfolio/theme-api/astro | PageProps、页面数据、正文与 SEO 类型 |
| @mintfolio/theme-api/search | 纯搜索与 URL 查询参数函数 |
| @mintfolio/theme-api/client | 浏览器搜索与密码文章解锁 |
| @mintfolio/theme-api/crypto | 内容适配器使用的底层 Web Crypto 契约 |
| @mintfolio/theme-api/SeoHead.astro | 可选的 SEO 标签组件 |

主题获得公开 DTO，不接触站点原始配置、文章密码或内容集合。根入口和搜索函数不依赖 DOM，客户端入口面向浏览器。

## 开发与版本

~~~sh
npm ci
npm test
npm pack
~~~

当前契约系列为 1.x，与 Core 版本独立。接口变更需要同步类型、调用方与兼容说明。

完整定义见 [Theme API 参考](https://github.com/MintfolioBlog/mintfolio/blob/main/docs/theme-api.md)。从零开发可看 [主题教程](https://github.com/MintfolioBlog/mintfolio/wiki/Theme-Development) 和 [Starter](https://github.com/MintfolioBlog/mintfolio-theme-starter)。

[参与开发](CONTRIBUTING.md) · [安全问题](SECURITY.md) · [GPL-3.0-only](LICENSE)

契约 1.1 新增文章元数据、独立页面、静态分页、系列与相关文章、全文搜索片段和 SEO/订阅信息。搜索字符串保留原文大小写，高亮以 UTF-16 坐标返回，需用文本节点呈现。
