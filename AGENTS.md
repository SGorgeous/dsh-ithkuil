# 给 AI 助手看的（本仓库 = 一个 DSH 插件）

`dsh-ithkuil`：新伊库伊尔语（New Ithkuil / Ithkuil IV）翻译工作台。
使用者要的是「以后你负责帮我翻译 ithkuil」——所以这些工具是**我的工作台**，不是自动翻译器。

## 三条铁律

1. **改动之后先跑 `node validate.mjs --run`**，必须 `✅ 全部通过` 才能装回去。
   2026-10-22 就是没跑闸门，工具参数 schema 变成 `{type:null}`，
   把使用者整个 DSH 卡死（每条请求都被 OpenAI 兼容层拒）。
2. **`parameters` 必须是"属性表"**（`{ query: { type:'string', description } }`），
   交给 `defineTool()` 编译；**绝不**把属性表直接丢 `ctx.tools.register()`。
3. **别在插件加载时读大文件**：`data/*.json` 全部懒加载（首次调用工具时才读），
   否则宿主启动会被拖慢、出问题也难定位。

## 翻译时的工作方式

- **Ithkuil → 中文**：先切词（重音 → Slot IX 分支）→ 用 `ithkuil_root` 验词根 →
  `ithkuil_affix` 验词缀 → `ithkuil_case` 定格 → 出 interlinear gloss → 再译中文。
- **中文 → Ithkuil**：先拆语义角色 → 选词根/词干 → 定 CA 五范畴 →
  VR（功能/限定/语境）→ 词缀 → **交给 `ithkuil_build` 拼**（它同时给出重音与音位体检）→
  拼接复合词用 `concat: "T1"`（第 10 章）→ 有 3 辅音以上的簇再人工对照音位配列表。
- 不确定就明说，并给出候选读法 + 引用的 § 号。**不要编造词根或语法规则**。
- 交付格式：词形 + gloss 标注 + 直译 + 中文 + 存疑点。

`ithkuil_quickref` 的 `workflow` / `pitfalls` / `slots` 三节就是这套流程的中文版，随时可查。

## 语料与来源

- 词根：官方 Lexicon v1.0（570 页 PDF）→ `tools/parse_lexicon.py`
- 词缀：官方 VXCS Affixes（140 页 PDF）→ `tools/parse_affixes.py`
- 语法：ithkuil.net 13 章 + 附录 HTML → `tools/extract_text.py` + `tools/build_grammar.py`

PDF 解析的两个固有坑（已在脚本里处理，改脚本时别改回去）：

1. **双栏**：必须按词的 x 坐标分栏，否则左右栏交错成乱码句子。
2. **Word 导出的 HTML 表格**：每个单元格都包着 `<p>`，按标签换行会把表竖着摊开；
   必须用 lxml 单独走 `<table>`，一行一行拼成 `a | b | c`。

数据里偶有 `｜`：那是左右栏交界标记（左栏通常 STEM 1，右栏 STEM 2/3），不是错字。

## 结构

- `index.js` —— 11 个工具的注册（全部经 `defineTool` + 自检）
- `lib/data.mjs` —— 语料加载与检索（词根评分、词缀、格、BM25、例句）
- `lib/morph.mjs` —— VX 元音表、词缀拼法、十槽说明、术语中文
- `lib/quickref.mjs` —— 中文速查（槽位/术语/流程/坑/音系）
- `lib/toolkit.mjs` —— `defineTool` 解析 + schema 自检（**改工具必看**）
- `validate.mjs` —— 启用前闸门
- `tools/*.py` —— 语料生成（只有官方文档更新时才需要跑）
