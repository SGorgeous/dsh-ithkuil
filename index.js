/**
 * dsh-ithkuil —— host 半端
 * ============================================================================
 * 干什么：把官方《A Grammar of New Ithkuil》(Ithkuil IV, ithkuil.net) 的全部语料
 *         做成一组**离线**工具，让 DSH 里的我（以及使用者）能真正"查着翻"而不是瞎编：
 *
 *   ithkuil_root      查词根（英文概念 → -ŢK- 这样的词根形）
 *   ithkuil_entry     看某个词根的独立释义 / STEM 1·2·3 详解原文
 *   ithkuil_affix     查 VXCS 词缀（按缩写 / 辅音形 / 英文关键词 / 主题）
 *   ithkuil_affix_form 由 辅音形 + 度 + 类型 拼出 -VXCS- 形（含 Slot V 的反写形）
 *   ithkuil_case      查格（57 个格 → VC 元音 + 语义角色）
 *   ithkuil_grammar   13 章 + 附录的全文检索（BM25，带 § 号与章节定位）
 *   ithkuil_section   读某一小节全文（比如 "3.6.1"）
 *   ithkuil_examples  带 interlinear 标注的例句（最可靠的学习材料）
 *   ithkuil_quickref  中文速查：槽位 / 术语 / 翻译流程
 *   ithkuil_zh        语法术语 → 中文（统一译名）
 *
 * 数据来自仓库里的 data/*.json，由 tools/*.py 从官方 PDF/HTML 生成（见 README）。
 * 零网络依赖，不调用任何外部 API。
 * ============================================================================
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { stats, searchRoots, getRoot, searchAffixes, searchCases, cases, searchGrammar, section, examples } from './lib/data.mjs'
import { affixForm, SLOTS, ZH_TERMS, zhTerm, stressOf } from './lib/morph.mjs'
import { QUICKREF } from './lib/quickref.mjs'
import { buildFormative, caComplex, checkWord } from './lib/assemble.mjs'
import { loadDefineTool, assertToolSchema, localDefineTool } from './lib/toolkit.mjs'

export const name = 'ithkuil'
export const inject = ['tools']

const pluginDir = dirname(fileURLToPath(import.meta.url))
const pkg = (() => {
  try { return JSON.parse(readFileSync(join(pluginDir, 'package.json'), 'utf8')) } catch { return { version: '0.0.0' } }
})()

const clip = (s, n) => {
  const t = String(s ?? '').replace(/\r/g, '')
  return t.length > n ? t.slice(0, n) + '…' : t
}

const md = (lines) => lines.filter((x) => x !== undefined && x !== null).join('\n')

/** 宿主那份 defineTool（拿不到就用本地等价实现）—— 模块顶层解析，apply 因此保持同步 */
const defineTool = await loadDefineTool((m) => console.log(`[ithkuil] ${m}`)).catch((e) => {
  console.error(`[ithkuil] 解析 defineTool 失败，退回本地实现：${e?.message ?? e}`)
  return localDefineTool
})

export function apply(ctx) {
  /**
   * ⚠️ 这里必须走 defineTool（宿主的"参数表→JSON Schema"编译步骤），否则参数表会以
   *    `{type:null}` 送到模型那儿，每一条请求都被 OpenAI 兼容层拒掉
   *    （2026-10-22 踩过：Invalid schema for function 'ithkuil_affix'，整个 DSH 起不来）。
   *    defineTool 在模块顶层就异步解析好了（见文件上方），拿不到宿主那份就用本地等价实现，
   *    并且**注册前逐个自检**：坏的那条只跳过它自己，绝不拖垮宿主。
   */
  const tool = (spec) => {
    const def = defineTool({
      name: spec.name,
      description: spec.description,
      parameters: spec.parameters,
      output: {
        schema: { type: 'object', properties: {}, additionalProperties: true },
        render: (_args, value) => [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
      },
      async execute(args) {
        try {
          return await spec.execute(args || {})
        } catch (e) {
          return `⚠️ ${spec.name} 出错：${e?.message ?? e}`
        }
      },
    })
    assertToolSchema(def)
    return ctx.tools.register(def)
  }

  /* ─────────── 词根 ─────────── */

  tool({
    name: 'ithkuil_root',
    description: '查伊库伊尔词根：英文概念 → 词根形。'
      + '返回 -ABC- 词根、它的核心释义、页数（官方 Lexicon PDF 的页码）。'
      + '也接受词根本身（-ŢK- / ŢK）。'
      + '⚠️ 伊库伊尔词根是**宽概念**（如 -ŢR- = WATER/SOURCE OF WATER），一个英文词可能查不到，'
      + '要换同义词多试几次；查到的词根再用 ithkuil_entry 看 STEM 1/2/3 细分。',
    parameters: {
      query: { type: 'string', description: '英文概念（water / to make / government），或词根（-ŢK- / ŢK）' },
      limit: { type: 'number', description: '返回几条（默认 10）' },
    },
    async execute({ query, limit }) {
      const n = Math.max(1, Math.min(Number(limit) || 10, 40))
      const hits = searchRoots(String(query || ''), n)
      if (!hits.length) {
        return md([
          `没查到「${query}」。`,
          '换个说法再试：伊库伊尔词根是宽概念，试试同义词 / 更抽象的说法（如 dark → BLACK / DIM / OBSCURED）。',
          '也可以直接按词根查：ithkuil_root query="-ŢK-"',
        ])
      }
      return md([
        `「${query}」→ ${hits.length} 个候选（Lexicon PDF 页码可用来核对原文）：`,
        '',
        ...hits.map((r, i) => {
          const sens = r.senses?.length ? `\n   细分：${r.senses.map((s, k) => `${k + 1}) ${clip(s, 70)}`).join('  ')}` : ''
          return `${i + 1}. -${r.r}-  ${clip(r.gloss, 120)}   (p${r.page}, ${r.style})${sens}`
        }),
        '',
        '→ 看某个词根的 STEM 详解：ithkuil_entry root="ŢK"',
      ])
    },
  })

  tool({
    name: 'ithkuil_entry',
    description: '看一个词根的完整条目：核心释义、编号义项、以及官方词典里 STEM 1/2/3 的原文说明。'
      + '原文是双栏排版的还原，行里出现 "｜" 表示左右栏交界（左栏通常是 STEM 1 的 CTE/CSV/OBJ，右栏是 STEM 2/3）。',
    parameters: {
      root: { type: 'string', description: '词根，-ŢK- / ŢK 都行' },
      maxChars: { type: 'number', description: '原文最多返回多少字（默认 1800）' },
    },
    async execute({ root, maxChars }) {
      const r = getRoot(String(root || ''))
      if (!r) {
        const near = searchRoots(String(root || '').replace(/[-–—]/g, ''), 5)
        return md([
          `没有词根 -${String(root).replace(/[-–—]/g, '')}-。`,
          near.length ? `相近的：${near.map((x) => `-${x.r}-`).join(' ')}` : '',
          '可能是词缀而不是词根？试试 ithkuil_affix。',
        ])
      }
      const cap = Math.max(200, Math.min(Number(maxChars) || 1800, 8000))
      return md([
        `## -${r.r}-  ${r.gloss}`,
        `官方 Lexicon PDF 第 ${r.page} 页 · 条目类型 ${r.style}`,
        r.senses?.length ? `编号义项：\n${r.senses.map((s, i) => `  ${i + 1}. ${clip(s, 200)}`).join('\n')}` : '',
        r.raw ? `\n原文（STEM 明细）：\n${clip(r.raw, cap)}` : '',
        '',
        '标注约定：BSC 基本 / CTE 内容 / CSV 构成 / OBJ 客体；｜ = 左右栏交界。',
      ])
    },
  })

  /* ─────────── 词缀 ─────────── */

  tool({
    name: 'ithkuil_affix',
    description: '查 VXCS 词缀（422 个）：按三字母缩写（如 FAM）、辅音形（如 rļ）、英文关键词（如 "familiarity"）或主题查。'
      + '返回 9 个度的释义（度 0 = 该词缀的整体概念）。',
    parameters: {
      query: { type: 'string', description: '缩写 / 辅音形 / 英文关键词 / 主题' },
      limit: { type: 'number', description: '返回几条（默认 6）' },
    },
    async execute({ query, limit }) {
      const n = Math.max(1, Math.min(Number(limit) || 6, 20))
      const hits = searchAffixes(String(query || ''), n)
      if (!hits.length) return `没查到词缀「${query}」。试试三字母缩写（FAM / DCD / SPT）或主题（temporal / sensory）。`
      return md(hits.map((a, i) => md([
        `${i + 1}. -${a.cs}  ${a.abbr}  ${a.name}   [${a.topic}, p${a.page}]`,
        ...a.degrees.map((d, k) => `   ${k + 1}/9 ${clip(d, 150)}`),
      ])))
    },
  })

  tool({
    name: 'ithkuil_affix_form',
    description: '把「辅音形 + 度 + 类型」拼成词缀形。第 7 章 §7.1 的 VX 元音表：type 1/2/3 各 10 个度。'
      + '返回 Slot VII 标准形 -VXCS- 与 Slot V 反写形 -CSVX-（后者仅在无 CA 时才用标准形）。',
    parameters: {
      cs: { type: 'string', description: '词缀辅音形，如 sp / ňḑ / rļ' },
      degree: { type: 'number', description: '度 0–9' },
      type: { type: 'number', description: '类型 1/2/3（1 情境、2 派生、3 修饰相邻词缀），默认 1' },
    },
    async execute({ cs, degree, type }) {
      const r = affixForm(cs, degree, type ?? 1)
      return md([
        `-${r.cs}- 度 ${r.degree} 类型 ${r.type}`,
        `Slot VII（标准）：${r.slot7.join(' 或 ')}`,
        `Slot V（反写）  ：${r.slot5.join(' 或 ')}`,
        r.note ? `注：${r.note}` : '',
        '',
        '用法提醒：Slot V 词缀作用于「词干」，Slot VII 作用于「词干 + CA」；有 Slot VI CA 时，Slot V 用反写形且 CA 要双写。',
      ])
    },
  })

  /* ─────────── 格 ─────────── */

  tool({
    name: 'ithkuil_case',
    description: '查格：57 个格（第 4 章）。给缩写（THM / ERG / ABL）、英文名（ablative）或中文概念，'
      + '返回 VC 元音形与语义角色说明。',
    parameters: {
      query: { type: 'string', description: '缩写 / 英文名 / 关键词' },
      limit: { type: 'number', description: '返回几条（默认 5）' },
    },
    async execute({ query, limit }) {
      const n = Math.max(1, Math.min(Number(limit) || 5, 20))
      const hits = searchCases(String(query || '')).slice(0, n)
      if (!hits.length) {
        const all = cases().slice(0, 12).map((c) => `${c.abbr}(${c.vc})`)
        return `没查到格「${query}」。前几个格：${all.join(' ')} —— 全部格见 ithkuil_section num="4.2"`
      }
      return md(hits.map((c) => md([
        `### ${c.abbr} ${c.name}    VC = -${c.vc || '?'}-   (§${c.section})`,
        clip(c.text.split('\n').slice(1).join(' ').replace(/\s+/g, ' '), 500),
      ])))
    },
  })

  /* ─────────── 语法全文 ─────────── */

  tool({
    name: 'ithkuil_grammar',
    description: '在官方语法（13 章 + 附录，328 小节、约 52 万字）里做全文检索。'
      + '返回小节号、标题、命中片段。**翻译时不确定的规则先来这里查原文**，不要凭印象。',
    parameters: {
      query: { type: 'string', description: '英文检索词（如 "configuration affix" / "stem 2" / "case scope"）' },
      limit: { type: 'number', description: '返回几条（默认 5）' },
    },
    async execute({ query, limit }) {
      const n = Math.max(1, Math.min(Number(limit) || 5, 15))
      const hits = searchGrammar(String(query || ''), n)
      if (!hits.length) return `没命中「${query}」。换个英文说法（官方文档是英文的）。`
      return md(hits.map((s, i) => md([
        `### ${i + 1}. §${s.num} ${s.title}   [第 ${s.ch} 章 ${s.chName}]   score ${s.score}`,
        s.excerpt,
      ])))
    },
  })

  tool({
    name: 'ithkuil_section',
    description: '按小节号读官方语法原文（如 "3.6.1" / "4.2" / "7.1"）。用于把某条规则完整读一遍。',
    parameters: {
      num: { type: 'string', description: '小节号，如 3.6.1' },
      maxChars: { type: 'number', description: '最多返回多少字（默认 4000）' },
    },
    async execute({ num, maxChars }) {
      const s = section(String(num || ''))
      if (!s) {
        const list = searchGrammar(String(num || ''), 3)
        return md([
          `没有 §${num}。`,
          ...list.map((x) => `也许你要找 §${x.num} ${x.title}`),
        ])
      }
      const cap = Math.max(300, Math.min(Number(maxChars) || 4000, 20000))
      return md([
        `## §${s.num} ${s.title}`,
        `（第 ${s.ch} 章 ${s.chName}）`,
        '',
        clip(s.text, cap),
      ])
    },
  })

  /* ─────────── 例句 ─────────── */

  tool({
    name: 'ithkuil_examples',
    description: '找带 interlinear 标注的例句（伊库伊尔词 + 逐词标注 + 英文翻译）。'
      + '这是学语法最可靠的材料：想看某个格/词缀怎么用，就在例句里搜它。',
    parameters: {
      query: { type: 'string', description: '检索词（ABL / DYN / -VXCS- / 英文关键词）' },
      limit: { type: 'number', description: '返回几条（默认 6）' },
    },
    async execute({ query, limit }) {
      const n = Math.max(1, Math.min(Number(limit) || 6, 25))
      const hits = examples(String(query || ''), n)
      if (!hits.length) return `没找到含「${query}」的例句。`
      return md(hits.map((e, i) => `${i + 1}. §${e.num} ${e.title}\n   ${clip(e.line, 320)}`))
    },
  })

  /* ─────────── 拼装 / 体检 ─────────── */

  tool({
    name: 'ithkuil_ca',
    description: '拼 CA 综合体（Slot VI）：配置 + 关联 + 延展 + 视角 + 本质 → 那个辅音合成形。'
      + '默认全取时得到 -l-（第 3 章 §3.6 原文说的最常见形式）。',
    parameters: {
      config: { type: 'string', description: '配置：UPX/DPX/MSS/DSS/MSC/DSC/MSF/…/DFF（默认 UPX）' },
      affil: { type: 'string', description: '关联：CSL/ASO/COA/VAR（默认 CSL）' },
      ext: { type: 'string', description: '延展：DEL/PRX/ICP/ATV/GRA/DPL（默认 DEL）' },
      persp: { type: 'string', description: '视角：M/G/N/A（默认 M）' },
      ess: { type: 'string', description: '本质：NRM/RPV（默认 NRM）' },
    },
    async execute({ config, affil, ext, persp, ess }) {
      const ca = caComplex({ config, affil, ext, persp, ess })
      return md([
        `CA = -${ca}-`,
        `（${config || 'UPX'} 配置 · ${affil || 'CSL'} 关联 · ${ext || 'DEL'} 延展 · ${persp || 'M'} 视角 · ${ess || 'NRM'} 本质）`,
        '',
        '拼进词形时放在 Slot VI（VR 之后、Slot VII 词缀之前）；Slot V 有词缀时它要双写。',
      ])
    },
  })

  tool({
    name: 'ithkuil_build',
    description: '按十个槽位拼一个伊库伊尔词形，并做音位配列体检。'
      + '给词根 + 词干/版本 + 功能/限定/语境 + 可选 CA / 词缀 / 体 / 格 / 拼接类型，'
      + '返回表面形式（含重音）、gloss、各槽位分解、以及**能自动判定**的音位问题。'
      + '⚠️ 三辅音以上的簇要人工对照音位配列表；本工具只做能规则化的检查。',
    parameters: {
      root: { type: 'string', description: '词根辅音，如 čph / lvž / ksm' },
      stem: { type: 'number', description: '词干 0/1/2/3（默认 1）' },
      version: { type: 'string', description: 'PRC 过程 / CPT 完成（默认 PRC）' },
      fn: { type: 'string', description: 'STA 状态 / DYN 动态（默认 STA）' },
      spec: { type: 'string', description: 'BSC/CTE/CSV/OBJ（默认 BSC）' },
      ctx: { type: 'string', description: 'EXS/FNC/RPS/AMG（默认 EXS）' },
      ca: { type: 'string', description: '直接指定 CA 辅音形（如 l / k），或用 config/affil/ext/persp/ess' },
      config: { type: 'string', description: '配置缩写（UPX/DPX/MSS/MSC/…）' },
      affil: { type: 'string', description: '关联缩写（CSL/ASO/COA/VAR）' },
      ext: { type: 'string', description: '延展缩写（DEL/PRX/ICP/ATV/GRA/DPL）' },
      persp: { type: 'string', description: '视角（M/G/N/A）' },
      ess: { type: 'string', description: '本质（NRM/RPV）' },
      affixes: { type: 'string', description: 'Slot VII 词缀，逗号分隔，写成 "cs/度" 如 "gm/7,mţ/8"' },
      aspect: { type: 'string', description: 'Aspect 缩写（PRG 进行 / RTR 回顾 / CNT 继续 …）' },
      caseAbbr: { type: 'string', description: 'Slot IX 的格缩写（默认 THM）' },
      concat: { type: 'string', description: '拼接：T1 情境型 / T2 派生型（默认不拼接）' },
    },
    async execute(a) {
      const affixes = String(a.affixes || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
          const [cs, degree, type] = s.split('/')
          return { cs, degree: Number(degree || 1), type: Number(type || 1) }
        })
      const ca = a.ca
        ? String(a.ca)
        : (a.config || a.affil || a.ext || a.persp || a.ess)
          ? caComplex({ config: a.config, affil: a.affil, ext: a.ext, persp: a.persp, ess: a.ess })
          : null
      const r = buildFormative({
        root: a.root, stem: Number(a.stem ?? 1), version: a.version, fn: a.fn, spec: a.spec,
        ctx: a.ctx, ca, affixes, aspect: a.aspect, caseAbbr: a.caseAbbr, concat: a.concat,
      })
      return md([
        `## ${r.form}`,
        `gloss：${r.gloss}`,
        '',
        `分解：${Object.entries(r.components).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join('  ')}`,
        r.warnings.length ? `\n❌ 音位问题：\n- ${r.warnings.join('\n- ')}` : '',
        r.review.length ? `\n⚠️ 需人工复核：\n- ${r.review.join('\n- ')}` : '',
        '\n（重音默认倒数第二 = 未框架 + VC；拼接词形的 37–68 号格改走"去喉塞音 + 末音节重音"）',
      ])
    },
  })

  tool({
    name: 'ithkuil_check',
    description: '给一个词形做音位配列体检（官方 PHONOTACTIC RULES v1.0 里能自动判定的部分）：'
      + '禁用辅音串、叠辅音、喉塞音位置、词首词尾簇结构。',
    parameters: {
      word: { type: 'string', description: '要检查的词（罗马字转写，可带重音符）' },
    },
    async execute({ word }) {
      const w = String(word || '').trim()
      if (!w) return '给个词吧。'
      const { issues, review } = checkWord(w)
      const clusters = w.match(/[pbtdkgfvţḑszšžçxhļcżčjmnňrlřwy’]{2,}/g) || []
      return md([
        `## ${w}`,
        `辅音簇：${clusters.length ? clusters.join(' · ') : '无'}`,
        issues.length ? `❌ 明确违规：\n- ${issues.join('\n- ')}` : '✅ 没有命中任何"明确禁止"的规则',
        review.length ? `⚠️ 需人工复核：\n- ${review.join('\n- ')}` : '',
      ])
    },
  })

  /* ─────────── 速查 / 术语 / 概况 ─────────── */

  tool({
    name: 'ithkuil_quickref',
    description: '中文速查表：十个槽位的结构、术语中文对照、Ithkuil→中文 / 中文→Ithkuil 的翻译流程、常见坑。'
      + 'topic 可传 slots / terms / workflow / pitfalls / overview，不传返回目录概览。',
    parameters: {
      topic: { type: 'string', description: 'slots / terms / workflow / pitfalls / overview' },
    },
    async execute({ topic }) {
      const t = String(topic || 'overview').toLowerCase()
      if (QUICKREF[t]) return QUICKREF[t]
      return QUICKREF.overview
    },
  })

  tool({
    name: 'ithkuil_zh',
    description: '语法术语 → 中文统一译名（配置/关联/视角/延展/本质/版本/功能/语境/格/价/体/相/级/效应/语气/语力/验证…）。',
    parameters: {
      term: { type: 'string', description: '英文术语（configuration / stative / THM …）' },
    },
    async execute({ term }) {
      const r = zhTerm(String(term || ''))
      if (!r) return `没收录「${term}」。已收录：${Object.keys(ZH_TERMS).join(', ')}`
      return `${r.term} → ${r.zh}`
    },
  })

  tool({
    name: 'ithkuil_stats',
    description: '看这份离线语料的规模与来源（词根 / 词缀 / 小节 / 格 / 例句数）。',
    parameters: {},
    async execute() {
      const s = stats()
      return md([
        `dsh-ithkuil v${pkg.version}`,
        `词根 ${s.roots} 个 · VXCS 词缀 ${s.affixes} 个 · 语法小节 ${s.sections} 个 · 格 ${s.cases} 个 · 全文 ${(s.chars / 1e4).toFixed(1)} 万字`,
        '来源：ithkuil.net —— 《A Grammar of New Ithkuil》13 章 + 附录、LEXICON v1.0（570 页）、VXCS AFFIXES（140 页）',
      ])
    },
  })
}
