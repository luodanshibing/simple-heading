# Simple Heading

[English](#english) · [简体中文](#简体中文)

---

## English

Heading numbering and a table of contents for Obsidian — **numbers from level 2 down, and a TOC you can remove again.**

Both are manual commands: short notes are never touched until you ask.

### What it does

**Numbering** (starts at `##`, never touches `#`):

| before | after |
|---|---|
| `# My page` | `# My page` (untouched) |
| `## 甲节` | `## 一、甲节` |
| `### 甲一` | `### 1.1 甲一` |
| `### 甲二` | `### 1.2 甲二` |
| `## 乙节` | `## 二、乙节` |

- Level 2 uses **Chinese numerals** (`一、二、`) or **Arabic** (`1. 2.`), your choice.
- Level 3 and deeper are always Arabic and nested: `1.1`, `1.2`, `1.2.1`, `1.2.1.3` …
- **Delete a heading and run it again** — numbers are recomputed from scratch, so the sequence closes up and never skips.
- A skipped level (H2 straight to H4) fills in as `1.1.1`.

**Table of contents**, wrapped in marker comments so it can be updated or removed exactly (anchors are URL-encoded, as Obsidian expects):

```markdown
<!-- simple-heading:toc:start -->
**目录**
- [一、甲节](#%E4%B8%80%E3%80%81%E7%94%B2%E8%8A%82)
  - [1.1 甲一](#1.1%20%E7%94%B2%E4%B8%80)
<!-- simple-heading:toc:end -->
```

Inserted **before the first level-2 heading** (default) or **at the cursor**.

### Commands

| Command | What it does |
|---|---|
| 一键：重排编号 + 更新目录 | Renumber everything, then create or update the TOC — the one you will bind to a hotkey |
| 仅重排标题编号（删过标题就用它） | Just the numbers |
| 仅插入 / 更新目录 | Just the TOC, at the position from settings |
| 在当前光标处插入目录 | Just the TOC, at the cursor |
| 清除标题编号与目录（卸载前清理用） | Removes exactly what this plugin added |

### Uninstalling changes nothing

Everything this plugin writes is either a number in one of these shapes — `1.`, `1.1`, `1.2.3`, `一、` — or a block fenced by the two marker comments above.

- `清除标题编号与目录` removes those and nothing else. A heading like `## 2026 年计划` keeps its `2026`, because this plugin only strips its own shapes (a number followed by `. ` or a Chinese numeral followed by `、`).
- Level-1 headings are never numbered and never appear in the TOC.
- Headings inside fenced code blocks are ignored.
- Disable or uninstall the plugin at any time: the document is ordinary Markdown either way.

### Settings

| Setting | Default | Notes |
|---|---|---|
| Level-2 numbering style | Chinese `一、` | or Arabic `1.` |
| TOC title | `目录` | bold text as the first line of the TOC block; empty = no title line |
| Default TOC position | before the first level-2 heading | or the cursor |
| Include headings up to level | 6 | 2–6 |
| Indent per level | 2 spaces | 0–8 |

### Install (manual)

1. Copy `main.js`, `manifest.json` and `versions.json` into `<your vault>/.obsidian/plugins/simple-heading/`.
2. Reload Obsidian, then enable **Simple Heading**.

Or use the bundled script:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\deploy.ps1 -Vault "E:\Enotes" -Enable
```

### Development

`main.js` is the source and the artifact — plain JavaScript, no build step. All numbering / TOC / cleanup logic is pure string functions, which is what makes the whole thing testable and reversible.

```bash
node tools/test.mjs      # unit tests, no Obsidian needed
```

### Why not an existing plugin

[Number Headings](https://github.com/onlyafly/number-headings-obsidian) is the closest match (outline numbering, a remove-numbering command, an optional TOC), but its last release is **1.16.0 from October 2023** and it has open issues to match; it supports Roman numerals but **not Chinese numerals**, and it does not place a TOC "before the first level-2 heading or at the cursor" with a marker-bounded block you can strip exactly. The TOC plugins ([obsidian-plugin-toc](https://github.com/hipstersmoothie/obsidian-plugin-toc) and friends) build a table of contents but no numbering. This plugin does both, in the two shapes this vault actually uses.

### License

MIT — see [LICENSE](LICENSE).

---

## 简体中文

给 Obsidian 用的**标题编号 + 目录**：二级标题起自动编号，目录一键生成、也能一键删干净。

两条都是**手动命令**：短文你不点它，它就不动。

### 做了什么

**编号**（从 `##` 开始，永远不碰 `#`）：

- 二级标题用**中文数字**（一、二、）或**阿拉伯数字**（1. 2.），你选；
- 三级及更深一律阿拉伯数字并逐层嵌套：`1.1`、`1.2`、`1.2.1`、`1.2.1.3`……；
- **删掉某个标题后再跑一次**：序号每次从头重算，所以**不会断号**，自动补上；
- 层级跳跃（二级下直接四级）按 1 补齐，显示成 `1.1.1`。

**目录**用两行 HTML 注释标记包住，因此可以精确更新、精确删除：

```markdown
<!-- simple-heading:toc:start -->
**目录**
- [一、甲节](#%E4%B8%80%E3%80%81%E7%94%B2%E8%8A%82)
  - [1.1 甲一](#1.1%20%E7%94%B2%E4%B8%80)
<!-- simple-heading:toc:end -->
```

插入位置：**第一个二级标题之前**（默认）或**当前光标处**。

### 命令

| 命令 | 作用 |
|---|---|
| 一键：重排编号 + 更新目录 | 编号 + 目录一次做完（建议绑快捷键） |
| 仅重排标题编号（删过标题就用它） | 只重排编号 |
| 仅插入 / 更新目录 | 只处理目录，位置按设置 |
| 在当前光标处插入目录 | 只处理目录，插在光标处 |
| 清除标题编号与目录（卸载前清理用） | 精确删掉本插件加过的东西 |

### 卸载不影响文档

本插件写进去的东西只有两类：一是**固定形态的序号**（`1.`、`1.1`、`1.2.3`、`一、`），二是**被两行标记包住的目录块**。

- 「清除标题编号与目录」只删这两类，别的什么都不动。比如 `## 2026 年计划` 里的 `2026` 不会被吃掉 —— 因为它只认"数字 + `. `"或"中文数字 + `、`"这两种形态。
- **一级标题永远不编号、也不进目录**（你的页面一级标题就是文档名）。
- 代码块（``` 与 ~~~）里的 `##` 不会被当成标题。
- 插件随时可以禁用或卸载：文档本身就是普通 Markdown，不会坏。

### 设置项

| 设置 | 默认 | 说明 |
|---|---|---|
| 二级标题编号样式 | 中文 `一、` | 也可选数字 `1.` |
| 目录标题 | `目录` | 目录块首行的加粗文字；留空则不要这一行 |
| 默认插入位置 | 第一个二级标题之前 | 也可设为光标处 |
| 目录收录到几级 | 6 | 2–6 |
| 每级缩进空格数 | 2 | 0–8 |

### 安装（手动）

1. 把 `main.js`、`manifest.json`、`versions.json` 放进 `<你的库>/.obsidian/plugins/simple-heading/`；
2. 重新加载 Obsidian，启用 **Simple Heading**。

或用仓库里的脚本：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\deploy.ps1 -Vault "E:\Enotes" -Enable
```

### 开发

`main.js` 既是源码也是产物，纯 JavaScript、没有构建步骤。编号 / 目录 / 清理全部是**纯字符串函数** —— 这正是它能被单测、也能精确回退的原因。

```bash
node tools/test.mjs      # 单测，不需要 Obsidian
```

### 为什么不用现成插件

[Number Headings](https://github.com/onlyafly/number-headings-obsidian) 最接近（大纲编号、有"移除编号"命令、也做过 TOC），但它最后一个版本是 **2023 年 10 月的 1.16.0**，未关 issue 一堆；它支持罗马数字却**不支持中文数字**，也没有"目录插在第一个二级标题前 / 光标处"+"标记块精确剥离"这套。纯 TOC 插件（[obsidian-plugin-toc](https://github.com/hipstersmoothie/obsidian-plugin-toc) 等）只做目录、不做编号。本插件把两件事合起来，并只产出这份库里实际会用的两种形态。

### 许可证

MIT，见 [LICENSE](LICENSE)。
