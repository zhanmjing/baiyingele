(() => {
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DATA = LINE_DATA;
const POINT_LINKS = {
  'ocr.read': { classId: 'win.ocr.read', instanceId: 'i-ocr-auto', label: 'OCR 识别 · 截图转文字' },
  'input.clipboard': { classId: 'win.clipboard.get', instanceId: 'i-clip-text', label: '读取剪贴板 · 取文本' },
  'sys.open': { classId: 'win.open', instanceId: 'i-open-github', label: '打开目标 · 打开 GitHub' }
};
const state = {
  flowId: DATA.flows[0]?.id || '',
  instId: DATA.flows[0]?.instances[0]?.id || '',
  mode: 'class',
  selectedNodeId: null,
  toastTimer: null
};
const flow = () => DATA.flows.find(f => f.id === state.flowId) || DATA.flows[0];
const inst = () => flow()?.instances.find(i => i.id === state.instId) || flow()?.instances[0] || null;
const nodeById = id => flow()?.nodes.find(n => n.id === id) || null;
const pointNodes = f => (f?.nodes || []).filter(n => n.kind === 'point');
const isImplemented = n => n?.kind === 'point' && !!POINT_LINKS[n.pointClass];
const pointLink = n => isImplemented(n) ? POINT_LINKS[n.pointClass] : null;
const pointHref = n => { const p = pointLink(n); return p ? `atom-catalog-management.html#${encodeURIComponent(p.classId)}/${encodeURIComponent(p.instanceId)}` : ''; };
const pinForNode = n => {
  if (!n || n.kind !== 'point') return null;
  const chosen = state.mode === 'instance' ? inst()?.pins?.[n.id] : n.pointInstance;
  return DATA.pins[chosen] || DATA.pins[n.pointInstance] || null;
};
const pinIdForNode = n => {
  if (!n || n.kind !== 'point') return '';
  return state.mode === 'instance' ? (inst()?.pins?.[n.id] || n.pointInstance || '') : (n.pointInstance || '');
};
const nodeClass = n => n.kind === 'gate' ? 'gate' : n.kind === 'subflow' ? 'subflow' : isImplemented(n) ? 'point impl' : 'point placeholder';
const nodeBadge = n => n.kind === 'gate' ? 'gate' : n.kind === 'subflow' ? 'subflow' : isImplemented(n) ? '点层已实现' : '占位符';
const flowStats = f => {
  const points = pointNodes(f);
  return { nodes: f.nodes.length, edges: f.edges.length, points: points.length, linked: points.filter(isImplemented).length, placeholders: points.filter(n => !isImplemented(n)).length, gates: f.nodes.filter(n => n.kind === 'gate').length, subflows: f.nodes.filter(n => n.kind === 'subflow').length };
};
function showToast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => t.classList.remove('show'), 1700);
}
function parseHash() {
  const parts = (location.hash || '').replace(/^#/, '').split('/').map(decodeURIComponent).filter(Boolean);
  if (parts[0] && DATA.flows.some(f => f.id === parts[0])) state.flowId = parts[0];
  const f = flow();
  if (parts[1] && f.instances.some(i => i.id === parts[1])) state.instId = parts[1];
  if (parts[2] && f.nodes.some(n => n.id === parts[2])) state.selectedNodeId = parts[2];
  if (!state.instId) state.instId = f.instances[0]?.id || '';
}
function updateHash() {
  const h = `#${encodeURIComponent(state.flowId)}${state.instId ? '/' + encodeURIComponent(state.instId) : ''}${state.selectedNodeId ? '/' + encodeURIComponent(state.selectedNodeId) : ''}`;
  if (location.hash !== h) history.replaceState(null, '', h);
}
function renderTopStats() {
  const all = DATA.flows;
  const allInstances = all.reduce((n, f) => n + f.instances.length, 0);
  const points = all.reduce((n, f) => n + pointNodes(f).length, 0);
  const linked = all.reduce((n, f) => n + pointNodes(f).filter(isImplemented).length, 0);
  const ph = points - linked;
  $('#topStats').innerHTML = `<span class="mini violet">${all.length} FlowClass</span><span class="mini cyan">${allInstances} FlowInstance</span><span class="mini">${points} point slots</span><span class="mini green">${linked} linked</span><span class="mini amber">${ph} 占位符</span>`;
}
function renderLeft() {
  const f = flow();
  $('#flowCount').textContent = DATA.flows.length;
  $('#instCount').textContent = f.instances.length;
  $('#flowList').innerHTML = DATA.flows.map(x => `<div class="flow-item ${x.id === f.id ? 'on' : ''}" data-flow="${esc(x.id)}"><div class="fi-top"><span class="fi-name">${esc(x.name)}</span><span class="fi-ver">v${esc(x.version)}</span></div><div class="fi-id">${esc(x.id)}</div><div class="fi-meta"><span class="fi-badge">${esc(x.family)}</span><span class="fi-badge">${x.nodes.length} nodes</span><span class="fi-badge">${x.instances.length} inst</span></div></div>`).join('');
  $('#instList').innerHTML = f.instances.map(i => `<div class="inst-item ${i.id === state.instId ? 'on' : ''}" data-inst="${esc(i.id)}"><div class="ii-top"><span class="ii-name">${esc(i.name)}</span><span class="ii-rev">r${i.rev}</span></div><div class="ii-id">${esc(i.id)}</div><span class="ii-status ${esc(i.status || 'stable')}">${esc(i.status || 'stable')}</span></div>`).join('') || '<div class="empty">暂无实例</div>';
}
function renderMain() {
  const f = flow(); const s = flowStats(f);
  const i = inst();
  const modeInstance = state.mode === 'instance';
  const rows = f.nodes.map(n => {
    const pin = pinForNode(n); const link = pointLink(n);
    const kind = n.kind === 'point' ? (isImplemented(n) ? '已实现' : 'placeholder') : n.kind === 'gate' ? 'gate' : 'subflow';
    const impl = n.kind === 'gate' ? '<span class="pill gate">gate</span>' : n.kind === 'subflow' ? '<span class="pill sub">subflow</span>' : isImplemented(n) ? '<span class="pill ok">点层已实现</span>' : '<span class="pill ph">占位符</span>';
    const action = link ? `<a class="plink" href="${esc(pointHref(n))}">打开实例设置 ↗</a>` : n.kind === 'point' ? '<span class="pill ph">待接入</span>' : '—';
    return `<tr class="tr-node ${state.selectedNodeId === n.id ? 'on' : ''}" data-row-node="${esc(n.id)}"><td><span class="t-label">${esc(n.label)}</span><span class="t-sub">slot.${esc(n.id)}</span></td><td>${n.kind === 'point' ? '<span class="pill">point</span>' : n.kind === 'gate' ? '<span class="pill gate">gate</span>' : '<span class="pill sub">subflow</span>'}</td><td class="mono">${esc(n.pointClass || (n.kind === 'gate' ? 'gate:' + n.gate : 'FlowInstance'))}</td><td class="mono">${esc(pinIdForNode(n) || '—')}</td><td>${impl}</td><td>${link ? `<span class="mono" style="color:#86efac">${esc(link.label)}</span>` : (n.kind === 'point' ? '<span class="mono" style="color:#fcd34d">占位符 · 未实现</span>' : '—')}</td><td>${action}</td></tr>`;
  }).join('');
  $('#main').innerHTML = `<div class="hero"><div class="hero-icon">{ }</div><div class="hero-main"><div class="kicker">FlowClass · ${esc(f.family)}</div><h1>${esc(f.name)}</h1><p>${esc(f.desc)}</p></div><div class="mode-tabs"><button data-mode="class" class="${!modeInstance ? 'on' : ''}">类定义</button><button data-mode="instance" class="${modeInstance ? 'on' : ''}">实例绑定</button></div><div class="hero-actions"><button class="btn" data-action="run-flow">▶ 运行</button><button class="btn primary" data-action="new-instance">＋ 实例</button></div></div>
    <div class="stats"><span class="mini violet">${s.nodes} nodes</span><span class="mini">${s.edges} edges</span><span class="mini cyan">${s.points} point slots</span><span class="mini green">${s.linked} linked</span><span class="mini amber">${s.placeholders} 占位符</span><span class="mini">${s.gates} gates · ${s.subflows} subflow</span>${modeInstance && i ? `<span class="mini cyan">${esc(i.name)} · r${i.rev}</span>` : '<span class="mini">FlowClass 默认绑定</span>'}</div>
    <div class="graph-panel"><div class="panel-head"><b>数据流图</b><span class="sub">${esc(f.id)} · ${modeInstance && i ? 'instance ' + esc(i.id) : 'class defaults'}</span><span class="right"><span class="mini">${modeInstance ? 'PointInstance pins' : 'PointClass slots'}</span></span></div><div class="graph-scroll"><div class="canvas" id="canvas"></div></div><div class="legend"><span><i class="impl"></i>点层已实现 · 可跳转</span><span><i class="ph"></i>占位符 · 待接入</span><span><i class="gate"></i>gate</span><span><i class="sub"></i>subflow</span></div></div>
    <div class="bind-panel"><div class="panel-head"><b>Point 绑定</b><span class="sub">线层节点 → 点层类/实例</span><span class="right"><span class="mini green">${s.linked} 可直接跳转</span><span class="mini amber">${s.placeholders} 占位</span></span></div><div class="table-wrap"><table><thead><tr><th>节点</th><th>类型</th><th>PointClass</th><th>Pin</th><th>实现</th><th>点层实例</th><th>操作</th></tr></thead><tbody>${rows || '<tr><td colspan="7" class="empty">暂无节点。</td></tr>'}</tbody></table></div></div>`;
  renderGraph(f);
  $$('#main [data-mode]').forEach(b => b.onclick = () => { state.mode = b.dataset.mode; state.selectedNodeId = null; renderMain(); renderInspector(); updateHash(); });
  $$('#main [data-row-node]').forEach(el => el.onclick = () => { state.selectedNodeId = el.dataset.rowNode; renderMain(); renderInspector(); updateHash(); });
  $$('#main .plink').forEach(a => a.addEventListener('click', e => e.stopPropagation()));
  $$('#main [data-action]').forEach(b => b.onclick = () => handleAction(b.dataset.action));
}
function edgePath(a, b) {
  const x1 = a.x + a.w, y1 = a.y + a.h / 2, x2 = b.x, y2 = b.y + b.h / 2;
  const dx = Math.max(40, (x2 - x1) / 2);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}
function renderGraph(f) {
  const canvas = $('#canvas'); if (!canvas) return;
  canvas.style.width = f.w + 'px'; canvas.style.height = f.h + 'px';
  const svg = `<svg width="${f.w}" height="${f.h}" viewBox="0 0 ${f.w} ${f.h}"><defs><marker id="arr" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7" fill="#475569"/></marker></defs>${f.edges.map(e => { const a = f.nodes.find(n => n.id === e.from), b = f.nodes.find(n => n.id === e.to); return a && b ? `<path d="${edgePath(a, b)}" fill="none" stroke="${e.tone === 'warn' ? '#92400e' : '#334155'}" stroke-width="1.3" marker-end="url(#arr)"/><text x="${(a.x + a.w + b.x) / 2}" y="${(a.y + b.y) / 2 + 28}" fill="#5f7188" font-family="Consolas" font-size="7">${esc(e.label || '')}</text>` : ''; }).join('')}</svg>`;
  const nodes = f.nodes.map(n => {
    const pin = pinForNode(n); const link = pointLink(n); const cls = nodeClass(n);
    return `<div class="node ${cls} ${state.selectedNodeId === n.id ? 'selected' : ''}" data-node="${esc(n.id)}" style="left:${n.x}px;top:${n.y}px;width:${n.w}px;height:${n.h}px">
      <div class="n-kind">${n.kind === 'point' ? 'POINT SLOT' : n.kind === 'gate' ? 'GATE' : 'SUBFLOW'}</div><div class="n-label">${esc(n.label)}</div><div class="n-meta">${esc(n.pointClass || (n.kind === 'gate' ? 'gate:' + n.gate : 'FlowInstance'))}</div><div class="n-pin">${esc(pinIdForNode(n) || '—')}${pin ? ' @r' + pin.rev : ''}</div>
      ${link ? `<button class="n-jump" data-open-point="${esc(pointHref(n))}" title="打开点层实例设置">↗</button>` : `<span class="n-badge ${n.kind === 'gate' ? '' : n.kind === 'subflow' ? 'sub' : 'ph'}">${nodeBadge(n)}</span>`}
    </div>`;
  }).join('');
  canvas.innerHTML = svg + nodes;
  $$('#canvas [data-node]').forEach(el => el.onclick = (e) => { if (e.target.closest('[data-open-point]')) return; state.selectedNodeId = el.dataset.node; renderMain(); renderInspector(); updateHash(); });
  $$('#canvas [data-open-point]').forEach(b => b.onclick = (e) => { e.stopPropagation(); window.location.href = b.dataset.openPoint; });
}
function renderInspector() {
  const f = flow(); const i = inst(); const n = nodeById(state.selectedNodeId);
  if (n) return renderNodeInspector(n);
  if (i) return renderInstanceInspector(f, i);
  return renderClassInspector(f);
}
function renderClassInspector(f) {
  const s = flowStats(f);
  $('#inspector').innerHTML = `<div class="insp-kicker">FlowClass · 线层类</div><div class="insp-title">${esc(f.name)}</div><div class="insp-id">${esc(f.id)} · v${esc(f.version)}</div>
    <div class="insp-section"><div class="lh">Contract</div><div class="kv"><div class="k">family</div><div class="v">${esc(f.family)}</div><div class="k">nodes</div><div class="v">${s.nodes}</div><div class="k">edges</div><div class="v">${s.edges}</div><div class="k">instances</div><div class="v">${f.instances.length}</div></div></div>
    <div class="insp-section"><div class="lh">Summary</div><div style="font-size:8px;line-height:1.55;color:#9fb1c8">${esc(f.desc)}</div></div>
    <div class="insp-section"><div class="lh">Point Slots · ${s.points}</div><div class="kv"><div class="k">linked</div><div class="v" style="color:#86efac">${s.linked}</div><div class="k">占位符</div><div class="v" style="color:#fcd34d">${s.placeholders}</div><div class="k">gates</div><div class="v">${s.gates}</div><div class="k">subflows</div><div class="v">${s.subflows}</div></div></div>
    <div class="insp-section"><div class="lh">Actions</div><div class="actions"><button class="btn primary" data-action="new-instance">＋ 新建实例</button><button class="btn" data-action="edit-class">✎ 编辑类</button><button class="btn" data-action="run-flow">▶ 运行默认</button></div></div>`;
  $$('#inspector [data-action]').forEach(b => b.onclick = () => handleAction(b.dataset.action));
}
function renderInstanceInspector(f, i) {
  const pins = Object.entries(i.pins || {}).map(([nodeId, pinId]) => ({ node: nodeById(nodeId), pinId, pin: DATA.pins[pinId] })).filter(x => x.node);
  $('#inspector').innerHTML = `<div class="insp-kicker">FlowInstance · 线层实例</div><div class="insp-title">${esc(i.name)}</div><div class="insp-id">${esc(i.id)} · rev${i.rev}</div>
    <div class="insp-section"><div class="lh">Binding</div><div class="kv"><div class="k">flow</div><div class="v">${esc(f.id)}</div><div class="k">status</div><div class="v">${esc(i.status || 'stable')}</div><div class="k">pins</div><div class="v">${pins.length}</div></div></div>
    <div class="insp-section"><div class="lh">Arguments</div><pre style="margin:0;font:7px var(--mono);color:#9fb1c8;white-space:pre-wrap;word-break:break-word">${esc(JSON.stringify(i.args || {}, null, 2))}</pre></div>
    <div class="insp-section"><div class="lh">Point Pins</div><div class="insp-list">${pins.map(x => { const link = x.node.kind === 'point' ? pointLink(x.node) : null; return `<div class="insp-row" data-insp-node="${esc(x.node.id)}"><span>${esc(x.node.label)}</span><span style="color:${link ? '#86efac' : '#fcd34d'}">${esc(x.pinId)}${link ? ' ↗' : ' · ph'}</span></div>`; }).join('') || '<div class="empty">无绑定</div>'}</div></div>
    <div class="insp-section"><div class="lh">Actions</div><div class="actions"><button class="btn primary" data-action="run-instance">▶ 运行</button><button class="btn" data-action="duplicate-instance">⧉ 复制</button><button class="btn danger" data-action="archive-instance">⌫ 归档</button></div></div>`;
  $$('#inspector [data-action]').forEach(b => b.onclick = () => handleAction(b.dataset.action));
  $$('#inspector [data-insp-node]').forEach(el => el.onclick = () => { state.selectedNodeId = el.dataset.inspNode; renderMain(); renderInspector(); updateHash(); });
}
function renderNodeInspector(n) {
  const pin = pinForNode(n); const link = pointLink(n);
  const isPoint = n.kind === 'point';
  $('#inspector').innerHTML = `<div class="insp-kicker">FlowNode · ${n.kind === 'point' ? 'POINT SLOT' : n.kind === 'gate' ? 'GATE' : 'SUBFLOW'}</div><div class="insp-title">${esc(n.label)}</div><div class="insp-id">${esc(n.id)} · ${esc(n.pointClass || (n.kind === 'gate' ? 'gate:' + n.gate : 'FlowInstance'))}</div>
    <div class="insp-section"><div class="lh">Binding</div><div class="kv"><div class="k">kind</div><div class="v">${esc(n.kind)}</div><div class="k">pointClass</div><div class="v">${esc(n.pointClass || '—')}</div><div class="k">pin</div><div class="v">${esc(pinIdForNode(n) || '—')}</div><div class="k">revision</div><div class="v">${pin ? 'r' + pin.rev : '—'}</div><div class="k">implemented</div><div class="v" style="color:${link ? '#86efac' : isPoint ? '#fcd34d' : '#93c5fd'}">${link ? 'yes · point' : isPoint ? 'no · 占位符' : n.kind}</div></div></div>
    ${pin ? `<div class="insp-section"><div class="lh">Pin Params</div><pre style="margin:0;font:7px var(--mono);color:#9fb1c8;white-space:pre-wrap;word-break:break-word">${esc(JSON.stringify(pin.params || {}, null, 2))}</pre></div>` : ''}
    ${link ? `<div class="insp-section"><div class="lh">Point Instance</div><div class="kv"><div class="k">class</div><div class="v">${esc(link.classId)}</div><div class="k">instance</div><div class="v">${esc(link.instanceId)}</div></div><a class="btn primary" style="width:100%;margin-top:6px" href="${esc(pointHref(n))}">打开点层实例设置 ↗</a></div>` : isPoint ? `<div class="insp-section"><div class="lh">Placeholder</div><div class="note">该点层实例尚未实现，线层先用占位符。点层实现后，这里会显示可跳转的点层实例设置入口。</div></div>` : n.kind === 'subflow' ? `<div class="insp-section"><div class="lh">Subflow</div><div class="note">该节点绑定的是子流程 FlowInstance，不是点层实例；在 FlowInstance 管理中维护。</div></div>` : `<div class="insp-section"><div class="lh">Gate</div><div class="note">门节点由线层引擎执行，不绑定 PointInstance。</div></div>`}
    <div class="insp-section"><div class="lh">Actions</div><div class="actions"><button class="btn" data-action="back-instance">← 回实例</button>${link ? `<a class="btn primary" href="${esc(pointHref(n))}">打开设置 ↗</a>` : ''}</div></div>`;
  $$('#inspector [data-action]').forEach(b => b.onclick = () => handleAction(b.dataset.action));
}
function handleAction(action) {
  const f = flow(); const i = inst();
  if (action === 'back-instance') { state.selectedNodeId = null; renderMain(); renderInspector(); updateHash(); return; }
  if (action === 'new-instance') { newInstance(); return; }
  if (action === 'duplicate-instance') {
    if (!i) return;
    const copy = JSON.parse(JSON.stringify(i)); copy.id = `inst.copy-${Date.now()}`; copy.name = `${i.name} 副本`; copy.rev = 1; copy.status = 'draft'; f.instances.push(copy); state.instId = copy.id; state.mode = 'instance'; state.selectedNodeId = null; updateHash(); renderAll(); showToast('已复制 FlowInstance'); return;
  }
  if (action === 'archive-instance') { if (i) { i.status = 'archived'; renderAll(); showToast('已归档 FlowInstance'); } return; }
  if (action === 'run-instance' || action === 'run-flow') { showToast(`运行 ${action === 'run-flow' ? f.name : i?.name || f.name} · 模拟轨迹正常`); return; }
  if (action === 'edit-class') { const name = prompt('FlowClass 名称', f.name); if (name?.trim()) { f.name = name.trim(); renderAll(); showToast('已更新 FlowClass 名称'); } return; }
  if (action === 'new-class') { newFlow(); return; }
}
function newFlow() {
  const name = prompt('FlowClass 名称', '新建线层类'); if (!name?.trim()) return;
  const id = `flow.custom-${Date.now()}`;
  const f = { id, name: name.trim(), family: 'custom', version: '0.1.0', desc: '新建的线层类。', w: 760, h: 300, params: [], nodes: [], edges: [], code: [], instances: [] };
  DATA.flows.push(f); state.flowId = id; state.instId = ''; state.mode = 'class'; state.selectedNodeId = null; updateHash(); renderAll(); showToast('已新建 FlowClass');
}
function newInstance() {
  const f = flow(); const name = prompt('FlowInstance 名称', `${f.name} 实例`); if (!name?.trim()) return;
  const pins = {}; f.nodes.forEach(n => { if (n.kind === 'point') pins[n.id] = n.pointInstance || ''; });
  const i = { id: `inst.custom-${Date.now()}`, name: name.trim(), rev: 1, status: 'draft', args: {}, pins, trace: {} };
  f.instances.push(i); state.instId = i.id; state.mode = 'instance'; state.selectedNodeId = null; updateHash(); renderAll(); showToast('已新建 FlowInstance');
}
function renderAll() { renderTopStats(); renderLeft(); renderMain(); renderInspector(); }
function init() {
  parseHash();
  if (!state.instId) state.instId = flow().instances[0]?.id || '';
  renderAll();
  $('#flowList').addEventListener('click', e => { const el = e.target.closest('[data-flow]'); if (!el) return; state.flowId = el.dataset.flow; state.instId = flow().instances[0]?.id || ''; state.selectedNodeId = null; state.mode = 'class'; updateHash(); renderAll(); });
  $('#instList').addEventListener('click', e => { const el = e.target.closest('[data-inst]'); if (!el) return; state.instId = el.dataset.inst; state.mode = 'instance'; state.selectedNodeId = null; updateHash(); renderAll(); });
  $('#newFlowBtn').addEventListener('click', newFlow);
  $('#newInstBtn').addEventListener('click', newInstance);
  window.addEventListener('hashchange', () => { parseHash(); renderAll(); });
}
init();
})();
