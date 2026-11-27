import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function getSvg(name) {
  try {
    return readFileSync(join(root, '.cache', name), 'utf8')
  } catch {
    return ''
  }
}

export function buildHtmlPages() {
  const claudeSvg = getSvg('lobe-claude-color.svg')
  const deepseekSvg = getSvg('lobe-deepseek-color.svg')
  const githubSvg = getSvg('si-github.svg')
  const youtubeSvg = getSvg('si-youtube.svg')
  const linearSvg = getSvg('si-linear.svg')

  const baseCss = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #09090b;
      color: #f4f4f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 13px;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }
    :root {
      --ui-text-primary: #f4f4f5;
      --ui-text-secondary: #a1a1aa;
      --ui-text-tertiary: #71717a;
      --ui-stroke-secondary: #27272a;
      --ui-stroke-tertiary: #1f1f23;
      --ui-bg-panel: #111114;
      --ui-bg-surface: #18181c;
      --ui-bg-input: #1c1c21;
      --ui-accent: #3b82f6;
      --ui-green: #10b981;
      --ui-red: #ef4444;
      --ui-warning: #f59e0b;
      --chrome-action-hover: rgba(255, 255, 255, 0.08);
      --font-mono: "JetBrains Mono", Consolas, monospace;
    }
    .icon-svg { display: inline-block; vertical-align: middle; flex-shrink: 0; }
  `

  return {
    agentPanel: `<!DOCTYPE html><html><head><style>${baseCss}
      body { padding: 24px; display: flex; justify-content: center; }
      .hs-panel {
        width: 360px;
        background: var(--ui-bg-panel);
        border: 1px solid var(--ui-stroke-secondary);
        border-radius: 10px;
        overflow: hidden;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      }
      .hs-head {
        display: flex; justify-content: space-between; align-items: center;
        padding: 12px 14px;
        border-bottom: 1px solid var(--ui-stroke-secondary);
        background: rgba(255,255,255,0.02);
      }
      .hs-head-text { display: flex; flex-direction: column; }
      .hs-title { font-weight: 600; font-size: 14px; color: var(--ui-text-primary); }
      .hs-sub { font-size: 11px; color: var(--ui-text-tertiary); font-variant-numeric: tabular-nums; margin-top: 1px; }
      .hs-scroll { padding: 12px 14px; display: flex; flex-direction: column; gap: 14px; }
      .hs-section-title {
        display: flex; justify-content: space-between; align-items: center;
        font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em;
        color: var(--ui-text-tertiary); margin-bottom: 6px;
      }
      .hs-count { font-size: 10px; font-weight: 400; font-variant-numeric: tabular-nums; }
      .hs-steps { list-style: none; display: flex; flex-direction: column; gap: 6px; }
      .hs-step {
        display: grid; grid-template-columns: 20px minmax(0, 1fr) auto;
        align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px;
        border: 1px solid var(--ui-stroke-tertiary); background: var(--ui-bg-surface);
      }
      .hs-step-icon { display: flex; align-items: center; justify-content: center; }
      .hs-step-body { display: flex; flex-direction: column; min-width: 0; }
      .hs-step-title { font-size: 12px; font-weight: 500; color: var(--ui-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .hs-step-detail { font-size: 11px; color: var(--ui-text-tertiary); font-family: var(--font-mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .hs-step-meta { display: flex; flex-direction: column; align-items: flex-end; font-size: 11px; font-variant-numeric: tabular-nums; color: var(--ui-text-tertiary); }
      .hs-status-wrap { display: flex; align-items: center; gap: 4px; }
      .hs-step-break {
        display: inline-flex; align-items: center; justify-content: center;
        width: 18px; height: 18px; border-radius: 4px; border: 1px solid rgba(239, 68, 68, 0.4);
        background: rgba(239, 68, 68, 0.1); color: var(--ui-red); cursor: pointer;
      }
      .hs-step.hs-stalled { border-color: rgba(245, 158, 11, 0.4); background: rgba(245, 158, 11, 0.04); }
      .hs-step.hs-stalled .hs-status { color: var(--ui-warning); font-weight: 600; }
      .hs-todos { list-style: none; display: flex; flex-direction: column; gap: 4px; font-size: 12px; }
      .hs-todos li { display: flex; gap: 8px; padding: 2px 0; }
      .hs-todo-mark { color: var(--ui-text-tertiary); width: 14px; text-align: center; }
      .hs-todos li[data-status="completed"] { color: var(--ui-text-tertiary); text-decoration: line-through; }
      .hs-todos li[data-status="in_progress"] { color: var(--ui-text-primary); font-weight: 500; }
      .hs-todos li[data-status="in_progress"] .hs-todo-mark { color: var(--ui-accent); }
      .hs-sources { display: flex; flex-wrap: wrap; gap: 6px; }
      .hs-chip {
        display: inline-flex; align-items: center; gap: 5px; padding: 3px 8px;
        background: var(--ui-bg-surface); border: 1px solid var(--ui-stroke-tertiary);
        border-radius: 12px; font-size: 11px; color: var(--ui-text-secondary);
      }
      .hs-artifacts { display: flex; flex-direction: column; gap: 6px; }
      .hs-artifact-row {
        display: flex; align-items: center; justify-content: space-between;
        padding: 6px 10px; border-radius: 6px; background: var(--ui-bg-surface);
        border: 1px solid var(--ui-stroke-tertiary);
      }
      .hs-artifact-info { display: flex; align-items: center; gap: 8px; font-size: 12px; }
      .hs-pin-tag {
        font-size: 10px; text-transform: uppercase; font-weight: 600;
        padding: 2px 6px; border-radius: 4px; background: rgba(59, 130, 246, 0.15); color: var(--ui-accent);
      }
      .hs-approval {
        padding: 10px 12px; border: 1px solid rgba(245, 158, 11, 0.3);
        border-radius: 8px; background: rgba(245, 158, 11, 0.05);
      }
      .hs-approval-head { display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 12px; color: #fbbf24; }
      .hs-approval-cmd {
        margin: 6px 0; padding: 6px 8px; font-family: var(--font-mono); font-size: 11px;
        background: rgba(0,0,0,0.3); border-radius: 4px; border: 1px solid var(--ui-stroke-tertiary);
      }
      .hs-approval-actions { display: flex; justify-content: flex-end; gap: 6px; margin-top: 8px; }
      .hs-btn {
        padding: 4px 10px; font-size: 11px; font-weight: 500; border-radius: 5px;
        cursor: pointer; border: 1px solid transparent;
      }
      .hs-btn-deny { background: transparent; color: var(--ui-text-secondary); border-color: var(--ui-stroke-secondary); }
      .hs-btn-allow { background: var(--ui-accent); color: #fff; }
    </style></head><body>
      <div class="hs-panel">
        <div class="hs-head">
          <div class="hs-head-text">
            <span class="hs-title">Agent</span>
            <span class="hs-sub">Working for 1m 45s · <strong>2 turns · 8 steps</strong></span>
          </div>
          <button style="background:none;border:0;color:var(--ui-text-tertiary);cursor:pointer;font-size:16px;">✕</button>
        </div>
        <div class="hs-scroll">
          <div class="hs-approval">
            <div class="hs-approval-head">🛡️ Approval needed</div>
            <div style="font-size:11px;color:var(--ui-text-secondary);margin-top:2px;">Execute shell build check</div>
            <div class="hs-approval-cmd">npm run test:benchmark</div>
            <div class="hs-approval-actions">
              <button class="hs-btn hs-btn-deny">Deny</button>
              <button class="hs-btn hs-btn-allow">Allow once</button>
            </div>
          </div>

          <div>
            <div class="hs-section-title"><span>Plan</span><span class="hs-count">2/3</span></div>
            <ul class="hs-todos">
              <li data-status="completed"><span class="hs-todo-mark">✓</span><span>Fetch API benchmark data</span></li>
              <li data-status="in_progress"><span class="hs-todo-mark">◐</span><span>Generate interactive comparison chart</span></li>
              <li data-status="pending"><span class="hs-todo-mark">○</span><span>Evaluate token cost trade-offs</span></li>
            </ul>
          </div>

          <div>
            <div class="hs-section-title"><span>Visual Artifacts / GenUI</span><span class="hs-count">2 items</span></div>
            <div class="hs-artifacts">
              <div class="hs-artifact-row">
                <div class="hs-artifact-info">
                  <span style="color:var(--ui-accent);">📊</span>
                  <span style="font-weight:500;">Q3 Revenue Growth</span>
                </div>
                <span class="hs-pin-tag">chart</span>
              </div>
              <div class="hs-artifact-row">
                <div class="hs-artifact-info">
                  <span style="color:var(--ui-green);">📈</span>
                  <span style="font-weight:500;">MRR: $45,200 (+14%)</span>
                </div>
                <span class="hs-pin-tag">kpi</span>
              </div>
            </div>
          </div>

          <div>
            <div class="hs-section-title"><span>Sources</span><span class="hs-count">3</span></div>
            <div class="hs-sources">
              <span class="hs-chip"><span style="width:14px;height:14px;">${githubSvg}</span>github.com</span>
              <span class="hs-chip"><span style="width:14px;height:14px;">${linearSvg}</span>linear.app</span>
              <span class="hs-chip"><span style="width:14px;height:14px;">${youtubeSvg}</span>youtube.com</span>
            </div>
          </div>

          <div>
            <div class="hs-section-title"><span>Sub-agents</span><span class="hs-count">1</span></div>
            <div class="hs-steps">
              <div class="hs-step">
                <div class="hs-step-icon" style="width:16px;height:16px;">${deepseekSvg}</div>
                <div class="hs-step-body">
                  <span class="hs-step-title">Survey theme repos</span>
                  <span class="hs-step-detail">deepseek-v4.1-flash · 3 tools</span>
                </div>
                <div class="hs-step-meta">
                  <span style="color:var(--ui-green);font-weight:600;">done</span>
                  <span>42.1s</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div class="hs-section-title"><span>Steps</span><span class="hs-count">4 tools</span></div>
            <div class="hs-steps">
              <div class="hs-step hs-stalled">
                <div class="hs-step-icon">🌐</div>
                <div class="hs-step-body">
                  <span class="hs-step-title">web_search · fetch live benchmarks</span>
                  <span class="hs-step-detail">query="ai tokens 2026"</span>
                </div>
                <div class="hs-step-meta">
                  <div class="hs-status-wrap">
                    <span class="hs-status">stalled</span>
                    <button class="hs-step-break" title="Stop tool / break turn">⏹</button>
                  </div>
                  <span style="color:var(--ui-warning);">18.4s</span>
                </div>
              </div>
              <div class="hs-step">
                <div class="hs-step-icon" style="width:16px;height:16px;">${githubSvg}</div>
                <div class="hs-step-body">
                  <span class="hs-step-title">GitHub · create issue</span>
                  <span class="hs-step-detail">repo="ILSTR-RIX/herald-styx-ui"</span>
                </div>
                <div class="hs-step-meta">
                  <span style="color:var(--ui-green);font-weight:600;">done</span>
                  <span>1.4s</span>
                </div>
              </div>
              <div class="hs-step">
                <div class="hs-step-icon">💡</div>
                <div class="hs-step-body">
                  <span class="hs-step-title">Thinking</span>
                  <span class="hs-step-detail">Structuring response format</span>
                </div>
                <div class="hs-step-meta">
                  <span style="color:var(--ui-green);font-weight:600;">done</span>
                  <span>2.1s</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </body></html>`,

    genuiBlocks: `<!DOCTYPE html><html><head><style>${baseCss}
      body { padding: 32px; display: flex; flex-direction: column; align-items: center; gap: 16px; }
      .chat-bubble {
        width: 680px; background: var(--ui-bg-panel); border: 1px solid var(--ui-stroke-secondary);
        border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 16px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.3);
      }
      .bubble-header { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--ui-text-primary); }
      .bubble-header .avatar { width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; }
      .hs-genui-card {
        padding: 12px 14px; border-radius: 8px; border: 1px solid var(--ui-stroke-tertiary);
        background: var(--ui-bg-surface); display: flex; flex-direction: column; gap: 10px;
      }
      .hs-genui-head { display: flex; justify-content: space-between; align-items: center; }
      .hs-genui-title { font-weight: 600; font-size: 13px; color: var(--ui-text-primary); display: flex; align-items: center; gap: 6px; }
      .hs-genui-pin-btn {
        padding: 2px 8px; font-size: 11px; border-radius: 4px; border: 1px solid var(--ui-stroke-tertiary);
        background: transparent; color: var(--ui-text-tertiary); cursor: pointer; display: flex; align-items: center; gap: 4px;
      }
      .hs-genui-pin-btn:hover { color: var(--ui-accent); background: var(--chrome-action-hover); }
      .hs-kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .hs-kpi-box { padding: 12px; border-radius: 8px; background: var(--ui-bg-surface); border: 1px solid var(--ui-stroke-tertiary); }
      .hs-kpi-val { font-size: 24px; font-weight: 700; color: var(--ui-text-primary); margin: 4px 0; font-variant-numeric: tabular-nums; }
      .hs-kpi-change { font-size: 11px; font-weight: 600; color: var(--ui-green); }
      .hs-table { width: 100%; border-collapse: collapse; font-size: 12px; }
      .hs-table th { text-align: left; padding: 6px 8px; color: var(--ui-text-tertiary); border-bottom: 1px solid var(--ui-stroke-tertiary); font-weight: 600; cursor: pointer; }
      .hs-table td { padding: 6px 8px; border-bottom: 1px solid rgba(255,255,255,0.04); }
      .calc-slider-wrap { display: flex; align-items: center; gap: 12px; margin: 4px 0; }
      .calc-slider { flex: 1; accent-color: var(--ui-accent); cursor: pointer; }
      .calc-res-box { display: flex; justify-content: space-between; padding: 8px 12px; border-radius: 6px; background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.2); }
      .explainer-stepper { display: flex; gap: 6px; }
      .step-pill { padding: 4px 10px; border-radius: 6px; border: 1px solid var(--ui-stroke-tertiary); background: none; color: var(--ui-text-secondary); font-size: 11px; cursor: pointer; }
      .step-pill.active { background: var(--ui-accent); color: #fff; border-color: transparent; }
    </style></head><body>
      <div class="chat-bubble">
        <div class="bubble-header">
          <div class="avatar">${claudeSvg}</div>
          <span>Claude 3.7 Sonnet · GenUI Interactive Artifacts</span>
        </div>
        <p style="color:var(--ui-text-secondary);">Here is the project analysis with real-time interactive charts, live projections, and component walkthrough:</p>

        <!-- KPI Grid -->
        <div class="hs-kpi-grid">
          <div class="hs-kpi-box">
            <span style="font-size:11px;color:var(--ui-text-tertiary);text-transform:uppercase;font-weight:600;">Monthly Active Users</span>
            <div class="hs-kpi-val">128,450</div>
            <span class="hs-kpi-change">▲ +18.4% vs last mo</span>
          </div>
          <div class="hs-kpi-box">
            <span style="font-size:11px;color:var(--ui-text-tertiary);text-transform:uppercase;font-weight:600;">Token Efficiency</span>
            <div class="hs-kpi-val">94.2%</div>
            <span class="hs-kpi-change">▲ +3.1% optimized</span>
          </div>
        </div>

        <!-- Interactive Bar Chart -->
        <div class="hs-genui-card">
          <div class="hs-genui-head">
            <span class="hs-genui-title">📊 Revenue Growth per Quarter (USD in k)</span>
            <button class="hs-genui-pin-btn">📌 Keep in Dashboard</button>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;padding:4px 0;">
            <div style="display:grid;grid-template-columns:50px 1fr 50px;align-items:center;gap:10px;font-size:11px;">
              <span style="color:var(--ui-text-secondary);">Q1 2026</span>
              <div style="height:10px;background:var(--ui-stroke-tertiary);border-radius:5px;overflow:hidden;"><div style="width:45%;height:100%;background:var(--ui-accent);border-radius:5px;"></div></div>
              <span style="text-align:right;font-weight:600;font-variant-numeric:tabular-nums;">$45k</span>
            </div>
            <div style="display:grid;grid-template-columns:50px 1fr 50px;align-items:center;gap:10px;font-size:11px;">
              <span style="color:var(--ui-text-secondary);">Q2 2026</span>
              <div style="height:10px;background:var(--ui-stroke-tertiary);border-radius:5px;overflow:hidden;"><div style="width:72%;height:100%;background:var(--ui-accent);border-radius:5px;"></div></div>
              <span style="text-align:right;font-weight:600;font-variant-numeric:tabular-nums;">$72k</span>
            </div>
            <div style="display:grid;grid-template-columns:50px 1fr 50px;align-items:center;gap:10px;font-size:11px;">
              <span style="color:var(--ui-text-secondary);">Q3 2026</span>
              <div style="height:10px;background:var(--ui-stroke-tertiary);border-radius:5px;overflow:hidden;"><div style="width:95%;height:100%;background:var(--ui-green);border-radius:5px;"></div></div>
              <span style="text-align:right;font-weight:600;font-variant-numeric:tabular-nums;">$95k</span>
            </div>
          </div>
        </div>

        <!-- Sortable Table -->
        <div class="hs-genui-card">
          <div class="hs-genui-head">
            <span class="hs-genui-title">📋 Model Evaluation & Latency</span>
          </div>
          <table class="hs-table">
            <thead>
              <tr>
                <th>Model ↑</th>
                <th>Provider</th>
                <th>Latency (ms)</th>
                <th>Benchmark Score</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style="font-weight:500;">Claude 3.7 Sonnet</td><td style="color:var(--ui-text-secondary);">Anthropic</td><td>420ms</td><td style="color:var(--ui-green);font-weight:600;">94.8</td></tr>
              <tr><td style="font-weight:500;">GPT-4.5 Preview</td><td style="color:var(--ui-text-secondary);">OpenAI</td><td>510ms</td><td style="color:var(--ui-green);font-weight:600;">93.4</td></tr>
              <tr><td style="font-weight:500;">DeepSeek V3</td><td style="color:var(--ui-text-secondary);">DeepSeek</td><td>380ms</td><td style="color:var(--ui-green);font-weight:600;">92.1</td></tr>
            </tbody>
          </table>
        </div>

        <!-- Interactive Calculator -->
        <div class="hs-genui-card">
          <div class="hs-genui-head">
            <span class="hs-genui-title">🎛️ Live Monthly Budget Simulator</span>
          </div>
          <div class="calc-slider-wrap">
            <span style="font-size:11px;color:var(--ui-text-secondary);">Daily Calls:</span>
            <input type="range" min="100" max="5000" value="1500" class="calc-slider" />
            <span style="font-size:12px;font-weight:600;min-width:60px;">1,500 req</span>
          </div>
          <div class="calc-res-box">
            <span style="font-size:12px;color:var(--ui-text-secondary);">Estimated Cost (Jev Dynamic Route):</span>
            <strong style="color:var(--ui-accent);font-size:13px;">$34.50 / mo (Saved 62%)</strong>
          </div>
        </div>

        <!-- Concept Explainer -->
        <div class="hs-genui-card">
          <div class="hs-genui-head">
            <span class="hs-genui-title">🧠 Architecture Flow</span>
          </div>
          <div class="explainer-stepper">
            <button class="step-pill active">1. Input Routing</button>
            <button class="step-pill">2. GenUI Directive</button>
            <button class="step-pill">3. Vector Memory</button>
          </div>
          <div style="padding:10px;border-radius:6px;background:rgba(255,255,255,0.03);font-size:12px;color:var(--ui-text-secondary);line-height:1.4;">
            <strong style="color:var(--ui-text-primary);">Step 1: Input Routing & Analysis:</strong> Request is parsed through lightweight intent classification, routing queries needing visual answers into GenUI block emitters.
          </div>
        </div>

      </div>
    </body></html>`,

    statusbarControls: `<!DOCTYPE html><html><head><style>${baseCss}
      body { padding: 40px; display: flex; justify-content: center; align-items: center; }
      .statusbar {
        width: 720px; height: 32px; background: #111114; border: 1px solid var(--ui-stroke-secondary);
        border-radius: 6px; display: flex; justify-content: space-between; align-items: center;
        padding: 0 10px; font-size: 11px; color: var(--ui-text-tertiary);
      }
      .sb-left { display: flex; align-items: center; gap: 8px; }
      .sb-right { display: flex; align-items: center; gap: 6px; }
      .hs-chip-btn {
        display: inline-flex; height: 24px; align-items: center; gap: 5px; padding: 0 8px;
        font-size: 11px; color: var(--ui-text-secondary); background: rgba(255,255,255,0.04);
        border: 1px solid var(--ui-stroke-tertiary); border-radius: 4px; cursor: pointer;
      }
      .hs-chip-btn:hover { background: var(--chrome-action-hover); color: var(--ui-text-primary); }
      .sb-badge { font-weight: 600; color: var(--ui-accent); font-variant-numeric: tabular-nums; }
    </style></head><body>
      <div class="statusbar">
        <div class="sb-left">
          <span>⚡ Ready</span>
          <span style="opacity:0.4;">|</span>
          <span>git(dev)</span>
        </div>
        <div class="sb-right">
          <!-- Iteration Counter -->
          <div class="hs-chip-btn" title="Iteration Meter: 3 turns · 18 steps">
            <span>⏱️ 2m 14s</span>
            <span class="sb-badge">3t · 18s</span>
          </div>

          <!-- Reasoning Effort Switch -->
          <button class="hs-chip-btn" title="Reasoning effort: Medium · click to cycle">
            <span>🧠 Effort:</span>
            <strong style="color:#60a5fa;">Med</strong>
          </button>

          <!-- Model Chip with Vendor Logo -->
          <button class="hs-chip-btn" title="anthropic/claude-3-7-sonnet · click to toggle Agent Panel">
            <span style="width:14px;height:14px;display:flex;align-items:center;">${claudeSvg}</span>
            <span style="font-weight:500;color:var(--ui-text-primary);">claude-3-7-sonnet</span>
          </button>
        </div>
      </div>
    </body></html>`,

    composerEnhance: `<!DOCTYPE html><html><head><style>${baseCss}
      body { padding: 40px; display: flex; justify-content: center; }
      .composer-box {
        width: 760px; background: var(--ui-bg-panel); border: 1px solid var(--ui-stroke-secondary);
        border-radius: 10px; padding: 12px 14px; position: relative;
        box-shadow: 0 8px 30px rgba(0,0,0,0.5);
      }
      .composer-input {
        width: 100%; min-height: 52px; background: transparent; border: 0; outline: none;
        color: var(--ui-text-primary); font-size: 13px; resize: none; font-family: inherit;
      }
      .composer-controls {
        display: flex; justify-content: space-between; align-items: center;
        border-top: 1px solid var(--ui-stroke-tertiary); padding-top: 8px; margin-top: 6px;
      }
      .ctrl-left { display: flex; align-items: center; gap: 8px; }
      .ctrl-right { display: flex; align-items: center; gap: 8px; }
      .model-pill {
        display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px;
        background: var(--ui-bg-surface); border: 1px solid var(--ui-stroke-secondary);
        border-radius: 14px; font-size: 11px; font-weight: 500; color: var(--ui-text-primary);
      }
      .enhance-trigger {
        display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px;
        border-radius: 6px; border: 1px solid rgba(59, 130, 246, 0.4);
        background: rgba(59, 130, 246, 0.12); color: #93c5fd; font-size: 11px; font-weight: 500; cursor: pointer;
      }
      .enhance-popover {
        position: absolute; bottom: 48px; right: 80px; width: 260px;
        background: #18181c; border: 1px solid var(--ui-stroke-secondary);
        border-radius: 8px; padding: 6px; box-shadow: 0 8px 24px rgba(0,0,0,0.6);
        display: flex; flex-direction: column; gap: 2px;
      }
      .enhance-popover-title {
        font-size: 10px; font-weight: 600; text-transform: uppercase; color: var(--ui-text-tertiary);
        padding: 4px 8px; letter-spacing: .05em;
      }
      .popover-item {
        display: flex; align-items: center; gap: 8px; padding: 6px 8px;
        border-radius: 5px; font-size: 12px; color: var(--ui-text-primary);
        cursor: pointer; background: transparent; border: 0; text-align: left; width: 100%;
      }
      .popover-item:hover { background: var(--chrome-action-hover); color: var(--ui-accent); }
      .send-btn {
        width: 28px; height: 28px; border-radius: 6px; background: var(--ui-accent);
        border: 0; color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer;
      }
    </style></head><body>
      <div class="composer-box">
        <textarea class="composer-input" placeholder="Ask Hermes anything...">Review this implementation for edge cases and performance bottlenecks:</textarea>
        
        <!-- Open Prompt Enhance Popover -->
        <div class="enhance-popover">
          <div class="enhance-popover-title">✨ Prompt Enhance Templates</div>
          <button class="popover-item"><span>🔍</span><span>Review Code (Bugs & Perf)</span></button>
          <button class="popover-item"><span>📐</span><span>Explain Architecture Step-by-Step</span></button>
          <button class="popover-item"><span>🧪</span><span>Write Comprehensive Tests</span></button>
          <button class="popover-item"><span>⚡</span><span>Refactor & Delete Dead Weight</span></button>
        </div>

        <div class="composer-controls">
          <div class="ctrl-left">
            <div class="model-pill">
              <span style="width:14px;height:14px;display:flex;align-items:center;">${claudeSvg}</span>
              <span>Claude 3.7 Sonnet</span>
            </div>
          </div>
          <div class="ctrl-right">
            <button class="enhance-trigger">
              <span>✨</span>
              <span>Prompt Enhance</span>
            </button>
            <button class="send-btn">➔</button>
          </div>
        </div>
      </div>
    </body></html>`,

    sessionAppearance: `<!DOCTYPE html><html><head><style>${baseCss}
      body { padding: 40px; display: flex; justify-content: center; }
      .sidebar-box {
        width: 320px; background: var(--ui-bg-panel); border: 1px solid var(--ui-stroke-secondary);
        border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 6px;
      }
      .sb-header { font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--ui-text-tertiary); padding: 4px 8px; letter-spacing: .05em; }
      .session-row {
        display: flex; align-items: center; justify-content: space-between;
        padding: 8px 10px; border-radius: 6px; cursor: pointer; transition: background .1s;
      }
      .session-row:hover { background: var(--chrome-action-hover); }
      .session-row.active { background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.25); }
      .row-left { display: flex; align-items: center; gap: 8px; min-width: 0; }
      .row-title { font-size: 12px; font-weight: 500; color: var(--ui-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .color-dot {
        width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0;
        box-shadow: 0 0 0 2px rgba(0,0,0,0.3);
      }
    </style></head><body>
      <div class="sidebar-box">
        <div class="sb-header">Recent Sessions · Color Categorized</div>
        
        <div class="session-row active">
          <div class="row-left">
            <span class="color-dot" style="background:#3b82f6;"></span>
            <span class="row-title">Herald Styx UI v0.2.0 Development</span>
          </div>
          <span style="font-size:10px;color:var(--ui-text-tertiary);">Active</span>
        </div>

        <div class="session-row">
          <div class="row-left">
            <span class="color-dot" style="background:#10b981;"></span>
            <span class="row-title">Backend API Architecture & DB</span>
          </div>
          <span style="font-size:10px;color:var(--ui-text-tertiary);">2h ago</span>
        </div>

        <div class="session-row">
          <div class="row-left">
            <span class="color-dot" style="background:#8b5cf6;"></span>
            <span class="row-title">Market Analysis & Revenue GenUI</span>
          </div>
          <span style="font-size:10px;color:var(--ui-text-tertiary);">Yesterday</span>
        </div>

        <div class="session-row">
          <div class="row-left">
            <span class="color-dot" style="background:#f59e0b;"></span>
            <span class="row-title">Security & Vulnerability Audit</span>
          </div>
          <span style="font-size:10px;color:var(--ui-text-tertiary);">3d ago</span>
        </div>
      </div>
    </body></html>`,

    settings: `<!DOCTYPE html><html><head><style>${baseCss}
      body { padding: 40px; display: flex; justify-content: center; }
      .settings-modal {
        width: 680px; background: var(--ui-bg-panel); border: 1px solid var(--ui-stroke-secondary);
        border-radius: 12px; padding: 24px; display: flex; flex-direction: column; gap: 16px;
        box-shadow: 0 12px 48px rgba(0,0,0,0.5);
      }
      .settings-title { font-size: 16px; font-weight: 600; color: var(--ui-text-primary); display: flex; align-items: center; gap: 8px; }
      .settings-list { display: flex; flex-direction: column; border: 1px solid var(--ui-stroke-secondary); border-radius: 8px; overflow: hidden; }
      .toggle-row {
        display: flex; justify-content: space-between; align-items: center; padding: 12px 16px;
        border-bottom: 1px solid var(--ui-stroke-tertiary); background: var(--ui-bg-surface);
      }
      .toggle-row:last-child { border-bottom: 0; }
      .toggle-info { display: flex; flex-direction: column; gap: 2px; padding-right: 20px; }
      .toggle-label { font-size: 13px; font-weight: 500; color: var(--ui-text-primary); }
      .toggle-desc { font-size: 11px; color: var(--ui-text-tertiary); }
      .switch {
        width: 36px; height: 20px; border-radius: 10px; background: var(--ui-accent);
        position: relative; cursor: pointer; flex-shrink: 0;
      }
      .switch-knob {
        width: 16px; height: 16px; border-radius: 50%; background: #fff;
        position: absolute; top: 2px; right: 2px; box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      }
    </style></head><body>
      <div class="settings-modal">
        <div class="settings-title">
          <span>⚡</span>
          <span>Herald Styx UI v0.2.0 Settings</span>
        </div>
        <div class="settings-list">
          <div class="toggle-row">
            <div class="toggle-info">
              <span class="toggle-label">Agent panel</span>
              <span class="toggle-desc">Right-hand pane with the focused chat's steps, plan, sources, sub-agents and approvals.</span>
            </div>
            <div class="switch"><div class="switch-knob"></div></div>
          </div>
          <div class="toggle-row">
            <div class="toggle-info">
              <span class="toggle-label">Model chip in the status bar</span>
              <span class="toggle-desc">Logo and name of the model in use. Click it to toggle the agent panel.</span>
            </div>
            <div class="switch"><div class="switch-knob"></div></div>
          </div>
          <div class="toggle-row">
            <div class="toggle-info">
              <span class="toggle-label">Reasoning effort switch in status bar</span>
              <span class="toggle-desc">Cycles reasoning effort (none, low, med, high) per session with one click from the status bar.</span>
            </div>
            <div class="switch"><div class="switch-knob"></div></div>
          </div>
          <div class="toggle-row">
            <div class="toggle-info">
              <span class="toggle-label">Scroll on session switch</span>
              <span class="toggle-desc">Automatically snaps transcript scroll to the newest message when switching to a session tab.</span>
            </div>
            <div class="switch"><div class="switch-knob"></div></div>
          </div>
          <div class="toggle-row">
            <div class="toggle-info">
              <span class="toggle-label">Prompt enhancement templates</span>
              <span class="toggle-desc">Adds quick task templates (explain, review, test, refactor) to the chat composer.</span>
            </div>
            <div class="switch"><div class="switch-knob"></div></div>
          </div>
          <div class="toggle-row">
            <div class="toggle-info">
              <span class="toggle-label">Session color tags in sidebar</span>
              <span class="toggle-desc">Clickable color dot on session rows in the sidebar to organize sessions visually.</span>
            </div>
            <div class="switch"><div class="switch-knob"></div></div>
          </div>
          <div class="toggle-row">
            <div class="toggle-info">
              <span class="toggle-label">Interactive GenUI blocks in chat</span>
              <span class="toggle-desc">Renders charts, KPI cards, sortable tables, calculators, and explainers directly inside chat responses.</span>
            </div>
            <div class="switch"><div class="switch-knob"></div></div>
          </div>
          <div class="toggle-row">
            <div class="toggle-info">
              <span class="toggle-label">Logo on the composer model pill</span>
              <span class="toggle-desc">Shows the model's logo beside its name in each chat's composer.</span>
            </div>
            <div class="switch"><div class="switch-knob"></div></div>
          </div>
          <div class="toggle-row">
            <div class="toggle-info">
              <span class="toggle-label">Logos on chat tool rows</span>
              <span class="toggle-desc">Replaces the generic icon on tool rows that belong to a known service.</span>
            </div>
            <div class="switch"><div class="switch-knob"></div></div>
          </div>
        </div>
      </div>
    </body></html>`
  }
}
