'use strict';

/* ==========================================================================
 * Simple Heading — 标题编号 + 目录（手动触发，可精确撤销）
 * --------------------------------------------------------------------------
 * 1. 一键生成目录：默认插在【第一个二级标题之前】，也可插在【当前光标处】。
 * 2. 手动触发：只在命令面板 / 快捷键里跑，短文不打扰。
 * 3. 从【二级标题】开始编号；二级可选中式（一、二、）或数字（1. 2.）；
 *    三级起一律数字，格式 1.1 / 1.2 / 1.2.3 ……
 * 4. 删掉某个标题后，再跑一次编号即可自动补齐，绝不断号（每次从头重算序号）。
 * 5. 一级标题（#）不编号、不进目录。
 *
 * 设计红线（改代码前先读）：
 *   1. 不碰启动    onload 只做「读一次设置 + 注册 5 个命令 + 1 个设置页」：
 *                  不遍历库、不监听事件、不起定时器、不碰 vault 层。
 *                  （tools/test.mjs 里有一条**读源码**的断言在守这条。）
 *   2. 不自动改文档 全部是手动命令；不点它，文档永远不变。
 *   3. 精确可逆    序号只有 `1.` / `1.1` / `一、` 这几种形态；目录块**默认不加任何
 *                  HTML 注释标记**，靠"加粗标题行 + 内部标题链接"结构识别 ——
 *                  所以「清除」能把文档逐字节还原（单测有往返断言）。
 *   4. 局部修改    插入目录只动插入点附近的空行，不重排文档其他部分。
 *   5. 一次事务    用 editor.transaction 提交，撤销历史只多一步，不逐行 setValue。
 *   6. 无构建      main.js 既是源码也是产物，直接改它。
 *
 * 文件结构：
 *   §1 常量与默认设置
 *   §2 纯函数（tools/test.mjs 覆盖）
 *   §3 插件主体（命令 / 编辑器交互）
 *   §4 设置页
 *   §5 导出
 * ========================================================================== */

const obsidian = require('obsidian');
const { Plugin, PluginSettingTab, Setting, Notice } = obsidian;

/* 可选：给目录块加 HTML 注释标记（默认不用，见 tocMarker 设置） */
const TOC_START = '<!-- simple-heading:toc:start -->';
const TOC_END = '<!-- simple-heading:toc:end -->';
const CN_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

const DEFAULT_SETTINGS = {
  numberStyle: 'chinese', // chinese（一、）| numeric（1.）
  tocTitle: '目录', // 目录块首行的加粗文字；留空则不要这一行
  tocMarker: 'none', // none（不加标记，靠结构识别）| comment（用 HTML 注释包住）
  tocPosition: 'beforeFirstH2', // beforeFirstH2 | cursor
  tocMaxLevel: 6, // 目录收录到几级
  tocIndent: 2, // 每深一级缩进几个空格
};

/* §2 纯函数 =============================================================== */

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function normalizeSettings(raw) {
  const out = Object.assign({}, DEFAULT_SETTINGS);
  if (raw && typeof raw === 'object') {
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (raw[key] !== undefined) out[key] = raw[key];
    }
  }
  if (['chinese', 'numeric'].indexOf(out.numberStyle) < 0) out.numberStyle = DEFAULT_SETTINGS.numberStyle;
  if (['none', 'comment'].indexOf(out.tocMarker) < 0) out.tocMarker = DEFAULT_SETTINGS.tocMarker;
  if (['beforeFirstH2', 'cursor'].indexOf(out.tocPosition) < 0) out.tocPosition = DEFAULT_SETTINGS.tocPosition;
  out.tocMaxLevel = clampInt(out.tocMaxLevel, 2, 6, 6);
  out.tocIndent = clampInt(out.tocIndent, 0, 8, 2);
  return out;
}

/** 1–99 的中文数字（二级标题够用；再大退回阿拉伯数字） */
function chineseNumber(n) {
  const num = Number(n);
  if (!Number.isFinite(num) || num < 1 || num > 99) return String(num);
  if (num < 10) return CN_DIGITS[num];
  if (num === 10) return '十';
  if (num < 20) return `十${CN_DIGITS[num - 10]}`;
  const tens = Math.floor(num / 10);
  const ones = num % 10;
  return ones === 0 ? `${CN_DIGITS[tens]}十` : `${CN_DIGITS[tens]}十${CN_DIGITS[ones]}`;
}

/**
 * 一级不编号；二级按 style；三级起一律 a.b.c（阿拉伯层号拼接）。
 * 返回值带结尾分隔符：中文 `、`，数字二级 `. `，三级起 ` `。
 */
function formatHeadingNumber(level, counters, style) {
  const c = counters || [];
  if (level < 2) return '';
  if (level === 2) {
    return style === 'chinese' ? `${chineseNumber(c[2] || 1)}、` : `${c[2] || 1}. `;
  }
  const parts = [];
  for (let l = 2; l <= level; l += 1) parts.push(c[l] || 1);
  return `${parts.join('.')} `;
}

/**
 * 只去"我们自己会加的"序号前缀：
 *   1.  → 数字 + 点 + 空格          （二级，数字模式）
 *   1.1 / 1.1.1  → 至少一个点再跟空格（三级起）
 *   一、 → 中文数字 + 顿号
 * 关键：**点号是必须的** —— 否则 `## 2026 年计划` 里的 2026 会被误吃掉。
 */
function stripNumberPrefix(text) {
  return String(text == null ? '' : text)
    .replace(/^(?:\d+(?:\.\d+)+\.?\s+|\d+\.\s+)/, '')
    .replace(/^[一二三四五六七八九十]+、\s*/, '');
}

/** 扫描标题，跳过 ``` / ~~~ 围栏代码块。返回 [{ level, text, line }] */
function parseHeadings(text) {
  const lines = String(text == null ? '' : text).split('\n');
  const out = [];
  let fence = null;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const fenceMatch = /^\s*(```|~~~)/.exec(line);
    if (fenceMatch) {
      if (fence === null) fence = fenceMatch[1];
      else if (line.trim().startsWith(fence)) fence = null;
      continue;
    }
    if (fence !== null) continue;
    const m = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (!m) continue;
    out.push({ level: m[1].length, text: m[2], line: i });
  }
  return out;
}

/* ---------- 目录块的识别：两种方式 ---------- */

/** 是目录条目行吗：`- [文字](#锚点)` */
function isTocEntryLine(line) {
  return /^\s*[-*] \[[^\]]*\]\(#[^)]*\)\s*$/.test(String(line == null ? '' : line));
}

/** 是"只有加粗"的一行吗：`**目录**` */
function isBoldOnlyLine(line) {
  return /^\s*\*\*[^*]+\*\*\s*$/.test(String(line == null ? '' : line));
}

/** 注释标记模式：靠 start/end 两行找块 */
function findMarkedBlock(text) {
  const lines = String(text == null ? '' : text).split('\n');
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() === TOC_START) {
      start = i;
      break;
    }
  }
  if (start < 0) return null;
  for (let j = start + 1; j < lines.length; j += 1) {
    if (lines[j].trim() === TOC_END) return { startLine: start, endLine: j, entries: j - start - 1 };
  }
  return null;
}

/**
 * 默认方式（无标记）：靠结构识别 ——
 *   一行加粗标题（默认 `**目录**`）+ 紧随其后的若干行内部标题链接。
 *   两者缺一不可；tocTitle 留空时要求连续 ≥2 行内部链接（更保守）。
 * 因此你手写的普通链接列表（哪怕全是内部链接）不会被误认，除非它正好以 `**目录**` 开头。
 */
function findTocByShape(text, settings) {
  const s = normalizeSettings(settings);
  const lines = String(text == null ? '' : text).split('\n');
  const wantTitle = s.tocTitle ? `**${s.tocTitle}**` : null;

  for (let i = 0; i < lines.length; i += 1) {
    let contentFrom = i;
    if (wantTitle) {
      if (lines[i].trim() !== wantTitle) continue;
      contentFrom = i + 1;
    }
    let j = contentFrom;
    let count = 0;
    while (j < lines.length && isTocEntryLine(lines[j])) {
      count += 1;
      j += 1;
    }
    const min = wantTitle ? 1 : 2;
    if (count >= min) return { startLine: i, endLine: j - 1, entries: count };
  }
  return null;
}

/** 统一的"找目录块"入口：按设置选识别方式 */
function findTocBlock(text, settings) {
  const s = normalizeSettings(settings);
  return s.tocMarker === 'comment' ? findMarkedBlock(text) : findTocByShape(text, s);
}

/** 目录块内的行号（编号 / 清除时跳过块内内容） */
function tocLineSet(text, settings) {
  const range = findTocBlock(text, settings);
  const set = new Set();
  if (!range) return set;
  for (let i = range.startLine; i <= range.endLine; i += 1) set.add(i);
  return set;
}

/* ---------- 编号 ---------- */

/**
 * 重排编号：二级起重新编号，序号每次从头重算 —— 删掉标题后不会断号。
 * 一级标题原样保留（不编号、也不去号）。
 * 注意：标题用 parseHeadings 取，**已经跳过围栏代码块**。
 */
function renumberText(text, settings) {
  const s = normalizeSettings(settings);
  const src = String(text == null ? '' : text);
  const lines = src.split('\n');
  const found = parseHeadings(src);
  const skip = tocLineSet(src, s);
  const counters = [0, 0, 0, 0, 0, 0, 0];
  let count = 0;
  let changed = false;

  for (const h of found) {
    if (skip.has(h.line)) continue;
    if (h.level === 1) continue; // 一级标题不编号
    counters[h.level] = (counters[h.level] || 0) + 1;
    for (let l = h.level + 1; l <= 6; l += 1) counters[l] = 0;
    const body = stripNumberPrefix(h.text);
    const numbered = `${'#'.repeat(h.level)} ${formatHeadingNumber(h.level, counters, s.numberStyle)}${body}`;
    if (numbered !== lines[h.line]) changed = true;
    lines[h.line] = numbered;
    count += 1;
  }
  return { text: lines.join('\n'), count: count, changed: changed };
}

/** 清除编号（只删本插件加过的形态；一级标题不动，代码块与目录块不动） */
function clearNumbers(text, settings) {
  const src = String(text == null ? '' : text);
  const lines = src.split('\n');
  const found = parseHeadings(src);
  const skip = tocLineSet(src, settings);
  let count = 0;
  for (const h of found) {
    if (skip.has(h.line)) continue;
    if (h.level === 1) continue;
    const body = stripNumberPrefix(h.text);
    if (body !== h.text) {
      lines[h.line] = `${'#'.repeat(h.level)} ${body}`;
      count += 1;
    }
  }
  return { text: lines.join('\n'), count: count };
}

/* ---------- 目录 ---------- */

function escapeLinkText(text) {
  return String(text == null ? '' : text).replace(/[[\]]/g, (c) => `\\${c}`);
}

/** 目录锚点：与 Obsidian 的标题链接一致（URL 编码） */
function encodeAnchor(text) {
  return encodeURIComponent(String(text == null ? '' : text));
}

/** 生成目录块：默认只有"加粗标题 + 链接列表"，不加任何注释标记 */
function buildTocBlock(headings, settings) {
  const s = normalizeSettings(settings);
  const items = (Array.isArray(headings) ? headings : []).filter((h) => h && h.level >= 2 && h.level <= s.tocMaxLevel);
  const body = [];
  if (s.tocTitle) body.push(`**${s.tocTitle}**`);
  for (const h of items) {
    const indent = ' '.repeat(Math.max(0, (h.level - 2) * s.tocIndent));
    body.push(`${indent}- [${escapeLinkText(h.text)}](#${encodeAnchor(h.text)})`);
  }
  if (items.length === 0) body.push(s.tocTitle ? '（文档里还没有二级及以下标题）' : '- （文档里还没有二级及以下标题）');
  return s.tocMarker === 'comment' ? [TOC_START].concat(body).concat([TOC_END]).join('\n') : body.join('\n');
}

/** 用新块替换旧块；没有旧块则原样返回 */
function replaceTocBlock(text, block, settings) {
  const src = String(text == null ? '' : text);
  const range = findTocBlock(src, settings);
  if (!range) return src;
  const lines = src.split('\n');
  return lines.slice(0, range.startLine).concat(block.split('\n')).concat(lines.slice(range.endLine + 1)).join('\n');
}

/**
 * 删掉目录块：把块本身去掉；如果块原来的位置两侧都成了空行，只合并掉一个 ——
 * 这样「插入 → 清除」能逐字节回到原文（单测里专门验这条）。
 */
function removeTocBlock(text, settings) {
  const src = String(text == null ? '' : text);
  const range = findTocBlock(src, settings);
  if (!range) return src;
  const lines = src.split('\n');
  const list = lines.slice(0, range.startLine).concat(lines.slice(range.endLine + 1));
  const at = range.startLine;
  if (at - 1 >= 0 && list[at - 1] !== undefined && list[at - 1].trim() === '' && list[at] !== undefined && list[at].trim() === '') {
    list.splice(at, 1);
  }
  return list.join('\n');
}

/** 在指定行之前插入目录块：只在插入点补必要的空行，不动别处 */
function insertBlockAtLine(text, block, line) {
  const src = String(text == null ? '' : text);
  const lines = src.split('\n');
  const at = Math.max(0, Math.min(lines.length, Number.isFinite(line) ? line : 0));
  const needLead = at > 0 && lines[at - 1] !== undefined && lines[at - 1].trim() !== '';
  const chunk = (needLead ? [''] : []).concat(block.split('\n')).concat(['']);
  return lines.slice(0, at).concat(chunk).concat(lines.slice(at)).join('\n');
}

/** 插到第一个二级标题之前；没有二级标题则放到文末 */
function insertTocBlock(text, block, headings) {
  const list = Array.isArray(headings) ? headings : parseHeadings(text);
  const first = list.find((h) => h.level === 2);
  if (first) return insertBlockAtLine(text, block, first.line);
  const lines = String(text == null ? '' : text).split('\n');
  return insertBlockAtLine(text, block, lines.length);
}

/**
 * 一步到位：重排编号 → 用编号后的标题生成目录 → 更新或插入目录块。
 * cursorLine 传了且设置为"光标处"时才插到光标行，否则插在第一个二级标题之前。
 */
function applyNumberAndToc(text, settings, cursorLine) {
  const s = normalizeSettings(settings);
  const numbered = renumberText(text, s);
  const headings = parseHeadings(numbered.text);
  const block = buildTocBlock(headings, s);
  let next;
  if (findTocBlock(numbered.text, s)) {
    next = replaceTocBlock(numbered.text, block, s);
  } else if (s.tocPosition === 'cursor' && Number.isFinite(cursorLine)) {
    next = insertBlockAtLine(numbered.text, block, cursorLine);
  } else {
    next = insertTocBlock(numbered.text, block, headings);
  }
  return {
    text: next,
    numbered: numbered.count,
    inToc: headings.filter((h) => h.level >= 2 && h.level <= s.tocMaxLevel).length,
  };
}

/** 设置页里显示的格式示例 */
function sampleText(settings) {
  const s = normalizeSettings(settings);
  const counters = [0, 0, 0, 0, 0, 0, 0];
  const lines = [];
  for (const level of [2, 3, 4, 2, 3]) {
    counters[level] = (counters[level] || 0) + 1;
    for (let l = level + 1; l <= 6; l += 1) counters[l] = 0;
    lines.push(`${'#'.repeat(level)} ${formatHeadingNumber(level, counters, s.numberStyle)}标题`);
  }
  return lines.join('　·　');
}

/* §3 插件主体 ============================================================= */

class SimpleHeadingPlugin extends Plugin {
  async onload() {
    // 只读一次设置：不扫描库、不监听事件、不起定时器
    await this.loadSettings();

    this.addCommand({
      id: 'number-and-toc',
      name: '一键：重排编号 + 更新目录',
      editorCallback: (editor) => this.runNumberAndToc(editor),
    });
    this.addCommand({
      id: 'number-only',
      name: '仅重排标题编号（删过标题就用它）',
      editorCallback: (editor) => this.runNumber(editor),
    });
    this.addCommand({
      id: 'toc',
      name: '仅插入 / 更新目录',
      editorCallback: (editor) => this.runToc(editor, false),
    });
    this.addCommand({
      id: 'toc-at-cursor',
      name: '在当前光标处插入目录',
      editorCallback: (editor) => this.runToc(editor, true),
    });
    this.addCommand({
      id: 'clear',
      name: '清除标题编号与目录（卸载前清理用）',
      editorCallback: (editor) => this.runClear(editor),
    });

    this.addSettingTab(new SimpleHeadingSettingTab(this.app, this));
  }

  async loadSettings() {
    this.settings = normalizeSettings(await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  /** 一次事务替换全文，撤销历史只多一步；光标尽量留在原处 */
  applyText(editor, newText) {
    if (editor.getValue() === newText) return false;
    const cursor = editor.getCursor();
    const lines = newText.split('\n');
    const line = Math.max(0, Math.min(cursor.line, lines.length - 1));
    const ch = Math.max(0, Math.min(cursor.ch, lines[line].length));
    const lastOld = editor.lastLine();
    editor.transaction({
      changes: [
        {
          from: { line: 0, ch: 0 },
          to: { line: lastOld, ch: editor.getLine(lastOld).length },
          text: newText,
        },
      ],
      selection: { from: { line: line, ch: ch }, to: { line: line, ch: ch } },
    });
    return true;
  }

  runNumberAndToc(editor) {
    const result = applyNumberAndToc(editor.getValue(), this.settings, editor.getCursor().line);
    if (!this.applyText(editor, result.text)) return new Notice('标题编号与目录已是最新，无需改动');
    new Notice(`已重排 ${result.numbered} 个标题（二级起），目录收录 ${result.inToc} 条`);
  }

  runNumber(editor) {
    const result = renumberText(editor.getValue(), this.settings);
    if (!this.applyText(editor, result.text)) return new Notice('编号已是最新，无需改动');
    new Notice(`已重排 ${result.count} 个标题（二级起，一级标题不动）`);
  }

  runToc(editor, atCursor) {
    const text = editor.getValue();
    const settings = Object.assign({}, this.settings, { tocPosition: atCursor ? 'cursor' : this.settings.tocPosition });
    const headings = parseHeadings(text);
    const block = buildTocBlock(headings, settings);
    const existed = findTocBlock(text, settings);
    let next;
    if (existed) {
      next = replaceTocBlock(text, block, settings); // 已有目录就地更新，不重复插
    } else if (atCursor) {
      next = insertBlockAtLine(text, block, editor.getCursor().line);
    } else {
      next = insertTocBlock(text, block, headings);
    }
    if (!this.applyText(editor, next)) return new Notice('目录已是最新，无需改动');
    const n = headings.filter((h) => h.level >= 2 && h.level <= settings.tocMaxLevel).length;
    new Notice(`目录已${existed ? '更新' : '插入'}，收录 ${n} 条`);
  }

  runClear(editor) {
    const text = editor.getValue();
    const withoutToc = removeTocBlock(text, this.settings);
    const cleared = clearNumbers(withoutToc, this.settings);
    if (!this.applyText(editor, cleared.text)) return new Notice('没有找到本插件添加的编号或目录');
    new Notice(`已清除 ${cleared.count} 个标题编号，并移除目录块（其他内容未改动）`);
  }
}

/* §4 设置页 =============================================================== */

class SimpleHeadingSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    const p = this.plugin;
    const s = p.settings;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Simple Heading 设置' });
    const bind = (key, cast) => async (value) => {
      s[key] = cast ? cast(value) : value;
      await p.saveSettings();
    };

    containerEl.createEl('h3', { text: '编号' });
    new Setting(containerEl)
      .setName('二级标题编号样式')
      .setDesc('三级起一律数字（1.1、1.2、1.2.3……）；一级标题（#）永远不编号')
      .addDropdown((d) =>
        d
          .addOption('chinese', '中文：一、二、三、')
          .addOption('numeric', '数字：1. 2. 3.')
          .setValue(s.numberStyle)
          .onChange(bind('numberStyle'))
      );
    containerEl.createEl('p', { cls: 'setting-item-description', text: `示例：${sampleText(s)}` });

    containerEl.createEl('h3', { text: '目录' });
    new Setting(containerEl)
      .setName('目录标题')
      .setDesc('目录块首行的加粗文字，同时也是识别目录块的依据；留空则只认"连续两行以上的内部标题链接"')
      .addText((t) => t.setValue(s.tocTitle).onChange(bind('tocTitle', (v) => v.trim())));
    new Setting(containerEl)
      .setName('目录块标记')
      .setDesc('默认不加任何标记（推荐）：靠"加粗标题 + 内部标题链接"结构识别，文档里不留插件痕迹')
      .addDropdown((d) =>
        d
          .addOption('none', '不加标记（推荐，文档更干净）')
          .addOption('comment', '用 HTML 注释包住（识别最稳，但源码里能看到两行注释）')
          .setValue(s.tocMarker)
          .onChange(bind('tocMarker'))
      );
    new Setting(containerEl)
      .setName('默认插入位置')
      .setDesc('「仅插入 / 更新目录」用它；光标处另有专门命令')
      .addDropdown((d) =>
        d
          .addOption('beforeFirstH2', '第一个二级标题之前')
          .addOption('cursor', '当前光标处')
          .setValue(s.tocPosition)
          .onChange(bind('tocPosition'))
      );
    new Setting(containerEl)
      .setName('目录收录到几级')
      .setDesc('2–6')
      .addSlider((sl) => sl.setLimits(2, 6, 1).setValue(s.tocMaxLevel).setDynamicTooltip().onChange(bind('tocMaxLevel')));
    new Setting(containerEl)
      .setName('每级缩进空格数')
      .setDesc('0–8')
      .addSlider((sl) => sl.setLimits(0, 8, 1).setValue(s.tocIndent).setDynamicTooltip().onChange(bind('tocIndent')));

    containerEl.createEl('h3', { text: '关于' });
    containerEl.createEl('p', {
      cls: 'setting-item-description',
      text:
        '启动开销：onload 只读一次设置、注册命令与设置页 —— 不遍历库、不监听事件、不起定时器，也不访问 vault。' +
        '文档改动：只在命令面板 / 快捷键触发时发生，绝不自动改。',
    });
    containerEl.createEl('p', {
      cls: 'setting-item-description',
      text:
        '加的序号只有 1. / 1.1 / 一、 这几种形态；目录块默认不带任何注释标记。' +
        '所以「清除标题编号与目录」能精确还原，卸载插件也不影响文档。',
    });
  }
}

/* §5 导出 ================================================================= */

module.exports = SimpleHeadingPlugin;
module.exports.__test = {
  DEFAULT_SETTINGS,
  TOC_START,
  TOC_END,
  clampInt,
  normalizeSettings,
  chineseNumber,
  formatHeadingNumber,
  stripNumberPrefix,
  parseHeadings,
  isTocEntryLine,
  isBoldOnlyLine,
  findMarkedBlock,
  findTocByShape,
  findTocBlock,
  tocLineSet,
  renumberText,
  clearNumbers,
  escapeLinkText,
  encodeAnchor,
  buildTocBlock,
  replaceTocBlock,
  removeTocBlock,
  insertBlockAtLine,
  insertTocBlock,
  applyNumberAndToc,
  sampleText,
};
