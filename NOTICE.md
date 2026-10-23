# NOTICE —— 语言资料的来源与版权

本仓库的**代码**是 MIT 许可（见 LICENSE）。

但代码所处理、索引的**语言资料**不是我的作品，著作权属于原作者：

| 资料 | 作者 / 来源 | 本仓库里的形态 |
|---|---|---|
| 《A Grammar of New Ithkuil》（13 章 + 附录） | John Quijada，<https://ithkuil.net/> | **不收录原始 HTML/PDF**；`data/grammar.json` 是按小节切分的**全文**（约 52.5 万字），供全文检索与引用，字段与章节号可回原文对照 |
| 《Lexicon for New Ithkuil》v1.0（570 页 PDF） | 同上 | **不收录 PDF**；只保留解析出的词根表 `data/roots.json`（词根辅音 + 释义 + 页码） |
| 《V_X_C_S Affixes for New Ithkuil》（140 页 PDF） | 同上 | **不收录 PDF**；只保留解析出的词缀表 `data/affixes.json`（词缀形 + 9 度释义） |
| 《Phonotactic Rules for New Ithkuil》v1.0 | 同上 | 未收录；`lib/assemble.mjs` 里只实现了可自动判定的少量规则 |

以上三份 `data/*.json` 都是从官方公开文档解析出来的**派生数据**，原文档可在 ithkuil.net 免费获取。
如果你只想保留代码、自己本地生成数据，删掉 `data/*.json` 后按 README 的"自己重建语料"跑一遍即可。


本项目的目的是**辅助学习与翻译**：把官方文档变成可检索、可拼装的离线工具，
不替代原文档，也不主张对语言资料本身的任何权利。

如果你是该资料的版权持有人并认为本仓库的派生索引不妥，请开 issue，
我会立刻移除相应的 `data/*.json`，只保留"由用户本地重新生成"的构建脚本
（`python tools/fetch_data.py` + `python tools/*.py`）。

官方文档地址：
- 语法总目录：<https://ithkuil.net/>
- 词典 PDF：<https://ithkuil.net/newithkuil_lexicon.pdf>
- 词缀 PDF：<https://ithkuil.net/newithkuil_affixes.pdf>
- 音位配列：<https://ithkuil.net/new_ithkuil_phonotaxis.pdf>
