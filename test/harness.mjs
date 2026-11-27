// Harness: loads dist/plugin.js against a mock @hermes/plugin-sdk, renders the
// real React tree in jsdom, feeds gateway events shaped like the generated
// contract (apps/shared/src/gateway-contract.generated.ts), and checks output.
//   node test/harness.mjs
import { build } from 'esbuild'
import { JSDOM } from 'jsdom'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>', { pretendToBeVisual: true })
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, MutationObserver: dom.window.MutationObserver,
  requestAnimationFrame: fn => setTimeout(fn, 0), CSS: { escape: s => String(s).replace(/"/g, '\\"') },
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node
})
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mockSdk = `
import { atom } from 'nanostores'
import { useStore } from '@nanostores/react'
import { jsx, jsxs } from 'react/jsx-runtime'
export { atom }
export const useValue = useStore
export const APPROVAL_RESPOND_TIMEOUT_MS = 300000
export const PALETTE_AREA = 'palette'
export const MODEL_MENU_ROW_AREA = 'modelMenu.row'
export const STATUSBAR_AREAS = { left: 'statusBar.left', right: 'statusBar.right' }
export const COMPOSER_AREAS = { actions: 'composer.actions', top: 'composer.top', leading: 'composer.leading' }
export const SESSION_ROW_AREAS = { leading: 'sessionRow.leading', trailing: 'sessionRow.trailing' }
export const Codicon = ({ name }) => jsx('i', { 'data-codicon': name })
export const Tip = ({ children }) => children
export const Button = ({ children, onClick, disabled, ...rest }) => jsx('button', { onClick, disabled, 'aria-label': rest['aria-label'], children })
export const ToggleRow = ({ label, checked, onChange }) => jsxs('label', { children: [label, jsx('input', { type: 'checkbox', checked, onChange: e => onChange(e.target.checked) })] })
export const requests = (globalThis.__hsRequests = [])
export const host = {
  state: {
    focusedSessionId: atom('s1'), model: (globalThis.__hsModel = atom('openrouter/anthropic/claude-opus-4.5')),
    busyBySession: (globalThis.__hsBusy = atom({}))
  },
  composer: {
    insertText: async (sid, text) => { (globalThis.__hsDraft = (globalThis.__hsDraft || '') + text); return true },
    getDraft: async sid => globalThis.__hsDraft || '',
    setDraft: async (sid, text) => { globalThis.__hsDraft = text }
  },
  sessions: {
    setColor: (sid, color) => { (globalThis.__hsSessionColors = globalThis.__hsSessionColors || {})[sid] = color }
  },
  request: async (method, params) => { requests.push({ method, params }); return {} },
  undismissPane: () => {}, revealPane: () => {}
}
`
writeFileSync(join(root, 'test', '.sdk-mock.mjs'), mockSdk)

const out = await build({
  entryPoints: [join(root, 'dist', 'plugin.js')], bundle: true, format: 'esm', write: false, platform: 'node',
  alias: { '@hermes/plugin-sdk': join(root, 'test', '.sdk-mock.mjs') },
  external: ['react', 'react/*', 'react-dom', 'react-dom/*'], logLevel: 'error'
})
const bundlePath = join(root, 'test', '.bundle.mjs')
writeFileSync(bundlePath, out.outputFiles[0].text)
const mod = await import(pathToFileURL(bundlePath).href)
const plugin = mod.default
const { applyEvent, traces, modelLogo, serviceLogo, hostLogo, resultFailed } = mod.__internals

const React = await import('react')
const { createRoot } = await import('react-dom/client')
const { act } = React

let failures = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
  if (!ok) failures += 1
}

// 1. Logo matching
check('model: openrouter/anthropic/claude → claude', modelLogo('openrouter/anthropic/claude-opus-4.5')?.id === 'claude')
check('model: gpt-5.5 → openai', modelLogo('gpt-5.5')?.id === 'openai')
check('model: deepseek-v4.1-flash → deepseek', modelLogo('deepseek-v4.1-flash')?.id === 'deepseek')
check('model: auto/best-coding → none (router alias)', modelLogo('auto/best-coding') === null)
check('model: provider fallback openrouter', modelLogo('some-model', 'openrouter')?.id === 'openrouter')
check('service: mcp__github__create_issue → github', serviceLogo('mcp__github__create_issue')?.id === 'github')
check('service: label app "Gmail" → gmail', serviceLogo('connectors__x__y', 'Gmail')?.id === 'gmail')
check('service: mcp__omniroute__obsidian_read_note → obsidian', serviceLogo('mcp__omniroute__obsidian_read_note')?.id === 'obsidian')
check('service: terminal → none', serviceLogo('terminal') === null)
check('host: https://www.youtube.com/watch → youtube', hostLogo('https://www.youtube.com/watch?v=1')?.id === 'youtube')
check('host: netflix.com is not X', hostLogo('https://www.netflix.com/browse') === null)
check('host: nonlinear.io is not Linear', hostLogo('nonlinear.io') === null)
check('host: x.com and api.x.com → x', hostLogo('https://x.com/a')?.id === 'x' && hostLogo('api.x.com')?.id === 'x')
check('host: linear.app → linear', hostLogo('https://linear.app/t')?.id === 'linear')
check('host: docs.github.com → github', hostLogo('docs.github.com')?.id === 'github')
check('failure: exit_code 1', resultFailed({ result: { exit_code: 1 } }))
check('failure: exit_code 130 is a stop, not failure', !resultFailed({ result: { exit_code: 130 } }))
check('failure: {error:"x"}', resultFailed({ result: { error: 'boom' } }))
check('failure: plain string result is ok', !resultFailed({ result: 'ok' }))

// 2. Register against a fake ctx
const registry = []
const disposers = []
const storage = new Map()
const ctx = {
  register: c => { registry.push(c); return () => registry.splice(registry.indexOf(c), 1) },
  registerSettingsPage: page => { registry.push({ area: 'settings', ...page }); return () => {} },
  onDispose: fn => disposers.push(fn),
  onEvent: (type, fn) => { ctx._listener = fn; return () => {} },
  // Long timers (the 8s idle grace) are compressed so the harness stays fast.
  setTimeout: (fn, ms) => { const t = setTimeout(fn, ms > 1000 ? 40 : ms); return () => clearTimeout(t) },
  storage: { get: (k, f) => (storage.has(k) ? storage.get(k) : f), set: (k, v) => storage.set(k, v), remove: k => storage.delete(k) }
}
plugin.register(ctx)
const areas = registry.map(c => c.area)
check('registers palette command', areas.includes('palette'))
check('registers status-bar chip', areas.includes('statusBar.right'))
check('registers reasoning chip', registry.some(c => c.id === 'reasoning-chip'))
check('registers prompt enhance action', registry.some(c => c.id === 'prompt-enhance'))
check('registers session row trailing', registry.some(c => c.id === 'session-row-color'))
check('registers model-menu decorator', areas.includes('modelMenu.row'))
check('registers settings page', areas.includes('settings'))
check('pane not registered while closed', !areas.includes('panes'))
check('base stylesheet injected', !!document.querySelector('style[data-herald-styx="base"]'))

const decorator = registry.find(c => c.area === 'modelMenu.row').data
check('model-menu: claude row gets an icon', !!decorator.decorate({ label: 'Opus', model: 'claude-opus-4.5', provider: 'anthropic' })?.icon)
check('model-menu: unknown row declines', decorator.decorate({ label: 'x', model: 'auto/best-coding', provider: 'thir13teen-omniroute' }) === null)

// 3. Open the panel via the palette and render it
registry.find(c => c.area === 'palette').data.run()
const pane = registry.find(c => c.area === 'panes')
check('palette toggle registers the pane', !!pane)
check('pane is uncloseable and docks right of workspace', pane?.data.uncloseable === true && pane?.data.dock?.pos === 'right')
check('open state persisted', storage.get('prefs')?.panelOpen === true)

const container = document.getElementById('root')
const reactRoot = createRoot(container)
await act(async () => reactRoot.render(pane.render()))
check('empty state shows before any event', container.textContent.includes('No steps seen'))

// 4. A realistic turn
const ev = (type, payload, seq) => ({ type, session_id: 's1', seq, payload })
const events = [
  ev('message.start', { turn_id: 't1' }, 1),
  ev('reasoning.delta', { text: 'Need to check the repo first.' }, 2),
  ev('tool.start', { tool_id: 'c1', name: 'web_search', context: 'hermes desktop themes', args: { query: 'hermes desktop themes' } }, 3),
  ev('tool.complete', { tool_id: 'c1', name: 'web_search', duration_s: 1.42, args: { query: 'hermes desktop themes' }, result: { results: [] } }, 4),
  ev('tool.start', { tool_id: 'c2', name: 'web_extract', args: { urls: ['https://github.com/a/b', 'https://www.youtube.com/watch?v=1'] } }, 5),
  ev('tool.complete', { tool_id: 'c2', name: 'web_extract', duration_s: 0.8, args: { urls: ['https://github.com/a/b', 'https://www.youtube.com/watch?v=1'] }, result: 'ok' }, 6),
  ev('tool.start', { tool_id: 'c3', name: 'mcp__github__create_issue', labels: [{ kind: 'mcp', app: 'GitHub', action: 'create issue', name: 'mcp__github__create_issue', emoji: '', text: '' }] }, 7),
  ev('tool.complete', { tool_id: 'c3', name: 'mcp__github__create_issue', duration_s: 2.1, result: { error: 'Bad credentials' } }, 8),
  ev('tool.start', { tool_id: 'c4', name: 'tool_call', labels: [
    { kind: 'connector', app: 'Gmail', action: 'fetch emails', name: 'connectors__gmail__fetch', emoji: '', text: '' },
    { kind: 'connector', app: 'Notion', action: 'search', name: 'connectors__notion__search', emoji: '', text: '' }] }, 9),
  ev('tool.complete', { tool_id: 'c4', name: 'tool_call', duration_s: 3, result: { results: [{ ok: 1 }, { error: 'not connected' }] } }, 10),
  ev('todo.updated', { revision: 1, todos: [
    { id: '1', content: 'Read README', status: 'completed' },
    { id: '2', content: 'Build plugin', status: 'in_progress' },
    { id: '3', content: 'Bad', status: 'weird' }] }, 11),
  ev('subagent.start', { goal: 'Survey theme repos', task_count: 1, task_index: 0, subagent_id: 'sa1', model: 'deepseek-v4.1-flash' }, 12),
  ev('subagent.tool', { goal: 'Survey theme repos', task_count: 1, task_index: 0, subagent_id: 'sa1', tool_name: 'web_search' }, 13),
  ev('tool.start', { tool_id: 'c5', name: 'terminal', context: 'rm -rf build' }, 14),
  ev('approval.request', { prompt_id: 'p1', request_id: 'p1', command: 'rm -rf build', description: 'Delete build folder' }, 15)
]
events.forEach(e => ctx._listener(e))
await act(async () => { await new Promise(r => setTimeout(r, 300)) })
const text = container.textContent
const trace = traces.get('s1')

check('header shows Working for', text.includes('Working for'))
check('thinking step drawn', text.includes('Thinking') && text.includes('Need to check'))
check('web_search done with duration', trace.steps.find(s => s.toolId === 'c1')?.status === 'done' && text.includes('1.4s'))
check('github step failed via result.error', trace.steps.find(s => s.toolId === 'c3')?.status === 'failed')
check('github step titled from label', text.includes('GitHub · create issue'))
const c4 = trace.steps.filter(s => s.toolId === 'c4')
check('bridged tool_call split into 2 steps', c4.length === 2, c4.map(s => s.title).join(' | '))
check('bridged inner results: gmail done, notion failed', c4[0]?.status === 'done' && c4[1]?.status === 'failed')
check('sources: github.com + youtube.com', trace.sources.has('github.com') && trace.sources.has('youtube.com'))
check('query listed once (start + complete dedupe)', text.includes('Searched: hermes desktop themes') && trace.queries.length === 1, JSON.stringify(trace.queries))
check('plan: invalid todo dropped, 1/2', text.includes('1/2') && !text.includes('Bad'))
check('plan: status text for screen readers', text.includes('in progress: '))
check('sub-agent row', text.includes('Survey theme repos') && text.includes('deepseek-v4.1-flash'))
check('approval card visible', text.includes('Approval needed') && text.includes('rm -rf build'))
check('logos rendered as <img data:svg>', container.querySelectorAll('img.hs-logo[src^="data:image/svg+xml"]').length >= 4,
  `${container.querySelectorAll('img.hs-logo').length} logos`)
const requests = globalThis.__hsRequests
const stepBreakBtn = container.querySelector('button.hs-step-break')
check('running step has break button', !!stepBreakBtn)
if (stepBreakBtn) {
  await act(async () => { stepBreakBtn.click(); await new Promise(r => setTimeout(r, 10)) })
  check('break button sends session.interrupt', requests.some(r => r.method === 'session.interrupt' && r.params.session_id === 's1'))
}
const stats = mod.__internals.statsFor('s1')
check('cumulative turn and step counters track work', stats.turns >= 1 && stats.steps >= 4, `${stats.turns} turns, ${stats.steps} steps`)
// 5. Approval without Hermes' card on screen → approval.respond
const allow = [...container.querySelectorAll('button')].find(b => b.textContent === 'Allow once')
await act(async () => { allow.click(); await new Promise(r => setTimeout(r, 10)) })
check('Allow once → approval.respond {choice:once}', requests.some(r => r.method === 'approval.respond' && r.params.choice === 'once' && r.params.request_id === 'p1'))

// 6. Approval with Hermes' card on screen → presses Hermes' own button instead
let pressed = ''
const card = document.createElement('div')
card.innerHTML = '<div data-slot="tool-approval-card" data-request-id="p1"><div data-slot="tool-approval-actions"><button data-approval-deny="">Deny</button><button aria-label="More options">Always…</button><button id="h-allow" data-approval-run="">Run</button></div></div>'
document.body.appendChild(card)
card.querySelector('#h-allow').addEventListener('click', () => { pressed = 'allow' })
const before = requests.length
await act(async () => { [...container.querySelectorAll('button')].find(b => b.textContent === 'Allow once').click(); await new Promise(r => setTimeout(r, 10)) })
check('with Hermes card present: clicks its Allow, no extra RPC', pressed === 'allow' && requests.length === before)
// Hermes reorders its buttons: the plugin must still press Run, not the last button.
pressed = ''
const actions = card.querySelector('[data-slot="tool-approval-actions"]')
actions.appendChild(actions.querySelector('[aria-label="More options"]'))
actions.querySelector('[aria-label="More options"]').addEventListener('click', () => { pressed = 'more' })
document.body.appendChild(card)
await act(async () => { [...container.querySelectorAll('button')].find(b => b.textContent === 'Allow once').click(); await new Promise(r => setTimeout(r, 10)) })
check('reordered Hermes card: still presses data-approval-run', pressed === 'allow', pressed)
let denied = false
card.querySelector('[data-approval-deny]').addEventListener('click', () => { denied = true })
await act(async () => { [...container.querySelectorAll('button')].find(b => b.textContent === 'Deny').click(); await new Promise(r => setTimeout(r, 10)) })
check('Deny presses Hermes data-approval-deny', denied && requests.length === before)
card.remove()

ctx._listener(ev('approval.settled', { prompt_id: 'p1', request_id: 'p1' }, 16))
ctx._listener(ev('subagent.complete', { goal: 'Survey theme repos', task_count: 1, task_index: 0, subagent_id: 'sa1', status: 'completed', duration_seconds: 42 }, 17))
ctx._listener(ev('message.complete', { status: 'complete' }, 18))
await act(async () => { await new Promise(r => setTimeout(r, 300)) })
const after = container.textContent
check('approval card gone after settled', !after.includes('Approval needed'))
check('terminal left running → stopped at turn end', trace.steps.find(s => s.toolId === 'c5')?.status === 'stopped')
check('sub-agent done 42s', trace.subagents.get('sa1')?.status === 'done' && after.includes('42s'))
check('header shows Worked for', after.includes('Worked for'))

// 7. Next turn resets
ctx._listener(ev('message.start', { turn_id: 't2' }, 19))
check('new turn clears steps', traces.get('s1').steps.length === 0)

// 8. Other session isolated
ctx._listener({ type: 'tool.start', session_id: 's2', payload: { tool_id: 'z', name: 'terminal' } })
check('events of another session do not leak', traces.get('s1').steps.length === 0 && traces.get('s2').steps.length === 1)

// 8b. Turn-end edges other than message.complete
const turn = (sid, type, payload = {}) => ctx._listener({ type, session_id: sid, payload })
turn('s3', 'message.start'); turn('s3', 'tool.start', { tool_id: 'e1', name: 'terminal' })
turn('s3', 'message.error', { message: 'boom' })
check('message.error ends the turn', !traces.get('s3').running && traces.get('s3').outcome === 'error' && traces.get('s3').steps[0].status === 'stopped')
turn('s4', 'message.start'); turn('s4', 'session.reclaimed', { reason: 'reaped' })
check('session.reclaimed ends the turn', !traces.get('s4').running && traces.get('s4').outcome === 'interrupted')
turn('s5', 'message.start'); turn('s5', 'approval.request', { request_id: 'q1', command: 'ls' })
turn('s5', 'approval.cancelled', { request_ids: ['q1'], cancelled_count: 1, reason: 'interrupt' })
check('approval.cancelled clears the card', traces.get('s5').approval === null)
turn('s6', 'message.error', {})
check('message.error for an unknown session creates nothing', !traces.has('s6'))

// 8c. No terminal frame at all: Hermes' busy flag drops → trace ends after grace
const busy = globalThis.__hsBusy
const settle = () => act(async () => { await new Promise(r => setTimeout(r, 80)) })
turn('s7', 'message.start')
busy.set({ s7: true })
await settle()
check('busy session keeps running', traces.get('s7').running)
await act(async () => busy.set({ s7: false }))
await settle()
check('idle per Hermes → trace stopped', !traces.get('s7').running && traces.get('s7').outcome === 'stopped')
turn('s8', 'message.start')
await act(async () => busy.set({ s8: false }))
turn('s8', 'tool.start', { tool_id: 'b1', name: 'terminal' })
await act(async () => busy.set({ s8: true }))
await settle()
check('idle blip cancelled when busy returns', traces.get('s8').running)

// 8d. Status bar chip uses the session provider for a vendorless model id
const chip = registry.find(c => c.area === 'statusBar.right')
const chipBox = document.createElement('div')
document.body.appendChild(chipBox)
const chipRoot = createRoot(chipBox)
const chipLogo = () => chipBox.querySelector('img.hs-logo')
globalThis.__hsModel.set('auto/best-coding')
await act(async () => chipRoot.render(chip.render()))
check('chip: router alias without provider → no logo', !chipLogo())
ctx._listener({ type: 'session.info', session_id: 's1', payload: { model: 'auto/best-coding', provider: 'openrouter' } })
await act(async () => { await new Promise(r => setTimeout(r, 300)) })
check('chip: session.info provider gives the logo', !!chipLogo())
await act(async () => { globalThis.__hsModel.set('auto/other'); await new Promise(r => setTimeout(r, 10)) })
check('chip: provider of a different model is not borrowed', !chipLogo())
await act(async () => chipRoot.unmount())
chipBox.remove()

// 8e. Phase 1 Features: ReasoningChip, PromptEnhanceAction, SessionRowTrailing
const reasChipContrib = registry.find(c => c.id === 'reasoning-chip')
const reasBox = document.createElement('div')
document.body.appendChild(reasBox)
const reasRoot = createRoot(reasBox)
await act(async () => reasRoot.render(reasChipContrib.render()))
const reasBtn = reasBox.querySelector('button.hs-reasoning-btn')
check('reasoning chip renders', !!reasBtn)
if (reasBtn) {
  await act(async () => { reasBtn.click(); await new Promise(r => setTimeout(r, 10)) })
  check('reasoning chip cycle sends config.set', requests.some(r => r.method === 'config.set' && r.params.key === 'reasoning'))
}
await act(async () => reasRoot.unmount())
reasBox.remove()

const promptContrib = registry.find(c => c.id === 'prompt-enhance')
const promptBox = document.createElement('div')
document.body.appendChild(promptBox)
const promptRoot = createRoot(promptBox)
await act(async () => promptRoot.render(promptContrib.render()))
const promptBtn = promptBox.querySelector('button.hs-prompt-trigger')
check('prompt enhance trigger renders', !!promptBtn)
if (promptBtn) {
  await act(async () => { promptBtn.click(); await new Promise(r => setTimeout(r, 10)) })
  const templateItem = promptBox.querySelector('button.hs-prompt-item')
  check('prompt enhance popover opens with templates', !!templateItem)
  if (templateItem) {
    await act(async () => { templateItem.click(); await new Promise(r => setTimeout(r, 10)) })
    check('prompt template prepends text to composer draft', (globalThis.__hsDraft || '').length > 0)
  }
}
await act(async () => promptRoot.unmount())
promptBox.remove()

const sessionRowContrib = registry.find(c => c.id === 'session-row-color')
const sessionBox = document.createElement('div')
document.body.appendChild(sessionBox)
const sessionRoot = createRoot(sessionBox)
await act(async () => sessionRoot.render(sessionRowContrib.render({ sessionId: 's1' })))
const sessionDotBtn = sessionBox.querySelector('button.hs-session-dot-btn')
check('session row color dot renders', !!sessionDotBtn)
if (sessionDotBtn) {
  await act(async () => { sessionDotBtn.click(); await new Promise(r => setTimeout(r, 10)) })
  check('session color cycle sets color', !!(globalThis.__hsSessionColors?.s1 || storage.get('sessionColors')?.s1))
}
await act(async () => sessionRoot.unmount())
sessionBox.remove()

// 9. Row decorator on a Hermes-shaped tool row
const row = document.createElement('div')
row.innerHTML = '<div data-slot="tool-block" data-tool-row=""><div><div><button><span class="flex"><span class="grid size-3.5"><svg></svg></span><span>GitHub · create issue</span></span></button></div></div></div>'
document.body.appendChild(row)
await new Promise(r => setTimeout(r, 30))
const glyph = row.querySelector('span.grid')
check('chat row glyph gets data-hs-svc=github', glyph.getAttribute('data-hs-svc') === 'github')
check('row CSS injected', !!document.querySelector('style[data-herald-styx="rows"]'))

// 9b. Composer model pill (markup of model-pill.tsx: name span, pin dot, chevron svg)
const { pillModel } = mod.__internals
check('pillModel: English title', JSON.stringify(pillModel('Model · Anthropic: claude-opus-5', 'Opus 5')) === JSON.stringify({ model: 'claude-opus-5', provider: 'Anthropic' }))
check('pillModel: pinned suffix dropped', pillModel('Model · OpenRouter: auto/best — Pinned', 'x').model === 'auto/best')
check('pillModel: French " : " and CJK "："', pillModel('Modèle · Anthropic : claude-x', '').model === 'claude-x' && pillModel('模型 · Anthropic：claude-y', '').model === 'claude-y')
check('pillModel: colon inside the model id kept', pillModel('Model · Ollama: qwen3:8b', '').model === 'qwen3:8b')
check('pillModel: no menu → visible name', JSON.stringify(pillModel('Open model picker', 'Opus 5')) === JSON.stringify({ model: 'Opus 5', provider: '' }))
const composer = document.createElement('div')
composer.innerHTML = '<form data-slot="composer-root">' +
  '<button id="pill" aria-label="Model · Anthropic: claude-opus-5"><span class="truncate">Opus 5</span><svg></svg></button>' +
  '<button id="effort" aria-label="Effort: High"><span>High</span><svg></svg></button>' +
  '<button id="tile" aria-label="Model · thir13teen-omniroute: auto/best-coding"><span class="truncate">best-coding</span><span role="img"></span><svg></svg></button>' +
  '<button id="compact" aria-label="Model · Anthropic: claude-opus-5"><svg></svg></button>' +
  '</form>'
document.body.appendChild(composer)
await new Promise(r => setTimeout(r, 30))
const mark = id => composer.querySelector(`#${id}`).getAttribute('data-hs-model')
check('composer pill gets data-hs-model=claude', mark('pill') === 'claude')
check('reasoning pill untouched', mark('effort') === null)
check('router alias with unknown provider → no mark', mark('tile') === null)
check('compact pill (chevron only) → no mark', mark('compact') === null)
check('pill CSS injected', !!document.querySelector('style[data-herald-styx="pill"]'))
composer.querySelector('#pill').setAttribute('aria-label', 'Model · OpenAI: gpt-5.5')
composer.querySelector('#pill span').textContent = 'GPT-5.5'
await new Promise(r => setTimeout(r, 30))
check('model switch updates the mark', mark('pill') === 'openai')
composer.querySelector('#tile').setAttribute('aria-label', 'Model · OpenRouter: auto/best-coding')
await new Promise(r => setTimeout(r, 30))
check('provider-only match via aria-label', mark('tile') === 'openrouter')
const toggleSetting = async on => {
  const box = document.createElement('div')
  const r = createRoot(box)
  await act(async () => r.render(React.createElement(registry.find(c => c.area === 'settings').render)))
  const input = [...box.querySelectorAll('label')].find(l => l.textContent.startsWith('Logo on the composer model pill')).querySelector('input')
  if (input.checked !== on) await act(async () => input.click())
  await act(async () => r.unmount())
}
await toggleSetting(false)
check('setting off removes the pill marks and CSS', !composer.querySelector('[data-hs-model]') && !document.querySelector('style[data-herald-styx="pill"]'))
check('row decorator still running after pill off', glyph.getAttribute('data-hs-svc') === 'github')
await toggleSetting(true)
await new Promise(r => setTimeout(r, 30))
check('setting on again restores the mark', mark('pill') === 'openai')

// 10. Closing the panel removes the pane
registry.find(c => c.area === 'palette').data.run()
check('toggle again unregisters the pane', !registry.some(c => c.area === 'panes'))

// 11. Unload leaves nothing behind
await act(async () => reactRoot.unmount())
disposers.forEach(fn => fn())
check('unload: styles removed', !document.querySelector('style[data-herald-styx]'))
check('unload: row and pill attributes removed', !document.querySelector('[data-hs-svc],[data-hs-model]'))
check('unload: window.__heraldStyx removed', !('__heraldStyx' in window))

// 12. Loader rules: only SDK + react imports, default export shape
const src = readFileSync(join(root, 'dist', 'plugin.js'), 'utf8')
const specs = [...src.matchAll(/(?:from\s*|import\s+)(['"])([^'"]+)\1/g)].map(m => m[2])
check('imports only @hermes/plugin-sdk / react / react/jsx-runtime', specs.every(s => ['@hermes/plugin-sdk', 'react', 'react/jsx-runtime'].includes(s)), [...new Set(specs)].join(', '))
check('default export id matches folder name', plugin.id === 'herald-styx-ui' && typeof plugin.register === 'function')
check('no <script>/on*= inside inlined SVGs', !/PHNjcmlwd/.test(src))

console.log(`\n${failures ? `${failures} FAILED` : 'ALL PASSED'}`)
process.exit(failures ? 1 : 0)
