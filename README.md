# Simple Heading

[English](#english) · [简体中文](#简体中文)

---

## English

Heading numbering and a table of contents for Obsidian — **numbers from level 2 down, and a TOC that leaves no marks in your notes.**

Both are manual commands, and the plugin does nothing at all until you run one.

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
- A skipped level (H2 straight to H4) fills in as `1.1.1`. Headings inside fenced code blocks are ignored.

**Table of contents** — plain Markdown, nothing wrapped around it:

```markdown
**目录**
- [一、甲节](#%E4%B8%80%E3%80%81%E7%94%B2%E8%8A%82)
  - [1.1 甲一](#1.1%20%E7%94%B2%E4%B8%80)
```

Inserted **before the first level-2 heading** (default) or **at the cursor**.

### No markers, no pollution

Earlier versions fenced the TOC with `<!-- simple-heading:toc:start -->` comments. They are gone by default, because they are software residue visible in source mode. The TOC is now recognised **by structure**:

> a bold title line (default `**目录**`) **immediately followed by** one or more in-document heading links `- [text](#anchor)`

Both halves are required, so an ordinary list of links — even internal ones — is never mistaken for a TOC unless it happens to start with `**目录**`. If you empty the title setting, the rule becomes stricter instead: a run of **two or more** in-document heading links, and nothing may separate them.

If you would rather have bulletproof identification than a clean document, set **目录块标记 → HTML 注释** and the two comment lines come back.

### Startup and document safety

- **Startup cost is one settings read.** `onload` does exactly three things: `loadData()`, register five commands, register the settings tab. It does not walk the vault, does not read files, does not register a single event listener, view or timer, and never touches `app.vault`. The test suite asserts all of this by reading `main.js` as text — so the claim cannot silently rot.
- **Nothing is ever changed automatically.** Every edit happens inside a command you invoked. Open a note, do nothing, and the bytes do not move.
- **Everything written is reversible.** The only things this plugin adds are numbers in the shapes `1.`, `1.1`, `1.2.3`, `一、` and a plain link list under a bold title. `清除编号与目录` removes exactly those. A heading like `## 2026 年计划` keeps its `2026`, because a number only counts as "ours" when it is followed by `. ` or a Chinese numeral followed by `、`. The test suite includes a byte-exact round trip (number + TOC → clear → identical to the original) in both modes.

### Commands

| Command | What it does |
|---|---|
| 重排编号并更新目录 | Renumber everything, then create or update the TOC — bind this to a hotkey |
| 重排编号 | Just the numbers |
| 插入或更新目录 | Just the TOC, at the position from settings |
| 在光标处插入目录 | Just the TOC, at the cursor |
| 清除编号与目录（卸载前清理用） | Removes exactly what this plugin added |

### Settings

| Setting | Default | Notes |
|---|---|---|
| Level-2 numbering style | Chinese `一、` | or Arabic `1.` |
| TOC title | `目录` | bold first line, and the anchor for recognising the TOC block |
| TOC block marker | none (recommended) | or HTML comments |
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

[Number Headings](https://github.com/onlyafly/number-headings-obsidian) is the closest match (outline numbering, a remove-numbering command, an optional TOC), but its last release is **1.16.0 from October 2023** and it has open issues to match; it supports Roman numerals but **not Chinese numerals**, and it has no marker-free TOC that can be recognised, updated and removed exactly. The TOC plugins ([obsidian-plugin-toc](https://github.com/hipstersmoothie/obsidian-plugin-toc) and friends) build a table of contents but no numbering. This plugin does both, in the two shapes this vault actually uses.

### License

MIT — see [LICENSE](LICENSE).

---

## 简体中文

给 Obsidian 用的**标题编号 + 目录**：二级标题起自动编号，目录一键生成、也能一键删干净，**文档里不留插件痕迹**。

两条都是**手动命令**：你不点它，它什么都不做。

### 做了什么

**编号**（从 `##` 开始，永远不碰 `#`）：

| 之前 | 之后 |
|---|---|
| `# 我的页面` | `# 我的页面`（原样） |
| `## 甲节` | `## 一、甲节` |
| `### 甲一` | `### 1.1 甲一` |
| `### 甲二` | `### 1.2 甲二` |
| `## 乙节` | `## 二、乙节` |

- 二级标题用**中文数字**（一、二、）或**阿拉伯数字**（1. 2.），你选；
- 三级及更深一律阿拉伯数字并逐层嵌套：`1.1`、`1.2`、`1.2.1`、`1.2.1.3`……；
- **删掉某个标题后再跑一次**：序号每次从头重算，所以**不会断号**，自动补上；
- 层级跳跃（二级下直接四级）按 1 补齐，显示成 `1.1.1`；围栏代码块里的 `##` 不算标题。

**目录**就是普通 Markdown，外面**什么都不包**：

```markdown
**目录**
- [一、甲节](#%E4%B8%80%E3%80%81%E7%94%B2%E8%8A%82)
  - [1.1 甲一](#1.1%20%E7%94%B2%E4%B8%80)
```

插入位置：**第一个二级标题之前**（默认）或**当前光标处**。

### 不加标记，也就不算污染

早期版本用 `<!-- simple-heading:toc:start -->` 这类注释把目录包起来。**默认已经去掉** —— 那种注释在源码模式下看得见，是软件留下的痕迹。现在目录块**靠结构识别**：

> 一行加粗标题（默认 `**目录**`）**紧跟着**一行或多行"指向本文标题的内部链接" `- [文字](#锚点)`

两半都必需，所以你手写的普通链接列表（哪怕全是内部链接）不会被误认，除非它**正好**以 `**目录**` 开头。把目录标题设为空时规则反而更严：要求**连续两行以上**内部标题链接，中间不能夹别的东西。

如果你更看重"识别绝对稳"而不是"文档干净"，把设置里的**目录块标记**换成「HTML 注释」，那两行注释就会回来。

### 启动开销与文档安全

- **启动只读一次设置**：`onload` 只做三件事 —— `loadData()`、注册 5 个命令、注册设置页。不遍历库、不读文件、**不注册任何事件 / 视图 / 定时器**，也从不碰 `app.vault`。测试里有一条**把 `main.js` 当文本读**的断言在守这些结论，所以它不会悄悄失效。
- **绝不自动改文档**：所有改动都发生在你主动触发的命令里。打开笔记什么都不点，字节就不会动。
- **写进去的都能还原**：本插件只加两类东西 —— 形态固定的序号（`1.`、`1.1`、`1.2.3`、`一、`），和"加粗标题 + 链接列表"的目录块。「清除编号与目录」只删这两类。`## 2026 年计划` 里的 `2026` 不会被吃掉（只有"数字 + `. `"或"中文数字 + `、`"才算我们加的）。测试里有**逐字节往返断言**：编号+目录 → 清除 → 必须与原文件完全一致（两种模式都验）。

### 命令

| 命令 | 作用 |
|---|---|
| 重排编号并更新目录 | 编号 + 目录一次做完（建议绑快捷键） |
| 重排编号 | 只重排编号 |
| 插入或更新目录 | 只处理目录，位置按设置 |
| 在光标处插入目录 | 只处理目录，插在光标处 |
| 清除编号与目录（卸载前清理用） | 精确删掉本插件加过的东西 |

### 设置项

| 设置 | 默认 | 说明 |
|---|---|---|
| 二级标题编号样式 | 中文 `一、` | 也可选数字 `1.` |
| 目录标题 | `目录` | 目录块首行的加粗文字，同时也是识别目录块的依据 |
| 目录块标记 | 不加（推荐） | 也可选 HTML 注释 |
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

[Number Headings](https://github.com/onlyafly/number-headings-obsidian) 最接近（大纲编号、有"移除编号"命令、也做过 TOC），但最后一个版本是 **2023 年 10 月的 1.16.0**，未关 issue 一堆；它支持罗马数字却**不支持中文数字**，也没有"无标记 + 可精确识别/更新/清除"的目录。纯 TOC 插件（[obsidian-plugin-toc](https://github.com/hipstersmoothie/obsidian-plugin-toc) 等）只做目录、不做编号。本插件把两件事合起来，且只产出这份库里实际会用的两种形态。

### 许可证

MIT，见 [LICENSE](LICENSE)。
