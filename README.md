# @mintfolio/theme-api

The public contract for independent Mintfolio themes. It provides content types,
declarative manifests, page props, safe search helpers, and article unlocking.
It contains no host content service, site configuration, layout, or visual styles.

Core also exposes these contracts through `@mintfolio/core/theme`, `/astro`, and
`/search`, and adds shared controllers and optional components. Themes can depend
on Core alone when they only use those public facades.

## Entry points

| Import | Purpose |
| --- | --- |
| `@mintfolio/theme-api` | `defineTheme`, `InferSettings`, public content and manifest types |
| `@mintfolio/theme-api/astro` | `PageProps`, discriminated page data, article body and SEO types |
| `@mintfolio/theme-api/SeoHead.astro` | Optional head markup rendered with `{seo}` |
| `@mintfolio/theme-api/search` | Pure filtering and URL state helpers for Core or browser code |
| `@mintfolio/theme-api/client` | Search re-exports and validated, sanitized browser unlocking |
| `@mintfolio/theme-api/crypto` | Low-level Web Crypto envelope primitives for the content adapter |

Only the optional Astro component needs Astro. The root and `/search` imports
have no DOM or Node dependencies. `/client` loads DOMPurify and is intended for
browser scripts. These explicit exports also work from a packed npm dependency;
themes do not need a path alias into the host repository.

## Declare a theme

```js
// theme.mjs
import { defineTheme } from '@mintfolio/theme-api';

export default defineTheme({
  manifest: {
    id: 'example', name: 'Example', version: '1.0.0', engine: '^1.0.0',
    author: 'Theme author', description: 'An independent text-first theme',
  },
  capabilities: { search: true, encryptedPosts: true },
  pages: { home: './pages/home.astro', post: './pages/post.astro' },
  settings: {
    accent: { type: 'color', label: 'Link color', default: '#2255aa' },
    width: { type: 'number', label: 'Reading width', default: 760, min: 480, max: 1200 },
  },
});
```

`defineTheme` preserves types; it does not replace the host's build-time validator.
The required `home` and `post` paths resolve relative to the manifest. Optional
renderers are `page`, `archive`, and `notFound`. Search/tag/category filters share the archive renderer.
Declaring a renderer or capability does not register routes or enable services.

```astro
---
import type { PageProps, HomePageData } from '@mintfolio/theme-api/astro';
import type { InferSettings } from '@mintfolio/theme-api';
import definition from '../theme.mjs';

type Props = PageProps<InferSettings<typeof definition.settings>, HomePageData>;
const { theme, page } = Astro.props;
const tags = await theme.taxonomy.tags();
---
<main>
  <h1>{theme.site.title}</h1>
  <ul>{page.posts.map((post) => <li><a href={post.url}>{post.title}</a></li>)}</ul>
</main>
```

Each renderer receives `{theme, page}`. `page.posts` is an array;
`theme.content.posts(query)` returns `{items, total}`, where `total` precedes
pagination. Taxonomy services are asynchronous methods. `publishedAt` is an ISO
string; URLs are provided by Core. Protected post summaries contain only a safe
description, and passwords or source content are never part of the public DTO.

## Search and URL state

`createSearchEntry(post)` produces normalized title/description/taxonomy strings,
retaining the original id and URL. Display the original summary, then use
`searchPosts(index, filters)` or `filterPosts(posts, filters)` to select matches.
Filtering is case-insensitive; a query is a substring of title or description,
while tag/category are exact labels. Neither function sorts, mutates or paginates.

`readFiltersFromUrl(url)` reads `q`, `tag`, and `category` without using `window`.
`writeFiltersToUrl(filters, url)` returns a new URL, preserving unrelated query
parameters and the hash. Static archive pages apply query filtering in a browser
script; query strings do not rerun an Astro static page's frontmatter.

## Protected articles

A `PostPageData.body` is either public HTML/headings or an encrypted envelope.
For a protected body, call
`unlockArticle(body.payload, passwordInput.value, body.postId)` from the browser.
The promise returns `{fragment, headings}` only after authenticating ciphertext,
validating the versioned `{version: 1, html, headings}` content protocol, and
sanitizing HTML with DOMPurify. Mount the fragment with `replaceChildren` and
render heading text normally. The low-level `/crypto` decryptor does not sanitize.

Themes own their password form and lifecycle. Clear the input after unlocking,
clear content and heading references on relock/navigation, and discard pending
results after disposal. Never store passwords or decrypted content in browser
storage/history. Secure browser contexts (HTTPS or localhost) are required.

`ArticleUnlockError.code` is one of `UNSUPPORTED_ENVIRONMENT`,
`INVALID_ENCRYPTED_ARTICLE`, `AUTHENTICATION_FAILED`, or `INVALID_ARTICLE_CONTENT`.
These errors contain no passwords, plaintext, or nested crypto exceptions.

## Building the package

From this independent repository root, run:

```sh
npm ci
npm test
npm pack
```

This emits executable ESM and declarations into `dist`. The package includes that
directory and its standalone Astro helper; theme authors consume only exports.
Build before packing. The package prepack script compiles before packing.

## 独立仓库开发

公开 DTO、manifest、搜索纯函数和加密契约。源码在 src，所属测试在 tests。这个仓库不依赖 Core 或任何主题。

```sh
npm ci
npm test
npm pack
```

这个仓库可单独安装，不需要 PersonalSite 或其他源码目录。拆分前历史保留在原 PersonalSite，起点见 MIGRATION.md。
