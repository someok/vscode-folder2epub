# AGENTS.md

## 项目性质

本项目是 VS Code 扩展 `vscode-folder2epub`，使用 TypeScript 开发，源码在 `src/`，编译产物在 `dist/`。

功能核心：

- 初始化 epub
- 生成 epub
- 配置当前 Workspace 默认作者

---

## 必须先看

开始分析或修改前，必须先看：

1. `package.json`
2. 相关 `src/commands/*`
3. 相关 `src/services/*`
4. `README.md`
5. 必要时看 `TASK.md`

不得跳过 `package.json` 和现有实现直接猜。

---

## 硬规则

- 只优先修改 `src/**`，不要直接修改 `dist/**`
- `src/extension.ts` 只做激活、注册、装配，保持轻量
- 命令入口放 `src/commands/*`
- 可复用业务逻辑放 `src/services/*`
- 不要把复杂业务逻辑塞进 `src/extension.ts`
- 不要混入无关重构
- 不要无必要新增依赖
- 不要修改用户可见行为却不更新文档

---

## 一致性要求

如果改动影响以下内容，必须同步检查并更新 `package.json` 与 `README.md`：

- 命令 ID 或标题
- 配置项
- 菜单行为
- metadata 结构
- 支持的文件类型
- 输出目录规则
- 输出命名规则

如影响需求范围或阶段说明，也要检查是否需要更新 `TASK.md`。

---

## EPUB 约定不可随意改

以下约定默认稳定，不要轻易变更：

- `__t2e.data/metadata.yml`
- 父级 `__epub.yml`
- `.md` / `.txt` 内容来源
- 数字前缀排序
- Markdown 本地图片处理
- 基于 metadata 的输出命名

如必须修改，必须同时更新实现和文档。

---

## 风格要求

- 使用 TypeScript
- 遵守 `.editorconfig`
- 遵守 `eslint.config.mjs`
- 保持现有命名、结构和风格一致
- 代码以清晰、可维护为第一优先级

---

## 改完必须做

修改 TypeScript 后，至少执行：
```
bash
npm run compile
```
需要时再执行：
```
bash
npm run lint
```
涉及打包验证时执行：
```
bash
npm run package
```
---

## 提交前检查

- [ ] 改的是 `src/**`，不是直接改 `dist/**`
- [ ] 分层合理，没有把业务逻辑塞进 `src/extension.ts`
- [ ] `package.json` 与实现一致
- [ ] 用户可见行为变化已更新 `README.md`
- [ ] 必要时已更新 `TASK.md`
- [ ] 已执行 `npm run compile`
- [ ] 必要时已执行 `npm run lint`

---

## 最终原则

任何影响用户行为、配置方式、输出结果的改动，如果没有同步更新相关文档，默认视为未完成。
