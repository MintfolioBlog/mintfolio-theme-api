# MintfolioThemeAPI

公开 DTO、manifest、搜索纯函数和加密契约。源码在 src，所属测试在 tests。这个仓库不依赖 Core 或任何主题。

只为核心功能编写单元测试，非核心或边缘功能没有明确要求时不要新增测试。集中验证，不要每修改一个文件就跑测试。为公开接口写清楚输入、输出和生命周期要求。

- Node.js >= 22.12.0; strict TypeScript; use import type for types.
- Keep source imports inside this repository or public npm exports. Never import sibling repositories or host private modules.
- Commit only source, docs, lockfiles and required vendor packages. Ignore node_modules, dist, artifacts and caches.
- Use focused English feat:/fix:/refactor: commits; user-facing documentation is Chinese.

```sh
npm ci
npm test
npm pack
```
