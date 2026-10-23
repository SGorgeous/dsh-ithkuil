/**
 * selfcheck.mjs —— 不起 DSH 也能验插件：
 *   1) 导入 index.js（会触发 apply）
 *   2) 用一个假的 ctx 抓住所有工具
 *   3) 逐个跑一遍，打印前几行
 * 用法：node selfcheck.mjs
 */
import { apply, name } from './index.js'

const tools = new Map()
const ctx = {
  tools: {
    register(t) {
      tools.set(t.name, t)
      return t
    },
  },
  effect(fn) { try { const d = fn(); return d } catch { return null } },
  logger: () => {},
}

apply(ctx)

const run = async (toolName, args) => {
  const t = tools.get(toolName)
  if (!t) return `!! 没有工具 ${toolName}`
  const v = await t.execute(args, {})
  const rendered = t.output?.render ? t.output.render(args, v) : [{ text: String(v) }]
  return rendered.map((x) => x.text).join('\n')
}

const casesToRun = [
  ['ithkuil_stats', {}],
  ['ithkuil_root', { query: 'water', limit: 3 }],
  ['ithkuil_entry', { root: 'ŢK', maxChars: 500 }],
  ['ithkuil_affix', { query: 'FAM', limit: 1 }],
  ['ithkuil_affix_form', { cs: 'sp', degree: 7, type: 1 }],
  ['ithkuil_case', { query: 'ablative', limit: 1 }],
  ['ithkuil_grammar', { query: 'configuration affix', limit: 2 }],
  ['ithkuil_section', { num: '3.6.1', maxChars: 600 }],
  ['ithkuil_examples', { query: 'ABL', limit: 2 }],
  ['ithkuil_quickref', { topic: 'slots' }],
  ['ithkuil_zh', { term: 'stative' }],
]

console.log(`plugin: ${name}  工具数: ${tools.size}\n`)
for (const [n, a] of casesToRun) {
  const out = await run(n, a)
  console.log('='.repeat(70))
  console.log(`▸ ${n} ${JSON.stringify(a)}`)
  console.log(out.split('\n').slice(0, 14).join('\n'))
  console.log()
}
