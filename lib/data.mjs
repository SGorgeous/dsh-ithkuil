/**
 * lib/data.mjs —— 语料加载 + 检索
 * ============================================================================
 * 数据都是插件自带的离线 JSON（由仓库里 tools/*.py 从官方 PDF/HTML 生成）：
 *   data/roots.json     5716 个词根（含 STEM 1/2/3 详解原文）
 *   data/affixes.json    422 个 VXCS 词缀（9 度释义 + 主题分类）
 *   data/grammar.json    328 个小节（13 章 + 附录的全文，表格保留成 "a | b | c" 行）
 *
 * 检索都是纯 JS，不联网、不依赖宿主：洗牌一遍 token 就够了。
 * ============================================================================
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data')

const norm = (s) => String(s || '').normalize('NFC')

let _roots = null
let _affixes = null
let _grammar = null
let _cases = null

const loadJson = (name) => JSON.parse(readFileSync(join(DATA, name), 'utf8'))

export function roots() {
  return (_roots ??= loadJson('roots.json'))
}
export function affixes() {
  return (_affixes ??= loadJson('affixes.json'))
}
export function grammar() {
  return (_grammar ??= loadJson('grammar.json'))
}

/* ─────────────── 小工具 ─────────────── */

const WORD = /[\p{L}\p{N}]+/gu
const STOP = new Set(['a', 'an', 'the', 'to', 'of', 'be', 'is', 'in', 'on', 'for', 'and', 'or', 'by', 'with', 'as', 'at', 'sth', 'sb', 'x'])

const tokens = (s) => (norm(s).toLowerCase().match(WORD) || [])

/** 根词记号：允许 -ŢK- / ŢK / ţk 三种写法 */
const looksLikeRoot = (q) => /^[-–—]?\p{Lu}[\p{Lu}\p{M}'’-]{0,7}[-–—]?$/u.test(norm(q).trim())
const bareRoot = (q) => norm(q).trim().replace(/^[-–—]+|[-–—]+$/g, '')

/* ─────────────── 词根 ─────────────── */

/**
 * 查词根。query 可以是：
 *   · 英文概念（water / to make / 用工具做 —— 中文不行，先自己换成英文关键词）
 *   · 词根本身（-ŢK- / ŢK）
 */
export function searchRoots(query, limit = 12) {
  const q = norm(query).trim()
  if (!q) return []
  const all = roots()
  const exactRoot = looksLikeRoot(q) ? bareRoot(q) : ''
  if (exactRoot) {
    const hit = all.filter((r) => r.r === exactRoot)
    if (hit.length) return hit.slice(0, limit).map((r) => ({ ...r, score: 100 }))
  }
  const ql = q.toLowerCase()
  const qs = ql.split(/\s+/).filter((t) => t && !STOP.has(t))
  const qc = qs.join(' ')
  const out = []
  for (const r of all) {
    const g = norm(r.gloss).toLowerCase()
    let score = 0
    if (g === ql || g === qc) score = 100
    else if (g.split(/\s*\/\s*|\s*,\s*|\s+or\s+/).some((x) => x.trim() === ql || x.trim() === qc)) score = 95
    else if (qc && g.startsWith(qc)) score = 88
    else if (qc && g.includes(qc)) score = 80 - Math.min(30, Math.max(0, g.length - qc.length) / 4)
    else {
      const hit = qs.filter((t) => g.includes(t)).length
      if (hit === qs.length && qs.length > 1) score = 55
      else if (hit) score = 15 + (30 * hit) / qs.length
    }
    if (!score && r.senses?.length) {
      const s = r.senses.join(' ').toLowerCase()
      if (s.includes(ql)) score = 35
    }
    if (!score && r.raw && norm(r.raw).toLowerCase().includes(ql)) score = 15
    if (score > 0) out.push({ ...r, score })
  }
  out.sort((a, b) => b.score - a.score || a.gloss.length - b.gloss.length)
  return out.slice(0, limit)
}

export function getRoot(query) {
  const q = bareRoot(query).toUpperCase()
  return roots().find((r) => r.r === q) || null
}

/* ─────────────── 词缀 ─────────────── */

export function searchAffixes(query, limit = 10) {
  const q = norm(query).trim()
  if (!q) return []
  const ql = q.toLowerCase().replace(/^[-–—]+|[-–—]+$/g, '')
  const items = affixes()
  const out = []
  for (const a of items) {
    const cs = a.cs.toLowerCase()
    const abbr = a.abbr.toLowerCase()
    const name = a.name.toLowerCase()
    const degs = a.degrees.join(' ').toLowerCase()
    let score = 0
    if (cs === ql) score = 100
    else if (abbr === ql) score = 100
    else if (name === ql) score = 95
    else if (abbr.startsWith(ql) && ql.length >= 2) score = 80
    else if (cs.split('/').includes(ql)) score = 90
    else if (name.includes(ql)) score = 70
    else if (a.topic.toLowerCase().includes(ql)) score = 45
    else if (degs.includes(ql)) score = 40
    if (score > 0) out.push({ ...a, score })
  }
  out.sort((a, b) => b.score - a.score || a.abbr.localeCompare(b.abbr))
  return out.slice(0, limit)
}

/* ─────────────── 格（第 4 章） ─────────────── */

/**
 * 从第 4 章正文里抽格表：标题行形如 "4.2.1 | THM | The Thematic Case"，
 * 正文里 "marked by the V C affix - a in Slot IX" 给出 VC 形。
 */
export function cases() {
  if (_cases) return _cases
  const out = []
  const re = /^\|?\s*([A-Z]{2,5})\s*\|\s*(The .+?Case)\s*$/
  for (const s of grammar()) {
    if (s.ch !== '4') continue
    const m = re.exec(s.title.trim())
    if (!m) continue
    // 原文形如： "marked by the V C affix - a in Slot IX" / "- ia ’ (realized as - i ’ a )" / "- e ö in Slot"
    const mAff = /affix\s*-\s*([^\n]{0,24})/iu.exec(s.text)
    let vc = ''
    let glottal = false
    if (mAff) {
      const raw = mAff[1]
      const stop = raw.search(/\s+in\s+|\s*\(|[.,;]/i)
      const seg = (stop > 0 ? raw.slice(0, stop) : raw)
      glottal = /[’']/.test(seg)
      vc = (seg.match(/[\p{L}'’\s]{1,8}/u)?.[0] || '').replace(/[\s’'|]/g, '').slice(0, 4)
      if (glottal) vc += "'"
    }
    out.push({
      num: s.num, abbr: m[1], name: m[2].replace(/^The /, '').replace(/\s*Case$/, ''),
      vc, glottal, section: s.num, text: s.text.slice(0, 1200),
    })
  }
  _cases = out
  return out
}

export function searchCases(query) {
  const q = norm(query).trim().toLowerCase()
  if (!q) return []
  const qd = q.replace(/[-\s]+/g, ' ').trim()
  const out = []
  for (const c of cases()) {
    const abbr = c.abbr.toLowerCase()
    const name = c.name.toLowerCase()
    let score = 0
    if (abbr === q) score = 100
    else if (name === qd || name + ' case' === qd) score = 95
    else if (name.startsWith(qd)) score = 85
    else if (name.includes(qd)) score = 70
    else if (c.text.toLowerCase().includes(q)) score = 25
    if (score) out.push({ ...c, score })
  }
  out.sort((a, b) => b.score - a.score || a.abbr.localeCompare(b.abbr))
  return out
}

/* ─────────────── 语法全文（BM25） ─────────────── */

let _index = null

function buildIndex() {
  const secs = grammar()
  const docs = secs.map((s) => {
    const tf = new Map()
    for (const t of tokens(`${s.title} ${s.title} ${s.text}`)) tf.set(t, (tf.get(t) || 0) + 1)
    return { s, tf, len: [...tf.values()].reduce((a, b) => a + b, 0) }
  })
  const df = new Map()
  for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) || 0) + 1)
  const avg = docs.reduce((a, d) => a + d.len, 0) / Math.max(1, docs.length)
  _index = { docs, df, avg, n: docs.length }
  return _index
}

export function searchGrammar(query, limit = 6) {
  const idx = _index ?? buildIndex()
  const qs = [...new Set(tokens(query))]
  if (!qs.length) return []
  const k1 = 1.4, b = 0.75
  const scored = []
  for (const d of idx.docs) {
    let score = 0
    for (const q of qs) {
      const tf = d.tf.get(q) || 0
      if (!tf) continue
      const df = idx.df.get(q) || 1
      const idf = Math.log(1 + (idx.n - df + 0.5) / (df + 0.5))
      score += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * d.len) / idx.avg)))
    }
    // 标题命中额外加权
    const t = d.s.title.toLowerCase()
    for (const q of qs) if (t.includes(q)) score += 2.5
    if (score > 0) scored.push({ s: d.s, score })
  }
  scored.sort((a, b2) => b2.score - a.score)
  return scored.slice(0, limit).map(({ s, score }) => ({
    ch: s.ch, chName: s.chName, num: s.num, title: s.title,
    score: Math.round(score * 100) / 100,
    excerpt: excerpt(s.text, qs, 700),
  }))
}

function excerpt(text, qs, width) {
  const low = text.toLowerCase()
  let at = -1
  for (const q of qs) {
    const i = low.indexOf(q)
    if (i >= 0 && (at < 0 || i < at)) at = i
  }
  if (at < 0) at = 0
  const start = Math.max(0, at - Math.floor(width / 3))
  const slice = text.slice(start, start + width)
  return (start > 0 ? '…' : '') + slice + (start + width < text.length ? '…' : '')
}

/** 取某一节的全文（按小节号，如 "3.6.1"） */
export function section(num) {
  const q = String(num).trim().replace(/^§/, '')
  return grammar().find((s) => s.num === q) || null
}

/* ─────────────── 例句（带 interlinear 标注的行） ─────────────── */

let _examples = null

export function examples(query = '', limit = 8) {
  if (!_examples) {
    const out = []
    const prose = /is marked by|affix -|shall be|Note that|as described|in Sec\.|i\.e\.|e\.g\./
    for (const s of grammar()) {
      for (const line of s.text.split('\n')) {
        // 判定：一行里同时有「罗马化伊库伊尔词」和「引号里的英文」
        if (!/[‘'"].+[’'"]/.test(line)) continue
        if (!/[äëïöüţřňšžčçļ]/i.test(line)) continue
        if (line.length < 20 || line.length > 400) continue
        if (prose.test(line)) continue
        // 至少要有一个形态标注 token（-thm / prx / DSP / dyn …）
        if (!/(?:^|\s)-?[a-z]{2,5}(?:[’']|(?:\s|$))|(?:^|\s)-?[A-Z]{2,5}(?:\s|$)/.test(line)) continue
        out.push({ ch: s.ch, num: s.num, title: s.title, line })
      }
    }
    _examples = out
  }
  const q = norm(query).trim().toLowerCase()
  let list = _examples
  if (q) {
    if (/^[\p{Lu}\p{M}'’/-]{1,12}$/u.test(norm(query).trim())) {
      // 大写缩写（ABL / DYN / VXCS）：按整词匹配，别让 "abl" 命中 "translatable"
      const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp(`(^|[^a-zäëïöü])${esc}($|[^a-zäëïöü])`, 'iu')
      list = _examples.filter((e) => re.test(e.line))
    } else {
      list = _examples.filter((e) => e.line.toLowerCase().includes(q))
    }
  }
  return list.slice(0, limit)
}

/* ─────────────── 概况 ─────────────── */

export function stats() {
  return {
    roots: roots().length,
    affixes: affixes().length,
    sections: grammar().length,
    cases: cases().length,
    examples: _examples?.length ?? null,
    chars: grammar().reduce((a, s) => a + s.text.length, 0),
  }
}
