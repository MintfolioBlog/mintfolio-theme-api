# Mintfolio Theme API

[Mintfolio](https://github.com/MintfolioBlog/mintfolio) 的主题公共契约：主题能读取哪些资料、页面会收到什么参数，以及配置清单怎样声明。

普通站点作者不需要单独使用这个仓库。开发主题时，通常从 @mintfolio/core/theme 和 @mintfolio/core/astro 导入即可，它们会转出这里的契约。

## 一个最小清单

~~~js
import { defineTheme } from '@mintfolio/theme-api';

export default defineTheme({
  manifest: {
    id: 'paper', name: 'Paper', version: '1.0.0',
    engine: '^1.2.0', author: 'Your name',
    description: '一个专注阅读的主题。',
  },
  capabilities: {},
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

## 站点统计契约

AnalyticsConfig 定义可选的 google 配置，GoogleAnalyticsConfig 包含 measurementId 和可选 enabled。PublicSite.analytics 公开这份非敏感配置；脚本加载、环境判断和页面浏览初始化由 Core 负责，主题不得重复接入统计。

## SDK 1.2 与 Core 0.4

使用本节新增服务的主题声明 `manifest.engine: '^1.2.0'`，并将 Core peerDependency 设为 `^0.4.0`。旧的 `^1.1.0` 清单仍可在新 Runtime 加载；需要新增服务时应提高最低契约版本。SDK 与 Core 使用独立版本号。1.2 与 Core 0.4 配套使用。

### 已有功能与公开接口

| Core 功能 | 主题开发入口 |
| --- | --- |
| 置顶、发布时间、更新时间、阅读时长、作者、封面 | `PostSummary`；受保护正文不提供字数与阅读时长 |
| 标签、分类、系列、按月归档 | `theme.taxonomy.tags/categories/series/archives()`；月份按站点时区分组，没有月归档路由 |
| 筛选与切片 | `theme.content.posts({ q, tag, category, series, offset, limit })`；返回 `{ items, total }`，total 为切片前总数 |
| 系列目录 | `theme.content.series(id)`；精确系列 ID，先按 order 升序、再按发布时间升序，未设置 order 的排后面 |
| 独立 Markdown 页 | `theme.content.pages()` / `page(id)`；未知或不可见 ID 返回 null，生成的 about 不属于 Markdown 集合 |
| 相关文章与文章导航 | `theme.content.related(id, limit)`、`page.related`、`page.previous/next`、`page.seriesPosts` |
| 静态归档分页 | `page.pagination`；可用 `theme.urls.archivePage(number, filters)` 获取路由，页码从 1 开始 |
| 全文搜索 | `theme.search.index()`、`searchWithHighlights`；`SearchPayload` 描述搜索端点的 `{ posts, index }` |
| 部署到子目录 | `theme.urls.searchIndex()`、`robots()`、`asset('/logo.svg')`，其他 URL 方法同样包含部署前缀 |
| SEO、社交卡片、订阅 | `page.seo` 与 SeoHead；`theme.urls.rss/jsonFeed/atom/sitemap()` |
| 加密文章、目录、图片预览、代码复制 | 从 `@mintfolio/core/client` 导入现有控制器，组件从 `@mintfolio/core/components/*` 导入 |
| GA4 | `theme.site.analytics` 只读展示配置，生产脚本由 Core 注入，开发模式关闭，主题不要重复初始化 |

`content.post/page` 使用内容 ID，不使用 frontmatter slug；链接始终使用 DTO 的 url。`urls.post/page` 只负责路由编码，不进行 ID 到 slug 的查询。`posts()` 保持 Core 的置顶、新文章优先顺序，系列目录另用 `series()`。搜索过滤忽略大小写、各条件取交集；`series` 为可选字段，未提供或空字符串不限制系列。

`archivePage` 按 tag、category、series 的顺序选取第一个非空分类生成静态路径，其余条件与 q 保留在查询参数中。这些参数由浏览器搜索处理，不会使静态页面重新构建；链接有效页码须来自已有的 `page.pagination`。`asset` 为根相对静态路径补一次部署前缀，已带前缀、外部 URL 和相对路径保持不变，不检查文件存在性或做图片优化。

公开内容服务仍遵守发布策略：只有显式本地预览才可看到草稿及定时文章；搜索始终排除草稿、定时未发布和 noindex 内容，加密文章索引没有正文。不要序列化整个 theme 上下文，它包含构建期函数。

### 从 manifest 推导页面类型

下面是 `pages/archive.astro` 的完整最小示例，假定清单位于包根目录 `theme.mjs`：

~~~astro
---
import definition from '../theme.mjs';
import type { ThemePageProps } from '@mintfolio/core/astro';
import SeoHead from '@mintfolio/core/components/SeoHead.astro';
import PostArchive from '@mintfolio/core/components/PostArchive.astro';

type Props = ThemePageProps<typeof definition, 'archive'>;
const { theme, page } = Astro.props;
const [tags, categories] = await Promise.all([
  theme.taxonomy.tags(), theme.taxonomy.categories(),
]);
---
<!doctype html>
<html lang={theme.site.language}>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <SeoHead seo={page.seo} />
  </head>
  <body>
    <main>
      <h1>{page.title}</h1>
      <PostArchive posts={page.posts} tags={tags} categories={categories}
        filters={page.filters} pagination={page.pagination}
        language={theme.site.language} archiveUrl={theme.urls.archive()}
        searchEndpoint={theme.urls.searchIndex()} />
    </main>
  </body>
</html>
~~~

`PageProps<Settings, PageData>` 原有写法继续支持；`PageDataFor<'post'>` 可以单独取文章页数据类型。`ThemeContent`、`ThemeTaxonomy`、`ThemeSearch` 可以作为自定义组件的服务参数类型。`ThemeConfiguration<Settings>` 的 settings 使用 `ThemeSettingsInput` 允许递归的对象部分覆盖，数组仍须提供完整条目。

### Core 0.4 项目布局和生命周期

站点根目录放文章；`_mintfolio/` 放 package.json、site.config.ts、theme.config.mjs、pages、public 和依赖。`overrides.pages` 从 Astro 项目根 `_mintfolio/` 解析，例如 `./overrides/archive.astro`。主题包内 renderer 路径仍从 theme.mjs 所在目录解析。

设置统一放在 `_mintfolio/theme.config.mjs` 的 settings。主题可在 package.json 声明 `mintfolio.configTemplate`，Core 的 `mintfolio theme use` 会复制模板对象及注释并备份旧配置，`theme init` 仅在 settings 为空时填充。主题不应自行读写宿主配置；旧 `theme-<id>.config.mjs` 已不作为站点运行时设置文件。

浏览器交互从 `@mintfolio/core/client` 导入 `onPage`，在 setup 中使用 `scope.signal` 绑定事件，并用 `scope.add(controller.dispose)` 注册控制器清理，以支持 Astro 页面切换和 BFCache。解锁后正文、目录和密码不可持久化，离开页面或重新锁定时必须清除。SDK 本身不依赖 Core；完整的 DOM 控制器属于 Core 的公共门面，不要从其 src 私有路径导入。

## 站点 favicon 契约

Core 0.4.1 将站点配置 `site.favicon` 验证、规范化并补上部署路径后，提供为 `theme.site.favicon` 和所有页面的 `page.seo.favicon`。Theme API 1.3 的 `SeoHead` 新增可选 `faviconFallback` 属性，接受 URL 字符串或只读 `FaviconLink[]`（`{ href, type? }`）。配置了站点图标时只渲染该图标；未配置时才渲染主题提供的默认图标列表。

~~~astro
---
import SeoHead from '@mintfolio/core/components/SeoHead.astro';
import defaultIcon from '../assets/favicon.svg?url';
const { page } = Astro.props;
---
<SeoHead seo={page.seo} faviconFallback={defaultIcon} />
~~~

无需主题读取宿主配置或自行拼接 base，也不要再额外输出固定的 `link rel="icon"`。内置 Minimal 和七个主题已接入；Verdant 原有 SVG/ICO 组合仍用于默认回退。使用此能力的主题声明 `engine: '^1.3.0'` 和 Core peerDependency `^0.4.1`。

### 按需加载文章解锁

搜索使用 `@mintfolio/theme-api/search`；加密文章使用 `@mintfolio/theme-api/protected-article`。原 `/client` 入口保持兼容。HTML 清理库只在调用 `unlockArticle` 时加载；解锁和安全清理规则不变。
