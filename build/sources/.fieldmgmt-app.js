(() => {
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const deep = o => JSON.parse(JSON.stringify(o));
let FIELD_CLASSES = deep(FIELD_DATA.classes);
let AI_CLASSES = deep(AI_DATA.classes);
const DEFAULT_POLICY = { autonomyCeiling: 'A2', confidenceThreshold: 0.6, privacy: 'redact', fallback: 'rules', requireEvidence: true, requireUndo: true, explain: true };
let POLICY = { ...DEFAULT_POLICY };
let RUNS = [
  { id: 'run-0001', mode: 'field', classId: 'field.prefill', instId: 'field.prefill.ocr-language@r1', output: 'ocr.language = zh', confidence: 0.84, decision: 'A1 draft', latency: 42, status: 'ok', evidence: ['selected_text', 'app', 'recent_actions'], model: 'local/rules' },
  { id: 'run-0002', mode: 'field', classId: 'field.guard', instId: 'field.guard.risk@r1', output: 'L2 · require approval', confidence: 0.91, decision: 'A0 ask', latency: 18, status: 'ok', evidence: ['draft', 'permission'], model: 'rules' },
  { id: 'run-0003', mode: 'ai', classId: 'ai.agent', instId: 'ai.agent.researcher@r1', output: 'research plan draft', confidence: 0.77, decision: 'A1 draft', latency: 1240, status: 'ok', evidence: ['web_search', 'docs'], model: 'cloud/claude' },
  { id: 'run-0004', mode: 'field', classId: 'field.diagnose', instId: 'field.diagnose.flow-failure@r1', output: 'cause: selector changed', confidence: 0.68, decision: 'A1 patch draft', latency: 220, status: 'warn', evidence: ['run_trace', 'uia_tree'], model: 'reasoning' }
];
const STORAGE = 'baiying.fieldManager.v1';
try { const saved = JSON.parse(localStorage.getItem(STORAGE) || 'null'); if (saved) { if (Array.isArray(saved.fieldClasses) && saved.fieldClasses.length) FIELD_CLASSES = saved.fieldClasses; if (Array.isArray(saved.aiClasses) && saved.aiClasses.length) AI_CLASSES = saved.aiClasses; if (Array.isArray(saved.runs)) RUNS = saved.runs; if (saved.policy) POLICY = { ...DEFAULT_POLICY, ...saved.policy }; } } catch (_) {}
const FAMILIES = ['perceive', 'understand', 'generate', 'evolve', 'govern'];
const state = { mode: 'field', fieldClassId: FIELD_CLASSES[0]?.id || '', fieldInstId: FIELD_CLASSES[0]?.instances[0]?.id || '', aiClassId: AI_CLASSES[0]?.id || '', aiInstId: AI_CLASSES[0]?.instances[0]?.id || '', runId: RUNS[0]?.id || '', query: '', filter: 'all', toastTimer: null };
const fieldClass = () => FIELD_CLASSES.find(c => c.id === state.fieldClassId) || FIELD_CLASSES[0];
const fieldInst = () => fieldClass()?.instances.find(i => i.id === state.fieldInstId) || fieldClass()?.instances[0] || null;
const aiClass = () => AI_CLASSES.find(c => c.id === state.aiClassId) || AI_CLASSES[0];
const aiInst = () => aiClass()?.instances.find(i => i.id === state.aiInstId) || aiClass()?.instances[0] || null;
const activeClass = () => state.mode === 'ai' ? aiClass() : fieldClass();
const activeInst = () => state.mode === 'ai' ? aiInst() : fieldInst();
const run = () => RUNS.find(r => r.id === state.runId) || RUNS[0] || null;
const allInstances = list => list.reduce((n, c) => n + c.instances.length, 0);
function saveData() { try { localStorage.setItem(STORAGE, JSON.stringify({ fieldClasses: FIELD_CLASSES, aiClasses: AI_CLASSES, runs: RUNS, policy: POLICY, savedAt: new Date().toISOString() })); } catch (_) {} }
function showToast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => t.classList.remove('show'), 1800); }
function ensureSelection() { if (!FIELD_CLASSES.some(c => c.id === state.fieldClassId)) state.fieldClassId = FIELD_CLASSES[0]?.id || ''; if (!fieldClass()?.instances.some(i => i.id === state.fieldInstId)) state.fieldInstId = fieldClass()?.instances[0]?.id || ''; if (!AI_CLASSES.some(c => c.id === state.aiClassId)) state.aiClassId = AI_CLASSES[0]?.id || ''; if (!aiClass()?.instances.some(i => i.id === state.aiInstId)) state.aiInstId = aiClass()?.instances[0]?.id || ''; }
function updateHash() { const h = `#${state.mode}/${encodeURIComponent(state.mode === 'ai' ? state.aiClassId : state.fieldClassId)}`; if (location.hash !== h) history.replaceState(null, '', h); }
function parseHash() { const parts = (location.hash || '').replace(/^#/, '').split('/').map(decodeURIComponent).filter(Boolean); if (['field', 'ai', 'runs', 'policy'].includes(parts[0])) state.mode = parts[0]; if (state.mode === 'field' && parts[1] && FIELD_CLASSES.some(c => c.id === parts[1])) state.fieldClassId = parts[1]; if (state.mode === 'ai' && parts[1] && AI_CLASSES.some(c => c.id === parts[1])) state.aiClassId = parts[1]; ensureSelection(); }
function renderTopStats() {
  const f0 = FIELD_CLASSES.filter(c => c.autonomy === 'A0').length, f1 = FIELD_CLASSES.filter(c => c.autonomy === 'A1').length, f2 = FIELD_CLASSES.filter(c => c.autonomy === 'A2').length;
  $('#topStats').innerHTML = `<span class="mini violet">${FIELD_CLASSES.length} FieldClass</span><span class="mini cyan">${allInstances(FIELD_CLASSES)} FieldInstance</span><span class="mini green">${AI_CLASSES.length} AIClass</span><span class="mini">${allInstances(AI_CLASSES)} AIInstance</span><span class="mini amber">${f0}/${f1}/${f2} A0/A1/A2</span>`;
  $('#viewStats').innerHTML = `<span class="mini">${RUNS.length} runs</span><span class="mini">${POLICY.autonomyCeiling} ceiling</span><span class="mini">conf ≥ ${POLICY.confidenceThreshold}</span><span class="mini">${POLICY.privacy}</span>`;
}
function renderViewTabs() {
  const tabs = [['field', 'Field', `${FIELD_CLASSES.length}/${allInstances(FIELD_CLASSES)}`], ['ai', 'AI', `${AI_CLASSES.length}/${allInstances(AI_CLASSES)}`], ['runs', 'Runs', `${RUNS.length}`], ['policy', 'Policy', POLICY.autonomyCeiling]];
  $('#viewTabs').innerHTML = tabs.map(([id, label, count]) => `<button data-view="${id}" class="${state.mode === id ? 'on' : ''}">${label}<span>${count}</span></button>`).join('');
}
function filteredClasses(list) {
  const q = state.query.trim().toLowerCase();
  return list.filter(c => {
    if (state.filter !== 'all' && (state.mode === 'field' ? c.family : c.group) !== state.filter) return false;
    if (!q) return true;
    return [c.id, c.name, c.summary, c.family, c.group, ...c.instances.map(i => i.id + ' ' + i.name + ' ' + i.detail)].join(' ').toLowerCase().includes(q);
  });
}
function renderLeft() {
  if (state.mode === 'runs') return renderRunLeft();
  if (state.mode === 'policy') return renderPolicyLeft();
  const isAI = state.mode === 'ai';
  const list = isAI ? AI_CLASSES : FIELD_CLASSES;
  const c = activeClass(), instList = c?.instances || [];
  const chips = isAI ? [...new Set(list.map(x => x.group))] : FAMILIES;
  const shown = filteredClasses(list);
  $('#leftPane').innerHTML = `<div class="pane-head"><b>${isAI ? 'AIClass · AI 基座' : 'FieldClass · 场层类'}</b><span class="count">${list.length}</span><button data-action="new-class" title="新建">＋</button></div><input class="panel-search" id="fieldSearch" placeholder="搜索 class / instance / summary…" value="${esc(state.query)}"><div class="fi-meta" style="margin-bottom:5px"><button class="tab-mini ${state.filter === 'all' ? 'on' : ''}" data-filter="all">全部</button>${chips.map(x => `<button class="tab-mini ${state.filter === x ? 'on' : ''}" data-filter="${esc(x)}">${esc(x)}</button>`).join('')}</div>
    ${shown.map(x => `<div class="flow-item ${x.id === c?.id ? 'on' : ''}" data-class="${esc(x.id)}"><div class="fi-top"><span class="fi-name">${isAI ? '✦' : '✧'} ${esc(x.name)}</span><span class="fi-ver">${x.instances.length}</span></div><div class="fi-id">${esc(x.id)}</div><div class="fi-meta"><span class="fi-badge">${esc(isAI ? x.group : x.family)}</span>${isAI ? `<span class="fi-badge">${esc(x.effect)}</span>` : `<span class="autonomy ${esc(x.autonomy)}">${esc(x.autonomy)}</span>`}<span class="fi-badge">${esc(x.priority)}</span></div></div>`).join('') || '<div class="empty">没有匹配项。</div>'}
    <div class="pane-head" style="margin-top:10px"><b>${isAI ? 'AIInstance' : 'FieldInstance'} · 实例</b><span class="count">${instList.length}</span><button data-action="new-instance" title="新建实例">＋</button></div>
    ${instList.map(i => `<div class="inst-item ${i.id === (isAI ? state.aiInstId : state.fieldInstId) ? 'on' : ''}" data-inst="${esc(i.id)}"><div class="ii-top"><span class="ii-name">${esc(i.name)}</span><span class="ii-rev">r${i.rev}</span></div><div class="ii-id">${esc(i.detail)}</div><span class="ii-status">${esc(i.status)}</span></div>`).join('') || '<div class="empty">暂无实例</div>'}
    <div style="margin-top:10px"><button class="btn" style="width:100%;justify-content:center" data-action="reset-data">↺ 重置示例数据</button></div>`;
  const search = $('#fieldSearch'); if (search) search.addEventListener('input', e => { state.query = e.target.value; renderLeft(); });
  $$('#leftPane [data-class]').forEach(el => el.onclick = () => { if (isAI) { state.aiClassId = el.dataset.class; state.aiInstId = aiClass().instances[0]?.id || ''; } else { state.fieldClassId = el.dataset.class; state.fieldInstId = fieldClass().instances[0]?.id || ''; } updateHash(); renderAll(); });
  $$('#leftPane [data-inst]').forEach(el => el.onclick = () => { if (isAI) state.aiInstId = el.dataset.inst; else state.fieldInstId = el.dataset.inst; updateHash(); renderAll(); });
  $$('#leftPane [data-filter]').forEach(b => b.onclick = () => { state.filter = b.dataset.filter; renderLeft(); });
  $$('#leftPane [data-action]').forEach(b => b.onclick = () => handleAction(b.dataset.action));
}
function renderRunLeft() {
  $('#leftPane').innerHTML = `<div class="pane-head"><b>FieldRun / AIRun</b><span class="count">${RUNS.length}</span><button data-action="new-run" title="新建模拟运行">＋</button></div>${RUNS.map(r => `<div class="run-row ${r.id === state.runId ? 'on' : ''}" data-run="${esc(r.id)}"><span class="run-status ${r.status === 'warn' ? 'warn' : r.status === 'error' ? 'error' : ''}"></span><div class="run-main"><div class="run-name">${esc(r.classId)} · ${esc(r.instId)}</div><div class="run-meta">${esc(r.decision)} · ${r.latency}ms · ${esc(r.model)}</div></div><span class="mini">${Math.round(r.confidence * 100)}%</span></div>`).join('') || '<div class="empty">暂无运行记录</div>'}`;
  $$('#leftPane [data-run]').forEach(el => el.onclick = () => { state.runId = el.dataset.run; renderAll(); });
  $$('#leftPane [data-action]').forEach(b => b.onclick = () => handleAction(b.dataset.action));
}
function renderPolicyLeft() {
  $('#leftPane').innerHTML = `<div class="pane-head"><b>Field Policy</b><span class="count">A0–A2</span></div><div class="flow-item on"><div class="fi-top"><span class="fi-name">自主度 / 置信度</span></div><div class="fi-id">autonomyCeiling · confidenceThreshold</div></div><div class="flow-item"><div class="fi-top"><span class="fi-name">隐私 / 回退</span></div><div class="fi-id">privacy · fallback</div></div><div class="flow-item"><div class="fi-top"><span class="fi-name">证据 / 撤销 / 解释</span></div><div class="fi-id">evidence · undo · explain</div></div>`; }
const LANDING_META = {
  point: { label: 'Point', href: 'atom-catalog-management.html' },
  line: { label: 'Line', href: 'line-management.html' },
  surface: { label: 'Surface', href: 'surface-management.html' },
  body: { label: 'Body', href: 'body-management.html' }
};
function landingItems(landing) {
  return String(landing || '').toLowerCase() === 'all' ? ['point', 'line', 'surface', 'body'] : String(landing || '').split('/').map(s => s.trim()).filter(Boolean);
}
function landingHTML(landing) {
  const items = landingItems(landing);
  return `<div class="landing-group">${items.map(x => { const m = LANDING_META[x]; return m ? `<a class="landing-chip mapped" href="${m.href}">${m.label} ↗</a>` : `<span class="landing-chip ph">${esc(x)} ·ph</span>`; }).join('') || '<span class="landing-chip ph">no landing</span>'}</div>`;
}
function aiConfig(c, i) {
  return { provider: c.config?.provider || (String(c.id).includes('model') ? 'local' : 'auto'), model: c.config?.model || (String(c.id).includes('agent') ? 'reasoning' : String(c.id).includes('model') ? 'fast' : 'router'), prompt: c.config?.prompt || c.summary, tools: c.config?.tools || (String(c.id).includes('agent') ? 'web_search, file_read, code' : '—'), guardrails: c.config?.guardrails || 'pii, permission, confidence' };
}
function renderFieldMain() {
  const c = fieldClass(), i = fieldInst();
  if (!c) { $('#main').innerHTML = '<div class="empty">没有 FieldClass。</div>'; return; }
  $('#main').innerHTML = `<div class="hero"><div class="hero-icon" style="color:#c4b5fd">✧</div><div class="hero-main"><div class="kicker">FieldClass · ${esc(c.family)}</div><h1>${esc(c.name)}</h1><p>${esc(c.summary)}</p></div><div class="hero-actions"><button class="btn" data-action="edit-class">✎ 编辑</button><button class="btn primary" data-action="new-instance">＋ 实例</button><button class="btn" data-action="run-instance">▶ 运行</button><button class="btn danger" data-action="delete-class">⌫ 删除</button></div></div>
    <div class="stats"><span class="autonomy ${esc(c.autonomy)}">${esc(c.autonomy)}</span><span class="mini">${esc(c.family)}</span><span class="mini cyan">${esc(c.output)}</span><span class="mini">${esc(c.landing)}</span><span class="mini">${c.instances.length} instances</span><span class="mini">v${esc(c.version)}</span>${i ? `<span class="mini amber">${esc(i.name)} · r${i.rev}</span>` : ''}</div>
    <div class="field-visual"><div class="field-chain"><div class="field-core"><div class="fc-i">✧</div><div class="fc-n">${esc(c.name)}</div><div class="fc-id">${esc(c.id)} · ${esc(c.autonomy)}</div></div><span class="field-arrow">→</span>${landingHTML(c.landing)}<span class="field-arrow">→</span><div class="field-output">${esc(c.output)}</div></div></div>
    <div class="sec-head"><b>Field Contract</b><span class="right"><span class="mini">${esc(c.id)}</span></span></div><div class="bind-panel"><div style="padding:7px 8px"><div class="kv" style="display:grid;grid-template-columns:70px 1fr;gap:4px;font:7px var(--mono)"><div class="k" style="color:#5f7188">family</div><div class="v">${esc(c.family)}</div><div class="k" style="color:#5f7188">output</div><div class="v">${esc(c.output)}</div><div class="k" style="color:#5f7188">landing</div><div class="v">${esc(c.landing)}</div><div class="k" style="color:#5f7188">autonomy</div><div class="v">${esc(c.autonomy)}</div><div class="k" style="color:#5f7188">priority</div><div class="v">${esc(c.priority)}</div><div class="k" style="color:#5f7188">version</div><div class="v">${esc(c.version)}</div></div></div></div>
    <div class="sec-head" style="margin-top:8px"><b>FieldInstance · ${c.instances.length}</b><span class="right"><button class="btn small" data-action="new-instance">＋ 新建实例</button></span></div><div class="instance-grid">${c.instances.map(x => `<div class="instance-card ${x.id === state.fieldInstId ? 'on' : ''}" data-inst-card="${esc(x.id)}"><div class="ic-top"><span class="ic-name">${esc(x.name)}</span><span class="ic-rev">r${x.rev}</span></div><div class="ic-desc">${esc(x.detail)}</div><div class="ic-meta"><span class="ic-badge ${x.status === 'active' ? 'on' : ''}">${esc(x.status)}</span><span class="ic-badge">${esc(c.autonomy)}</span><span class="ic-badge">${esc(c.family)}</span></div></div>`).join('') || '<div class="empty">暂无实例</div>'}</div>`;
  bindMain();
}
function renderAIMain() {
  const c = aiClass(), i = aiInst();
  if (!c) { $('#main').innerHTML = '<div class="empty">没有 AIClass。</div>'; return; }
  const cfg = aiConfig(c, i);
  $('#main').innerHTML = `<div class="hero"><div class="hero-icon" style="color:#c4b5fd">✦</div><div class="hero-main"><div class="kicker">AIClass · ${esc(c.group)}</div><h1>${esc(c.name)}</h1><p>${esc(c.summary)}</p></div><div class="hero-actions"><button class="btn" data-action="edit-class">✎ 编辑</button><button class="btn primary" data-action="new-instance">＋ 实例</button><button class="btn" data-action="run-instance">▶ 运行</button><button class="btn danger" data-action="delete-class">⌫ 删除</button></div></div>
    <div class="stats"><span class="mini violet">${esc(c.group)}</span><span class="mini">${esc(c.effect)}</span><span class="mini">${esc(c.priority)}</span><span class="mini cyan">${c.instances.length} instances</span><span class="mini">v${esc(c.version)}</span>${i ? `<span class="mini amber">${esc(i.name)} · r${i.rev}</span>` : ''}</div>
    <div class="sec-head"><b>AI Substrate · 模型/提示/工具/护栏</b><span class="right"><span class="mini">${esc(cfg.provider)} / ${esc(cfg.model)}</span></span></div><div class="ai-stack"><div class="ai-layer provider"><span class="al-k">Provider</span><span class="al-v">${esc(cfg.provider)} / ${esc(cfg.model)} · local/cloud fallback</span></div><div class="ai-layer prompt"><span class="al-k">Prompt</span><span class="al-v">${esc(cfg.prompt)}</span></div><div class="ai-layer tools"><span class="al-k">Tools</span><span class="al-v">${esc(cfg.tools)}</span></div><div class="ai-layer guard"><span class="al-k">Guardrails</span><span class="al-v">${esc(cfg.guardrails)}</span></div><div class="ai-layer output"><span class="al-k">Output</span><span class="al-v">${esc(c.summary)}</span></div></div>
    <div class="sec-head" style="margin-top:8px"><b>AIInstance · ${c.instances.length}</b><span class="right"><button class="btn small" data-action="new-instance">＋ 新建实例</button></span></div><div class="instance-grid">${c.instances.map(x => `<div class="instance-card ${x.id === state.aiInstId ? 'on' : ''}" data-inst-card="${esc(x.id)}"><div class="ic-top"><span class="ic-name">${esc(x.name)}</span><span class="ic-rev">r${x.rev}</span></div><div class="ic-desc">${esc(x.detail)}</div><div class="ic-meta"><span class="ic-badge ${x.status === 'active' ? 'on' : ''}">${esc(x.status)}</span><span class="ic-badge">${esc(c.group)}</span><span class="ic-badge">${esc(c.effect)}</span></div></div>`).join('') || '<div class="empty">暂无实例</div>'}</div>`;
  bindMain();
}
function bindMain() {
  $$('#main [data-action]').forEach(b => b.onclick = () => handleAction(b.dataset.action));
  $$('#main [data-inst-card]').forEach(el => el.onclick = () => { if (state.mode === 'ai') state.aiInstId = el.dataset.instCard; else state.fieldInstId = el.dataset.instCard; updateHash(); renderAll(); });
}
function renderRunMain() {
  const r = run();
  if (!r) { $('#main').innerHTML = '<div class="empty">暂无运行记录。</div>'; return; }
  const pct = Math.round(r.confidence * 100);
  $('#main').innerHTML = `<div class="hero"><div class="hero-icon" style="color:#22d3ee">▶</div><div class="hero-main"><div class="kicker">FieldRun / AIRun</div><h1>${esc(r.id)} · ${esc(r.classId)}</h1><p>${esc(r.instId)} · ${esc(r.decision)} · ${esc(r.model)}</p></div><div class="hero-actions"><button class="btn primary" data-action="new-run">＋ 模拟运行</button></div></div><div class="stats"><span class="mini ${r.status === 'ok' ? 'green' : 'amber'}">${esc(r.status)}</span><span class="mini">${esc(r.mode)}</span><span class="mini">${r.latency} ms</span><span class="mini">confidence ${pct}%</span><span class="mini">${esc(r.decision)}</span></div>
    <div class="sec-head"><b>Run Result</b><span class="right"><span class="mini">${esc(r.model)}</span></span></div><div class="bind-panel"><div style="padding:8px"><div style="font:8px var(--mono);color:#a5f3fc;margin-bottom:5px">output</div><div style="border:1px solid var(--line);border-radius:5px;background:#08111b;padding:7px;font:7px var(--mono);color:#b9c7da;line-height:1.6">${esc(r.output)}</div><div style="display:flex;align-items:center;gap:6px;margin-top:8px"><span class="mini">confidence</span><div class="confidence ${pct < 60 ? 'bad' : pct < 75 ? 'low' : ''}" style="width:150px"><i style="width:${pct}%"></i></div><b style="font:8px var(--mono);color:#dbeafe">${pct}%</b><span class="mini">${esc(r.decision)}</span></div><div class="sec-head" style="margin-top:8px"><b>Evidence</b></div><div class="wire-chips">${(r.evidence || []).map(x => `<span class="wire-chip cyan">${esc(x)}</span>`).join('')}</div></div></div>
    <div class="sec-head" style="margin-top:8px"><b>Run History</b><span class="right"><span class="mini">${RUNS.length} records</span></span></div><div class="bind-panel"><div class="table-wrap"><table><thead><tr><th>Run</th><th>Mode</th><th>Class</th><th>Decision</th><th>Confidence</th><th>Latency</th><th>Status</th></tr></thead><tbody>${RUNS.map(x => `<tr class="tr-node ${x.id === r.id ? 'on' : ''}" data-run-row="${esc(x.id)}"><td class="mono">${esc(x.id)}</td><td><span class="kind-badge ${x.mode === 'ai' ? 'line' : 'point'}">${esc(x.mode)}</span></td><td class="mono">${esc(x.classId)}</td><td class="mono">${esc(x.decision)}</td><td class="mono">${Math.round(x.confidence * 100)}%</td><td class="mono">${x.latency}ms</td><td class="mono">${esc(x.status)}</td></tr>`).join('')}</tbody></table></div></div>`;
  $$('#main [data-action]').forEach(b => b.onclick = () => handleAction(b.dataset.action));
  $$('#main [data-run-row]').forEach(el => el.onclick = () => { state.runId = el.dataset.runRow; renderAll(); });
}
function renderPolicyMain() {
  const a0 = FIELD_CLASSES.filter(c => c.autonomy === 'A0').length, a1 = FIELD_CLASSES.filter(c => c.autonomy === 'A1').length, a2 = FIELD_CLASSES.filter(c => c.autonomy === 'A2').length;
  $('#main').innerHTML = `<div class="hero"><div class="hero-icon" style="color:#f59e0b">⚖</div><div class="hero-main"><div class="kicker">Field Policy · 场层治理</div><h1>自主度与信任边界</h1><p>A0 只建议 / A1 草稿需批准 / A2 自动应用可撤销。A3 全自动禁止。</p></div><div class="hero-actions"><button class="btn primary" data-action="save-policy">保存策略</button></div></div><div class="stats"><span class="mini">${a0} A0</span><span class="mini">${a1} A1</span><span class="mini">${a2} A2</span><span class="mini">${RUNS.length} runs</span><span class="mini">threshold ${POLICY.confidenceThreshold}</span></div>
    <div class="policy-grid"><div class="policy-card"><label>autonomy ceiling</label><select id="policyAutonomy">${['A0', 'A1', 'A2'].map(x => `<option value="${x}" ${POLICY.autonomyCeiling === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div><div class="policy-card"><label>confidence threshold</label><input id="policyThreshold" type="number" min="0" max="1" step="0.05" value="${POLICY.confidenceThreshold}"></div><div class="policy-card"><label>privacy</label><select id="policyPrivacy">${['redact', 'block', 'allow'].map(x => `<option value="${x}" ${POLICY.privacy === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div><div class="policy-card"><label>fallback</label><select id="policyFallback">${['rules', 'ask', 'off'].map(x => `<option value="${x}" ${POLICY.fallback === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div><div class="policy-card"><label class="chk"><input type="checkbox" id="policyEvidence" ${POLICY.requireEvidence ? 'checked' : ''}> require evidence</label></div><div class="policy-card"><label class="chk"><input type="checkbox" id="policyUndo" ${POLICY.requireUndo ? 'checked' : ''}> require undo</label></div><div class="policy-card"><label class="chk"><input type="checkbox" id="policyExplain" ${POLICY.explain ? 'checked' : ''}> explain every suggestion</label></div></div>
    <div class="sec-head"><b>Autonomy Matrix</b></div><div class="policy-grid"><div class="policy-card"><label>A0 · suggest only</label><div class="mini">只读建议；无写入；无需 undo</div></div><div class="policy-card"><label>A1 · draft + approve</label><div class="mini">生成草稿；必须人工批准</div></div><div class="policy-card"><label>A2 · apply + undo</label><div class="mini">自动应用；必须有 undoToken</div></div><div class="policy-card"><label>A3 · forbidden</label><div class="mini" style="color:#fca5a5">全自动执行禁止</div></div></div>`;
  $$('#main [data-action]').forEach(b => b.onclick = () => handleAction(b.dataset.action));
}
function renderMain() {
  if (state.mode === 'field') renderFieldMain();
  else if (state.mode === 'ai') renderAIMain();
  else if (state.mode === 'runs') renderRunMain();
  else renderPolicyMain();
}
function renderInspector() {
  if (state.mode === 'runs') return renderRunInspector();
  if (state.mode === 'policy') return renderPolicyInspector();
  const c = activeClass(), i = activeInst();
  if (!c) { $('#inspector').innerHTML = '<div class="empty">选择类。</div>'; return; }
  const isAI = state.mode === 'ai';
  $('#inspector').innerHTML = `<div class="insp-kicker">${isAI ? 'AIClass' : 'FieldClass'} · ${isAI ? esc(c.group) : esc(c.family)}</div><div class="insp-title">${isAI ? '✦' : '✧'} ${esc(c.name)}</div><div class="insp-id">${esc(c.id)} · v${esc(c.version)}</div>
    <div class="insp-section"><div class="lh">Contract</div><div class="kv">${isAI ? `<div class="k">group</div><div class="v">${esc(c.group)}</div><div class="k">effect</div><div class="v">${esc(c.effect)}</div>` : `<div class="k">family</div><div class="v">${esc(c.family)}</div><div class="k">output</div><div class="v">${esc(c.output)}</div><div class="k">landing</div><div class="v">${esc(c.landing)}</div><div class="k">autonomy</div><div class="v">${esc(c.autonomy)}</div>`}<div class="k">priority</div><div class="v">${esc(c.priority)}</div><div class="k">instances</div><div class="v">${c.instances.length}</div></div></div>
    <div class="insp-section"><div class="lh">Summary</div><div style="font-size:8px;line-height:1.55;color:#9fb1c8">${esc(c.summary)}</div></div>
    ${i ? `<div class="insp-section"><div class="lh">Instance · ${esc(i.name)}</div><div class="kv"><div class="k">id</div><div class="v">${esc(i.id)}</div><div class="k">rev</div><div class="v">r${i.rev}</div><div class="k">status</div><div class="v">${esc(i.status)}</div><div class="k">detail</div><div class="v">${esc(i.detail)}</div></div><div class="actions" style="margin-top:5px"><button class="btn" data-action="run-instance">▶ 运行</button><button class="btn" data-action="edit-instance">✎ 编辑</button><button class="btn" data-action="duplicate-instance">⧉ 复制</button><button class="btn danger" data-action="delete-instance">⌫ 删除</button></div></div>` : ''}
    <div class="insp-section"><div class="lh">Class Actions</div><div class="actions"><button class="btn" data-action="edit-class">✎ 编辑</button><button class="btn" data-action="new-instance">＋ 实例</button><button class="btn danger" data-action="delete-class">⌫ 删除</button></div></div>`;
  $$('#inspector [data-action]').forEach(b => b.onclick = () => handleAction(b.dataset.action));
}
function renderRunInspector() {
  const r = run(); if (!r) { $('#inspector').innerHTML = '<div class="empty">暂无运行记录。</div>'; return; }
  const pct = Math.round(r.confidence * 100);
  $('#inspector').innerHTML = `<div class="insp-kicker">Run Inspector</div><div class="insp-title">${esc(r.id)}</div><div class="insp-id">${esc(r.classId)} → ${esc(r.instId)}</div><div class="insp-section"><div class="lh">Result</div><div class="kv"><div class="k">mode</div><div class="v">${esc(r.mode)}</div><div class="k">decision</div><div class="v">${esc(r.decision)}</div><div class="k">confidence</div><div class="v">${pct}%</div><div class="k">latency</div><div class="v">${r.latency}ms</div><div class="k">model</div><div class="v">${esc(r.model)}</div><div class="k">status</div><div class="v">${esc(r.status)}</div></div></div><div class="insp-section"><div class="lh">Output</div><div style="font:7px var(--mono);color:#b9c7da;line-height:1.55">${esc(r.output)}</div></div><div class="insp-section"><div class="lh">Evidence</div><div class="wire-chips">${(r.evidence || []).map(x => `<span class="wire-chip cyan">${esc(x)}</span>`).join('')}</div></div><div class="insp-section"><div class="actions"><button class="btn" data-action="new-run">＋ 新运行</button></div></div>`; $$('#inspector [data-action]').forEach(b => b.onclick = () => handleAction(b.dataset.action));
}
function renderPolicyInspector() {
  $('#inspector').innerHTML = `<div class="insp-kicker">Field Policy</div><div class="insp-title">治理摘要</div><div class="insp-id">A0–A2 · evidence · undo · explain</div><div class="insp-section"><div class="lh">Current</div><div class="kv"><div class="k">ceiling</div><div class="v">${esc(POLICY.autonomyCeiling)}</div><div class="k">threshold</div><div class="v">${POLICY.confidenceThreshold}</div><div class="k">privacy</div><div class="v">${esc(POLICY.privacy)}</div><div class="k">fallback</div><div class="v">${esc(POLICY.fallback)}</div><div class="k">evidence</div><div class="v">${POLICY.requireEvidence ? 'required' : 'optional'}</div><div class="k">undo</div><div class="v">${POLICY.requireUndo ? 'required' : 'optional'}</div><div class="k">explain</div><div class="v">${POLICY.explain ? 'required' : 'optional'}</div></div></div><div class="insp-section"><div class="lh">Principle</div><div class="note">可解释、可撤销、可退场。A3 全自动禁止；A2 必须有 undoToken。</div></div>`; }
function renderAll() { renderTopStats(); renderViewTabs(); renderLeft(); renderMain(); renderInspector(); }
function openModal(html) { $('#modalRoot').innerHTML = `<div class="modal-overlay" id="modalOverlay"><div class="modal">${html}</div></div>`; }
function closeModal() { $('#modalRoot').innerHTML = ''; }
function confirmModal(title, message, label, onConfirm) { openModal(`<h3>${esc(title)}</h3><p>${esc(message)}</p><div class="modal-actions"><button class="btn" data-modal-close>取消</button><button class="btn danger" id="modalConfirm">${esc(label)}</button></div>`); $('#modalConfirm').onclick = () => { closeModal(); onConfirm(); }; }
function openClassModal(edit = false) {
  const isAI = state.mode === 'ai';
  const c = edit ? activeClass() : null;
  openModal(`<h3>${edit ? '编辑' : '新建'} ${isAI ? 'AIClass' : 'FieldClass'}</h3><p>${isAI ? 'AI 能力契约：模型/provider + prompt + tools + guardrails。' : 'Field 智能契约：输入/输出 + 落点 + 自主度上限。'}</p><div class="form-grid"><div class="field"><label>ID</label><input id="mClassId" value="${esc(c?.id || (isAI ? 'ai.custom' : 'field.custom'))}" ${edit ? 'disabled' : ''}></div><div class="field"><label>名称</label><input id="mClassName" value="${esc(c?.name || 'Custom')}"></div><div class="field"><label>version</label><input id="mClassVersion" value="${esc(c?.version || '0.1.0')}"></div><div class="field"><label>priority</label><select id="mClassPriority">${['P0', 'P1', 'P2'].map(x => `<option value="${x}" ${(c?.priority || 'P1') === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div><div class="field full"><label>summary</label><textarea id="mClassSummary">${esc(c?.summary || '')}</textarea></div>${isAI ? `<div class="field"><label>group</label><input id="mClassGroup" value="${esc(c?.group || '模型与提示')}"></div><div class="field"><label>effect</label><select id="mClassEffect">${['L0', 'L1', 'L2'].map(x => `<option value="${x}" ${(c?.effect || 'L1') === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div><div class="field"><label>provider</label><input id="mClassProvider" value="${esc(c?.config?.provider || 'local')}"></div><div class="field"><label>model</label><input id="mClassModel" value="${esc(c?.config?.model || 'fast')}"></div><div class="field full"><label>prompt</label><input id="mClassPrompt" value="${esc(c?.config?.prompt || '')}"></div><div class="field full"><label>tools</label><input id="mClassTools" value="${esc(c?.config?.tools || '')}"></div><div class="field full"><label>guardrails</label><input id="mClassGuards" value="${esc(c?.config?.guardrails || '')}"></div>` : `<div class="field"><label>family</label><select id="mClassFamily">${FAMILIES.map(x => `<option value="${x}" ${(c?.family || 'perceive') === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div><div class="field"><label>autonomy</label><select id="mClassAutonomy">${['A0', 'A1', 'A2'].map(x => `<option value="${x}" ${(c?.autonomy || 'A1') === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div><div class="field"><label>output</label><input id="mClassOutput" value="${esc(c?.output || 'suggestion')}"></div><div class="field"><label>landing</label><input id="mClassLanding" value="${esc(c?.landing || 'all')}"></div>`}</div><div class="modal-actions"><button class="btn" data-modal-close>取消</button><button class="btn primary" id="classSave">${edit ? '保存' : '创建'}</button></div>`);
  $('#classSave').onclick = () => {
    const id = $('#mClassId').value.trim(), name = $('#mClassName').value.trim(); if (!id || !name) { showToast('ID 和名称必填'); return; }
    const list = isAI ? AI_CLASSES : FIELD_CLASSES;
    if (!edit && list.some(x => x.id === id)) { showToast('ID 已存在'); return; }
    const base = { id, name, version: $('#mClassVersion').value.trim() || '1.0.0', priority: $('#mClassPriority').value, status: c?.status || 'active', summary: $('#mClassSummary').value.trim() };
    const data = isAI ? { ...base, group: $('#mClassGroup').value.trim() || '模型与提示', effect: $('#mClassEffect').value, config: { provider: $('#mClassProvider').value.trim() || 'local', model: $('#mClassModel').value.trim() || 'fast', prompt: $('#mClassPrompt').value.trim(), tools: $('#mClassTools').value.trim(), guardrails: $('#mClassGuards').value.trim() } } : { ...base, family: $('#mClassFamily').value, autonomy: $('#mClassAutonomy').value, output: $('#mClassOutput').value.trim() || 'suggestion', landing: $('#mClassLanding').value.trim() || 'all' };
    if (edit) { Object.assign(c, data); showToast('已更新'); }
    else { list.push({ ...data, instances: [] }); if (isAI) state.aiClassId = id; else state.fieldClassId = id; showToast('已创建'); }
    saveData(); closeModal(); ensureSelection(); updateHash(); renderAll();
  };
}
function openInstanceModal(edit = false) {
  const isAI = state.mode === 'ai', c = activeClass(), i = edit ? activeInst() : null;
  if (!c) return;
  openModal(`<h3>${edit ? '编辑' : '新建'} ${isAI ? 'AIInstance' : 'FieldInstance'}</h3><p>${isAI ? 'AIInstance = AIClass + provider/model + 参数 + revision。' : 'FieldInstance = FieldClass + 作用域 + 输出绑定 + revision。'}</p><div class="form-grid"><div class="field"><label>name</label><input id="mInstName" value="${esc(i?.name || 'new-instance')}"></div><div class="field"><label>status</label><select id="mInstStatus">${['active', 'draft', 'archived'].map(x => `<option value="${x}" ${(i?.status || 'active') === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div><div class="field"><label>rev</label><input id="mInstRev" type="number" value="${i?.rev || 1}"></div><div class="field full"><label>detail</label><textarea id="mInstDetail">${esc(i?.detail || '')}</textarea></div>${isAI ? `<div class="field"><label>provider</label><input id="mInstProvider" value="${esc(i?.config?.provider || c.config?.provider || 'local')}"></div><div class="field"><label>model</label><input id="mInstModel" value="${esc(i?.config?.model || c.config?.model || 'fast')}"></div>` : `<div class="field"><label>scope</label><input id="mInstScope" value="${esc(i?.scope || 'global')}"></div><div class="field"><label>output</label><input id="mInstOutput" value="${esc(i?.output || c.output || '')}"></div>`}</div><div class="modal-actions"><button class="btn" data-modal-close>取消</button><button class="btn primary" id="instSave">${edit ? '保存新 revision' : '创建'}</button></div>`);
  $('#instSave').onclick = () => {
    const name = $('#mInstName').value.trim(); if (!name) { showToast('name 必填'); return; }
    const data = { name, rev: edit ? (i.rev || 1) + 1 : Number($('#mInstRev').value) || 1, status: $('#mInstStatus').value, detail: $('#mInstDetail').value.trim() };
    if (isAI) data.config = { provider: $('#mInstProvider').value.trim(), model: $('#mInstModel').value.trim() };
    else { data.scope = $('#mInstScope').value.trim(); data.output = $('#mInstOutput').value.trim(); }
    const id = edit ? i.id : `${c.id}.${name.replace(/\s+/g, '-')}@r1`; data.id = id; data.classId = c.id;
    if (edit) Object.assign(i, data); else c.instances.push(data);
    if (isAI) state.aiInstId = id; else state.fieldInstId = id;
    saveData(); closeModal(); updateHash(); renderAll(); showToast(edit ? '实例已更新 · rev +1' : '实例已创建');
  };
}
function newRun() {
  const isAI = state.mode === 'ai';
  const c = (state.mode === 'field' || state.mode === 'ai') ? activeClass() : (run()?.mode === 'ai' ? aiClass() : fieldClass());
  const i = (state.mode === 'field' || state.mode === 'ai') ? activeInst() : (run()?.mode === 'ai' ? aiInst() : fieldInst());
  if (!c) return;
  const confidence = Math.round((0.55 + Math.random() * 0.4) * 100) / 100;
  const decision = confidence < POLICY.confidenceThreshold ? 'A0 ask' : isAI ? 'A1 draft' : c.autonomy === 'A2' ? 'A2 apply + undo' : c.autonomy === 'A1' ? 'A1 draft' : 'A0 suggest';
  const r = { id: `run-${String(Date.now()).slice(-6)}`, mode: isAI ? 'ai' : 'field', classId: c.id, instId: i?.id || c.id, output: isAI ? c.summary : c.output, confidence, decision, latency: Math.round(30 + Math.random() * 1500), status: confidence < POLICY.confidenceThreshold ? 'warn' : 'ok', evidence: isAI ? ['prompt', 'context', 'tools'] : ['context_snapshot', 'class_contract', 'landing'], model: isAI ? `${c.config?.provider || 'local'}/${c.config?.model || 'fast'}` : 'local/rules' };
  RUNS.unshift(r); state.mode = 'runs'; state.runId = r.id; saveData(); updateHash(); renderAll(); showToast('已生成运行记录');
}
function savePolicy() {
  POLICY = { autonomyCeiling: $('#policyAutonomy').value, confidenceThreshold: Number($('#policyThreshold').value) || 0.6, privacy: $('#policyPrivacy').value, fallback: $('#policyFallback').value, requireEvidence: $('#policyEvidence').checked, requireUndo: $('#policyUndo').checked, explain: $('#policyExplain').checked };
  saveData(); renderAll(); showToast('Field Policy 已保存');
}
function handleAction(action) {
  const c = activeClass(), i = activeInst();
  if (action === 'new-class') { openClassModal(false); return; }
  if (action === 'edit-class') { openClassModal(true); return; }
  if (action === 'delete-class') { if (!c) return; confirmModal('删除类？', `会删除 ${c.id} 及其 ${c.instances.length} 个实例。`, '删除', () => { if (state.mode === 'ai') { AI_CLASSES = AI_CLASSES.filter(x => x.id !== c.id); state.aiClassId = AI_CLASSES[0]?.id || ''; } else { FIELD_CLASSES = FIELD_CLASSES.filter(x => x.id !== c.id); state.fieldClassId = FIELD_CLASSES[0]?.id || ''; } saveData(); ensureSelection(); updateHash(); renderAll(); showToast('类已删除'); }); return; }
  if (action === 'new-instance') { openInstanceModal(false); return; }
  if (action === 'edit-instance') { openInstanceModal(true); return; }
  if (action === 'duplicate-instance') { if (!i || !c) return; const copy = deep(i); copy.id = `${i.id}.copy-${Date.now()}`; copy.name = `${i.name} 副本`; copy.rev = 1; copy.status = 'draft'; c.instances.push(copy); if (state.mode === 'ai') state.aiInstId = copy.id; else state.fieldInstId = copy.id; saveData(); updateHash(); renderAll(); showToast('实例已复制'); return; }
  if (action === 'delete-instance') { if (!i || !c) return; confirmModal('删除实例？', `会删除 ${i.name}。`, '删除', () => { c.instances = c.instances.filter(x => x.id !== i.id); if (state.mode === 'ai') state.aiInstId = c.instances[0]?.id || ''; else state.fieldInstId = c.instances[0]?.id || ''; saveData(); ensureSelection(); updateHash(); renderAll(); showToast('实例已删除'); }); return; }
  if (action === 'run-instance' || action === 'new-run') { newRun(); return; }
  if (action === 'save-policy') { savePolicy(); return; }
  if (action === 'reset-data') { confirmModal('重置示例数据？', '会覆盖本地新增/修改，恢复 23 FieldClass / 78 FieldInstance / 29 AIClass / 124 AIInstance。', '重置', () => { FIELD_CLASSES = deep(FIELD_DATA.classes); AI_CLASSES = deep(AI_DATA.classes); RUNS = []; POLICY = { ...DEFAULT_POLICY }; saveData(); ensureSelection(); updateHash(); renderAll(); showToast('示例数据已重置'); }); return; }
}
function init() {
  parseHash(); ensureSelection(); renderAll();
  $('#viewTabs').addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (!b) return; state.mode = b.dataset.view; updateHash(); renderAll(); });
  $('#modalRoot').addEventListener('click', e => { if (e.target.id === 'modalOverlay' || e.target.closest('[data-modal-close]')) closeModal(); });
  window.addEventListener('hashchange', () => { parseHash(); ensureSelection(); renderAll(); });
}
init();
})();
