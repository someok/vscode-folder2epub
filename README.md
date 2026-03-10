# vscode-folder2epub

将符合条件的文件夹转换为 EPUB 的 VS Code 扩展。

## 功能说明

这个扩展面向“目录即书籍”的内容组织方式。你可以在 VS Code 资源管理器中对某个本地文件夹点右键，直接完成 EPUB 工程初始化，或把该目录下的 Markdown、TXT 以及相关图片资源打包为 EPUB 3 电子书。

核心用途：

- 通过 Command Palette 配置当前 Workspace 默认作者
- 对目标目录快速初始化 `__t2e.data/metadata.yml`
- 基于目录内容生成 EPUB 3 文件
- 支持 Markdown、TXT、Markdown 图片和 HTML `<img>`
- 支持按数字前缀对章节和子目录排序
- 支持通过父级 `__epub.yml` 配置输出目录

## 当前已实现

- TypeScript 扩展骨架
- 资源管理器目录右键菜单
  - `生成 epub`
  - `初始化 epub`
- `初始化 epub`
  - 支持通过 Command Palette 配置当前 Workspace 默认作者
  - 未配置当前 Workspace 作者时，初始化会先提示用户
  - 创建 `__t2e.data/metadata.yml`
  - 已存在时阻止覆盖
- `生成 epub`
  - 校验 `__t2e.data/metadata.yml`
  - 递归扫描目录中的 `.md` / `.txt`
  - 按数字前缀排序
  - 子目录若存在名为 `index` 的 `.md` / `.txt`（支持如 `0000__index.md` 的数字前缀），目录项会优先链接到该文件，且该文件不会作为该子目录下的独立目录项展示
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
author: [当前 Workspace 默认作者；未配置则为空]
description: ''
cover: cover.jpg
version: 1.0.0
```

支持的内容源：

- `.md`
- `.txt`

当前 Workspace 作者配置方式：

- 打开 Command Palette
- 执行 `Folder2EPUB: 配置当前 Workspace 默认作者`
- 之后执行 `初始化 epub` 时，会把该值写入 `metadata.yml` 的 `author`

排序规则：

- 文件或文件夹名形如 `0120_章节名.md`
- 数字前缀会参与排序
- 目录和文件在去掉数字前缀后，使用剩余名称作为显示名
- 子目录若存在名称为 `index` 的内容文件，则目录本身会优先跳转到该文件，并隐藏该文件对应的独立目录项

## 示例目录结构

下面是一个可用于测试和生成 EPUB 的示例目录：

```text
book-demo/
├── __t2e.data/
│   ├── metadata.yml
│   └── cover.jpg
├── 0010_前言.md
├── 0020_说明.txt
├── 0030_正文/
│   ├── 0000__index.md
│   ├── 0010_第一章.md
│   ├── 0020_第二章.txt
│   └── images/
│       └── scene-1.jpg
└── 0040_附录/
    ├── 0010_附录一.md
    └── 0020_附录二.txt
```

其中：

- `__t2e.data/metadata.yml` 是书籍元数据文件
- `__t2e.data/cover.jpg` 是封面文件，对应 `metadata.yml` 中的 `cover`
- 根目录下可以直接放 `.md` 和 `.txt`
- 子目录下也可以继续放 `.md` 和 `.txt`
- 子目录下如果存在 `index.md`、`index.txt` 或带数字前缀的 `index` 文件（如 `0000__index.md`），该子目录会优先跳转到这个文件，且它不会作为该子目录下的独立目录项展示
- Markdown 中引用的本地图片会按相对当前 `.md` 文件的路径解析
- 带数字前缀的目录和文件会按数字排序

示例 `metadata.yml`：

```yaml
title: 示例书籍
titleSuffix: 预览版
author: i3166
description: 这是一个用于测试的示例目录。
cover: cover.jpg
version: 1.0.0
```

## 开发

```bash
npm install
npm run compile
```

调试方式：

- 在 VS Code 中按 `F5`
- 在新的 Extension Development Host 中右键本地目录测试菜单

## 发布到 VS Code Marketplace

参考官方文档：

- [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Marketplace Publisher Management](https://marketplace.visualstudio.com/manage)

发布前，先把 `package.json` 里的以下字段改成真实值：

- `publisher`
  - 当前值是 `local`，不能直接用于发布
- `version`
  - 每次发布都需要递增版本号
- 可选补充：
  - `icon`
  - `repository`
  - `homepage`
  - `bugs`

### 1. 创建发布身份

根据 VS Code 官方发布文档，发布扩展前需要先准备：

- 一个 Azure DevOps 组织
- 一个 Personal Access Token
  - 作用域需要包含 `Marketplace > Manage`
- 一个 VS Code Marketplace Publisher

创建完成后，在终端登录 publisher：

```bash
npx @vscode/vsce login <publisher-id>
```

登录时会提示输入刚创建的 Personal Access Token。

### 2. 本地构建与打包

先执行构建：

```bash
npm install
npm run compile
```

然后打包成 `.vsix`：

```bash
npx @vscode/vsce package
```

执行成功后，会在项目根目录生成一个 `.vsix` 文件。

### 3. 发布到 Marketplace

直接发布：

```bash
npx @vscode/vsce publish
```

如果你希望发布时顺便递增版本号，可以使用：

```bash
npx @vscode/vsce publish patch
```

也可以把 `patch` 改成 `minor` 或显式版本号，例如：

```bash
npx @vscode/vsce publish 0.0.2
```

### 4. 手动上传 VSIX

如果你不想直接命令行发布，也可以：

1. 先执行 `npx @vscode/vsce package`
2. 打开 Marketplace Publisher 管理页面
3. 手动上传生成的 `.vsix`

### 5. 发布前检查

根据官方文档，以下内容会影响发布：

- `package.json` 中的扩展图标不能是 SVG
- `README.md` 和 `CHANGELOG.md` 里的图片链接应使用 `https`
- `README.md` 和 `CHANGELOG.md` 中的用户提供 SVG 图片可能导致发布失败

建议在发布前至少执行一次：

```bash
npm run lint
npm run compile
npx @vscode/vsce package
```

## 已知限制

VS Code 原生资源管理器菜单不能直接基于“目录内部是否存在某个文件”做逐项动态 disabled。当前实现采取的是：

- 菜单对本地目录显示
- `生成 epub` 在执行时严格检查 `__t2e.data/metadata.yml`

如果后续需要更强的动态菜单行为，需要改成自定义 Tree View，或接受命令执行时拦截的实现方式。
