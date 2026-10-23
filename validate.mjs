/**
 * validate.mjs —— 启用前的闸门（跑这一份通过，才允许把插件挂回 profile）
 *
 * 检查内容（都是 2026-10-22 事故的直接教训）：
 *   1. 每个工具都过 defineTool → parameters 必须是 {type:"object", properties:{...}}
 *   2. 每个工具名/描述/schema 合法，schema 能 JSON 序列化（无损）
 *   3. 逐个真跑一次 execute，确认返回字符串、不抛
 *   4. 模拟模型侧的 function 定义（OpenAI tools[] 形状），确保没有 type: null
 *
 * 用法：node validate.mjs [--run]
 *   --run  : 额外把每个工具跑一遍（慢一点，但能验到数据）
 */
import { apply } from './index.js'
import { assertToolSchema } from './lib/toolkit.mjs'

const runAll = process.argv.includes('--run')

const tools = new Map()
const problems = []
const ctx = {
  tools: {
    register(t) {
      try {
        assertToolSchema(t)
      } catch (e) {
        problems.push(`注册检查失败：${e.message}`)
      }
      tools.set(t.name, t)
      return t
    },
  },
  effect(fn) { try { return fn() } catch { return null } },
  logger: { info() {}, warn() {}, error() {} },
  log() {},
}

apply(ctx)

console.log(`工具数：${tools.size}`)
console.log('')

// ── 1. 逐个检查 function 定义（模型侧看到的样子）────────────────────────────
for (const [name, t] of tools) {
  const fn = { name: t.name, description: t.description, parameters: t.parameters }
  const ok = fn.parameters && fn.parameters.type === 'object' && fn.parameters.properties
  if (!ok) problems.push(`${name}: parameters 不是 object 根 schema`)
  for (const [k, v] of Object.entries(fn.parameters?.properties || {})) {
    if (!v.type) problems.push(`${name}.${k}: 缺 type`)
  }
  // 模拟序列化（模型 API 就是发这个 JSON）
  let bytes = 0
  try { bytes = JSON.stringify(fn).length } catch { problems.push(`${name}: function 定义无法序列化`) }
  console.log(`${ok ? '✓' : '✗'} ${name.padEnd(22)} 参数 ${String(Object.keys(fn.parameters?.properties || {}).length).padStart(2)} 个 · ${bytes} 字节`)
  const sample = JSON.stringify(fn.parameters?.properties || {})
  if (/type":\s*null/.test(sample)) problems.push(`${name}: schema 里出现 type:null`)
}

// ── 2.（可选）真跑一遍 ──────────────────────────────────────────────────────
if (runAll) {
  console.log('\n── 实跑 ──')
  const cases = [
    ['ithkuil_stats', {}],
    ['ithkuil_root', { query: 'water', limit: 2 }],
    ['ithkuil_entry', { root: 'ŢK', maxChars: 300 }],
    ['ithkuil_affix', { query: 'FAM', limit: 1 }],
    ['ithkuil_affix_form', { cs: 'sp', degree: 7, type: 1 }],
    ['ithkuil_case', { query: 'ablative', limit: 1 }],
    ['ithkuil_grammar', { query: 'case scope', limit: 1 }],
    ['ithkuil_section', { num: '3.6.1', maxChars: 300 }],
    ['ithkuil_examples', { query: 'VOC', limit: 1 }],
    ['ithkuil_quickref', { topic: 'slots' }],
    ['ithkuil_zh', { term: 'stative' }],
    ['ithkuil_ca', { config: 'MSC', affil: 'CSL', ext: 'DEL', persp: 'M', ess: 'NRM' }],
    ['ithkuil_build', { root: 'lvž', stem: 3, config: 'MSC', caseAbbr: 'ERG' }],
    ['ithkuil_check', { word: 'ačphulogmümţíwa' }],
  ]
  for (const [n, args] of cases) {
    const t = tools.get(n)
    if (!t) { problems.push(`缺少工具 ${n}`); continue }
    try {
      const v = await t.execute(args, {})
      const text = t.output.render(args, v).map((x) => x.text).join('')
      const okRun = typeof text === 'string' && text.length > 0
      if (!okRun) problems.push(`${n}: 返回空`)
      console.log(`${okRun ? '✓' : '✗'} ${n.padEnd(22)} ${text.length} 字 · ${text.split('\n')[0].slice(0, 60)}`)
    } catch (e) {
      problems.push(`${n}: 执行抛错 ${e.message}`)
      console.log(`✗ ${n}: ${e.message}`)
    }
  }
}

console.log('')
if (problems.length) {
  console.log('❌ 有 %d 个问题：', problems.length)
  for (const p of problems) console.log('   -', p)
  process.exit(1)
}
console.log('✅ 全部通过')
