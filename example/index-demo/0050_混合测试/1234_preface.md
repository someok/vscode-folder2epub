---

title: 数字前缀 + preface
order: 1234
---

# 数字前缀 + 自定义 indexName

此文件名为 `1234_preface.md`。

这是 "0050_混合测试" 目录的 index 文件之一，
测试数字前缀 + YAML frontmatter 的组合场景。

由于数字前缀在解析后被剥离，displayName 为 `preface`，
会被正确识别为 index 文件。

同时注意本文件包含 YAML frontmatter（`---`...`---`），
其中的 `title` 字段会优先作为章节标题。
