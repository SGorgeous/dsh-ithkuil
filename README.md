# dsh-ithkuil

**新伊库伊尔语（New Ithkuil / Ithkuil IV）翻译工作台** —— 一个 DeepSeek Harness（DSH）插件。

把 ithkuil.net 的官方语法、词典、词缀表做成一组**离线**工具：查词根、查词缀、查格、
全文检索语法、找例句，还能**按十个槽位把词形拼出来**并做音位配列体检。

> 给 AI 助手装上它，翻译伊库伊尔语时就是「查着翻」，而不是凭印象编。

## 它能干什么

```
你：翻译「无数成方阵的无人飞行器正在偷袭大国东南部的一个省份」

ačphulogmümţíwa  heňžaléi-ulvžáko  eksmále  huçtyáloi-ednyalí'a  aksmalóxoi
'strike'-1/PRC-DYN-PRG-SUD/7-DSR/8-THM   [arrangement]-2/PRC-ESS ⟵conc.⟶ 'aerial.drone'-3/PRC-MSC-ERG
'province'-2/PRC-ABS   [southern.part]-3/PRC-OGN ⟵conc.⟶ [eastern.part]-2/PRC-LOC   'country'-1/PRC-SIZ/7-OGN
```

工具不会自己"生成译文"，但会把每一步都钉在官方文档上：

- 这个词根是哪个？（带 Lexicon 页码，可回原文核对）
- 这个词缀第 7 度是什么意思？
- 这个格用哪个元音？
- 「配置/关联/延展/视角/本质」拼出来的 CA 综合体是哪个辅音？
- 拼出来的词有没有违反音位配列？

## 安装

```bash
# 本地开发 / 源码安装
dsh plugin --profile desktop add link:/path/to/dsh-ithkuil

# 如果发布到 npm 之后：
dsh plugin --profile desktop add dsh-ithkuil
```

装完**重启一次 DSH**（bundle 层要重启才组装）。重启后会话里会出现 14 个 `ithkuil_*` 工具。

## 工具

| 工具 | 干什么 |
|---|---|
| `ithkuil_root` | 英文概念 → 词根（也接受 `-ŢK-`） |
| `ithkuil_entry` | 词根的完整条目 + STEM 1/2/3 明细原文 |
| `ithkuil_affix` | 按缩写/辅音形/关键词/主题查 422 个 VXCS 词缀 |
| `ithkuil_affix_form` | 辅音形 + 度 + 类型 → `-VXCS-` / `-CSVX-` |
| `ithkuil_case` | 68 个格：缩写/名字 → VC 形 + 语义角色 |
| `ithkuil_grammar` | 13 章 + 附录全文检索（BM25，带 § 号） |
| `ithkuil_section` | 读某一小节全文 |
| `ithkuil_examples` | 带 interlinear 标注的例句 |
| `ithkuil_ca` | 拼 CA 综合体（配置+关联+延展+视角+本质） |
| `ithkuil_build` | **按十槽拼一个词形**（含重音、gloss、音位体检） |
| `ithkuil_check` | 音位配列体检 |
| `ithkuil_quickref` | 中文速查：槽位/术语/翻译流程/坑 |
| `ithkuil_zh` | 语法术语 → 中文统一译名 |
| `ithkuil_stats` | 语料规模与来源 |

## 语料

| 数据 | 数量 | 来源 |
|---|---|---|
| 词根 | 5,717 条（含 STEM 1/2/3 详解原文） | 《Lexicon for New Ithkuil》v1.0，570 页 |
| VXCS 词缀 | 422 条（每条 9 度释义 + 主题分类） | 《V_X_C_S Affixes》，140 页 |
| 语法全文 | 328 小节 ≈ 52.5 万字（13 章 + 附录） | ithkuil.net 各章 HTML |
| 格 | 68 条（缩写 + VC 元音形 + 角色说明） | 第 4 章正文 |

全部离线 JSON，零网络依赖，不调用任何外部 API。

> ⚠️ **版权**：语言资料属于 John Quijada / ithkuil.net，本仓库只保留"检索索引"，
> 不收原始 PDF/HTML。详见 [NOTICE.md](NOTICE.md)。

## 自己重建语料

```bash
pip install pdfplumber lxml
python tools/fetch_data.py     # 从 ithkuil.net 下官方 HTML/PDF 到 data/
python tools/extract_text.py   # 章节 HTML → 纯文本（表格按行展开）
python tools/build_grammar.py  # 纯文本 → 328 个小节
python tools/parse_lexicon.py  # 词典 PDF → 词根（双栏按 x 坐标分栏）
python tools/parse_affixes.py  # 词缀 PDF → 词缀（每条词缀是一张表）
```

## ⚠️ 开发必读：工具 schema 的坑

第一版直接把 `parameters: { 属性名: {...} }` 丢给 `ctx.tools.register()`，
结果整个 DSH 每次请求都被 OpenAI 兼容层拒掉：

```
Invalid schema for function 'ithkuil_affix':
schema must be a JSON Schema of 'type: "object"', got 'type: null'
```

原因：`register()` 收的是 **`defineTool()` 的产物**，其中 `parameters` 已经编译成
`{type:"object", properties:{...}}`。现在 `lib/toolkit.mjs` 负责这件事：

1. 先从宿主树里找真正的 `defineTool`（桌面版 `@deepseek-ai/*` 是 optional peer，不能裸 import）；
2. 找不到就用本地等价实现，按同一套规则编译；
3. 注册前 `assertToolSchema()` 逐个自检，坏的那条只跳过它自己。

**改完工具必须跑闸门**：

```bash
node validate.mjs --run
# 必须看到 ✅ 全部通过（14 个工具，参数根节点都是 type:"object"，且实跑不抛错）
```

## 目录

```
index.js            工具注册（14 个）
lib/data.mjs        语料加载 + 检索（词根/词缀/格/BM25/例句）
lib/morph.mjs       VX 元音表、词缀拼写、十槽说明、中文术语
lib/assemble.mjs    词形拼装（VV/VR/CA/体/格/重音）+ 音位体检
lib/quickref.mjs    中文速查表（翻译流程、坑）
lib/toolkit.mjs     defineTool 解析 + schema 自检
validate.mjs        启用前闸门
data/*.json         离线语料
tools/*.py          语料生成脚本
```

## 已知边界

- 音位配列检查只覆盖**能规则化**的部分；三辅音以上的簇会提示人工对照官方表。
- Slot VIII 只实现了 36 个 Aspect；Valence/Mood/Phase/Level/Effect 还没做成接口。
- 拼接（第 10 章）支持 Type-1/Type-2 与格形转换，但**case-frame（格框）嵌套**还没实现。
- 词典是英文释义的；中文概念要先自己想成英文再查。

## 致谢

- 语言与全部语法/词典资料：**John Quijada**（[ithkuil.net](https://ithkuil.net/)）
- 插件框架：**DeepSeek Harness**
- 数据解析：pdfplumber / lxml

## License

代码 MIT（见 [LICENSE](LICENSE)）；语言资料版权归原作者（见 [NOTICE.md](NOTICE.md)）。
