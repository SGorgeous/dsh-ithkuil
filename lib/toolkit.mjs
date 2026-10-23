/**
 * lib/toolkit.mjs —— 把"工具定义"变成宿主真正想要的样子
 * ============================================================================
 * 🔴 教训（2026-10-22，直接把 DSH 卡死过一次）：
 *   宿主的 `ctx.tools.register()` **不收** `parameters: { 属性名: {...} }` 这种"属性表"，
 *   它收的是 `defineTool()` 的产物 —— 也就是 **已经编译好的 JSON Schema**：
 *       { type: "object", properties: {...}, required?: [...] }
 *   我当时直接把属性表丢给 register，参数到模型那边就变成了 `{type: null}`，
 *   整个会话每次请求都被 OpenAI 兼容层拒掉：
 *       Invalid schema for function 'ithkuil_affix': schema must be a JSON Schema of
 *       'type: "object"', got 'type: null'
 *   所以：**能拿到宿主的 defineTool 就用它；拿不到就自己按同一套规则编译**，
 *   而且**注册前再自检一遍**，schema 不对就不注册（宁少一个工具，也不能拖垮宿主）。
 * ============================================================================
 */

import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const ALLOWED_TYPES = new Set(['string', 'number', 'integer', 'boolean', 'object', 'array', 'null'])
/** 属性表 → JSON Schema（等价于宿主 parameterSchemaSpecToJsonSchema 的最小实现） */
export function toParameterSchema(spec = {}) {
  const properties = {}
  for (const [key, def] of Object.entries(spec || {})) {
    if (!def || typeof def !== 'object') throw new Error(`参数 ${key} 的定义不合法`)
    const node = { ...def }
    if (node.type === undefined) throw new Error(`参数 ${key} 缺 type`)
    if (!ALLOWED_TYPES.has(node.type)) throw new Error(`参数 ${key} 的 type 不支持：${node.type}`)
    properties[key] = node
  }
  return { type: 'object', properties }
}

/** 自检：必须是 object 根 + 属性都带 type，且能无损 JSON 化 */
export function assertToolSchema(tool) {
  if (!tool || typeof tool !== 'object') throw new Error('工具定义不是对象')
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(String(tool.name || ''))) throw new Error(`工具名不合法：${tool.name}`)
  if (!tool.description || typeof tool.description !== 'string') throw new Error(`工具 ${tool.name} 缺 description`)
  const p = tool.parameters
  if (!p || p.type !== 'object') throw new Error(`工具 ${tool.name} 的 parameters 根节点必须是 type:"object"，实际 ${JSON.stringify(p?.type)}`)
  if (!p.properties || typeof p.properties !== 'object') throw new Error(`工具 ${tool.name} 的 parameters.properties 缺失`)
  for (const [k, v] of Object.entries(p.properties)) {
    if (!v || !ALLOWED_TYPES.has(v.type)) throw new Error(`工具 ${tool.name} 的参数 ${k} 类型不合法`)
  }
  const o = tool.output?.schema
  if (o && o.type !== 'object') throw new Error(`工具 ${tool.name} 的 output.schema 根节点必须是 object`)
  try {
    JSON.stringify(tool.parameters)
  } catch {
    throw new Error(`工具 ${tool.name} 的 schema 无法 JSON 序列化`)
  }
  return true
}

/** 本地 defineTool：参数表编译成 schema，其余原样 */
export function localDefineTool(options) {
  const tool = {
    name: options.name,
    description: options.description,
    parameters: toParameterSchema(options.parameters),
    output: options.output,
    async execute(args, exec) {
      return options.execute(args ?? {}, exec)
    },
  }
  assertToolSchema(tool)
  return tool
}

/**
 * 解析宿主的 defineTool。桌面版把 @deepseek-ai/* 当 optional peer（autoInstallPeers: false），
 * 所以**必须**从宿主树里找，不能裸 import。
 */
export async function loadDefineTool(log = () => {}) {
  const roots = []
  const add = (p) => { if (p && !roots.includes(p)) roots.push(p) }

  add(process.env.DSH_HOST_MODULES)
  const appdata = process.env.APPDATA
  if (appdata) {
    const npm = `${appdata}\\npm\\node_modules\\@deepseek-ai`
    add(`${npm}\\dsh\\node_modules\\@deepseek-ai`)
    add(npm)
  }
  const home = process.env.DSH_HOME || `${process.env.USERPROFILE || ''}\\.dsh`
  add(`${home}\\profiles\\desktop\\node_modules\\@deepseek-ai`)
  add(`${home}\\profiles\\web\\node_modules\\@deepseek-ai`)
  // 桌面版：dsh-tools 就在 app.asar 里（Electron 进程内能直接读 asar 路径）
  if (process.resourcesPath) add(`${process.resourcesPath}\\app.asar\\dsh\\node_modules\\@deepseek-ai`)
  add('D:\\_SOFTWARE_\\_Tools_\\DSH\\resources\\app.asar\\dsh\\node_modules\\@deepseek-ai')

  const tries = []
  for (const root of roots) {
    tries.push(`${root}\\dsh-tools\\lib\\index.js`)
    tries.push(`${root}\\dsh-tools\\lib\\index.cjs`)
  }
  for (const file of tries) {
    try {
      if (!existsSync(file)) continue
      const mod = await import(pathToFileURL(file).href)
      if (typeof mod.defineTool === 'function') {
        log(`defineTool：取自 ${file}`)
        return mod.defineTool
      }
    } catch { /* 下一个候选 */ }
  }
  log('defineTool：宿主树里没找到（正常情况），用本地等价实现（编译规则与宿主一致）')
  return localDefineTool
}
