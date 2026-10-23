/**
 * lib/quickref.mjs —— 中文速查表（人看 / 我查都用这一份）
 * ============================================================================
 * 只写**能对上原文**的东西：
 *   · 十槽结构  ← 第 2 章 §2.3、第 3 章 §3.0 的表
 *   · 范畴缩写  ← 第 3 章各节标题（3.2.1 | CSL | …）
 *   · 格表      ← 第 4 章正文逐条（68 条），运行时从 data/grammar.json 抽，不手抄
 *   · 音系      ← 第 1 章 §1.1 / §1.6
 * 翻译流程与坑是我（助手）的实际做法与踩坑记录。
 * ============================================================================
 */
import { cases } from './data.mjs'
import { SLOTS } from './morph.mjs'

const caseTable = () => {
  const all = cases()
  const rows = []
  for (let i = 0; i < all.length; i += 6) {
    rows.push(all.slice(i, i + 6).map((c) => `${c.abbr}=${c.vc}`).join('  '))
  }
  return rows.join('\n')
}

const overview = `# 新伊库伊尔语（New Ithkuil / Ithkuil IV）速查

**是什么**：John Quijada 的人造语言第四版（2021 年起，官方文档站 ithkuil.net）。
每个词形（formative）由固定的十个槽位串成，一个槽位编码一类语法范畴；
语言用「音高重音」切分词界，用配置/关联/视角、四个限定、四类语境、68 个格把语义压到极密。
前身：Ithkuil（2004）→ Ilaksh / Ithkuil III（2011）→ New Ithkuil（IV）。

**这份插件里有什么**（全部离线，来自官方 PDF/HTML）：
- ${'\u007f'}词根 5,717 条（Lexicon v1.0，570 页）
- VXCS 词缀 422 条（Affixes 文档，140 页，每条 9 度）
- 语法全文 328 小节 ≈ 52.5 万字（13 章 + 附录）
- 格 68 条（含 VC 元音形）

**工具**
| 想干什么 | 用哪个 |
|---|---|
| 英文概念 → 词根 | \`ithkuil_root\` |
| 词根的 STEM 1/2/3 详解 | \`ithkuil_entry\` |
| 查词缀 / 拼词缀形 | \`ithkuil_affix\` / \`ithkuil_affix_form\` |
| 查格（VC 元音 + 角色） | \`ithkuil_case\` |
| 查规则原文 | \`ithkuil_grammar\` / \`ithkuil_section\` |
| 找带标注的例句 | \`ithkuil_examples\` |
| 拼 CA 综合体 | \`ithkuil_ca\` |
| **拼整个词形**（十个槽位 + 重音 + 体检） | \`ithkuil_build\` |
| 音位配列体检 | \`ithkuil_check\` |
| 中文速查 | \`ithkuil_quickref\` |

**下面可以细看**：\`slots\` 十槽 / \`terms\` 范畴缩写 / \`workflow\` 翻译流程 / \`pitfalls\` 常见坑 / \`phonology\` 音系与重音。
`.replace('\u007f', '')

const slots = `# 十个槽位（第 2 章 §2.3）

词形公式：
\`\`\`
(CC + VV) + CR + VR + (CSVX…) + CA + (VXCS…) + (VNCN) + VC/VK + [stress]
\`\`\`
最小合法词形 = CR + VR + CA + VC/VK + 重音。

| 槽 | 内容 | 一句话 |
|---|---|---|
${SLOTS.map((s) => `| ${s.n} | ${s.name} | ${s.note} |`).join('\n')}

要点：
- **CA 是必选的**，而且是一个辅音「合成形」，同时表示 配置+关联+延展+视角+本质。
- **Slot V 与 Slot VII 是同一批词缀**，差别只在作用域：V 作用于词干，VII 作用于「词干+CA」。
  有 Slot V 词缀时，CA 要**双写**，且该词缀要**反写成 -CSVX-**。
- **重音不是装饰**：倒数第二 = 未框架 + 用 VC；末音节 = 未框架 + 用 VK；倒数第三 = 框架 + VC。
`

const terms = `# 范畴与缩写（第 3 章）

**配置 Configuration**（20 种，Plexity×Separability×Similarity：单/双/多 × 分离/连接/融合 × 相似/相异/模糊）
UPX 单一体 · DPX 二联体 · MSS/DSS 多/双·相似·分离 · MSC/DSC 相似·连接 · MSF/DSF 相似·融合
MDS/DDS 相异·分离 · MDC/DDC 相异·连接 · MDF/DDF 相异·融合
MFS/DFS 模糊·分离 · MFC/DFC 模糊·连接 · MFF/DFF 模糊·融合

**关联 Affiliation**：CSL 整合（consolidative）· ASO 伴随（associative）· COA 合流（coalescent）· VAR 变换（variative）

**视角 Perspective**：M 单数（monadic）· G 聚合（agglomerative）· N 通指（nomic）· A 抽象（abstract）

**延展 Extension**：DEL 界限 · PRX 近端 · ICP 起始 · ATV 减弱 · GRA 渐进 · DPL 耗尽

**本质 Essence**：NRM 正常（normal）· RPV 表征（representative）

**版本 Version**：PRC 过程（processual）· CPT 完成（completive）

**功能 Function**：STA 状态（stative）· DYN 动态（dynamic）

**限定 Specification**：BSC 基本 · CTE 内容 · CSV 构成 · OBJ 客体

**语境 Context**：EXS 存在 · FNC 功能 · RPS 表征 · AMG 融合

**格 Case**（第 4 章，68 条，格式 缩写=VC元音形）：
\`\`\`
${caseTable()}
\`\`\`
`

const workflow = `# 翻译流程（我实际用的）

## Ithkuil → 中文
1. **切词**：先分出词形 / 附加词（adjunct）/ 指代（referential）。词形以辅音开头、以 VC 或 VK 收尾。
2. **看重音**：带尖音符/长音符的音节是重音位；无标注 = 倒数第二。重音决定 Slot IX 是 VC（格）还是 VK（格式/语力）以及是否框架。
3. **找词根**：Slot III 是 1–5 个辅音。用 \`ithkuil_root query="-XXX-"\` 验证是不是真词根。
4. **逐槽还原**：VV（词干+版本）→ VR（功能+限定+语境）→ CA（配置/关联/延展/视角/本质）→ Slot V/VII 词缀 → VNCN（语气+体貌）→ VC（格）。
5. **出 interlinear gloss**（逐词标注，这是中间产物，也是给自己和用户核对用），**再**翻成通顺中文。
6. 不确定的槽位**明说不确定**，并给两个候选读法 + 依据的章节号。绝不编。

## 中文 → Ithkuil
1. 先把句子拆成**语义角色**：施事/受事/工具/感受者/刺激源/受益者/处所/时间…
2. 每个内容词选**词根**（伊库伊尔词根是宽概念；先抽象成英文概念再查），定词干 1/2/3/0。
3. 定配置/关联/视角/延展/本质（5 个范畴一起决定 CA 那个辅音合成形）。
4. 定功能（状态/动态）、限定（BSC/CTE/CSV/OBJ）、语境（EXS/FNC/RPS/AMG）→ 决定 VR。
5. 需要精确语义时加词缀：选词缀 → 定 Type（1 情境 / 2 派生 / 3 修饰相邻词缀）→ 定度 0–9 → \`ithkuil_affix_form\` 拼形。
5b. **别手算了**：把词根/词干/VR/CA/词缀/格丢给 \`ithkuil_build\`，它会给出表面形式、gloss 和音位体检；
   拼接复合词（第 10 章）用 \`concat: "T1"/"T2"\`，格自动改走"去喉塞音 + 末音节重音"。
6. 给每个名词定**格**（VC），并据此摆重音。
7. **检查音位配列**：非法辅音簇要插元音/喉塞音；CA 与 Slot V 同时出现要双写。
8. 交付三件套：**词形 + gloss 标注 + 中文回译**，外加"哪些地方是近似/存疑"。

## 交付格式（默认这么给我自己/使用者看）
\`\`\`
原文：…
词形：…
gloss： … -ROOT-  '…'-morph-tags- …
直译：…
中文：…
存疑：§x.y 的规则没吃透 / 词根只有近似对应
\`\`\`
`

const pitfalls = `# 常见坑（踩过的）

1. **别用中文词直接找词根**：词典是用英文广概念释义的（-ŢR- = WATER / SOURCE OF WATER）。
   先把中文概念抽象成英文（"爱" → love / affection / attachment 都试一遍）。
2. **一个英文词查不到是常态**：伊库伊尔靠「词根 + 词缀 + 配置」组合表达，词典条目可能只在某个 STEM 或某条词缀里出现。
3. **词根不是词**：-ŢK- 只是骨架，必须带词干元音（a/e/u/o）才是词形。
4. **CA 不能省**：省了就不合法；用 CA 表（第 3 章 §3.6）拼。
5. **Slot V 的反写**：-VXCS- 在 Slot V 写成 -CSVX-；同时 Slot VI 的 CA 要双写（§3.6.1）。
6. **重音承载语法**：改重音会改变 Slot IX 的含义（格 ↔ 格式/语力）。
7. **词典页码 p 是 PDF 页码**（570 页那本），可以回原文核对；词缀页码是 140 页那本。
8. **双栏还原偶有串行**：词根 raw 里出现 "｜" 是左右栏交界；读着不合逻辑就看原文页。
9. **例句的英文翻译是作者给的近似译法**，不是唯一解；以 gloss 为准。
10. **别把 "New Ithkuil" 和旧版 Ithkuil/Ilaksh 混用**：本插件只收 New Ithkuil（IV）的语料。
`

const phonology = `# 音系与重音（第 1 章）

- **31 个辅音**：p b · t d · k g · ' · f v · ţ · s z · š ž · ç · x · h · l · c ẓ · č j · m n ň · r · l · w y ř
- **9 个元音**：i ü u · e ö ë o · ä a（前/中/后 × 圆唇与否）
- **不是声调语言**，用**音高重音（pitch accent）**切分词界（§1.6 / §2.7）
- **罗马字只是次要转写**；官方书写系统见第 12 章（原生文字，非拉丁字母）
- 重音标记：无标记 = 倒数第二音节；非倒数第二时用附加符号（á / ô / ì 等）

音位配列（phonotaxis）另有专门 PDF；非法辅音簇的处理规则集中在第 1 章 §1.5 与附录。
`

export const QUICKREF = { overview, slots, terms, workflow, pitfalls, phonology }
