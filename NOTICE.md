# NOTICE —— 语言资料的来源与版权

本仓库的**代码**是 MIT 许可（见 LICENSE）。

但代码所处理、索引的**语言资料**不是我的作品，著作权属于原作者：

| 资料 | 作者 / 来源 | 本仓库里的形态 |
|---|---|---|
| 《A Grammar of New Ithkuil》（13 章 + 附录） | John Quijada，<https://ithkuil.net/> | **不收录原文**；只把各章 HTML 解析成按小节切分的 `data/grammar.json`（检索索引，含原文片段） |
| 《Lexicon for New Ithkuil》v1.0（570 页 PDF） | 同上 | **不收录 PDF**；只保留解析出的词根表 `data/roots.json`（词根辅音 + 释义 + 页码） |
| 《V_X_C_S Affixes for New Ithkuil》（140 页 PDF） | 同上 | **不收录 PDF**；只保留解析出的词缀表 `data/affixes.json` |
| 《Phonotactic Rules for New Ithkuil》v1.0 | 同上 | 未收录；`lib/assemble.mjs` 里只实现了可自动判定的少量规则 |

本项目的目的是**辅助学习与翻译**：把官方文档变成可检索、可拼装的离线工具，
不替代原文档，也不主张对语言资料本身的任何权利。

如果你是该资料的版权持有人并认为本仓库的派生索引不妥，请开 issue，
我会立刻移除相应的 `data/*.json`，只保留"由用户本地重新生成"的构建脚本
（`node tools/fetch-data.mjs && python tools/*.py`）。

官方文档地址：
- 语法总目录：<https://ithkuil.net/>
- 词典 PDF：<https://ithkuil.net/newithkuil_lexicon.pdf>
- 词缀 PDF：<https://ithkuil.net/newithkuil_affixes.pdf>
- 音位配列：<https://ithkuil.net/new_ithkuil_phonotaxis.pdf>
