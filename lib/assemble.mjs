/**
 * lib/assemble.mjs —— 词形拼装 + 音位配列体检
 * ============================================================================
 * 为什么要有它：光查词根/词缀只能翻"词"，翻不了"句"。句子里每个词形都是
 *   VV + CR + VR + [Slot V] + CA + [Slot VII] + [Slot VIII] + VC + [stress]
 * 再加上拼接（Slot I 的 CC）。这一步以前靠手算，容易错，所以做成函数。
 *
 * 数据来源（都能在 data/grammar.json 里逐条对上）：
 *   VV / VR / 36 个 Aspect  …… 第 3 章 §3.7–3.9、第 5 章 §5.6
 *   CA 综合体与替换规则        …… 第 3 章 §3.6
 *   68 个格的 VC 元音          …… 第 4 章（运行时从 data.mjs cases() 取）
 *   音位配列                   …… 官方《PHONOTACTIC RULES v1.0》§1–§7（只做能自动判定的部分）
 *
 * ⚠️ 音位配列只覆盖"能被规则直接判定"的部分（禁用辅音串、叠辅音、喉塞音位置、
 *    词首/词尾簇的基本结构），**不能**替代人眼复核；返回结果里会列出 "review" 项。
 * ============================================================================
 */
import { cases } from './data.mjs'

/* ─────────────── 表 ─────────────── */

/** Slot II：词干 × 版本（§2.4.3 / §3.10 表） */
export const VV = {
  1: { PRC: 'a', CPT: 'ä' },
  2: { PRC: 'e', CPT: 'i' },
  3: { PRC: 'u', CPT: 'ü' },
  0: { PRC: 'o', CPT: 'ö' },
}

/** Slot IV：功能 × 限定 × 语境（§3.9 表；列序 EXS/FNC/RPS/AMG） */
export const VR = {
  STA: {
    BSC: ['a', 'ai', 'ia|uä', 'ao'],
    CTE: ['ä', 'au', 'ie|uë', 'aö'],
    CSV: ['e', 'ei', 'io|üä', 'eo'],
    OBJ: ['i', 'eu', 'iö|üë', 'eö'],
  },
  DYN: {
    BSC: ['u', 'ui', 'ua|iä', 'oa'],
    CTE: ['ü', 'iu', 'ue|ië', 'öa'],
    CSV: ['o', 'oi', 'uo|öä', 'oe'],
    OBJ: ['ö', 'ou', 'uö|öë', 'öe'],
  },
}
const CTX_IDX = { EXS: 0, FNC: 1, RPS: 2, AMG: 3 }

/** Slot VIII：36 个 Aspect 的 VN（§5.6 表），后面统一接 CN = -w- */
export const ASPECT_VN = {
  RTR: 'a', PRS: 'ä', HAB: 'e', PRG: 'i', IMM: 'ëi', PCS: 'ö', REG: 'o', SMM: 'ü',
  RSM: 'ai', CSS: 'au', PAU: 'ei', RGR: 'eu', PCL: 'ëu', CNT: 'ou', ICS: 'oi', EXP: 'iu',
  PMP: 'ia|uä', CLM: 'ie|uë', DLT: 'io|üä', TMP: 'iö|üë', XPD: 'eë', LIM: 'uö|öë',
  EPD: 'uo|öä', PTC: 'ue|ië', DCL: 'ao', CCL: 'aö', CUL: 'eo', IMD: 'eö',
  TRD: 'oë', TNS: 'öe', ITC: 'oe', MTV: 'öa', SQN: 'oa',
}

/** Slot VI：CA 综合体（§3.6 + §3.1） */
export const CA_TABLE = {
  AFFIL: { CSL: '', ASO: 'l', COA: 'r', VAR: 'ř' },
  CONFIG: {
    UPX: '', DPX: 's', MSS: 't', DSS: 'c', MSC: 'k', DSC: 'ks',
    MSF: 'p', DSF: 'ps', MDS: 'ţ', DDS: 'ţs', MDC: 'f', DDC: 'fs',
    MDF: 'ç', DDF: 'š', MFS: 'z', DFS: 'č', MFC: 'ž', DFC: 'kš',
    MFF: 'ẓ', DFF: 'pš',
  },
  EXT: { DEL: '', PRX: 't', ICP: 'k', ATV: 'p', GRA: 'g', DPL: 'b' },
  /** 配置为 UPX 时用另一套（§3.6 脚注 1） */
  EXT_UPX: { DEL: '', PRX: 'd', ICP: 'g', ATV: 'b', GRA: 'gz', DPL: 'bz' },
  /** 视角 + 本质（§3.6 表；M/NRM 为默认零形，全默认时整个 CA 取 -l-） */
  PE: {
    'M/NRM': '', 'M/RPV': 'l', 'G/NRM': 'r', 'G/RPV': 'ř',
    'N/NRM': 'w', 'N/RPV': 'm', 'A/NRM': 'y', 'A/RPV': 'n',
  },
}

/** §3.6 的 19 条同形替换（按顺序应用） */
const ALLOMORPH = [
  ['pp', 'mp'], ['pb', 'mb'], ['rr', 'ns'], ['tt', 'nt'], ['kg', 'ng'],
  ['rř', 'nš'], ['kk', 'nk'], ['çy', 'nd'], ['řr', 'ňs'], ['ngn', 'ňn'],
  ['ll', 'pļ'], ['řř', 'ňš'], ['fbm', 'vw'], ['ţbn', 'ḑy'],
]
const ALLOMORPH_C = [
  ['gm', 'x'], ['bm', 'v'], ['gn', 'ň'], ['bn', 'ḑ'], ['çx', 'xw'],
]

/** 拼 CA 综合体 */
export function caComplex({ affil = 'CSL', config = 'UPX', ext = 'DEL', persp = 'M', ess = 'NRM' } = {}) {
  const upx = config === 'UPX'
  const parts = [
    CA_TABLE.AFFIL[affil] ?? '',
    CA_TABLE.CONFIG[config] ?? '',
    (upx ? CA_TABLE.EXT_UPX : CA_TABLE.EXT)[ext] ?? '',
    CA_TABLE.PE[`${persp}/${ess}`] ?? '',
  ]
  let out = parts.join('')
  if (!out) out = 'l'                     // 全默认 = -l-（§3.6 原文）
  for (const [from, to] of ALLOMORPH) out = out.split(from).join(to)
  // [C]gm → [C]x 这类要看前一个字符是不是辅音
  for (const [from, to] of ALLOMORPH_C) {
    out = out.replace(new RegExp(`(\\p{L})${from}`, 'gu'), `$1${to}`)
  }
  return out
}

/* ─────────────── 格 ─────────────── */

const CASE_CACHE = new Map()
/** 由缩写取 VC 元音形（去掉 / 加回喉塞音由调用方决定） */
export function caseForm(abbr) {
  if (!CASE_CACHE.size) {
    for (const c of cases()) CASE_CACHE.set(c.abbr, c.vc)
  }
  const v = CASE_CACHE.get(String(abbr).toUpperCase())
  if (!v) throw new Error(`没有这个格：${abbr}`)
  return v
}

/* ─────────────── 重音 ─────────────── */

const ACUTE = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú', ä: 'ǟ', ö: 'ȫ', ü: 'ǘ', ë: 'ë\u0301', 'ëi': 'ḛ' }
const VOWELS = 'aeiouäöüë'

/** 在倒数第 n 个元音上放重音（默认 2 = 倒数第二，即"未框架 + VC"） */
export function stress(word, n = 2) {
  const idx = []
  for (let i = 0; i < word.length; i++) {
    if (VOWELS.includes(word[i].toLowerCase())) {
      if (i > 0 && VOWELS.includes(word[i - 1].toLowerCase())) continue // 双元音只算一个核
      idx.push(i)
    }
  }
  if (idx.length < n) return word
  const at = idx[idx.length - n]
  const ch = word[at]
  const mark = ACUTE[ch] || ACUTE[ch.toLowerCase()] || ch
  return word.slice(0, at) + mark + word.slice(at + 1)
}

/* ─────────────── 拼装 ─────────────── */

/**
 * 拼一个词形。
 * @param {object} spec
 *   root     词根辅音（不含连字符）
 *   stem     1|2|3|0
 *   version  PRC|CPT
 *   fn       STA|DYN
 *   spec     BSC|CTE|CSV|OBJ
 *   ctx      EXS|FNC|RPS|AMG
 *   ca       {affil,config,ext,persp,ess} 或直接给字符串
 *   affixes  [{cs, degree, type}]   —— 放 Slot VII（标准 -VXCS-）
 *   aspect   36 个 Aspect 缩写（可选，放 Slot VIII）
 *   caseAbbr Slot IX 的格（默认 THM）
 *   concat   'T1' | 'T2'（拼接：Slot I 加 h / hw）
 *   stressAt 倒数第几个元音重音（默认 2）
 */
const VOWEL_SET = new Set(['a', 'e', 'i', 'o', 'u', 'ä', 'ö', 'ü', 'ë'])

/** 把带喉塞音的格形（如 ia'）按 §2.2 实现出来：ia' → i'a，a' → a'a */
export function realizeCase(vcRaw) {
  const raw = String(vcRaw)
  if (!raw.endsWith("'")) return raw
  const base = raw.slice(0, -1)
  const vs = [...base].filter((c) => VOWEL_SET.has(c))
  if (vs.length >= 2) {
    const last = vs[vs.length - 1]
    const at = base.lastIndexOf(last)
    return base.slice(0, at) + "'" + base.slice(at)
  }
  return base + "'" + base           // 单音节格形：补一个元音（§2.2 规则 3）
}

export function buildFormative({
  root, stem = 1, version = 'PRC', fn = 'STA', spec = 'BSC', ctx = 'EXS',
  ca = null, affixes = [], aspect = null, caseAbbr = 'THM', concat = null, stressAt = 2,
} = {}) {
  const r = String(root || '').replace(/^[-–—]+|[-–—]+$/g, '').toLowerCase()
  if (!r) throw new Error('root 不能为空')
  const vv = VV[stem]?.[version]
  if (vv === undefined) throw new Error(`词干/版本不合法：${stem}/${version}`)
  const vrRow = VR[fn]?.[spec]
  if (!vrRow) throw new Error(`功能/限定不合法：${fn}/${spec}`)
  let vr = vrRow[CTX_IDX[ctx]]
  if (!vr) throw new Error(`语境不合法：${ctx}`)
  const vrAlt = vr.includes('|') ? vr.split('|') : null
  vr = vrAlt ? vrAlt[0] : vr

  const caStr = typeof ca === 'string' ? ca : caComplex(ca || {})
  const affixStr = affixes.map((a) => affixVXCS(a)).join('')
  const aspStr = aspect ? (ASPECT_VN[aspect] || '').split('|')[0] + 'w' : ''
  const cc = concat === 'T2' ? 'hw' : concat === 'T1' ? 'h' : ''

  // Slot IX：拼接词形按 §10.1 用「去掉喉塞音 + 末音节重音」表示 37–68 号格
  const rawCase = caseForm(caseAbbr)
  let vc, st = stressAt
  if (concat && rawCase.endsWith("'")) {
    vc = rawCase.slice(0, -1)
    st = 1
  } else {
    vc = realizeCase(rawCase)
  }

  const bare = `${cc}${vv}${r}${vr}${caStr}${affixStr}${aspStr}${vc}`
  const form = stress(bare, st)
  return {
    form, bare,
    gloss: `'${r}'-${stem}/${version}-${fn}/${spec}/${ctx}${aspect ? '-' + aspect : ''}-${caseAbbr}`,
    components: { cc, vv, root: r, vr, ca: caStr, affixes: affixStr, aspect: aspStr, case: vc },
    warnings: checkWord(form).issues,
    review: checkWord(form).review,
  }
}

/** 由 cs + 度 + 类型拼 -VXCS- 片段（Slot VII） */
export function affixVXCS({ cs, degree, type = 1 }) {
  const VX = {
    0: { 1: ['ae'], 2: ['ea'], 3: ['üo'] }, 1: { 1: ['a'], 2: ['ai'], 3: ['ia', 'uä'] },
    2: { 1: ['ä'], 2: ['au'], 3: ['ie', 'uë'] }, 3: { 1: ['e'], 2: ['ei'], 3: ['io', 'üä'] },
    4: { 1: ['i'], 2: ['eu'], 3: ['iö', 'üë'] }, 5: { 1: ['ëi'], 2: ['ëu'], 3: ['eë'] },
    6: { 1: ['ö'], 2: ['ou'], 3: ['uö', 'öë'] }, 7: { 1: ['o'], 2: ['oi'], 3: ['uo', 'öä'] },
    8: { 1: ['ü'], 2: ['iu'], 3: ['ue', 'ië'] }, 9: { 1: ['u'], 2: ['ui'], 3: ['ua', 'iä'] },
  }
  const v = VX[Number(degree)]?.[Number(type)]
  if (!v) throw new Error(`度/类型不合法：${degree}/${type}`)
  return v[0] + String(cs).replace(/^[-–—]+|[-–—]+$/g, '')
}

/* ─────────────── 音位配列体检 ─────────────── */

const CONS = 'pbtdkgfvţḑszšžçxhļcżčjmnňrlřwy’'
const PROHIBITED = [
  ['ḑ', 's'], ['ḑ', 'š'], ['ḑ', 'z'], ['ḑ', 'ž'], ['n', 'ň'],
]
const clamp = (s) => s

/** 能自动判定的部分；判不了的回 review 列表 */
export function checkWord(word) {
  const w = clamp(String(word || '').toLowerCase())
  const issues = []
  const review = []

  // §2.1 喉塞音不能跟在辅音后
  if (/[^aeiouäöüë’\s]’/.test(w)) issues.push('喉塞音前面是辅音（§2.1 禁止）')

  // §2.2 齿塞音 t/d 后面不能接咝音
  if (/[td][szšžcżčjç]/.test(w)) issues.push('t/d 后接咝音（§2.2 禁止）')

  // §2.21 ř 后不能接 r
  if (/řr/.test(w)) issues.push('ř 后接 r（§2.21 禁止）')

  // §2.23 禁用串
  for (const [a, b] of PROHIBITED) {
    if (w.includes(a + b)) issues.push(`禁用辅音串 ${a}${b}（§2.23）`)
  }
  if (w.includes('çç')) issues.push('çç 禁止（§2.24）')
  if (w.includes('ļļ')) issues.push('ļļ 禁止（§2.24）')

  // §1.7 三个相同辅音连写
  if (/([^aeiouäöüë])\1\1/.test(w)) issues.push('同一辅音三连（§1.7 禁止）')

  // §1.5 喉塞音不能在词尾（除单音节解析附加词）
  if (/’$/.test(w)) issues.push('喉塞音在词尾（§1.5 禁止）')

  // §1.2 词首元音：所有词形都以 VV 开头，前面那个未写出的喉塞音就是合规的，不算错
  if (/^[aeiouäöüë]/.test(w)) review.push('词首元音 = 未写出的喉塞音（§1.2，合法）')

  // §1.3 双元音不能紧跟元音/双元音
  const diph = ['ai', 'au', 'ei', 'eu', 'ëi', 'ëu', 'ou', 'oi', 'iu', 'ui', 'ia', 'ie', 'io', 'iö', 'ua', 'ue', 'uo', 'uö', 'ao', 'aö', 'eo', 'eö', 'uä', 'uë', 'üä', 'üë', 'eë', 'öë', 'öä', 'ië', 'iä', 'öe', 'oe', 'oa', 'öa']
  if (/[aeiouäöüë]\s?[aeiouäöüë]/.test(w)) {
    // 允许"元音 + 元音"是标准元音序列的一部分；这里只提示人工看
    review.push('有多处相邻元音，请确认它们属于标准元音序列、不是意外相邻（§1.3/§1.4）')
  }

  // 辅音簇：只做长度申报
  const clusters = w.match(/[pbtdkgfvţḑszšžçxhļcżčjmnňrlřwy’]{2,}/g) || []
  for (const c of clusters) {
    if (c.length >= 3) review.push(`三辅音以上的簇 ${c}：请对照音位配列 §3（词首）/§4（词尾）/§5（词中）的人工表`)
    if (c.length > 4) issues.push(`辅音簇超过 4 个（${c}）`)
  }

  return { issues: [...new Set(issues)], review: [...new Set(review)] }
}
