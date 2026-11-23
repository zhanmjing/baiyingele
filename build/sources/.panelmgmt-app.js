(() => {
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const deep = o => JSON.parse(JSON.stringify(o));
const GROUPS = {
  inspect: { label: 'Inspect', color: '#22d3ee' },
  edit: { label: 'Edit', color: '#3b82f6' },
  ai: { label: 'AI', color: '#8b5cf6' },
  data: { label: 'Data', color: '#22c55e' },
  system: { label: 'System', color: '#f59e0b' }
};
const STORAGE = 'baiying.panelManager.v1';
let CLASSES = deep(PANEL_DATA.classes).map(c => ({ ...c, status: c.status || 'active' }));
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE) || 'null');
  if (saved && Array.isArray(saved.classes) && saved.classes.length) CLASSES = saved.classes;
} catch (_) {}
const state = {
  classId: CLASSES[0]?.id || '',
  instLabel: CLASSES[0]?.instances[0]?.label || '',
  mode: 'right',
  width: 380,
  anatomy: false,
  panelState: 'ready',
  query: '',
  toastTimer: null
};
const cls = () => CLASSES.find(c => c.id === state.classId) || CLASSES[0];
const ins = () => cls()?.instances.find(i => i.label === state.instLabel) || cls()?.instances[0] || null;
const groupMeta = g => GROUPS[g] || { label: g, color: '#22d3ee' };
const totalInstances = () => CLASSES.reduce((n, c) => n + c.instances.length, 0);
function saveData() { try { localStorage.setItem(STORAGE, JSON.stringify({ classes: CLASSES, savedAt: new Date().toISOString() })); } catch (_) {} }
function showToast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => t.classList.remove('show'), 1800); }
function updateHash() { const h = `#${encodeURIComponent(state.classId)}${state.instLabel ? '/' + encodeURIComponent(state.instLabel) : ''}`; if (location.hash !== h) history.replaceState(null, '', h); }
function parseHash() {
  const parts = (location.hash || '').replace(/^#/, '').split('/').map(decodeURIComponent).filter(Boolean);
  if (parts[0] && CLASSES.some(c => c.id === parts[0])) state.classId = parts[0];
  const c = cls();
  if (parts[1] && c.instances.some(i => i.label === parts[1])) state.instLabel = parts[1];
  ensureSelection();
}
function ensureSelection() {
  if (!CLASSES.length) { state.classId = ''; state.instLabel = ''; return; }
  if (!CLASSES.some(c => c.id === state.classId)) state.classId = CLASSES[0].id;
  const c = cls();
  if (!c.instances.some(i => i.label === state.instLabel)) state.instLabel = c.instances[0]?.label || '';
  const i = ins();
  if (i) { state.mode = i.mode || state.mode; state.width = Number(i.width) || state.width; }
}
function renderTopStats() {
  const groups = [...new Set(CLASSES.map(c => c.group))];
  $('#topStats').innerHTML = `<span class="mini cyan">${CLASSES.length} PanelClass</span><span class="mini">${totalInstances()} PanelInstance</span><span class="mini violet">${groups.length} groups</span><span class="mini green">${CLASSES.filter(c => c.status === 'active').length} active</span>`;
}
function filteredClasses() {
  const q = state.query.trim().toLowerCase();
  if (!q) return CLASSES;
  return CLASSES.filter(c => [c.id, c.name, c.desc, c.group, c.content, ...c.instances.map(i => i.label + ' ' + i.content)].join(' ').toLowerCase().includes(q));
}
function renderLeft() {
  const c = cls();
  const list = filteredClasses();
  const instances = c?.instances || [];
  $('#leftPane').innerHTML = `<div class="pane-head"><b>PanelClass · 面板类</b><span class="count">${CLASSES.length}</span><button data-action="new-class" title="新建 PanelClass">＋</button></div>
    <input class="panel-search" id="panelSearch" placeholder="搜索 panel / content / instance…" value="${esc(state.query)}">
    ${list.map(x => `<div class="flow-item ${x.id === c?.id ? 'on' : ''}" data-panel-class="${esc(x.id)}"><div class="fi-top"><span class="fi-name">${esc(x.icon)} ${esc(x.name)}</span><span class="fi-ver">${x.instances.length}</span></div><div class="fi-id">${esc(x.id)}</div><div class="fi-meta"><span class="fi-badge">${esc(groupMeta(x.group).label)}</span><span class="fi-badge">${esc(x.modes.join(' / '))}</span></div></div>`).join('') || '<div class="empty">没有匹配的面板类。</div>'}
    <div class="pane-head" style="margin-top:10px"><b>PanelInstance · 面板实例</b><span class="count">${instances.length}</span><button data-action="new-instance" title="新建 PanelInstance">＋</button></div>
    ${instances.map(i => `<div class="inst-item ${i.label === state.instLabel ? 'on' : ''}" data-panel-inst="${esc(i.label)}"><div class="ii-top"><span class="ii-name">${esc(i.label)}</span><span class="ii-rev">r${i.rev}</span></div><div class="ii-id">${esc(i.content)}</div><span class="ii-status">${esc(i.mode)} · ${i.width}px</span></div>`).join('') || '<div class="empty">暂无实例。</div>'}
    <div style="margin-top:10px"><button class="btn" style="width:100%;justify-content:center" data-action="reset-data">↺ 重置示例数据</button></div>`;
  const search = $('#panelSearch');
  if (search) search.addEventListener('input', e => { state.query = e.target.value; renderLeft(); });
  $$('#leftPane [data-panel-class]').forEach(el => el.onclick = () => { state.classId = el.dataset.panelClass; state.instLabel = cls().instances[0]?.label || ''; ensureSelection(); updateHash(); renderAll(); });
  $$('#leftPane [data-panel-inst]').forEach(el => el.onclick = () => { state.instLabel = el.dataset.panelInst; ensureSelection(); updateHash(); renderAll(); });
  $$('#leftPane [data-action]').forEach(b => b.onclick = () => handleAction(b.dataset.action));
}
function row(k, v, box = false) { return `<div class="wire-row"><span class="wire-k">${esc(k)}</span>${box ? '<span class="wf-box"></span>' : `<span class="wire-v">${esc(v)}</span>`}</div>`; }
function field(k, v) { return `<div class="wire-field"><span class="wf-name">${esc(k)}</span><span class="wf-val">${esc(v)}</span></div>`; }
function wbox(title, html) { return `<div class="wire-box"><div class="wb-title">${esc(title)}</div>${html}</div>`; }
function skeleton() { return Array.from({ length: 7 }, (_, i) => `<div class="wire-skeleton" style="width:${[45,88,72,80,60,90,66][i]}%"></div>`).join(''); }
function emptyState(c, i) { return `<div class="wire-empty"><b>No content</b><p>${esc(i?.content || c.content)} 还没有数据。可以运行上游流程或切换实例。</p><span class="wire-btn">Run upstream</span></div>`; }
function errorState() { return `<div class="wire-empty" style="color:#fca5a5"><b style="color:#fca5a5">Panel failed to load</b><p>内容返回错误。检查权限/网络/上游流程，或重试。</p><span class="wire-btn red">Retry</span></div>`; }
function contentHTML(c, i, panelState) {
  if (panelState === 'loading') return skeleton();
  if (panelState === 'empty') return emptyState(c, i);
  if (panelState === 'error' || panelState === 'blocked') return errorState();
  if (panelState === 'needsApproval') return wbox('Risk · L2', '<div class="wire-chips"><span class="wire-chip amber">irreversible</span><span class="wire-chip amber">external tool</span><span class="wire-chip">approval required</span></div>') + '<div class="wire-code"><span class="del">- openExternal(url)</span><br><span class="add">+ ensureVpn()</span><br><span class="add">+ openExternal(url)</span></div><div class="wire-chips"><span class="wire-btn">Approve</span><span class="wire-btn red">Deny</span><span class="wire-btn">Reason…</span></div>';
  if (panelState === 'streaming') return '<div class="wire-msg me">帮我总结这个 PR 的风险。</div><div class="wire-msg">正在阅读 diff…<br><span style="color:#5f7188">tool: github.diff · 42 files</span></div><div class="wire-msg">发现 3 个风险点：权限检查缺失 / 错误分支未覆盖 / 缺少回归测试<span style="color:#a5f3fc">▍</span></div>';
  const f = (c.id || '').split('.')[1] || '';
  if (f === 'inspector') return wbox('Selection', row('class', 'point.vpn.status') + row('instance', 'vpn.default.status@r1') + row('revision', 'r1') + row('effect', 'L0')) + wbox('Params', '<div class="wire-chips"><span class="wire-chip">profile=work</span><span class="wire-chip">timeoutMs=12000</span></div>') + wbox('Bindings', '<div class="wire-chips"><span class="wire-chip">scope=body.external-access</span><span class="wire-chip">slot=vpn.status</span></div>') + '<div class="wire-chips"><span class="wire-btn primary">Save</span><span class="wire-btn">Reset</span></div>';
  if (f === 'settings') return wbox('General', field('Profile', 'work') + field('Auto connect', 'on') + field('Protocol', 'WireGuard')) + wbox('Advanced', field('MTU', '1420') + field('DNS', '1.1.1.1') + field('Kill switch', 'on')) + '<div class="wire-chips"><span class="wire-btn primary">Save changes</span><span class="wire-btn">Cancel</span></div>';
  if (f === 'command') return '<div class="wire-search">⌘ Type a command…</div>' + ['Open GitHub', 'Ensure VPN', 'Preview file', 'Archive invoice'].map((x, idx) => `<div class="wire-list-row"><span class="wr-dot" style="background:${idx === 0 ? '#22d3ee' : '#22c55e'}"></span><div class="wr-main"><div class="wr-title">${x}</div><div class="wr-sub">${idx === 0 ? 'flow · L2' : 'point · L0'}</div></div><span class="wire-chip">↵</span></div>`).join('') + '<div class="wire-chips"><span class="wire-chip">↑↓ navigate</span><span class="wire-chip">↵ run</span><span class="wire-chip">esc close</span></div>';
  if (f === 'run-history') return '<div class="wire-chips" style="margin-bottom:5px"><span class="wire-chip cyan">All</span><span class="wire-chip">Errors</span><span class="wire-chip">Slow</span></div>' + ['flow.ensure-vpn · ok · 842ms', 'flow.open-site · failed · E_TARGET', 'flow.preview · ok · 120ms', 'flow.archive · ok · 2.4s'].map((x, idx) => `<div class="wire-list-row"><span class="wr-dot" style="background:${idx === 1 ? '#ef4444' : '#22c55e'}"></span><div class="wr-main"><div class="wr-title">${x.split(' · ')[0]}</div><div class="wr-sub">${x.split(' · ').slice(1).join(' · ')}</div></div><span class="wire-chip">↻</span></div>`).join('');
  if (f === 'artifact') return '<div class="wire-chips" style="margin-bottom:5px"><span class="wire-chip cyan">Preview</span><span class="wire-chip">Source</span><span class="wire-chip">Versions</span></div><div class="wire-code">export function PriceTag({ value }) {\n  return &lt;span className="tag"&gt;{value}&lt;/span&gt;;\n}</div><div class="wire-chips"><span class="wire-btn primary">Edit</span><span class="wire-btn">Export</span><span class="wire-btn">v2</span></div>';
  if (f === 'chat') return '<div class="wire-msg me">这个面板应该用什么 placement？</div><div class="wire-msg">持续工作的 side panel 用 docked right；短任务用 floating；不可逆动作才用 modal。</div><div class="wire-msg">推荐：<span style="color:#a5f3fc">panel.inspector · right · resizable</span></div><div class="wire-search">Ask anything… <span style="float:right;color:#a5f3fc">Send ↵</span></div>';
  if (f === 'approval') return wbox('Risk · L2', '<div class="wire-chips"><span class="wire-chip amber">irreversible</span><span class="wire-chip amber">external tool</span><span class="wire-chip">approval required</span></div>') + '<div class="wire-code"><span class="del">- openExternal(url)</span><br><span class="add">+ ensureVpn()</span><br><span class="add">+ openExternal(url)</span></div><div class="wire-chips"><span class="wire-btn primary">Approve</span><span class="wire-btn red">Deny</span><span class="wire-btn">Reason…</span></div>';
  if (f === 'notifications') return '<div class="wire-list-row"><span class="wr-dot"></span><div class="wr-main"><div class="wr-title">VPN connected</div><div class="wr-sub">just now · network</div></div><span class="wire-chip">dismiss</span></div><div class="wire-list-row"><span class="wr-dot" style="background:#f59e0b"></span><div class="wr-main"><div class="wr-title">Update available</div><div class="wr-sub">2 min ago · system</div></div><span class="wire-chip">install</span></div>';
  if (f === 'launcher') return '<div class="wire-chips" style="margin-bottom:5px"><span class="wire-chip cyan">常用</span><span class="wire-chip">开发</span><span class="wire-chip">系统</span></div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px">' + Array.from({ length: 8 }, (_, idx) => `<div class="wire-list-row" style="flex-direction:column;align-items:flex-start;gap:1px;padding:4px"><span class="wr-dot" style="width:12px;height:12px;border-radius:3px;background:${idx % 2 ? '#8b5cf6' : '#22d3ee'}"></span><div class="wr-title">${['GitHub', 'VS Code', '终端', '设置', '翻译', '发票', '剪贴板', '系统'][idx]}</div></div>`).join('') + '</div>';
  if (f === 'dashboard') return '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-bottom:5px">' + [['CPU', '42%'], ['GPU', '18%'], ['MEM', '64%']].map(([k, v]) => `<div class="wire-box"><div class="wb-title">${k}</div><div style="font:12px var(--mono);color:#dbeafe">${v}</div></div>`).join('') + '</div>' + wbox('Trend', '<div class="wire-code">▁▂▃▅▆▇█▇▆▅▃▂▁▂▄▆▇█▆▄▂</div>');
  if (f === 'diff') return '<div class="wire-code"><span class="del">- timeout: 12000</span><br><span class="add">+ timeout: 15000</span><br><br><span class="del">- retry: 1</span><br><span class="add">+ retry: 3</span></div><div class="wire-chips"><span class="wire-btn primary">Accept</span><span class="wire-btn red">Revert</span></div>';
  if (f === 'preview') return wbox('Preview', '<div style="height:80px;border:1px dashed rgba(148,163,184,.2);border-radius:4px;display:grid;place-items:center;color:#5f7188;font:7px var(--mono)">PDF / Image / Video preview</div>') + '<div class="wire-chips"><span class="wire-btn">Zoom</span><span class="wire-btn">Open external</span></div>';
  if (f === 'trace') return ['tool: github.diff · 42 files · 120ms', 'tool: vpn.status · ok · 8ms', 'tool: file.preview · error · E_PERM'].map((x, idx) => `<div class="wire-list-row"><span class="wr-dot" style="background:${idx === 2 ? '#ef4444' : '#22c55e'}"></span><div class="wr-main"><div class="wr-title">${x.split(' · ')[0]}</div><div class="wr-sub">${x.split(' · ').slice(1).join(' · ')}</div></div><span class="wire-chip">↻</span></div>`).join('');
  if (f === 'console') return '<div class="wire-code">$ npm run dev<br><span class="add">ready in 820ms</span><br>$ npm test<br><span class="add">✓ 42 passing</span><br><span class="del">✗ 1 failing</span><br>$ _</div>';
  return wbox('Content', row('class', c.id) + row('instance', i?.label || '—') + row('state', i?.state || 'ready') + row('content', i?.content || c.content));
}
function previewHTML(c, i) {
  const mode = state.mode;
  return `<div class="pv-workbench mode-${esc(mode)} ${state.anatomy ? 'pv-anatomy' : ''}" id="pvWorkbench" style="--pw:${state.width}px">
    <div class="pv-fake-sidebar"><div class="fs-brand">◆ WORKSPACE</div><div class="fs-item on">Overview</div><div class="fs-item">Flows</div><div class="fs-item">Points</div><div class="fs-item">Surfaces</div><div class="fs-item">Panels</div><div class="fs-item">Settings</div></div>
    <div class="pv-fake-main"><div class="fm-kicker">Workspace / Surface</div><h2>${esc(c.name)}</h2><p>${esc(c.desc)}</p><div class="pv-fake-cards"><div class="pv-fake-card"><span></span><span></span></div><div class="pv-fake-card"><span></span><span></span></div><div class="pv-fake-card"><span></span><span></span></div></div></div>
    <div class="pv-backdrop"></div>
    <section class="pv-shell" data-region="panel">
      <header class="pv-head" data-region="header"><div class="pv-h-icon">${esc(c.icon)}</div><div class="pv-h-main"><div class="pv-h-name">${esc(i?.label || c.name)}</div><div class="pv-h-sub">${esc(c.id)} @ r${i?.rev || 1} · ${esc(i?.mode || mode)} · ${i?.width || state.width}px</div></div><div class="pv-h-actions"><span class="pv-icon-btn">□</span><span class="pv-icon-btn">×</span></div></header>
      <div class="pv-toolbar" data-region="toolbar"><span class="pv-tab on">Preview</span><span class="pv-tab">Source</span><span class="pv-tab">Versions</span><span class="pv-sep"></span><span class="pv-tab">${esc(c.group)}</span><span class="pv-tab" style="margin-left:auto">${esc(i?.state || 'ready')}</span></div>
      <div class="pv-body" data-region="body">${contentHTML(c, i, state.panelState)}</div>
      <footer class="pv-foot" data-region="footer"><span class="dot"></span><span>${esc(c.content)}</span><span class="grow"></span><span>${state.width}px · r${i?.rev || 1}</span></footer>
    </section>
  </div>`;
}
function renderMain() {
  const c = cls(), i = ins();
  if (!c) { $('#main').innerHTML = '<div class="empty">没有 PanelClass。</div>'; return; }
  const gm = groupMeta(c.group);
  $('#main').innerHTML = `<div class="hero"><div class="hero-icon" style="color:${gm.color}">${esc(c.icon)}</div><div class="hero-main"><div class="kicker">PanelClass · ${esc(gm.label)}</div><h1>${esc(c.name)}</h1><p>${esc(c.desc)}</p></div><div class="hero-actions"><button class="btn" data-action="edit-class">✎ 编辑类</button><button class="btn primary" data-action="new-instance">＋ 实例</button><button class="btn danger" data-action="delete-class">⌫ 删除类</button></div></div>
    <div class="stats"><span class="mini cyan">${c.modes.join(' / ')}</span><span class="mini">${c.regions.length} regions</span><span class="mini">${c.instances.length} instances</span><span class="mini violet">v${esc(c.version)}</span><span class="mini">${esc(c.content)}</span></div>
    <div class="panel-toolbar"><div class="group">${['right', 'left', 'bottom', 'floating', 'modal', 'sheet'].map(m => `<button data-mode-btn="${m}" class="${state.mode === m ? 'on' : ''}">${m}</button>`).join('')}</div><span class="mini">width</span><input id="pwRange" type="range" min="300" max="720" value="${state.width}"><b id="pwLabel" class="mono" style="color:#a5f3fc">${state.width}px</b><select id="instSel">${c.instances.map(x => `<option value="${esc(x.label)}" ${x.label === state.instLabel ? 'selected' : ''}>${esc(x.label)} · r${x.rev}</option>`).join('')}</select><label class="chk"><input type="checkbox" id="anatomyChk" ${state.anatomy ? 'checked' : ''}> anatomy</label><select id="panelStateSel">${['ready', 'loading', 'empty', 'error', 'streaming', 'needsApproval', 'blocked'].map(s => `<option value="${s}" ${state.panelState === s ? 'selected' : ''}>${s}</option>`).join('')}</select><button class="btn small" data-action="reset-view">reset view</button></div>
    ${previewHTML(c, i)}
    <div class="bind-panel"><div class="panel-head"><b>Panel Contract</b><span class="sub">${esc(c.id)}</span><span class="right"><span class="mini">${esc(c.content)}</span></span></div><div style="padding:7px 8px"><div class="wire-chips" style="margin-bottom:5px">${c.states.map(s => `<span class="wire-chip amber">${esc(s)}</span>`).join('')}${c.behaviors.map(b => `<span class="wire-chip cyan">${esc(b)}</span>`).join('')}</div><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px">${[['modes', c.modes.join(' / ')], ['regions', c.regions.join(' / ')], ['version', 'v' + c.version], ['a11y', c.a11y.join(' / ')], ['instances', c.instances.length], ['status', c.status || 'active']].map(([k, v]) => `<div class="contract-cell"><div class="cc-k">${esc(k)}</div><div class="cc-v">${esc(v)}</div></div>`).join('')}</div></div></div>`;
  $$('#main [data-mode-btn]').forEach(b => b.onclick = () => { state.mode = b.dataset.modeBtn; renderMain(); });
  $$('#main [data-action]').forEach(b => b.onclick = () => handleAction(b.dataset.action));
  const range = $('#pwRange'); if (range) range.addEventListener('input', e => { state.width = Number(e.target.value); $('#pwLabel').textContent = state.width + 'px'; const wb = $('#pvWorkbench'); if (wb) wb.style.setProperty('--pw', state.width + 'px'); });
  const isel = $('#instSel'); if (isel) isel.addEventListener('change', e => { state.instLabel = e.target.value; ensureSelection(); updateHash(); renderAll(); });
  const achk = $('#anatomyChk'); if (achk) achk.addEventListener('change', e => { state.anatomy = e.target.checked; renderMain(); });
  const psel = $('#panelStateSel'); if (psel) psel.addEventListener('change', e => { state.panelState = e.target.value; renderMain(); });
}
function renderInspector() {
  const c = cls(), i = ins();
  if (!c) { $('#inspector').innerHTML = '<div class="empty">没有面板类。</div>'; return; }
  const gm = groupMeta(c.group);
  $('#inspector').innerHTML = `<div class="insp-kicker">PanelClass · 面板类</div><div class="insp-title">${esc(c.icon)} ${esc(c.name)}</div><div class="insp-id">${esc(c.id)} · v${esc(c.version)}</div>
    <div class="insp-section"><div class="lh">Contract</div><div class="kv"><div class="k">group</div><div class="v" style="color:${gm.color}">${esc(gm.label)}</div><div class="k">status</div><div class="v">${esc(c.status || 'active')}</div><div class="k">modes</div><div class="v">${esc(c.modes.join(' / '))}</div><div class="k">regions</div><div class="v">${esc(c.regions.join(' / '))}</div><div class="k">content</div><div class="v">${esc(c.content)}</div><div class="k">instances</div><div class="v">${c.instances.length}</div></div></div>
    <div class="insp-section"><div class="lh">Instance · ${esc(i?.label || '—')}</div><div class="kv"><div class="k">mode</div><div class="v">${esc(i?.mode || '—')}</div><div class="k">width</div><div class="v">${i?.width || '—'} px</div><div class="k">state</div><div class="v">${esc(i?.state || '—')}</div><div class="k">rev</div><div class="v">r${i?.rev || 1}</div><div class="k">content</div><div class="v">${esc(i?.content || '—')}</div></div></div>
    <div class="insp-section"><div class="lh">States</div>${c.states.map(x => `<span class="wire-chip amber">${esc(x)}</span>`).join(' ')}</div>
    <div class="insp-section"><div class="lh">Behaviors</div>${c.behaviors.map(x => `<span class="wire-chip cyan">${esc(x)}</span>`).join(' ') || '<span class="empty">无</span>'}</div>
    <div class="insp-section"><div class="lh">A11y</div>${c.a11y.map(x => `<span class="wire-chip">${esc(x)}</span>`).join(' ') || '<span class="empty">无</span>'}</div>
    <div class="insp-section"><div class="lh">Class Actions</div><div class="actions"><button class="btn" data-action="edit-class">✎ 编辑</button><button class="btn" data-action="new-instance">＋ 实例</button><button class="btn danger" data-action="delete-class">⌫ 删除</button></div></div>
    ${i ? `<div class="insp-section"><div class="lh">Instance Actions</div><div class="actions"><button class="btn" data-action="edit-instance">✎ 编辑</button><button class="btn" data-action="duplicate-instance">⧉ 复制</button><button class="btn danger" data-action="delete-instance">⌫ 删除</button></div></div>` : ''}`;
  $$('#inspector [data-action]').forEach(b => b.onclick = () => handleAction(b.dataset.action));
}
function openModal(html) { $('#modalRoot').innerHTML = `<div class="modal-overlay" id="modalOverlay"><div class="modal">${html}</div></div>`; }
function closeModal() { $('#modalRoot').innerHTML = ''; }
function confirmModal(title, message, label, onConfirm) {
  openModal(`<h3>${esc(title)}</h3><p>${esc(message)}</p><div class="modal-actions"><button class="btn" data-modal-close>取消</button><button class="btn danger" id="modalConfirm">${esc(label)}</button></div>`);
  $('#modalConfirm').onclick = () => { closeModal(); onConfirm(); };
}
function openClassModal(edit = false) {
  const c = edit ? cls() : null;
  openModal(`<h3>${edit ? '编辑 PanelClass' : '新建 PanelClass'}</h3><p>PanelClass = 面板外壳契约；modes/regions/states/behaviors/a11y 用逗号分隔。</p>
    <div class="form-grid">
      <div class="field"><label>ID</label><input id="mClassId" value="${esc(c?.id || 'panel.custom')}" ${edit ? 'disabled' : ''}></div>
      <div class="field"><label>名称</label><input id="mClassName" value="${esc(c?.name || 'Custom Panel')}"></div>
      <div class="field"><label>icon</label><input id="mClassIcon" value="${esc(c?.icon || '◧')}"></div>
      <div class="field"><label>group</label><select id="mClassGroup">${Object.entries(GROUPS).map(([k, v]) => `<option value="${k}" ${c?.group === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></div>
      <div class="field"><label>version</label><input id="mClassVersion" value="${esc(c?.version || '0.1.0')}"></div>
      <div class="field"><label>status</label><select id="mClassStatus">${['active', 'draft', 'archived'].map(s => `<option value="${s}" ${(c?.status || 'active') === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      <div class="field full"><label>说明</label><textarea id="mClassDesc">${esc(c?.desc || '')}</textarea></div>
      <div class="field"><label>modes</label><input id="mClassModes" value="${esc((c?.modes || ['right', 'floating']).join(', '))}"></div>
      <div class="field"><label>regions</label><input id="mClassRegions" value="${esc((c?.regions || ['header', 'body', 'footer']).join(', '))}"></div>
      <div class="field"><label>states</label><input id="mClassStates" value="${esc((c?.states || ['ready']).join(', '))}"></div>
      <div class="field"><label>behaviors</label><input id="mClassBehaviors" value="${esc((c?.behaviors || []).join(', '))}"></div>
      <div class="field"><label>a11y</label><input id="mClassA11y" value="${esc((c?.a11y || []).join(', '))}"></div>
      <div class="field"><label>content</label><input id="mClassContent" value="${esc(c?.content || 'surface.custom')}"></div>
    </div><div class="modal-actions"><button class="btn" data-modal-close>取消</button><button class="btn primary" id="modalSaveClass">${edit ? '保存新版本' : '创建类'}</button></div>`);
  $('#modalSaveClass').onclick = () => {
    const id = $('#mClassId').value.trim(), name = $('#mClassName').value.trim();
    if (!id || !name) { showToast('ID 和名称必填'); return; }
    if (!edit && CLASSES.some(x => x.id === id)) { showToast('ID 已存在'); return; }
    const data = { id, name, icon: $('#mClassIcon').value.trim() || '◧', group: $('#mClassGroup').value, version: $('#mClassVersion').value.trim() || '1.0.0', status: $('#mClassStatus').value, desc: $('#mClassDesc').value.trim(), modes: $('#mClassModes').value.split(',').map(s => s.trim()).filter(Boolean), regions: $('#mClassRegions').value.split(',').map(s => s.trim()).filter(Boolean), states: $('#mClassStates').value.split(',').map(s => s.trim()).filter(Boolean), behaviors: $('#mClassBehaviors').value.split(',').map(s => s.trim()).filter(Boolean), a11y: $('#mClassA11y').value.split(',').map(s => s.trim()).filter(Boolean), content: $('#mClassContent').value.trim() };
    if (edit) { Object.assign(c, data); showToast('PanelClass 已更新'); }
    else { CLASSES.push({ ...data, instances: [] }); state.classId = id; state.instLabel = ''; showToast('PanelClass 已创建'); }
    saveData(); closeModal(); ensureSelection(); updateHash(); renderAll();
  };
}
function openInstanceModal(edit = false) {
  const c = cls(), i = edit ? ins() : null;
  if (!c) return;
  openModal(`<h3>${edit ? '编辑 PanelInstance' : '新建 PanelInstance'}</h3><p>PanelInstance = 内容绑定 + 位置 + 尺寸 + 状态。</p>
    <div class="form-grid">
      <div class="field"><label>label</label><input id="mInstLabel" value="${esc(i?.label || 'New Instance')}"></div>
      <div class="field"><label>mode</label><select id="mInstMode">${['right', 'left', 'bottom', 'floating', 'modal', 'sheet'].map(m => `<option value="${m}" ${i?.mode === m ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
      <div class="field"><label>width</label><input id="mInstWidth" type="number" min="300" max="900" value="${i?.width || 380}"></div>
      <div class="field"><label>state</label><select id="mInstState">${['ready', 'loading', 'empty', 'error', 'streaming', 'needsApproval', 'blocked'].map(s => `<option value="${s}" ${i?.state === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      <div class="field full"><label>content</label><input id="mInstContent" value="${esc(i?.content || 'content')}"></div>
      <div class="field full"><label>data</label><input id="mInstData" value="${esc(i?.data || '')}"></div>
      <div class="field full"><label>actions</label><input id="mInstActions" value="${esc((i?.actions || []).join(', '))}"></div>
    </div><div class="modal-actions"><button class="btn" data-modal-close>取消</button><button class="btn primary" id="modalSaveInst">${edit ? '保存新 revision' : '创建实例'}</button></div>`);
  $('#modalSaveInst').onclick = () => {
    const label = $('#mInstLabel').value.trim(); if (!label) { showToast('label 必填'); return; }
    const data = { label, mode: $('#mInstMode').value, width: Number($('#mInstWidth').value) || 380, state: $('#mInstState').value, content: $('#mInstContent').value.trim(), data: $('#mInstData').value.trim(), actions: $('#mInstActions').value.split(',').map(s => s.trim()).filter(Boolean), rev: edit ? (i.rev || 1) + 1 : 1, status: 'active' };
    if (edit) { Object.assign(i, data); showToast('PanelInstance 已更新 · rev +1'); }
    else { c.instances.push(data); state.instLabel = label; showToast('PanelInstance 已创建'); }
    state.mode = data.mode; state.width = data.width; state.panelState = data.state; saveData(); closeModal(); updateHash(); renderAll();
  };
}
function handleAction(action) {
  const c = cls(), i = ins();
  if (action === 'new-class') { openClassModal(false); return; }
  if (action === 'edit-class') { openClassModal(true); return; }
  if (action === 'delete-class') { if (!c) return; confirmModal('删除 PanelClass？', `会删除 ${c.id} 及其 ${c.instances.length} 个实例。`, '删除', () => { CLASSES = CLASSES.filter(x => x.id !== c.id); state.classId = CLASSES[0]?.id || ''; state.instLabel = ''; ensureSelection(); saveData(); renderAll(); showToast('PanelClass 已删除'); }); return; }
  if (action === 'new-instance') { openInstanceModal(false); return; }
  if (action === 'edit-instance') { openInstanceModal(true); return; }
  if (action === 'delete-instance') { if (!i) return; confirmModal('删除 PanelInstance？', `会删除 ${i.label}。`, '删除', () => { c.instances = c.instances.filter(x => x.label !== i.label); state.instLabel = c.instances[0]?.label || ''; ensureSelection(); saveData(); renderAll(); showToast('PanelInstance 已删除'); }); return; }
  if (action === 'duplicate-instance') { if (!i) return; const copy = deep(i); copy.label = `${i.label} 副本`; copy.rev = 1; copy.status = 'draft'; c.instances.push(copy); state.instLabel = copy.label; state.mode = copy.mode; state.width = copy.width; state.panelState = copy.state; saveData(); updateHash(); renderAll(); showToast('PanelInstance 已复制'); return; }
  if (action === 'reset-view') { if (i) { state.mode = i.mode || 'right'; state.width = Number(i.width) || 380; state.panelState = i.state || 'ready'; } state.anatomy = false; renderMain(); return; }
  if (action === 'reset-data') { confirmModal('重置示例数据？', '会覆盖本地新增/修改，恢复 14 PanelClass / 37 PanelInstance。', '重置', () => { CLASSES = deep(PANEL_DATA.classes).map(x => ({ ...x, status: x.status || 'active' })); state.classId = CLASSES[0].id; state.instLabel = CLASSES[0].instances[0]?.label || ''; saveData(); ensureSelection(); updateHash(); renderAll(); showToast('示例数据已重置'); }); return; }
}
function renderAll() { renderTopStats(); renderLeft(); renderMain(); renderInspector(); }
function init() {
  parseHash(); ensureSelection(); renderAll();
  $('#modalRoot').addEventListener('click', e => { if (e.target.id === 'modalOverlay' || e.target.closest('[data-modal-close]')) closeModal(); });
  window.addEventListener('hashchange', () => { parseHash(); ensureSelection(); renderAll(); });
}
init();
})();
