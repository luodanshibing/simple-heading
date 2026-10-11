// Simple Heading —— 纯逻辑单测
//   运行：node tools/test.mjs
//   不依赖 Obsidian：把 require('obsidian') 换成最小桩件。
import { createRequire } from 'node:module';
import Module from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);

/* ---------- obsidian 桩件 ---------- */
class Plugin {}
class PluginSettingTab {}
class Setting {}
class Notice {}

const originalLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === 'obsidian') return { Plugin, PluginSettingTab, Setting, Notice };
  return originalLoad.call(this, request, ...rest);
};

const SimpleHeadingPlugin = require('../main.js');
const T = SimpleHeadingPlugin.__test;
const SRC = readFileSync(new URL('../main.js', import.meta.url), 'utf8');

/* ---------- 极简断言 ---------- */
let pass = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) pass += 1;
  else fails.push(`✗ ${label}`);
};
const eq = (actual, expected, label) => {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a === b) pass += 1;
  else fails.push(`✗ ${label}\n    实际：${a}\n    期望：${b}`);
};

/* ---------- 0. 不影响启动速度（读源码断言） ---------- */
ok(!/registerInterval|registerEvent/.test(SRC), '源码没有注册定时器 / 事件监听');
ok(!/setInterval|setTimeout/.test(SRC), '源码没有起任何计时器');
ok(!/\.vault\b|getFiles\(|getMarkdownFiles\(|getAllLoadedFiles/.test(SRC), '源码不访问 vault 层、不扫描库');
ok(!/workspace\.on\(|onLayoutReady/.test(SRC), '不监听 workspace 事件');
ok(!/\.obsidian|adapter\.read/.test(SRC), '不读库配置 / 不直接读文件');
ok(!/registerView|WorkspaceLeaf/.test(SRC), '不注册视图（本插件没有常驻界面）');

/* ---------- 1. 设置 ---------- */
eq(Object.keys(T.DEFAULT_SETTINGS).length, 6, '默认设置共 6 项');
eq(T.DEFAULT_SETTINGS.numberStyle, 'chinese', '默认二级用中文数字');
eq(T.DEFAULT_SETTINGS.tocMarker, 'none', '默认目录块不加任何标记');
eq(T.DEFAULT_SETTINGS.tocPosition, 'beforeFirstH2', '默认目录插在第一个二级标题前');
eq(T.DEFAULT_SETTINGS.tocMaxLevel, 6, '默认收录到 6 级');
eq(T.DEFAULT_SETTINGS.tocIndent, 2, '默认每级缩进 2 空格');
eq(T.normalizeSettings(null).numberStyle, 'chinese', 'null → 默认');
eq(T.normalizeSettings({ numberStyle: 'roman' }).numberStyle, 'chinese', '非法样式回退');
eq(T.normalizeSettings({ tocMarker: '乱写' }).tocMarker, 'none', '非法标记方式回退到 none');
eq(T.normalizeSettings({ tocPosition: '乱七八糟' }).tocPosition, 'beforeFirstH2', '非法位置回退');
eq(T.normalizeSettings({ tocMaxLevel: 99 }).tocMaxLevel, 6, '收录级别夹到 6');
eq(T.normalizeSettings({ tocMaxLevel: 1 }).tocMaxLevel, 2, '收录级别夹到 2');
eq(T.normalizeSettings({ tocIndent: -3 }).tocIndent, 0, '缩进夹到 0');
eq('extra' in T.normalizeSettings({ extra: 1 }), false, '未知键被丢弃');
eq(T.clampInt('abc', 2, 6, 6), 6, '非数字回退');

/* ---------- 2. 中文数字 ---------- */
eq(T.chineseNumber(1), '一', '1 → 一');
eq(T.chineseNumber(9), '九', '9 → 九');
eq(T.chineseNumber(10), '十', '10 → 十');
eq(T.chineseNumber(11), '十一', '11 → 十一');
eq(T.chineseNumber(19), '十九', '19 → 十九');
eq(T.chineseNumber(20), '二十', '20 → 二十');
eq(T.chineseNumber(21), '二十一', '21 → 二十一');
eq(T.chineseNumber(99), '九十九', '99 → 九十九');
eq(T.chineseNumber(100), '100', '100 超出范围退回阿拉伯数字');

/* ---------- 3. 编号格式 ---------- */
eq(T.formatHeadingNumber(2, [0, 0, 1], 'chinese'), '一、', '二级中文：一、');
eq(T.formatHeadingNumber(2, [0, 0, 3], 'numeric'), '3. ', '二级数字：3. ');
eq(T.formatHeadingNumber(3, [0, 0, 1, 1], 'chinese'), '1.1 ', '三级：1.1（中文模式下也是数字）');
eq(T.formatHeadingNumber(3, [0, 0, 2, 3], 'chinese'), '2.3 ', '三级：2.3');
eq(T.formatHeadingNumber(4, [0, 0, 1, 2, 4], 'numeric'), '1.2.4 ', '四级：1.2.4');
eq(T.formatHeadingNumber(6, [0, 0, 1, 2, 3, 4, 5], 'numeric'), '1.2.3.4.5 ', '六级：1.2.3.4.5');
eq(T.formatHeadingNumber(1, [0, 0, 1], 'chinese'), '', '一级不产生编号');

/* ---------- 4. 去序号前缀 ---------- */
eq(T.stripNumberPrefix('1. 标题'), '标题', '去 1.');
eq(T.stripNumberPrefix('1.1 标题'), '标题', '去 1.1');
eq(T.stripNumberPrefix('1.1.1 标题'), '标题', '去 1.1.1');
eq(T.stripNumberPrefix('一、标题'), '标题', '去 一、');
eq(T.stripNumberPrefix('十、标题'), '标题', '去 十、');
eq(T.stripNumberPrefix('2026 年计划'), '2026 年计划', '不动用户自己的 2026（没有点号）');
eq(T.stripNumberPrefix('第十八章'), '第十八章', '不动"第十八章"（没有顿号）');
eq(T.stripNumberPrefix('版本 1.2 说明'), '版本 1.2 说明', '不在行首的数字不动');
eq(T.stripNumberPrefix(''), '', '空串安全');

/* ---------- 5. 扫描标题 ---------- */
const doc1 = ['# 页面标题', '## 第一节', '正文', '### 小节', '#### 次小节', '## 第二节'].join('\n');
const h1 = T.parseHeadings(doc1);
eq(h1.length, 5, '数出 5 个标题（含一级）');
eq(h1[0].level + '/' + h1[0].text, '1/页面标题', '一级标题也解析出来（由调用方过滤）');
eq(h1[1].line, 1, '第二个标题在第 2 行（0 基）');
eq(h1[4].level, 2, '最后一个标题是二级');
const fenced = ['# T', '```js', '## 代码里的假标题', '```', '## 真标题'].join('\n');
eq(T.parseHeadings(fenced).map((h) => h.text), ['T', '真标题'], '``` 围栏里的假标题被跳过');
const fenced2 = ['# T', '~~~', '## 假标题', '~~~', '## 真标题'].join('\n');
eq(T.parseHeadings(fenced2).map((h) => h.text), ['T', '真标题'], '~~~ 围栏同样跳过');
eq(T.parseHeadings('#没有空格').length, 0, '#没有空格 不算标题');
eq(T.parseHeadings('####### 七级').length, 0, '七个 # 不算标题');
eq(T.parseHeadings('##   多空格   ')[0].text, '多空格', '标题两侧空白被裁掉');
eq(T.parseHeadings('').length, 0, '空文档没有标题');

/* ---------- 6. 重排编号 ---------- */
const src = ['# 页面标题', '## 甲', '### 甲一', '### 甲二', '#### 更深', '## 乙', '### 乙一'].join('\n');
const num1 = T.renumberText(src, { numberStyle: 'chinese' });
eq(
  num1.text.split('\n'),
  ['# 页面标题', '## 一、甲', '### 1.1 甲一', '### 1.2 甲二', '#### 1.2.1 更深', '## 二、乙', '### 2.1 乙一'],
  '中文模式：二级中文、三级起数字'
);
eq(num1.count, 6, '编号了 6 个（不含一级）');
const num2 = T.renumberText(src, { numberStyle: 'numeric' });
eq(num2.text.split('\n')[1], '## 1. 甲', '数字模式：二级 1.');
eq(num2.text.split('\n')[5], '## 2. 乙', '数字模式：二级 2.');
eq(T.renumberText(num1.text, { numberStyle: 'chinese' }).text, num1.text, '重复编号是幂等的');
eq(T.renumberText(num1.text, { numberStyle: 'chinese' }).changed, false, '重复编号时 changed=false');
eq(T.renumberText(src, {}).text.split('\n')[3], '### 1.2 甲二', '不传设置也能跑（用默认中文）');

/* 删掉一个标题后不断号 —— 需求 4 */
const deleted = ['# T', '## 甲', '### 甲一', '## 乙', '### 乙一'].join('\n');
const afterDelete = T.renumberText(deleted, { numberStyle: 'chinese' }).text.split('\n');
eq(afterDelete[1], '## 一、甲', '删除后：一级序号仍是 一、');
eq(afterDelete[3], '## 二、乙', '删除后：下一个仍是 二、（不断号）');

/* 层级跳跃与回落：跳过的层级按 1 计（H2 下直接 H4 → 1.1.1） */
const jump = ['## A', '#### D', '## B'].join('\n');
eq(
  T.renumberText(jump, { numberStyle: 'numeric' }).text.split('\n'),
  ['## 1. A', '#### 1.1.1 D', '## 2. B'],
  '层级跳跃按 1 补齐；回到二级时序号继续'
);

/* 一级标题永远不动 */
const withH1 = ['# 1. 看起来像编号的一级标题', '## x'].join('\n');
eq(T.renumberText(withH1, {}).text.split('\n')[0], '# 1. 看起来像编号的一级标题', '一级标题不编号、也不去号');

/* 用户自己的数字不被吃掉 */
const userNum = ['## 2026 年计划', '## 1.1 手写编号'].join('\n');
const un = T.renumberText(userNum, { numberStyle: 'numeric' }).text.split('\n');
eq(un[0], '## 1. 2026 年计划', '用户标题里的 2026 保留');
eq(un[1], '## 2. 手写编号', '手写的旧编号被替换（不叠加）');

/* 代码块里的假标题不动 */
const withCode = ['## 真', '```', '## 假', '```'].join('\n');
eq(T.renumberText(withCode, {}).text.split('\n')[2], '## 假', '代码块里的 ## 不被编号');

/* ---------- 7. 清除编号 ---------- */
const cleared = T.clearNumbers(num1.text, {});
eq(cleared.count, 6, '清除了 6 个编号');
eq(cleared.text, src, '清除后完全回到原文（可逆）');
eq(T.clearNumbers(src, {}).count, 0, '没有编号时清除 0 个');
eq(T.clearNumbers(withH1, {}).text, withH1, '一级标题原样保留');

/* ---------- 8. 目录块识别：默认「不加标记」（靠结构） ---------- */
const shape = ['# T', '', '**目录**', '- [一、甲](#x)', '  - [1.1 乙](#y)', '', '## 一、甲'].join('\n');
eq(T.findTocByShape(shape, {}).startLine, 2, '结构识别：从加粗标题行开始');
eq(T.findTocByShape(shape, {}).endLine, 4, '结构识别：到最后一个链接行为止');
eq(T.findTocByShape(shape, {}).entries, 2, '结构识别：数出 2 条');
eq(T.findTocBlock(shape, {}), T.findTocByShape(shape, {}), '默认走结构识别');
eq(T.findTocBlock(shape, { tocMarker: 'comment' }), null, '注释模式在无标记文档里找不到块');

/* 反例：不以 `**目录**` 开头的链接列表不算目录 */
const notToc = ['# T', '', '相关笔记：', '- [另一篇](另一篇.md)', '- [外部](https://x.com)'].join('\n');
eq(T.findTocByShape(notToc, {}), null, '普通链接列表不会被误认');
const linkListNoTitle = ['# T', '', '- [甲](#x)', '- [乙](#y)'].join('\n');
eq(T.findTocByShape(linkListNoTitle, { tocTitle: '' }).entries, 2, '标题留空时：连续 ≥2 行内部链接也认');
eq(T.findTocByShape(linkListNoTitle, { tocTitle: '' }).startLine, 2, '标题留空时的起始行');
eq(T.findTocByShape(['# T', '- [甲](#x)'].join('\n'), { tocTitle: '' }), null, '标题留空时单条链接不认（太容易误判）');
eq(T.findTocByShape(['**目录**', '', '- [甲](#x)'].join('\n'), {}), null, '标题行与链接之间夹了空行 → 不认（避免误判）');

/* 注释模式仍然可用 */
const marked = ['x', T.TOC_START, '**目录**', '- [甲](#x)', T.TOC_END, 'z'].join('\n');
eq(T.findMarkedBlock(marked).startLine, 1, '注释模式：找到起始行');
eq(T.findMarkedBlock(marked).endLine, 4, '注释模式：找到结束行');
eq(T.findTocBlock(marked, { tocMarker: 'comment' }).endLine, 4, '注释模式通过统一入口也能找到');
eq(T.findTocBlock(marked, {}), T.findTocByShape(marked, {}), '默认模式下同一文档按结构识别（从 **目录** 行开始）');

/* ---------- 9. 目录块生成（默认不带标记） ---------- */
const block = T.buildTocBlock(h1, { tocTitle: '目录', tocIndent: 2, tocMaxLevel: 6 });
eq(block.indexOf('<!--'), -1, '默认生成的目录块里没有任何 HTML 注释');
eq(block.split('\n')[0], '**目录**', '首行是加粗标题');
eq(block.split('\n')[1], '- [第一节](#%E7%AC%AC%E4%B8%80%E8%8A%82)', '第一条是二级标题');
eq(block.indexOf('页面标题'), -1, '一级标题不进目录');
eq(T.buildTocBlock(h1, { tocMarker: 'comment' }).split('\n')[0], T.TOC_START, '注释模式下首行是标记');
eq(T.buildTocBlock(h1, { tocTitle: '' }).split('\n')[0].startsWith('- '), true, '不要标题行时直接是条目');
eq(T.buildTocBlock([], { tocTitle: '目录' }).indexOf('还没有二级') > 0, true, '没有标题时给出提示');
eq(T.buildTocBlock([{ level: 2, text: 'A[B]C' }], {}).indexOf('A\\[B\\]C') > 0, true, '链接文字里的方括号被转义');
eq(T.buildTocBlock([{ level: 2, text: '带 空格' }], {}).indexOf('%20') > 0, true, '锚点里的空格被编码');
eq(T.buildTocBlock([{ level: 5, text: 'x' }], { tocMaxLevel: 4 }).indexOf('- [x]'), -1, '超过收录级别的标题不进目录');

/* ---------- 10. 插入 / 更新 / 移除 ---------- */
const base = ['# 页面标题', '', '前言。', '## 第一节', '正文'].join('\n');
const inserted = T.insertTocBlock(base, T.buildTocBlock(T.parseHeadings(base), {}), null);
eq(inserted.indexOf('**目录**') < inserted.indexOf('## 第一节'), true, '目录插在第一个二级标题之前');
eq(inserted.indexOf('# 页面标题') < inserted.indexOf('**目录**'), true, '一级标题仍在目录之前');
eq(inserted.indexOf('<!--'), -1, '插入后的文档里没有注释残留');
const replaced = T.replaceTocBlock(inserted, T.buildTocBlock(T.parseHeadings(inserted), { tocTitle: '新目录' }), {});
eq((replaced.match(/\*\*目录\*\*/g) || []).length, 0, '更新后旧标题被换掉');
eq((replaced.match(/\*\*新目录\*\*/g) || []).length, 1, '更新后只有一个新标题（不会重复插）');
eq(T.removeTocBlock(inserted, {}).indexOf('**目录**'), -1, '移除目录块');
const atCursor = T.insertBlockAtLine(base, T.buildTocBlock(T.parseHeadings(base), {}), 2);
eq(atCursor.split('\n').slice(0, 2).join('|'), '# 页面标题|', '光标插入：前两行不变');
eq(atCursor.indexOf('**目录**') < atCursor.indexOf('前言。'), true, '光标插入：块落在光标行处（前言之前）');

/* ---------- 11. 一步到位 + 往返（需求 5 的关键测试） ---------- */
const demo = ['# 我的页面', '', '开头一段。', '', '## 甲节', '', '### 甲一', '', '## 乙节'].join('\n');
const one = T.applyNumberAndToc(demo, { numberStyle: 'chinese', tocTitle: '目录', tocPosition: 'beforeFirstH2' });
eq(one.numbered, 3, '一步到位：编号 3 个');
eq(one.text.indexOf('## 一、甲节') > 0, true, '一步到位：二级变 一、');
eq(one.text.indexOf('### 1.1 甲一') > 0, true, '一步到位：三级变 1.1');
eq(one.text.indexOf('**目录**') < one.text.indexOf('## 一、甲节'), true, '一步到位：目录在第一个二级标题之前');
eq(one.text.indexOf('- [一、甲节](#%E4%B8%80%E3%80%81%E7%94%B2%E8%8A%82)') > 0, true, '目录条目带上了编号');
eq(one.text.indexOf('<!--'), -1, '一步到位后的文档里没有任何插件标记');
const once = T.applyNumberAndToc(one.text, { numberStyle: 'chinese', tocTitle: '目录' });
eq(once.text, one.text, '重复执行一步到位 = 幂等（不会越跑越长）');
const back = T.clearNumbers(T.removeTocBlock(one.text, {}), {}).text;
eq(back.replace(/\n+$/, ''), demo, '编号 + 目录 → 清除 = 完全回到原文（无标记模式下也是）');
/* 注释模式的往返 */
const oneM = T.applyNumberAndToc(demo, { numberStyle: 'numeric', tocMarker: 'comment' });
eq(oneM.text.indexOf(T.TOC_START) > 0, true, '注释模式：写入了起始标记');
const backM = T.clearNumbers(T.removeTocBlock(oneM.text, { tocMarker: 'comment' }), { tocMarker: 'comment' }).text;
eq(backM.replace(/\n+$/, ''), demo, '注释模式下的往返同样完全还原');
const cursorRun = T.applyNumberAndToc(demo, { tocPosition: 'cursor' }, 1);
eq(cursorRun.text.indexOf('**目录**') < cursorRun.text.indexOf('## 一、甲节'), true, '光标模式：目录落在光标行位置');

/* ---------- 12. 设置页示例 / 导出 ---------- */
ok(T.sampleText({ numberStyle: 'chinese' }).indexOf('一、标题') > 0, '示例文本含 一、标题');
ok(T.sampleText({ numberStyle: 'numeric' }).indexOf('1. 标题') > 0, '示例文本含 1. 标题');
ok(typeof SimpleHeadingPlugin === 'function', '默认导出是插件类');
eq(Object.keys(SimpleHeadingPlugin.__test).length > 20, true, '导出的纯函数足够多');

/* ---------- 汇总 ---------- */
if (fails.length === 0) {
  console.log(`\n通过 ${pass} 项，失败 0 项\n全部通过 ✓\n`);
} else {
  console.log(`\n通过 ${pass} 项，失败 ${fails.length} 项\n`);
  for (const f of fails) console.log(f);
  process.exitCode = 1;
}
