# vscode-folder2epub

将符合条件的文件夹转换为 EPUB 的 VS Code 扩展。

## 当前已实现

- TypeScript 扩展骨架
- 资源管理器目录右键菜单
  - `生成 epub`
  - `初始化 epub`
- `初始化 epub`
  - 创建 `__t2e.data/metadata.yml`
  - 已存在时阻止覆盖
- `生成 epub`
  - 校验 `__t2e.data/metadata.yml`
  - 递归扫描目录中的 `.md` / `.txt`
  - 按数字前缀排序
  - 自动收集 Markdown 中引用的本地图片并打包进 EPUB
  - 支持 Markdown 原生图片语法和 HTML `<img>` 标签
  - 当 `metadata.yml` 配置了 `cover` 时，从 `__t2e.data/` 读取封面文件，缺失时直接报错
  - 生成 EPUB 3 文件
  - 根据父级 `__epub.yml` 的 `saveTo` 解析输出目录

## 约定

初始化后的 `metadata.yml` 默认内容：

```yaml
title: 当前文件夹名
titleSuffix: ''
author: i3166
description: ''
cover: cover.jpg
version: 1.0.0
```

支持的内容源：

- `.md`
- `.txt`

排序规则：

- 文件或文件夹名形如 `0120_章节名.md`
- 数字前缀会参与排序
- 目录和文件在去掉数字前缀后，使用剩余名称作为显示名

## 开发

```bash
pnpm install
pnpm run compile
```

调试方式：

- 在 VS Code 中按 `F5`
- 在新的 Extension Development Host 中右键本地目录测试菜单

## 已知限制

VS Code 原生资源管理器菜单不能直接基于“目录内部是否存在某个文件”做逐项动态 disabled。当前实现采取的是：

- 菜单对本地目录显示
- `生成 epub` 在执行时严格检查 `__t2e.data/metadata.yml`

如果后续需要更强的动态菜单行为，需要改成自定义 Tree View，或接受命令执行时拦截的实现方式。
