/**
 * dsh-stellaris-ai —— DSH 插件：群星 AI 的「人格 + 多维倾向」设置。
 *
 * 服务端只做三件事：
 *   1. 把设置存到 ~/.dsh/stellaris-ai/config.json；
 *   2. 暴露 /api/stellaris-ai/{config,preset,prompt}；
 *   3. 其它插件/工具以后可以直接读 ctx 上的 persona（见 getPersona）。
 *
 * 人格数据结构借自 stellaris-agent/agent/lib/persona.mjs（MIT）。
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

import {
  DEFAULT_PERSONA,
  PRESETS,
  TRAITS,
  applyPreset,
  normalizePersona,
  personaPrompt,
  personaSummary,
} from './lib/persona.mjs'

export const name = 'dsh-stellaris-ai'
export const version = '0.1.0'
export const inject = ['webServer']

const ROUTE = '/api/stellaris-ai'
const STORE = join(homedir(), '.dsh', 'stellaris-ai', 'config.json')

let persona = normalizePersona(DEFAULT_PERSONA)
let updatedAt = null
let saveError = null
let ctxRef = null

function logLine(line) {
  try {
    if (ctxRef?.logger?.info) ctxRef.logger.info(line)
    else console.log(line)
  } catch {
    /* 日志失败不影响功能 */
  }
}

async function load() {
  try {
    const raw = JSON.parse(await readFile(STORE, 'utf8'))
    persona = normalizePersona(raw?.persona ?? raw)
    updatedAt = raw?.updatedAt || null
  } catch {
    /* 第一次用：保留默认人格 */
  }
  return persona
}

async function save(next) {
  persona = normalizePersona(next)
  updatedAt = new Date().toISOString()
  saveError = null
  try {
    await mkdir(dirname(STORE), { recursive: true })
    await writeFile(
      STORE,
      JSON.stringify({ version: 1, updatedAt, persona }, null, 2),
      'utf8',
    )
  } catch (error) {
    saveError = String(error?.message || error)
    logLine(`[stellaris-ai] 保存失败：${saveError}`)
  }
  return persona
}

/** 给别的插件用：当前人格（只读快照） */
export function getPersona() {
  return { ...personaSummary(persona), prompt: personaPrompt(persona) }
}

function state() {
  return {
    ok: true,
    persona: personaSummary(persona),
    traits: TRAITS,
    presets: Object.values(PRESETS).map((preset) => ({
      id: preset.id,
      label: preset.label,
      name: preset.name,
      title: preset.title,
      traits: preset.traits,
    })),
    prompt: personaPrompt(persona),
    store: STORE,
    updatedAt,
    saveError,
  }
}

function sendJson(res, status, body) {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(text),
  })
  res.end(text)
}

async function readBody(req, limit = 512 * 1024) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.byteLength
    if (size > limit) return null
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return null
  }
}

function localOnly(req) {
  const remote = req.socket?.remoteAddress || ''
  if (!remote) return true
  return /^(127\.|::1|::ffff:127\.|::ffff:::1)/.test(remote)
}

export async function handle(req, res) {
  try {
    if (!localOnly(req)) return sendJson(res, 403, { ok: false, error: 'localhost only' })
    const url = new URL(req.url, 'http://127.0.0.1')
    const path = url.pathname.replace(ROUTE, '') || '/'

    if (req.method === 'GET' && /^\/config\/?$/.test(path)) {
      return sendJson(res, 200, state())
    }

    if (req.method === 'GET' && /^\/prompt\/?$/.test(path)) {
      return sendJson(res, 200, { ok: true, prompt: personaPrompt(persona) })
    }

    if (req.method === 'POST' && /^\/config\/?$/.test(path)) {
      const body = await readBody(req)
      if (!body || typeof body !== 'object') {
        return sendJson(res, 400, { ok: false, error: 'expected json body' })
      }
      const incoming = body.persona && typeof body.persona === 'object' ? body.persona : body
      await save({ ...persona, ...incoming, traits: { ...persona.traits, ...(incoming.traits || {}) } })
      return sendJson(res, 200, state())
    }

    if (req.method === 'POST' && /^\/preset\/?$/.test(path)) {
      const body = await readBody(req)
      const id = body?.id
      if (!id || !PRESETS[id]) {
        return sendJson(res, 400, { ok: false, error: `unknown preset: ${id || '(empty)'}` })
      }
      await save(applyPreset(persona, id))
      return sendJson(res, 200, state())
    }

    return sendJson(res, 404, { ok: false, error: 'not found', path })
  } catch (error) {
    saveError = String(error?.message || error)
    return sendJson(res, 500, { ok: false, error: saveError })
  }
}

export function apply(ctx) {
  ctxRef = ctx
  load().then(() => logLine(`[stellaris-ai] 人格设置已加载（${persona.name}）`))

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'prefix',
        path: ROUTE,
        handler: handle,
      }),
    'stellaris-ai: /api/stellaris-ai（人格设置）',
  )

  // 给同一进程里的其它插件/工具留一个读取入口
  try {
    ctx.set?.('stellaris-ai', { getPersona, persona: () => persona })
  } catch {
    /* 老版本 DSH 没有 ctx.set，不影响设置页 */
  }
}

export function status() {
  return {
    name,
    version,
    persona: personaSummary(persona),
    updatedAt,
    store: STORE,
    saveError,
  }
}
