# 默认索引目录

此目录用于验证：配置了自定义 indexName 后，
名为 `index` 的文件不再被识别为 index。

由于 metadata.yml 中 `indexName: preface`：
- `_index.md` → **不是** index 文件（普通章节）
- `0000__preface.md` → **是** index 文件

请检查 EPUB 导航中此目录的跳转行为。
