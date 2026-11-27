/**
 * Herald Styx UI 0.1.0: model/service logos and a live agent panel for Hermes Desktop.
 * https://github.com/ILSTR-RIX/herald-styx-ui (MIT, provided AS IS without warranty)
 *
 * Built file. Edit src/plugin.js and logos.config.json, then run
 *   node scripts/build.mjs
 * which inlines the logos and writes dist/plugin.js.
 *
 * Install: copy dist/plugin.js to <hermes home>/desktop-plugins/herald-styx-ui/plugin.js
 * Remove:  delete that folder, or switch it off in Capabilities > Plugins.
 *
 * Uses only the public plugin SDK. The DOM touches are optional (Settings >
 * Plugins > Herald Styx UI > "Logos on chat tool rows" / "Logo on the composer
 * model pill"): they set a data attribute on a Hermes element and paint the
 * logo with CSS. They never insert nodes into React-owned markup, and
 * everything they set is removed on unload.
 */

import {
  APPROVAL_RESPOND_TIMEOUT_MS,
  atom,
  Button,
  Codicon,
  COMPOSER_AREAS,
  host,
  MODEL_MENU_ROW_AREA,
  PALETTE_AREA,
  SESSION_ROW_AREAS,
  STATUSBAR_AREAS,
  Tip,
  ToggleRow,
  TRANSCRIPT_DIRECTIVE_AREA,
  useValue
} from '@hermes/plugin-sdk'
import { useEffect, useState } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'

const ID = 'herald-styx-ui'
const PANE_ID = `${ID}:panel`

// { models, services, families, icons } — filled in by scripts/build.mjs.
const LOGOS = "__HERALD_STYX_LOGOS__"

// ── Logo lookup ─────────────────────────────────────────────────────────────

const lower = value => String(value ?? '').toLowerCase()

function firstMatch(entries, haystack) {
  if (!haystack) return null
  for (const entry of entries) {
    if (entry.aliases.some(alias => haystack.includes(alias))) return entry
  }
  return null
}

/** Logo for a model id, optionally with its provider slug. */
export function modelLogo(model, provider) {
  // Model name first: "openrouter/anthropic/claude" is Claude, not OpenRouter.
  return firstMatch(LOGOS.models, lower(model)) ?? firstMatch(LOGOS.models, lower(provider))
}

/** Logo for a tool: gateway label app ("GitHub"), MCP server, or tool name. */
export function serviceLogo(name, app) {
  const n = lower(name)
  // mcp__<server>__<tool> and connectors__<app>__<tool> carry the service in the middle.
  const middle = /^(?:mcp|connectors)__([^_]+(?:_[^_]+)*?)__/.exec(n)?.[1]
  return firstMatch(LOGOS.services, lower(app)) ?? firstMatch(LOGOS.services, middle) ?? firstMatch(LOGOS.services, n)
}

/** Logo for a URL or host. Matches whole domain labels, not substrings, so
 *  "x.com" does not claim netflix.com and "linear." does not claim nonlinear.io. */
export function hostLogo(urlOrHost) {
  const host = lower(hostOf(urlOrHost))
  if (!host) return null
  const labels = host.split('.')
  for (const entry of LOGOS.services) {
    for (const raw of entry.aliases) {
      const alias = raw.replace(/^[._/]+|[._/]+$/g, '')
      // Tool-name aliases ("exa_", "x_search", "mcp__exa") are not host names.
      if (!/^[a-z0-9.-]+$/.test(alias)) continue
      if (alias.includes('.') ? host === alias || host.endsWith(`.${alias}`) : labels.includes(alias)) return entry
    }
  }
  return null
}

const FAMILY_ICON = {
  code: 'code', cron: 'watch', delegation: 'organization', files: 'file', memory: 'database',
  search: 'search', skills: 'book', terminal: 'terminal', todo: 'checklist', tools: 'tools',
  vision: 'eye', web: 'globe'
}

export function familyOf(name) {
  const n = lower(name)
  for (const [family, names] of Object.entries(LOGOS.families)) {
    if (names.includes(n)) return family
  }
  if (n.startsWith('browser')) return 'web'
  return null
}

function hostOf(value) {
  const text = String(value ?? '').trim()
  if (!text) return ''
  try {
    return new URL(/^[a-z]+:\/\//i.test(text) ? text : `https://${text}`).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function Logo({ entry, fallback = 'symbol-misc', size = 14, label }) {
  const src = entry && LOGOS.icons[entry.icon]
  if (src) {
    return jsx('img', {
      alt: label ?? '',
      'aria-hidden': label ? undefined : true,
      className: 'hs-logo',
      draggable: false,
      height: size,
      src,
      width: size
    })
  }
  return jsx(Codicon, { 'aria-hidden': true, className: 'hs-glyph', name: fallback, size: `${size}px` })
}

// ── Turn state, per session ─────────────────────────────────────────────────

const MAX_STEPS = 300
const MAX_SESSIONS = 12
/** How long Hermes must report a session idle before a still-running trace is ended. */
const IDLE_GRACE_MS = 8000

/** Bumped (throttled) whenever any trace changes; the panel subscribes to it. */
const $version = atom(0)
const traces = new Map()
/** Last session.info model/provider per session, for the status-bar chip. */
/** Cumulative stats per session: turns, steps. */
const sessionStats = new Map()
/** Last known reasoning effort per session. */
const sessionReasoning = new Map()
/** Custom icon/color marks per session. */
const sessionMarks = new Map()
/** Detected GenUI artifacts per session: charts, tables, KPIs, calculators. */
const sessionArtifacts = new Map()

export function recordArtifact(sessionId, artifact) {
  if (!sessionId || !artifact) return
  let list = sessionArtifacts.get(sessionId)
  if (!list) {
    list = []
    sessionArtifacts.set(sessionId, list)
  }
  if (!list.some(a => a.id === artifact.id)) {
    list.push(artifact)
    if (list.length > 20) list.shift()
    $version.set($version.get() + 1)
  }
}

export function statsFor(sessionId) {
  let s = sessionStats.get(sessionId)
  if (!s) {
    s = { turns: 0, steps: 0 }
    sessionStats.set(sessionId, s)
    while (sessionStats.size > MAX_SESSIONS) sessionStats.delete(sessionStats.keys().next().value)
  }
  return s
}
const sessionInfo = new Map()

function newTrace() {
  return {
    running: false, startedAt: 0, endedAt: 0, outcome: null,
    steps: [], dropped: 0, sources: new Map(), queries: [],
    todos: [], subagents: new Map(), approval: null
  }
}

/** End the turn: stamp the outcome and stop whatever was still running. */
function finishTrace(trace, outcome) {
  if (trace.running || !trace.endedAt) trace.endedAt = Date.now()
  trace.running = false
  trace.outcome = outcome
  trace.approval = null
  for (const step of trace.steps) {
    if (step.status === 'running') step.status = 'stopped'
  }
}

function traceFor(sessionId) {
  let trace = traces.get(sessionId)
  if (!trace) {
    trace = newTrace()
    traces.set(sessionId, trace)
    while (traces.size > MAX_SESSIONS) traces.delete(traces.keys().next().value)
  }
  return trace
}

function pushStep(trace, step) {
  trace.steps.push(step)
  if (trace.steps.length > MAX_STEPS) {
    trace.steps.shift()
    trace.dropped += 1
  }
}

function addSource(trace, value) {
  const h = hostOf(value)
  if (h && !trace.sources.has(h)) trace.sources.set(h, hostLogo(h))
}

function collectSources(trace, args) {
  if (!args || typeof args !== 'object') return
  if (typeof args.url === 'string') addSource(trace, args.url)
  if (Array.isArray(args.urls)) args.urls.forEach(u => typeof u === 'string' && addSource(trace, u))
  const query = typeof args.query === 'string' ? args.query : Array.isArray(args.queries) ? args.queries[0] : null
  const q = typeof query === 'string' ? query.trim().slice(0, 80) : ''
  if (q && trace.queries.length < 8 && !trace.queries.includes(q)) trace.queries.push(q)
}

/** tool.complete has no failure flag in this protocol; read the result. */
export function resultFailed(payload) {
  if (payload.is_error === true) return true
  const r = payload.result
  if (r && typeof r === 'object' && !Array.isArray(r)) {
    if (r.success === false || r.ok === false) return true
    if (typeof r.error === 'string' && r.error.trim()) return true
    if (typeof r.exit_code === 'number' && r.exit_code !== 0 && r.exit_code !== 130) return true
  }
  return false
}

function stepsFromStart(payload) {
  const labels = Array.isArray(payload.labels) ? payload.labels : []
  // A bridged connector batch arrives as one tool_call with one label per inner call.
  const parts = labels.length ? labels : [null]
  return parts.map((label, index) => {
    const name = label?.name || payload.name
    const title = label?.app && label?.action ? `${label.app} · ${label.action}` : prettyName(name)
    return {
      kind: 'tool',
      key: `${payload.tool_id}#${index}`,
      toolId: payload.tool_id,
      name,
      title,
      detail: String(label?.preview || payload.context || payload.preview || '').slice(0, 120),
      logo: serviceLogo(name, label?.app),
      family: familyOf(name),
      status: 'running',
      startedAt: Date.now(),
      duration: null
    }
  })
}

function prettyName(name) {
  const n = String(name ?? 'tool')
  const mcp = /^(?:mcp|connectors)__(.+?)__(.+)$/.exec(n)
  const words = s => s.replace(/[_-]+/g, ' ').trim()
  return mcp ? `${words(mcp[1])} · ${words(mcp[2])}` : words(n)
}

/** Apply one gateway event. Exported for the test harness. */
export function applyEvent(event) {
  const sid = event?.session_id
  const p = event?.payload ?? {}
  if (!sid || !event.type) return false
  const t = event.type

  if (t === 'message.start') {
    const trace = traceFor(sid)
    // A queued prompt starts while the last turn is still marked running: keep its steps.
    if (!trace.running) {
      const keepSubagents = [...trace.subagents.values()].filter(s => s.status === 'running')
      Object.assign(trace, newTrace())
      keepSubagents.forEach(s => trace.subagents.set(s.id, s))
      trace.startedAt = Date.now()
      statsFor(sid).turns += 1
    }
    trace.running = true
    return true
  }

  if (t === 'message.complete') {
    finishTrace(traceFor(sid), p.status ?? (p.error ? 'error' : 'complete'))
    return true
  }

  // Every other edge Hermes itself treats as a turn end (lib/execution-authority.ts).
  if (t === 'message.error' || t === 'session.reclaimed') {
    const trace = traces.get(sid)
    if (trace?.running) finishTrace(trace, t === 'message.error' ? 'error' : 'interrupted')
    return !!trace
  }

  if (t === 'session.info') {
    // Only the provider is read here. Its `running` flag is not used as a turn
    // end: plugins hear events before Hermes fences stale snapshots.
    const prev = sessionInfo.get(sid)
    const next = { model: p.model || prev?.model || '', provider: p.provider || prev?.provider || '' }
    const reas = p.reasoning_effort || p.reasoning
    if (reas) sessionReasoning.set(sid, reas)
    if ((!next.model && !next.provider) || (next.model === prev?.model && next.provider === prev?.provider)) return !!reas
    sessionInfo.delete(sid)
    sessionInfo.set(sid, next)
    while (sessionInfo.size > MAX_SESSIONS) sessionInfo.delete(sessionInfo.keys().next().value)
    return true
  }

  if (t === 'tool.start') {
    const trace = traceFor(sid)
    if (!trace.running) {
      trace.running = true
      trace.startedAt ||= Date.now()
    }
    const started = stepsFromStart(p)
    started.forEach(step => pushStep(trace, step))
    statsFor(sid).steps += started.length
    collectSources(trace, p.args)
    return true
  }

  if (t === 'tool.complete') {
    const trace = traceFor(sid)
    const failed = resultFailed(p)
    const inner = p.result && Array.isArray(p.result.results) ? p.result.results : null
    let index = 0
    for (const step of trace.steps) {
      if (step.toolId !== p.tool_id || step.status !== 'running') continue
      const innerFailed = inner?.[index] && typeof inner[index] === 'object' && inner[index].error
      step.status = failed || innerFailed ? 'failed' : 'done'
      step.duration = typeof p.duration_s === 'number' ? p.duration_s : (Date.now() - step.startedAt) / 1000
      index += 1
    }
    if (!failed) collectSources(trace, p.args)
    if (Array.isArray(p.todos)) trace.todos = normaliseTodos(p.todos)
    return true
  }

  if (t === 'reasoning.delta') {
    const trace = traceFor(sid)
    const last = trace.steps[trace.steps.length - 1]
    const text = String(p.text ?? '')
    if (last?.kind === 'thinking' && last.status === 'running') {
      last.detail = (last.detail + text).slice(-160)
    } else {
      trace.steps.forEach(s => s.kind === 'thinking' && s.status === 'running' && (s.status = 'done'))
      pushStep(trace, {
        kind: 'thinking', key: `think-${event.seq ?? Date.now()}`, title: 'Thinking',
        detail: text.slice(-160), status: 'running', startedAt: Date.now(), duration: null
      })
    }
    return true
  }

  if (t === 'todo.updated') {
    traceFor(sid).todos = normaliseTodos(p.todos)
    return true
  }

  if (t.startsWith('subagent.')) {
    const id = p.subagent_id || p.child_session_id || `${p.delegation_id ?? 'd'}:${p.task_index ?? 0}`
    const trace = traceFor(sid)
    const prev = trace.subagents.get(id) ?? { id, startedAt: Date.now(), tools: 0 }
    const ended = t === 'subagent.complete'
    trace.subagents.set(id, {
      ...prev,
      goal: String(p.goal ?? prev.goal ?? '').slice(0, 140),
      model: p.model ?? prev.model,
      tool: t === 'subagent.tool' ? p.tool_name : prev.tool,
      tools: typeof p.tool_count === 'number' ? p.tool_count : prev.tools + (t === 'subagent.tool' ? 1 : 0),
      status: ended ? (p.status === 'completed' ? 'done' : 'failed') : 'running',
      duration: ended ? (p.duration_seconds ?? (Date.now() - prev.startedAt) / 1000) : null
    })
    return true
  }

  if (t === 'approval.request') {
    traceFor(sid).approval = {
      requestId: p.request_id || p.prompt_id,
      command: String(p.command ?? '').slice(0, 400),
      description: String(p.description ?? '').slice(0, 200),
      kind: p.kind
    }
    return true
  }

  // An interrupt / reap / teardown dropped pending approvals without a settled frame.
  if (t === 'approval.cancelled') {
    const trace = traces.get(sid)
    if (!trace?.approval) return false
    const ids = Array.isArray(p.request_ids) ? p.request_ids : []
    if (!ids.length || ids.includes(trace.approval.requestId)) trace.approval = null
    return true
  }

  if (t === 'approval.settled') {
    const trace = traceFor(sid)
    const rid = p.request_id || p.prompt_id
    if (!rid || trace.approval?.requestId === rid) trace.approval = null
    return true
  }

  return false
}

const TODO_STATUSES = new Set(['pending', 'in_progress', 'completed', 'cancelled'])

function normaliseTodos(list) {
  if (!Array.isArray(list)) return []
  return list
    .filter(item => item && typeof item === 'object' && TODO_STATUSES.has(item.status) && String(item.content ?? '').trim())
    .slice(0, 50)
    .map(item => ({ id: String(item.id ?? item.content), content: String(item.content).trim(), status: item.status }))
}

export const __internals = { traces, applyEvent, modelLogo, serviceLogo, hostLogo, resultFailed, pillModel, sessionStats, sessionReasoning, sessionMarks, statsFor, sessionArtifacts, recordArtifact }

// ── Formatting ──────────────────────────────────────────────────────────────

function formatDuration(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return ''
  if (seconds < 1) return `${Math.max(0, Math.round(seconds * 1000))}ms`
  if (seconds < 60) return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return m < 60 ? `${m}m ${s}s` : `${Math.floor(m / 60)}h ${m % 60}m`
}

const STATUS_TEXT = { done: 'done', failed: 'failed', running: 'running', stopped: 'stopped' }

// ── Panel ───────────────────────────────────────────────────────────────────

function useTicker(active) {
  const [, setNow] = useState(0)
  useEffect(() => {
    if (!active) return undefined
    const timer = setInterval(() => setNow(n => n + 1), 1000)
    return () => clearInterval(timer)
  }, [active])
}

function Section({ title, count, children }) {
  return jsxs('section', {
    className: 'hs-section',
    children: [
      jsxs('h3', { className: 'hs-section-title', children: [title, count != null && jsx('span', { className: 'hs-count', children: count })] }),
      children
    ]
  })
}

function StepRow({ step, sessionId }) {
  const running = step.status === 'running'
  const elapsed = running ? (Date.now() - step.startedAt) / 1000 : step.duration
  const stalled = running && elapsed > 15
  const icon = step.kind === 'thinking'
    ? jsx(Codicon, { 'aria-hidden': true, className: 'hs-glyph', name: 'lightbulb', size: '14px' })
    : jsx(Logo, { entry: step.logo, fallback: FAMILY_ICON[step.family] ?? 'tools' })

  const onBreak = e => {
    e.stopPropagation()
    if (sessionId) host.request('session.interrupt', { session_id: sessionId }).catch(() => {})
  }

  return jsxs('li', {
    className: `hs-step${stalled ? ' hs-stalled' : ''}`,
    'data-status': step.status,
    children: [
      jsx('span', { className: 'hs-step-icon', children: icon }),
      jsxs('span', {
        className: 'hs-step-body',
        children: [
          jsx('span', { className: 'hs-step-title', children: step.title }),
          step.detail && jsx('span', { className: 'hs-step-detail', title: step.detail, children: step.detail })
        ]
      }),
      jsxs('span', {
        className: 'hs-step-meta',
        children: [
          jsxs('span', {
            className: 'hs-status-wrap',
            children: [
              jsx('span', { className: 'hs-status', children: stalled ? 'stalled' : STATUS_TEXT[step.status] }),
              running && jsx(Tip, {
                label: 'Stop tool / break turn',
                children: jsx('button', {
                  className: 'hs-step-break',
                  onClick: onBreak,
                  'aria-label': 'Stop tool',
                  type: 'button',
                  children: jsx(Codicon, { 'aria-hidden': true, name: 'debug-stop', size: '11px' })
                })
              })
            ]
          }),
          jsx('span', { className: 'hs-time', children: formatDuration(elapsed) })
        ]
      })
    ]
  })
}

/** Answer through Hermes' own approval card when it is on screen (so the card
 *  leaves too); otherwise send approval.respond. Buttons are found by Hermes'
 *  own data attributes (approval.tsx), never by position. */
async function answerApproval(sessionId, approval, choice) {
  const card = document.querySelector(
    `[data-slot="tool-approval-card"][data-request-id="${CSS.escape(String(approval.requestId))}"]`
  )
  const button = card?.querySelector(choice === 'deny' ? 'button[data-approval-deny]' : 'button[data-approval-run]')
  if (button && !button.disabled) return button.click()
  await host.request(
    'approval.respond',
    { session_id: sessionId, request_id: approval.requestId, choice },
    APPROVAL_RESPOND_TIMEOUT_MS
  )
}

function ApprovalCard({ sessionId, approval }) {
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')
  const respond = choice => {
    setBusy(choice)
    setError('')
    answerApproval(sessionId, approval, choice)
      .catch(err => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setBusy(null))
  }
  return jsxs('div', {
    className: 'hs-approval',
    role: 'group',
    'aria-label': 'Approval needed',
    children: [
      jsxs('div', { className: 'hs-approval-head', children: [jsx(Codicon, { 'aria-hidden': true, name: 'shield', size: '14px' }), 'Approval needed'] }),
      approval.description && jsx('p', { className: 'hs-approval-desc', children: approval.description }),
      approval.command && jsx('pre', { className: 'hs-approval-cmd', children: approval.command }),
      error && jsx('p', { className: 'hs-error', role: 'alert', children: error }),
      jsxs('div', {
        className: 'hs-approval-actions',
        children: [
          jsx(Button, { disabled: !!busy, onClick: () => respond('deny'), size: 'sm', variant: 'text', children: busy === 'deny' ? 'Denying…' : 'Deny' }),
          jsx(Button, { disabled: !!busy, onClick: () => respond('once'), size: 'sm', children: busy === 'once' ? 'Allowing…' : 'Allow once' })
        ]
      }),
      jsx('p', { className: 'hs-hint', children: 'Allow for session or always: use the card in the chat.' })
    ]
  })
}

const TODO_MARK = { completed: '✓', in_progress: '◐', pending: '○', cancelled: '–' }
const TODO_TEXT = { completed: 'done', in_progress: 'in progress', pending: 'pending', cancelled: 'cancelled' }

function AgentPanel({ onClose }) {
  useValue($version)
  const sessionId = useValue(host.state.focusedSessionId)
  const [showAll, setShowAll] = useState(false)
  const trace = sessionId ? traces.get(sessionId) : null
  useTicker(!!trace?.running)

  const header = jsxs('div', {
    className: 'hs-head',
    children: [
      jsxs('div', {
        className: 'hs-head-text',
        children: [
          jsx('span', { className: 'hs-title', children: 'Agent' }),
          trace && jsx('span', {
            className: 'hs-sub',
            children: (() => {
              const stats = sessionId ? statsFor(sessionId) : { turns: 0, steps: 0 }
              const iter = (stats.turns > 0 || stats.steps > 0)
                ? ` · ${stats.turns} turn${stats.turns === 1 ? '' : 's'} · ${stats.steps} step${stats.steps === 1 ? '' : 's'}`
                : ''
              return trace.running
                ? `Working for ${formatDuration((Date.now() - trace.startedAt) / 1000)}${iter}`
                : trace.endedAt
                  ? `Worked for ${formatDuration((trace.endedAt - trace.startedAt) / 1000)}${iter}${trace.outcome && trace.outcome !== 'complete' ? ` · ${trace.outcome}` : ''}`
                  : ''
            })()
          })
        ]
      }),
      jsx(Tip, {
        label: 'Close panel',
        children: jsx(Button, {
          'aria-label': 'Close agent panel', onClick: onClose, size: 'icon-xs', variant: 'ghost',
          children: jsx(Codicon, { 'aria-hidden': true, name: 'close', size: '14px' })
        })
      })
    ]
  })

  if (!sessionId || !trace || (!trace.steps.length && !trace.subagents.size && !trace.todos.length && !trace.approval)) {
    return jsxs('div', {
      className: 'hs-panel',
      children: [
        header,
        jsxs('div', {
          className: 'hs-empty',
          children: [
            jsx(Codicon, { 'aria-hidden': true, name: 'pulse', size: '20px' }),
            jsx('p', { children: sessionId ? 'No steps seen for this chat in this window yet.' : 'Open a chat to see its agent work.' }),
            jsx('p', { className: 'hs-hint', children: 'Steps appear while a reply runs. Older turns are not rebuilt after a restart.' })
          ]
        })
      ]
    })
  }

  const steps = showAll ? trace.steps : trace.steps.slice(-30)
  const hidden = trace.steps.length - steps.length + trace.dropped
  const toolCount = trace.steps.filter(s => s.kind === 'tool').length
  const subagents = [...trace.subagents.values()]
  const sources = [...trace.sources.entries()]
  const artifacts = sessionId ? sessionArtifacts.get(sessionId) || [] : []

  return jsxs('div', {
    className: 'hs-panel',
    children: [
      header,
      jsxs('div', {
        className: 'hs-scroll',
        children: [
          trace.approval && jsx(ApprovalCard, { approval: trace.approval, sessionId }),

          trace.todos.length > 0 && jsx(Section, {
            title: 'Plan',
            count: `${trace.todos.filter(t => t.status === 'completed').length}/${trace.todos.length}`,
            children: jsx('ol', {
              children: trace.todos.map(todo => jsxs('li', {
                'data-status': todo.status,
                children: [
                  jsx('span', { 'aria-hidden': true, className: 'hs-todo-mark', children: TODO_MARK[todo.status] }),
                  jsx('span', { className: 'hs-sr', children: `${TODO_TEXT[todo.status]}: ` }),
                  todo.content
                ]
              }, todo.id))
            })
          }),

          artifacts.length > 0 && jsx(Section, {
            title: 'Artifacts',
            count: artifacts.length,
            children: jsx('ul', {
              className: 'hs-steps hs-artifacts',
              children: artifacts.map(art => jsxs('li', {
                className: 'hs-step hs-artifact-row',
                children: [
                  jsx('span', { className: 'hs-step-icon', children: jsx(Codicon, { name: art.kind === 'chart' ? 'graph' : art.kind === 'table' ? 'table' : art.kind === 'calculator' ? 'calculator' : 'dashboard', size: '13px' }) }),
                  jsx('span', { className: 'hs-step-body', children: jsx('span', { className: 'hs-step-title', children: art.title }) }),
                  jsx('span', { className: 'hs-step-meta', children: jsx('span', { className: 'hs-status', children: art.kind }) })
                ]
              }, art.id))
            })
          }),

          (sources.length > 0 || trace.queries.length > 0) && jsx(Section, {
            title: 'Sources',
            children: jsxs('div', {
              className: 'hs-sources',
              children: [
                sources.slice(0, 8).map(([h, logo]) => jsxs('span', {
                  className: 'hs-chip', title: h,
                  children: [jsx(Logo, { entry: logo, fallback: 'globe', size: 12 }), h]
                }, h)),
                sources.length > 8 && jsx('span', { className: 'hs-chip hs-muted', children: `+${sources.length - 8} more` }),
                trace.queries.length > 0 && jsx('p', { className: 'hs-queries', children: `Searched: ${trace.queries.slice(0, 3).join(' · ')}` })
              ]
            })
          }),

          subagents.length > 0 && jsx(Section, {
            title: 'Sub-agents',
            count: subagents.length,
            children: jsx('ul', {
              className: 'hs-steps',
              children: subagents.map(sub => jsxs('li', {
                className: 'hs-step',
                'data-status': sub.status,
                children: [
                  jsx('span', { className: 'hs-step-icon', children: jsx(Logo, { entry: modelLogo(sub.model), fallback: 'hubot' }) }),
                  jsxs('span', {
                    className: 'hs-step-body',
                    children: [
                      jsx('span', { className: 'hs-step-title', title: sub.goal, children: sub.goal || 'Sub-agent' }),
                      jsx('span', { className: 'hs-step-detail', children: [sub.model, sub.tool && `→ ${sub.tool}`, `${sub.tools} tools`].filter(Boolean).join(' · ') })
                    ]
                  }),
                  jsxs('span', {
                    className: 'hs-step-meta',
                    children: [
                      jsx('span', { className: 'hs-status', children: STATUS_TEXT[sub.status] }),
                      jsx('span', { className: 'hs-time', children: formatDuration(sub.duration ?? (Date.now() - sub.startedAt) / 1000) })
                    ]
                  })
                ]
              }, sub.id))
            })
          }),

          trace.steps.length > 0 && jsx(Section, {
            title: 'Steps',
            count: `${toolCount} tool${toolCount === 1 ? '' : 's'}`,
            children: jsxs('div', {
              children: [
                hidden > 0 && jsx(Button, {
                  className: 'hs-more', onClick: () => setShowAll(true), size: 'xs', variant: 'ghost',
                  disabled: showAll && trace.dropped > 0 && trace.steps.length === steps.length,
                  children: showAll ? `${trace.dropped} oldest steps not kept` : `Show ${hidden} earlier steps`
                }),
                jsx('ol', { className: 'hs-steps', 'aria-live': 'polite', children: steps.map(step => jsx(StepRow, { step, sessionId }, step.key)) })
              ]
            })
          })
        ]
      })
    ]
  })
}

// ── Statusbar chip and model-menu marks ─────────────────────────────────────

function ModelChip({ prefs, onToggle }) {
  useValue($version)
  const model = useValue(host.state.model)
  const sessionId = useValue(host.state.focusedSessionId)
  const { showChip } = useValue(prefs)
  if (!showChip || !model) return null
  // A router alias carries no vendor; the focused chat's session.info provider
  // does, but only while that snapshot is for the same model.
  const info = sessionInfo.get(sessionId)
  const entry = modelLogo(model, info && (!info.model || info.model === model) ? info.provider : null)
  const short = String(model).split('/').pop()
  return jsx(Tip, {
    label: `${model} · toggle agent panel`,
    children: jsxs('button', {
      className: 'hs-chip-btn',
      onClick: onToggle,
      type: 'button',
      children: [jsx(Logo, { entry, fallback: 'sparkle', size: 12 }), jsx('span', { children: short })]
    })
  })
}

const REASONING_LEVELS = ['none', 'low', 'medium', 'high']
const REASONING_LABELS = { none: 'None', low: 'Low', medium: 'Med', high: 'High' }

function ReasoningChip({ prefs }) {
  useValue($version)
  const sessionId = useValue(host.state.focusedSessionId)
  const { reasoningSwitch } = useValue(prefs)
  if (!reasoningSwitch || !sessionId) return null

  const raw = sessionReasoning.get(sessionId) || 'medium'
  const level = REASONING_LEVELS.includes(raw) ? raw : 'medium'

  const next = e => {
    e.stopPropagation()
    const idx = REASONING_LEVELS.indexOf(level)
    const nextLevel = REASONING_LEVELS[(idx + 1) % REASONING_LEVELS.length]
    sessionReasoning.set(sessionId, nextLevel)
    $version.set($version.get() + 1)
    host.request('config.set', { key: 'reasoning', session_id: sessionId, value: nextLevel }).catch(() => {})
  }

  return jsx(Tip, {
    label: `Reasoning effort: ${REASONING_LABELS[level] ?? level} · click to cycle`,
    children: jsxs('button', {
      className: 'hs-chip-btn hs-reasoning-btn',
      onClick: next,
      type: 'button',
      'aria-label': `Reasoning: ${REASONING_LABELS[level]}`,
      children: [
        jsx(Codicon, { 'aria-hidden': true, name: 'symbol-misc', size: '12px' }),
        jsx('span', { children: REASONING_LABELS[level] ?? level })
      ]
    })
  })
}

const SWATCH_PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

function SessionRowTrailing({ sessionId, storage }) {
  useValue($version)
  const colors = storage.get('sessionColors', {})
  const color = colors[sessionId] || null

  const cycle = e => {
    e.stopPropagation()
    const nextColors = { ...storage.get('sessionColors', {}) }
    const currentIdx = color ? SWATCH_PALETTE.indexOf(color) : -1
    const nextColor = currentIdx + 1 < SWATCH_PALETTE.length ? SWATCH_PALETTE[currentIdx + 1] : null
    if (nextColor) nextColors[sessionId] = nextColor
    else delete nextColors[sessionId]
    storage.set('sessionColors', nextColors)
    if (typeof host.sessions?.setColor === 'function') {
      host.sessions.setColor(sessionId, nextColor)
    }
    $version.set($version.get() + 1)
  }

  return jsx(Tip, {
    label: color ? `Session color: ${color} · click to change` : 'Set session color',
    children: jsx('button', {
      type: 'button',
      className: 'hs-session-dot-btn',
      onClick: cycle,
      'aria-label': 'Set session color',
      children: jsx('span', {
        className: 'hs-session-dot',
        style: { backgroundColor: color || 'transparent' }
      })
    })
  })
}

const PROMPT_TEMPLATES = [
  { id: 'review', label: 'Review Code', prefix: 'Review this code for bugs, edge cases, and performance bottlenecks:\n\n' },
  { id: 'explain', label: 'Explain Step-by-Step', prefix: 'Explain how this works step-by-step with architecture and trade-offs:\n\n' },
  { id: 'test', label: 'Write Tests', prefix: 'Write comprehensive regression tests covering edge cases for:\n\n' },
  { id: 'refactor', label: 'Refactor Cleanly', prefix: 'Refactor this code to improve clarity, remove duplication, and keep maintainability:\n\n' }
]

function PromptEnhanceAction({ prefs }) {
  useValue($version)
  const { promptEnhance } = useValue(prefs)
  const [open, setOpen] = useState(false)
  if (!promptEnhance) return null

  const apply = tmpl => {
    setOpen(false)
    const sid = host.state.focusedSessionId?.get?.()
    if (host.composer?.insertText) {
      host.composer.insertText(sid, tmpl.prefix, { mode: 'prefix' })
      return
    }
    const textarea = document.querySelector('[data-slot="composer-root"] textarea, [data-slot="composer-root"] [contenteditable="true"]')
    if (textarea) {
      if (textarea.tagName === 'TEXTAREA') {
        textarea.value = tmpl.prefix + textarea.value
        textarea.dispatchEvent(new Event('input', { bubbles: true }))
      } else {
        textarea.textContent = tmpl.prefix + textarea.textContent
      }
    }
  }

  return jsxs('div', {
    className: 'hs-prompt-wrap',
    children: [
      jsx(Tip, {
        label: 'Prompt templates (Enhance)',
        children: jsx('button', {
          type: 'button',
          className: 'hs-chip-btn hs-prompt-trigger',
          onClick: () => setOpen(!open),
          'aria-label': 'Prompt templates',
          children: jsx(Codicon, { 'aria-hidden': true, name: 'sparkle', size: '13px' })
        })
      }),
      open && jsxs('div', {
        className: 'hs-prompt-popover',
        children: PROMPT_TEMPLATES.map(t => jsx('button', {
          type: 'button',
          className: 'hs-prompt-item',
          onClick: () => apply(t),
          children: t.label
        }, t.id))
      })
    ]
  })
}

// ── GenUI Interactive Directives ────────────────────────────────────────────

function parseChartData(str) {
  return (str || '').split(',').map(pair => {
    const [k, v] = pair.split(':')
    return { label: (k || '').trim(), value: parseFloat(v) || 0 }
  }).filter(d => d.label && !isNaN(d.value))
}

function GenUIChart({ attrs, sessionId }) {
  const title = attrs?.title || 'Metric Chart'
  const data = parseChartData(attrs?.data)
  const [pinned, setPinned] = useState(false)

  useEffect(() => {
    if (sessionId) recordArtifact(sessionId, { id: `chart-${title}`, kind: 'chart', title })
  }, [sessionId, title])

  const maxVal = Math.max(...data.map(d => d.value), 1)

  const keep = () => {
    setPinned(!pinned)
    if (typeof host.sessions?.pin === 'function' && sessionId) host.sessions.pin(sessionId)
  }

  return jsxs('div', {
    className: 'hs-genui-card hs-genui-chart',
    children: [
      jsxs('div', {
        className: 'hs-genui-head',
        children: [
          jsxs('div', { className: 'hs-genui-title-wrap', children: [jsx(Codicon, { name: 'graph', size: '14px' }), jsx('span', { className: 'hs-genui-title', children: title })] }),
          jsx('button', {
            type: 'button',
            className: `hs-genui-pin-btn${pinned ? ' hs-active' : ''}`,
            onClick: keep,
            title: pinned ? 'Kept in dashboard' : 'Keep in dashboard',
            children: jsx(Codicon, { name: pinned ? 'pin' : 'pinned', size: '12px' })
          })
        ]
      }),
      data.length > 0 ? jsxs('div', {
        className: 'hs-genui-bars',
        children: data.map(d => jsxs('div', {
          className: 'hs-genui-bar-row',
          children: [
            jsx('span', { className: 'hs-genui-bar-label', children: d.label }),
            jsx('div', {
              className: 'hs-genui-bar-track',
              children: jsx('div', {
                className: 'hs-genui-bar-fill',
                style: { width: `${Math.min(100, Math.round((d.value / maxVal) * 100))}%` }
              })
            }),
            jsx('span', { className: 'hs-genui-bar-val', children: String(d.value) })
          ]
        }, d.label))
      }) : jsx('p', { className: 'hs-hint', children: 'No data points provided.' })
    ]
  })
}

function GenUIKpi({ attrs, sessionId }) {
  const label = attrs?.label || 'Metric'
  const value = attrs?.value || '0'
  const change = attrs?.change || null
  const isPositive = change && !change.startsWith('-')

  useEffect(() => {
    if (sessionId) recordArtifact(sessionId, { id: `kpi-${label}`, kind: 'kpi', title: `${label}: ${value}` })
  }, [sessionId, label, value])

  return jsxs('div', {
    className: 'hs-genui-card hs-genui-kpi',
    children: [
      jsx('span', { className: 'hs-genui-kpi-label', children: label }),
      jsxs('div', {
        className: 'hs-genui-kpi-val-row',
        children: [
          jsx('span', { className: 'hs-genui-kpi-val', children: value }),
          change && jsx('span', {
            className: `hs-genui-kpi-change ${isPositive ? 'hs-pos' : 'hs-neg'}`,
            children: `${isPositive ? '▲ ' : '▼ '}${change}`
          })
        ]
      })
    ]
  })
}

function GenUITable({ attrs, sessionId }) {
  const title = attrs?.title || 'Data Table'
  const headers = (attrs?.headers || '').split(',').map(h => h.trim()).filter(Boolean)
  const rows = (attrs?.rows || '').split(';').map(r => r.split(',').map(c => c.trim())).filter(r => r.length > 0 && r[0])
  const [sortCol, setSortCol] = useState(0)
  const [asc, setAsc] = useState(true)

  useEffect(() => {
    if (sessionId) recordArtifact(sessionId, { id: `table-${title}`, kind: 'table', title })
  }, [sessionId, title])

  const sorted = [...rows].sort((a, b) => {
    const v1 = a[sortCol] ?? ''
    const v2 = b[sortCol] ?? ''
    const num1 = parseFloat(v1)
    const num2 = parseFloat(v2)
    if (!isNaN(num1) && !isNaN(num2)) return asc ? num1 - num2 : num2 - num1
    return asc ? String(v1).localeCompare(String(v2)) : String(v2).localeCompare(String(v1))
  })

  const toggleSort = idx => {
    if (sortCol === idx) setAsc(!asc)
    else { setSortCol(idx); setAsc(true) }
  }

  return jsxs('div', {
    className: 'hs-genui-card hs-genui-table-wrap',
    children: [
      jsxs('div', {
        className: 'hs-genui-head',
        children: [
          jsx(Codicon, { name: 'table', size: '14px' }),
          jsx('span', { className: 'hs-genui-title', children: title })
        ]
      }),
      jsxs('table', {
        className: 'hs-genui-table',
        children: [
          jsx('thead', {
            children: jsx('tr', {
              children: headers.map((h, i) => jsx('th', {
                onClick: () => toggleSort(i),
                className: 'hs-genui-th',
                children: jsxs('span', {
                  className: 'hs-th-inner',
                  children: [h, sortCol === i ? (asc ? ' ↑' : ' ↓') : '']
                })
              }, i))
            })
          }),
          jsx('tbody', {
            children: sorted.map((row, rIdx) => jsx('tr', {
              children: row.map((cell, cIdx) => jsx('td', { children: cell }, cIdx))
            }, rIdx))
          })
        ]
      })
    ]
  })
}

function GenUICalculator({ attrs, sessionId }) {
  const title = attrs?.title || 'Interactive Calculator'
  const min = parseFloat(attrs?.min) || 0
  const max = parseFloat(attrs?.max) || 100
  const step = parseFloat(attrs?.step) || 1
  const unit = attrs?.unit || ''
  const rate = parseFloat(attrs?.rate) || 1.2
  const [val, setVal] = useState(parseFloat(attrs?.default) || (min + max) / 2)

  useEffect(() => {
    if (sessionId) recordArtifact(sessionId, { id: `calc-${title}`, kind: 'calculator', title })
  }, [sessionId, title])

  const result = Math.round(val * rate * 100) / 100

  return jsxs('div', {
    className: 'hs-genui-card hs-genui-calc',
    children: [
      jsxs('div', {
        className: 'hs-genui-head',
        children: [
          jsx(Codicon, { name: 'calculator', size: '14px' }),
          jsx('span', { className: 'hs-genui-title', children: title })
        ]
      }),
      jsxs('div', {
        className: 'hs-genui-calc-body',
        children: [
          jsxs('div', {
            className: 'hs-genui-slider-wrap',
            children: [
              jsx('input', {
                type: 'range',
                min, max, step,
                value: val,
                onChange: e => setVal(parseFloat(e.target.value)),
                className: 'hs-genui-slider'
              }),
              jsx('span', { className: 'hs-genui-slider-label', children: `${val}${unit}` })
            ]
          }),
          jsxs('div', {
            className: 'hs-genui-calc-res',
            children: [
              jsx('span', { className: 'hs-muted', children: 'Estimated output: ' }),
              jsx('strong', { children: `${result}${unit}` })
            ]
          })
        ]
      })
    ]
  })
}

function GenUIExplainer({ attrs, sessionId }) {
  const title = attrs?.title || 'Explainer'
  const steps = (attrs?.steps || '').split(';').map(s => s.trim()).filter(Boolean)
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (sessionId) recordArtifact(sessionId, { id: `explainer-${title}`, kind: 'explainer', title })
  }, [sessionId, title])

  return jsxs('div', {
    className: 'hs-genui-card hs-genui-explainer',
    children: [
      jsxs('div', {
        className: 'hs-genui-head',
        children: [
          jsx(Codicon, { name: 'mortar-board', size: '14px' }),
          jsx('span', { className: 'hs-genui-title', children: title })
        ]
      }),
      steps.length > 0 && jsxs('div', {
        className: 'hs-genui-explainer-body',
        children: [
          jsx('p', { className: 'hs-genui-step-text', children: steps[current] }),
          jsxs('div', {
            className: 'hs-genui-explainer-nav',
            children: [
              jsx(Button, {
                size: 'xs',
                variant: 'ghost',
                disabled: current <= 0,
                onClick: () => setCurrent(current - 1),
                children: 'Previous'
              }),
              jsx('span', { className: 'hs-muted', children: `${current + 1} / ${steps.length}` }),
              jsx(Button, {
                size: 'xs',
                variant: 'ghost',
                disabled: current >= steps.length - 1,
                onClick: () => setCurrent(current + 1),
                children: 'Next'
              })
            ]
          })
        ]
      })
    ]
  })
}

// ── Optional DOM decorators: logos on Hermes' own controls ──────────────────
// They only set a data attribute and paint with CSS; they never insert nodes
// into React-owned markup, and everything they set is removed on stop.

/** One body observer shared by every decorator, scanning at most once a frame. */
const scanners = new Set()
let domObserver = null
let scanQueued = false

function watchDom(scan) {
  scanners.add(scan)
  if (!domObserver) {
    domObserver = new MutationObserver(() => {
      if (scanQueued) return
      scanQueued = true
      requestAnimationFrame(() => {
        scanQueued = false
        scanners.forEach(fn => fn())
      })
    })
    // aria-label: the model pill's label changes on a provider switch with the same visible name.
    domObserver.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['aria-label'] })
  }
  scan()
  return () => {
    scanners.delete(scan)
    if (!scanners.size && domObserver) {
      domObserver.disconnect()
      domObserver = null
    }
  }
}

function injectRules(name, rules) {
  const style = document.createElement('style')
  style.dataset.heraldStyx = name
  style.textContent = rules.join('\n')
  document.head.appendChild(style)
  return style
}

function setMark(el, attr, want) {
  if (want && el.getAttribute(attr) !== want) el.setAttribute(attr, want)
  if (!want && el.hasAttribute(attr)) el.removeAttribute(attr)
}

const ROW_ATTR = 'data-hs-svc'

function startRowDecorator() {
  const rules = []
  const seen = new Set()
  for (const entry of LOGOS.services) {
    if (seen.has(entry.id) || !LOGOS.icons[entry.icon]) continue
    seen.add(entry.id)
    rules.push(`[${ROW_ATTR}="${entry.id}"]{background:url("${LOGOS.icons[entry.icon]}") center/contain no-repeat}`)
  }
  rules.push(`[${ROW_ATTR}]>*{visibility:hidden}`)
  const style = injectRules('rows', rules)

  const decorate = row => {
    const glyph = row.querySelector('button span.grid')
    const title = row.querySelector('button')?.textContent ?? ''
    if (!glyph) return
    // The row title is the gateway label ("GitHub · create issue") or the tool name.
    const entry = serviceLogo(title, title.split('·')[0])
    setMark(glyph, ROW_ATTR, entry && LOGOS.icons[entry.icon] ? entry.id : null)
  }
  const stop = watchDom(() => document.querySelectorAll('[data-slot="tool-block"][data-tool-row]').forEach(decorate))

  return () => {
    stop()
    style.remove()
    document.querySelectorAll(`[${ROW_ATTR}]`).forEach(el => el.removeAttribute(ROW_ATTR))
  }
}

const PILL_ATTR = 'data-hs-model'

/** Model and provider of a composer model pill. Its aria-label is Hermes'
 *  `modelTitle(provider, model)` ("Model · Anthropic: claude-opus-5", localized
 *  prefix, optional " — pinned" suffix). Without a live model menu the label is
 *  "Open model picker"; then the visible name ("Opus 5") is all there is. */
export function pillModel(ariaLabel, text) {
  const label = String(ariaLabel ?? '').split(' — ')[0]
  // ": " (French " : ", CJK "："), not a bare colon: ids like "qwen3:8b" and
  // providers like "custom:box" carry one.
  const sep = /\s?: |：/.exec(label)
  if (sep) {
    const model = label.slice(sep.index + sep[0].length).trim()
    const provider = label.slice(0, sep.index).split(' · ').pop().trim()
    if (model) return { model, provider }
  }
  return { model: String(text ?? '').trim(), provider: '' }
}

function startPillDecorator() {
  const rules = [`button[${PILL_ATTR}]::before{content:"";display:block;flex:none;width:14px;height:14px;background:center/contain no-repeat}`]
  const seen = new Set()
  for (const entry of LOGOS.models) {
    if (seen.has(entry.id) || !LOGOS.icons[entry.icon]) continue
    seen.add(entry.id)
    rules.push(`button[${PILL_ATTR}="${entry.id}"]::before{background-image:url("${LOGOS.icons[entry.icon]}")}`)
  }
  const style = injectRules('pill', rules)

  const scan = () => {
    // The model pill is the composer button that starts with the truncating
    // name span and ends with the chevron svg (model-pill.tsx). Compact pills
    // (chevron only) and the loading spinner have no name, so no logo.
    document.querySelectorAll('[data-slot="composer-root"] button').forEach(button => {
      const name = button.firstElementChild
      const isPill = name?.tagName === 'SPAN' && name.classList.contains('truncate') &&
        button.lastElementChild?.tagName.toLowerCase() === 'svg'
      if (!isPill) return setMark(button, PILL_ATTR, null)
      const { model, provider } = pillModel(button.getAttribute('aria-label'), name.textContent)
      const entry = modelLogo(model, provider) ?? modelLogo(name.textContent)
      setMark(button, PILL_ATTR, entry && LOGOS.icons[entry.icon] ? entry.id : null)
    })
  }
  const stop = watchDom(scan)

  return () => {
    stop()
    style.remove()
    document.querySelectorAll(`[${PILL_ATTR}]`).forEach(el => el.removeAttribute(PILL_ATTR))
  }
}

function startScrollOnSwitch() {
  const snap = el => {
    if (el) el.scrollTop = el.scrollHeight
  }
  const check = () => {
    document.querySelectorAll('[data-slot="aui_thread-viewport"]').forEach(el => {
      if (!el.closest('[data-pane-hidden]')) snap(el)
    })
  }
  return watchDom(check)
}

// ── Styles (theme variables only) ───────────────────────────────────────────

const STYLES = `
.hs-panel{display:flex;flex-direction:column;height:100%;min-height:0;font-size:12px;color:var(--ui-text-secondary)}
.hs-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border-bottom:1px solid var(--ui-stroke-tertiary)}
.hs-head-text{display:flex;flex-direction:column;min-width:0}
.hs-title{font-weight:600;color:var(--ui-text-primary)}
.hs-sub{color:var(--ui-text-tertiary);font-variant-numeric:tabular-nums}
.hs-scroll{flex:1;min-height:0;overflow:auto;padding:6px 10px 12px}
.hs-section{margin-top:10px}
.hs-section-title{display:flex;align-items:center;justify-content:space-between;margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:var(--ui-text-tertiary)}
.hs-count{font-weight:400;text-transform:none;letter-spacing:0;font-variant-numeric:tabular-nums}
.hs-steps,.hs-todos{list-style:none;margin:0;padding:0}
.hs-step{display:grid;grid-template-columns:16px minmax(0,1fr) auto;align-items:start;gap:8px;padding:4px 0;border-bottom:1px solid var(--ui-stroke-tertiary)}
.hs-step:last-child{border-bottom:0}
.hs-step-icon{display:grid;place-items:center;height:16px}
.hs-logo{display:block;flex:none;object-fit:contain}
.hs-glyph{color:var(--ui-text-tertiary)}
.hs-step-body{display:flex;flex-direction:column;min-width:0}
.hs-step-title{color:var(--ui-text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hs-step-detail{color:var(--ui-text-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--font-mono,ui-monospace,monospace);font-size:11px}
.hs-step-meta{display:flex;flex-direction:column;align-items:flex-end;font-size:11px;font-variant-numeric:tabular-nums;color:var(--ui-text-tertiary)}
.hs-step[data-status="failed"] .hs-status{color:var(--ui-red,var(--ui-text-primary));font-weight:600}
.hs-step[data-status="running"] .hs-status{color:var(--ui-text-primary)}
.hs-todos li{display:flex;gap:6px;padding:2px 0}
.hs-todos li[data-status="completed"]{color:var(--ui-text-tertiary);text-decoration:line-through}
.hs-todos li[data-status="in_progress"]{color:var(--ui-text-primary);font-weight:500}
.hs-todo-mark{width:12px;flex:none;text-align:center}
.hs-sources{display:flex;flex-wrap:wrap;gap:4px}
.hs-chip{display:inline-flex;align-items:center;gap:4px;max-width:100%;padding:1px 6px;border:1px solid var(--ui-stroke-tertiary);border-radius:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hs-muted,.hs-hint{color:var(--ui-text-tertiary)}
.hs-hint{font-size:11px;margin:4px 0 0}
.hs-queries{flex-basis:100%;margin:2px 0 0;color:var(--ui-text-tertiary)}
.hs-empty{display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:16px 10px;color:var(--ui-text-tertiary)}
.hs-empty p{margin:0}
.hs-approval{margin-top:8px;padding:8px;border:1px solid var(--ui-stroke-secondary);border-radius:8px}
.hs-approval-head{display:flex;align-items:center;gap:6px;font-weight:600;color:var(--ui-text-primary)}
.hs-approval-desc{margin:4px 0 0}
.hs-approval-cmd{margin:6px 0 0;padding:6px;max-height:120px;overflow:auto;border-radius:6px;background:var(--ui-bg-input,transparent);border:1px solid var(--ui-stroke-tertiary);font-size:11px;white-space:pre-wrap;word-break:break-word}
.hs-approval-actions{display:flex;justify-content:flex-end;gap:6px;margin-top:8px}
.hs-error{margin:6px 0 0;color:var(--ui-red,var(--ui-text-primary))}
.hs-more{margin-bottom:4px}
.hs-chip-btn{display:inline-flex;height:100%;align-items:center;gap:4px;padding:0 6px;font-size:11px;color:var(--ui-text-tertiary);background:none;border:0;cursor:pointer}
.hs-chip-btn:hover{color:var(--ui-text-primary);background:var(--chrome-action-hover)}
.hs-chip-btn:focus-visible{outline:2px solid var(--ui-accent,currentColor);outline-offset:-2px}
.hs-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.hs-status-wrap{display:inline-flex;align-items:center;gap:4px}
.hs-step-break{display:inline-flex;align-items:center;justify-content:center;padding:1px;border:0;border-radius:3px;background:none;color:var(--ui-text-tertiary);cursor:pointer}
.hs-step-break:hover{color:var(--ui-red,var(--ui-text-primary));background:var(--chrome-action-hover)}
.hs-step.hs-stalled .hs-status{color:var(--ui-warning,#f59e0b);font-weight:600}
.hs-session-dot-btn{display:inline-flex;align-items:center;justify-content:center;padding:2px;border:0;background:none;cursor:pointer}
.hs-session-dot{width:8px;height:8px;border-radius:50%;border:1px solid var(--ui-stroke-secondary);display:inline-block}
.hs-prompt-wrap{position:relative;display:inline-flex;align-items:center}
.hs-prompt-popover{position:absolute;bottom:100%;right:0;margin-bottom:4px;display:flex;flex-direction:column;gap:1px;padding:4px;background:var(--ui-bg-elevated,var(--ui-bg-input,#202020));border:1px solid var(--ui-stroke-tertiary);border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,.25);z-index:100;min-width:160px}
.hs-prompt-item{display:flex;align-items:center;padding:4px 8px;font-size:11px;color:var(--ui-text-primary);background:none;border:0;border-radius:4px;text-align:left;cursor:pointer}
.hs-prompt-item:hover{background:var(--chrome-action-hover)}
.hs-genui-card{margin:8px 0;padding:10px;border-radius:8px;border:1px solid var(--ui-stroke-tertiary);background:var(--ui-bg-surface,var(--ui-bg-input,transparent));font-size:12px}
.hs-genui-head{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:8px;font-weight:600;color:var(--ui-text-primary)}
.hs-genui-title-wrap{display:flex;align-items:center;gap:6px}
.hs-genui-pin-btn{display:inline-flex;align-items:center;padding:2px 4px;border:0;border-radius:4px;background:none;color:var(--ui-text-tertiary);cursor:pointer}
.hs-genui-pin-btn:hover,.hs-genui-pin-btn.hs-active{color:var(--ui-accent,currentColor);background:var(--chrome-action-hover)}
.hs-genui-bars{display:flex;flex-direction:column;gap:6px}
.hs-genui-bar-row{display:grid;grid-template-columns:80px minmax(0,1fr) 50px;align-items:center;gap:8px}
.hs-genui-bar-label{color:var(--ui-text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hs-genui-bar-track{height:8px;border-radius:4px;background:var(--ui-stroke-tertiary);overflow:hidden}
.hs-genui-bar-fill{height:100%;background:var(--ui-accent,#3b82f6);border-radius:4px}
.hs-genui-bar-val{text-align:right;font-variant-numeric:tabular-nums;color:var(--ui-text-tertiary)}
.hs-genui-kpi{display:flex;flex-direction:column;gap:4px}
.hs-genui-kpi-label{font-size:11px;text-transform:uppercase;color:var(--ui-text-tertiary);font-weight:600}
.hs-genui-kpi-val-row{display:flex;align-items:baseline;gap:8px}
.hs-genui-kpi-val{font-size:20px;font-weight:700;color:var(--ui-text-primary)}
.hs-genui-kpi-change{font-size:11px;font-weight:600}
.hs-genui-kpi-change.hs-pos{color:var(--ui-green,#10b981)}
.hs-genui-kpi-change.hs-neg{color:var(--ui-red,#ef4444)}
.hs-genui-table{width:100%;border-collapse:collapse;font-size:11px}
.hs-genui-th{text-align:left;padding:4px 6px;border-bottom:1px solid var(--ui-stroke-tertiary);color:var(--ui-text-tertiary);cursor:pointer}
.hs-genui-th:hover{color:var(--ui-text-primary)}
.hs-genui-table td{padding:4px 6px;border-bottom:1px solid var(--ui-stroke-secondary)}
.hs-genui-calc-body{display:flex;flex-direction:column;gap:8px}
.hs-genui-slider-wrap{display:flex;align-items:center;gap:8px}
.hs-genui-slider{flex:1}
.hs-genui-slider-label{min-width:40px;font-weight:600;font-variant-numeric:tabular-nums}
.hs-genui-calc-res{font-size:12px;color:var(--ui-text-primary)}
.hs-genui-explainer-body{display:flex;flex-direction:column;gap:8px}
.hs-genui-step-text{margin:0;line-height:1.4}
.hs-genui-explainer-nav{display:flex;align-items:center;justify-content:space-between}
.hs-artifact-row{border-bottom:1px dashed var(--ui-stroke-tertiary)}
`

// ── Plugin ──────────────────────────────────────────────────────────────────

const DEFAULT_PREFS = {
  panelOpen: false,
  showChip: true,
  rowLogos: true,
  pillLogo: true,
  reasoningSwitch: true,
  scrollOnSwitch: true,
  promptEnhance: true,
  sessionAppearance: true,
  genUI: true
}

export default {
  id: ID,
  name: 'Herald Styx UI',
  description: 'Model and service logos, and a live agent panel: steps, plan, sources, sub-agents, approvals.',
  register(ctx) {
    const prefs = atom({ ...DEFAULT_PREFS, ...ctx.storage.get('prefs', {}) })
    const update = patch => {
      prefs.set({ ...prefs.get(), ...patch })
      ctx.storage.set('prefs', prefs.get())
    }

    const style = document.createElement('style')
    style.dataset.heraldStyx = 'base'
    style.textContent = STYLES
    document.head.appendChild(style)
    ctx.onDispose(() => style.remove())

    if (typeof window !== 'undefined') window.__heraldStyx = __internals
    ctx.onDispose(() => {
      if (window.__heraldStyx === __internals) delete window.__heraldStyx
    })

    // A turn whose terminal frame never arrives (socket dropped, backend
    // respawned) would read "Working for…" forever. Hermes downgrades its own
    // per-session busy flag in those cases, so end any trace Hermes has
    // reported idle for IDLE_GRACE_MS. The grace covers the send → busy gap.
    const busy = host.state.busyBySession
    const idleTimers = new Map()
    const reconcileIdle = () => {
      const states = busy?.get?.()
      if (!states) return
      for (const [sid, trace] of traces) {
        if (!(trace.running && states[sid] === false)) {
          idleTimers.get(sid)?.()
          idleTimers.delete(sid)
        } else if (!idleTimers.has(sid)) {
          idleTimers.set(sid, ctx.setTimeout(() => {
            idleTimers.delete(sid)
            const current = traces.get(sid)
            if (current?.running && busy.get()?.[sid] === false) {
              finishTrace(current, 'stopped')
              $version.set($version.get() + 1)
            }
          }, IDLE_GRACE_MS))
        }
      }
    }
    if (typeof busy?.subscribe === 'function') ctx.onDispose(busy.subscribe(reconcileIdle))
    ctx.onDispose(() => idleTimers.forEach(cancel => cancel()))

    // Event intake, drawn at most ~4x a second.
    let pending = false
    ctx.onEvent('*', event => {
      if (!applyEvent(event)) return
      // A turn can start while Hermes still reports the session idle.
      reconcileIdle()
      if (!pending) {
        pending = true
        ctx.setTimeout(() => {
          pending = false
          $version.set($version.get() + 1)
        }, 250)
      }
    })

    // The pane is registered only while open: a closed panel leaves no tab, and
    // a single-pane plugin's tab Close would otherwise switch the whole plugin off.
    let disposePane = null
    const openPane = () => {
      if (!disposePane) {
        disposePane = ctx.register({
          id: 'panel',
          area: 'panes',
          title: 'Agent',
          data: { placement: 'main', dock: { pane: 'workspace', pos: 'right' }, width: '340px', uncloseable: true },
          render: () => jsx(AgentPanel, { onClose: () => setOpen(false) })
        })
      }
      if (typeof host.undismissPane === 'function') host.undismissPane(PANE_ID)
      if (typeof host.revealPane === 'function') host.revealPane(PANE_ID)
    }
    const setOpen = open => {
      update({ panelOpen: open })
      if (open) openPane()
      else if (disposePane) {
        disposePane()
        disposePane = null
      }
    }
    const toggle = () => setOpen(!prefs.get().panelOpen)
    if (prefs.get().panelOpen) openPane()
    ctx.onDispose(() => disposePane?.())

    ctx.register({
      id: 'toggle-panel',
      area: PALETTE_AREA,
      data: {
        id: 'toggle-panel',
        label: 'Herald Styx UI: Toggle agent panel',
        keywords: ['agent', 'trace', 'steps', 'subagent', 'approval', 'panel'],
        detail: () => (prefs.get().panelOpen ? 'open' : 'closed'),
        detailVariant: 'state',
        run: toggle
      }
    })

    ctx.register({
      id: 'model-chip',
      area: STATUSBAR_AREAS.right,
      order: 120,
      render: () => jsx(ModelChip, { prefs, onToggle: toggle })
    })

    ctx.register({
      id: 'reasoning-chip',
      area: STATUSBAR_AREAS.right,
      order: 115,
      render: () => jsx(ReasoningChip, { prefs })
    })

    if (COMPOSER_AREAS?.actions) {
      ctx.register({
        id: 'prompt-enhance',
        area: COMPOSER_AREAS.actions,
        order: 85,
        render: () => jsx(PromptEnhanceAction, { prefs })
      })
    }

    if (SESSION_ROW_AREAS?.trailing) {
      ctx.register({
        id: 'session-row-color',
        area: SESSION_ROW_AREAS.trailing,
        render: ({ sessionId }) => (prefs.get().sessionAppearance ? jsx(SessionRowTrailing, { sessionId, storage: ctx.storage }) : null)
      })
    }

    ctx.register({
      id: 'model-menu-logos',
      area: MODEL_MENU_ROW_AREA,
      data: {
        decorate: ({ model, provider }) => {
          const entry = modelLogo(model, provider)
          return entry && LOGOS.icons[entry.icon] ? { icon: jsx(Logo, { entry, size: 16 }) } : null
        }
      }
    })


    if (TRANSCRIPT_DIRECTIVE_AREA) {
      const directives = [
        { name: 'chart', render: GenUIChart },
        { name: 'kpi', render: GenUIKpi },
        { name: 'table', render: GenUITable },
        { name: 'calc', render: GenUICalculator },
        { name: 'explainer', render: GenUIExplainer },
        { name: 'blocks', render: GenUIChart }
      ]
      directives.forEach(d => {
        ctx.register({
          id: `genui-${d.name}`,
          area: TRANSCRIPT_DIRECTIVE_AREA,
          data: {
            name: d.name,
            render: props => (prefs.get().genUI ? jsx(d.render, { attrs: props.attrs, sessionId: props.sessionId, streaming: props.streaming }) : null)
          }
        })
      })
    }
    const decorators = [
      { pref: 'rowLogos', start: startRowDecorator, stop: null },
      { pref: 'pillLogo', start: startPillDecorator, stop: null },
      { pref: 'scrollOnSwitch', start: startScrollOnSwitch, stop: null }
    ]
    const syncDecorators = () => {
      for (const d of decorators) {
        const on = !!prefs.get()[d.pref]
        if (on && !d.stop) d.stop = d.start()
        if (!on && d.stop) {
          d.stop()
          d.stop = null
        }
      }
    }
    syncDecorators()
    ctx.onDispose(prefs.subscribe(syncDecorators))
    ctx.onDispose(() => decorators.forEach(d => d.stop?.()))

    ctx.registerSettingsPage?.({
      id: 'settings',
      title: 'Herald Styx UI',
      icon: 'pulse',
      render: function HeraldStyxSettings() {
        const p = useValue(prefs)
        return jsxs('div', {
          children: [
            jsx(ToggleRow, {
              checked: p.panelOpen, label: 'Agent panel',
              description: 'Right-hand pane with the focused chat\'s steps, plan, sources, sub-agents and approvals.',
              onChange: setOpen
            }, 'panelOpen'),
            jsx(ToggleRow, {
              checked: p.showChip, label: 'Model chip in the status bar',
              description: 'Logo and name of the model in use. Click it to toggle the agent panel.',
              onChange: on => update({ showChip: on })
            }, 'showChip'),
            jsx(ToggleRow, {
              checked: p.reasoningSwitch, label: 'Reasoning effort switch in status bar',
              description: 'Cycles reasoning effort (none, low, med, high) per session with one click from the status bar.',
              onChange: on => update({ reasoningSwitch: on })
            }, 'reasoningSwitch'),
            jsx(ToggleRow, {
              checked: p.scrollOnSwitch, label: 'Scroll on session switch',
              description: 'Automatically snaps transcript scroll to the newest message when switching to a session tab.',
              onChange: on => update({ scrollOnSwitch: on })
            }, 'scrollOnSwitch'),
            jsx(ToggleRow, {
              checked: p.promptEnhance, label: 'Prompt enhancement templates',
              description: 'Adds quick task templates (explain, review, test, refactor) to the chat composer.',
              onChange: on => update({ promptEnhance: on })
            }, 'promptEnhance'),
            jsx(ToggleRow, {
              checked: p.sessionAppearance, label: 'Session color tags in sidebar',
              description: 'Clickable color dot on session rows in the sidebar to organize sessions visually.',
              onChange: on => update({ sessionAppearance: on })
            }, 'sessionAppearance'),
            jsx(ToggleRow, {
              checked: p.pillLogo, label: 'Logo on the composer model pill',
              description: 'Shows the model\'s logo beside its name in each chat\'s composer. Reads the pill\'s label, so a Hermes update that changes it can hide the logo.',
              onChange: on => update({ pillLogo: on })
            }, 'pillLogo'),
            jsx(ToggleRow, {
              checked: p.rowLogos, label: 'Logos on chat tool rows',
              description: 'Replaces the generic icon on tool rows that belong to a known service. Reads the row title, so it can miss a tool Hermes labels differently.',
              onChange: on => update({ rowLogos: on })
            }, 'rowLogos'),
            jsx(ToggleRow, {
              checked: p.genUI, label: 'Interactive GenUI blocks in chat',
              description: 'Renders charts, KPI cards, sortable tables, calculators, and explainers directly inside chat responses.',
              onChange: on => update({ genUI: on })
            }, 'genUI')
          ]
        })
      }
    })
  }
}
