/**
 * lib/morph.mjs —— 形态学辅助：VX 元音表、词缀拼写、槽位说明、中文术语
 * ============================================================================
 * 只放"官方文档里能逐条对上"的表，不放我瞎猜的东西。
 * 出处：
 *   VX 元音表 …… 第 7 章 §7.1（degree × type 的 30 个元音形）
 *   槽位结构   …… 第 2 章 §2.3 / 第 3 章 §3.0
 *   格表       …… 第 4 章（见 data.mjs 的 cases()）
 * ============================================================================
 */

/** 第 7 章 §7.1：degree(0–9) × type(1/2/3) → VX 元音形（Type-3 有两个变体，按 CS 的辅音簇取其一） */
export const VX = {
  0: { 1: ['ae'], 2: ['ea'], 3: ['üo'] },
  1: { 1: ['a'], 2: ['ai'], 3: ['ia', 'uä'] },
  2: { 1: ['ä'], 2: ['au'], 3: ['ie', 'uë'] },
  3: { 1: ['e'], 2: ['ei'], 3: ['io', 'üä'] },
  4: { 1: ['i'], 2: ['eu'], 3: ['iö', 'üë'] },
  5: { 1: ['ëi'], 2: ['ëu'], 3: ['eë'] },
  6: { 1: ['ö'], 2: ['ou'], 3: ['uö', 'öë'] },
  7: { 1: ['o'], 2: ['oi'], 3: ['uo', 'öä'] },
  8: { 1: ['ü'], 2: ['iu'], 3: ['ue', 'ië'] },
  9: { 1: ['u'], 2: ['ui'], 3: ['ua', 'iä'] },
}

/** 拼一个 Slot VII 词缀的 VXCS 形（Slot V 要把 -VXCS- 反写成 -CSVX-） */
export function affixForm(cs, degree, type = 1) {
  const d = Number(degree)
  const t = Number(type)
  const row = VX[d]
  if (!row) throw new Error(`degree 必须是 0–9，收到 ${degree}`)
  const forms = row[t]
  if (!forms) throw new Error(`type 必须是 1/2/3，收到 ${type}`)
  const c = String(cs || '').replace(/^[-–—]+|[-–—]+$/g, '')
  if (!c) throw new Error('cs 不能为空（词缀的辅音形，例如 "sp" / "ňḑ"）')
  const out = forms.map((v) => v + c)
  return {
    cs: c, degree: d, type: t,
    slot7: out.map((x) => '-' + x + '-'),
    slot5: out.map((x) => '-' + c + x.slice(0, -c.length) + '-'),
    alternatives: out,
    note: t === 3
      ? 'Type-3 有两个变体，按 CS 开头能否直接接元音来挑（避免非法辅音簇）'
      : undefined,
  }
}

/** 十个槽位（依据第 2 章 §2.3 / 第 3 章 §3.0 的表） */
export const SLOTS = [
  { n: 'I', name: '拼接指示 CC', en: 'Concatenation status', note: '’/h/ hw… 表示独立词还是 1/2 型拼接，以及是否用 Slot II 的捷径' },
  { n: 'II', name: '词干 + 版本 VV', en: 'Stem + Version', note: '32 个元音形：词干 1/2/3/0 + processual / completive；也承载捷径信息' },
  { n: 'III', name: '词根 CR', en: 'Main Root', note: '1–5 个辅音，语义核心' },
  { n: 'IV', name: '功能 + 限定 + 语境 VR', en: 'Function + Specification + Context', note: 'stative/dynamic × 4 限定 × 4 语境 = 32 个元音形' },
  { n: 'V', name: '词缀 V（作用于词干）', en: 'CSVX affixes on stem', note: '形式要反过来写成 -CSVX-；有 CA 时 CA 要双写' },
  { n: 'VI', name: 'CA 综合体', en: 'Configuration + Affiliation + Extension + Perspective + Essence', note: '必需的辅音合成形（portmanteau），20 种配置等' },
  { n: 'VII', name: '词缀 VII（作用于词干+CA）', en: 'VXCS affixes on stem+CA', note: '标准 -VXCS- 形' },
  { n: 'VIII', name: '语气 / 体貌 VNCN', en: 'Mood/Case-Scope + Aspect/Phase/Level/Effect', note: '第 5 章' },
  { n: 'IX', name: '格 / 格式 / 语力 VC·VK', en: 'Case / Format / Illocution+Validation', note: '57 个格；由 Slot X 的重音决定用 VC 还是 VK' },
  { n: 'X', name: '重音', en: 'syllabic stress', note: '倒数第二重音 = 未框架 + VC；末音节重音 = 未框架 + VK；倒数第三 = 框架 + VC' },
]

/** 中文术语对照（翻译时统一用词，免得每次换说法） */
export const ZH_TERMS = {
  'root': '词根', 'stem': '词干', 'formative': '词形（formative）', 'adjunct': '附加词',
  'configuration': '配置', 'affiliation': '关联', 'perspective': '视角', 'extension': '延展',
  'essence': '本质', 'version': '版本', 'function': '功能', 'context': '语境',
  'specification': '限定', 'case': '格', 'valence': '价', 'aspect': '体', 'phase': '相',
  'level': '级', 'effect': '效应', 'mood': '语气', 'illocution': '语力', 'validation': '验证',
  'plexity': '聚散度（单/双/多）', 'separability': '可分性', 'similarity': '相似性',
  'stative': '状态（stative）', 'dynamic': '动态（dynamic）',
  'basic': '基本（BSC）', 'contential': '内容（CTE）', 'constitutive': '构成（CSV）', 'objective': '客体（OBJ）',
  'existential': '存在', 'functional': '功能', 'representational': '表征', 'amalgamative': '融合',
  'processual': '过程（PRC）', 'completive': '完成（CPL）',
  'uniplex': '单一体（UPX）', 'duplex': '二联体（DPX）', 'multiplex': '多体（MSS…）',
  'separate': '分离', 'connected': '连接', 'fused': '融合',
  'thematic': '主题格（THM）', 'instrumental': '工具格（INS）', 'absolutive': '绝对格（ABS）',
  'affective': '感受格（AFF）', 'stimulative': '刺激格（STM）', 'effectuative': '使成格（EFF）',
  'ergative': '施事格（ERG）', 'dative': '与格（DAT）', 'inducive': '自致格（IND）',
  'transrelative': '跨关系格', 'appositive': '同位格', ' associative': '伴随格',
  'vocative': '呼格', 'referential': '指称', 'concatenation': '拼接',
  'gloss': '标注（gloss）', 'affix': '词缀', 'slot': '槽位', 'word': '词',
  'writing system': '书写系统', 'romanization': '罗马字转写', 'phonology': '音系',
  'morpho-phonology': '形态音系', 'syntax': '句法', 'lexicon': '词典',
}

export function zhTerm(term) {
  const q = String(term || '').trim().toLowerCase()
  if (!q) return null
  if (ZH_TERMS[q]) return { term, zh: ZH_TERMS[q] }
  for (const [k, v] of Object.entries(ZH_TERMS)) {
    if (k.includes(q) || q.includes(k)) return { term: k, zh: v }
  }
  return null
}

/** 重音标注 → 判断 Slot IX 走哪条分支（第 6 章 §6.2.1 的说法） */
export function stressOf(word) {
  const w = String(word || '')
  const acute = (w.match(/[áéíóúä́ë́ḯö́ǘ]/g) || []).length
  const circum = (w.match(/[âêîôû]/g) || []).length
  const grave = (w.match(/[àèìòù]/g) || []).length
  return { marked: acute + circum + grave > 0, acute, circum, grave }
}
