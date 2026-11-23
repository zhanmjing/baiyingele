(() => {
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SC = SURFACE_DATA.classes;
const PC = PANEL_DATA.classes;
const GB = GESTURE_BINDINGS;
const DOCK_TABS = DOCK_DATA.tabs;
const DOCK_TILES = DOCK_DATA.tiles;
const surfaceInstances = () => SC.flatMap(c => c.instances.map(i => ({ ...i, classId: c.id, className: c.name, icon: c.icon, family: c.family })));
const panelInstances = () => PC.flatMap(c => c.instances.map((i, idx) => ({ ...i, classId: c.id, className: c.name, icon: c.icon, group: c.group, idx })));
const state = {
  view: 'surfaces',
  surfaceClassId: SC[0]?.id || '',
  surfaceInstId: SC[0]?.instances[0]?.id || '',
  panelClassId: PC[0]?.id || '',
  panelInstId: PC[0]?.instances[0]?.label || '',
  gesturePattern: GB[0]?.pattern || '',
  dockTabId: DOCK_TABS[0]?.id || 'common',
  dockTileId: DOCK_TILES[0]?.id || '',
  toastTimer: null
};
const surfClass = () => SC.find(c => c.id === state.surfaceClassId) || SC[0];
const surfInst = () => surfClass()?.instances.find(i => i.id === state.surfaceInstId) || surfClass()?.instances[0] || null;
const panelClass = () => PC.find(c => c.id === state.panelClassId) || PC[0];
const panelInst = () => panelClass()?.instances.find(i => i.label === state.panelInstId) || panelClass()?.instances[0] || null;
const gesture = () => GB.find(g => g.pattern === state.gesturePattern) || GB[0];
const dockTab = () => DOCK_TABS.find(t => t.id === state.dockTabId) || DOCK_TABS[0];
const dockTile = () => DOCK_TILES.find(t => t.id === state.dockTileId) || DOCK_TILES.find(t => t.tab === state.dockTabId) || DOCK_TILES[0];
const flowLink = (target) => {
  if (!target) return '';
  if (target.startsWith('inst.site-github')) return 'line-management.html#flow.open-external-site/inst.site-github';
  if (target.startsWith('inst.site-youtube')) return 'line-management.html#flow.open-external-site/inst.site-youtube';
  return '';
};
const surfaceStats = () => ({ classes: SC.length, instances: surfaceInstances().length, families: [...new Set(SC.map(c => c.family))].length, p0: SC.filter(c => c.p0).length });
const panelStats = () => ({ classes: PC.length, instances: panelInstances().length, groups: [...new Set(PC.map(c => c.group))].length });
const gestureStats = () => ({ total: GB.length, flow: GB.filter(g => g.kind === 'flow').length, point: GB.filter(g => g.kind === 'point').length });
const dockStats = () => ({ tabs: DOCK_TABS.length, tiles: DOCK_TILES.length, flow: DOCK_TILES.filter(t => t.kind === 'flow').length, point: DOCK_TILES.filter(t => t.kind === 'point').length });
const familyMeta = id => SURFACE_DATA.families[id] || { short: id, color: '#22d3ee', name: id };
function showToast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => t.classList.remove('show'), 1700); }
function updateHash() { const h = `#${state.view}/${encodeURIComponent(state.view === 'surfaces' ? state.surfaceClassId : state.view === 'panels' ? state.panelClassId : state.view === 'gestures' ? state.gesturePattern : state.dockTabId)}`; if (location.hash !== h) history.replaceState(null, '', h); }
function parseHash() {
  const parts = (location.hash || '').replace(/^#/, '').split('/').map(decodeURIComponent).filter(Boolean);
  if (['surfaces', 'panels', 'gestures', 'dock'].includes(parts[0])) state.view = parts[0];
  if (state.view === 'surfaces' && parts[1] && SC.some(c => c.id === parts[1])) { state.surfaceClassId = parts[1]; const c = surfClass(); if (c.instances[0]) state.surfaceInstId = c.instances[0].id; if (parts[2]) state.surfaceInstId = parts[2]; }
  if (state.view === 'panels' && parts[1] && PC.some(c => c.id === parts[1])) { state.panelClassId = parts[1]; const c = panelClass(); if (c.instances[0]) state.panelInstId = c.instances[0].label; if (parts[2]) state.panelInstId = parts[2]; }
  if (state.view === 'gestures' && parts[1]) state.gesturePattern = parts[1];
  if (state.view === 'dock' && parts[1]) { state.dockTabId = parts[1]; const t = DOCK_TILES.find(x => x.tab === state.dockTabId); if (t) state.dockTileId = t.id; }
}
function renderTopStats() {
  const s = surfaceStats(), p = panelStats(), g = gestureStats(), d = dockStats();
  $('#topStats').innerHTML = `<span class="mini cyan">${s.classes} SurfaceClass</span><span class="mini">${s.instances} SurfaceInstance</span><span class="mini">${p.classes} PanelClass</span><span class="mini">${p.instances} PanelInstance</span><span class="mini violet">${g.total} Gestures</span><span class="mini green">${d.tiles} Dock tiles</span>`;
  $('#viewStats').innerHTML = `<span class="mini">${s.families} families</span><span class="mini">${s.p0} P0</span><span class="mini">${p.groups} panel groups</span><span class="mini amber">${g.flow} flow / ${g.point} point</span>`;
}
function renderViewTabs() {
  const s = surfaceStats(), p = panelStats(), g = gestureStats(), d = dockStats();
  const tabs = [['surfaces', '目录', `${s.classes}/${s.instances}`], ['panels', '面板', `${p.classes}/${p.instances}`], ['gestures', '手势', `${g.total}`], ['dock', '启动坞', `${d.tiles}`]];
  $('#viewTabs').innerHTML = tabs.map(([id, label, count]) => `<button data-view="${id}" class="${state.view === id ? 'on' : ''}">${label}<span>${count}</span></button>`).join('');
}
function renderLeft() {
  if (state.view === 'surfaces') return renderSurfaceLeft();
  if (state.view === 'panels') return renderPanelLeft();
  if (state.view === 'gestures') return renderGestureLeft();
  return renderDockLeft();
}
function renderSurfaceLeft() {
  const c = surfClass(), instances = c?.instances || [];
  $('#leftPane').innerHTML = `<div class="pane-head"><b>SurfaceClass · 面层类</b><span class="count">${SC.length}</span></div>
    ${SC.map(x => `<div class="flow-item ${x.id === c.id ? 'on' : ''}" data-surface-class="${esc(x.id)}"><div class="fi-top"><span class="fi-name">${esc(x.icon)} ${esc(x.name)}</span><span class="fi-ver">${x.instances.length}</span></div><div class="fi-id">${esc(x.id)}</div><div class="fi-meta"><span class="fi-badge">${esc(familyMeta(x.family).short)}</span>${x.p0 ? '<span class="fi-badge">P0</span>' : ''}</div></div>`).join('')}
    <div class="pane-head" style="margin-top:10px"><b>SurfaceInstance · 面实例</b><span class="count">${instances.length}</span><button data-action="new-surface-instance" title="新建实例">＋</button></div>
    ${instances.map(i => `<div class="inst-item ${i.id === state.surfaceInstId ? 'on' : ''}" data-surface-inst="${esc(i.id)}"><div class="ii-top"><span class="ii-name">${esc(i.name)}</span><span class="ii-rev">r${i.revision}</span></div><div class="ii-id">${esc(i.id)}</div><span class="ii-status ${i.status === 'draft' ? 'draft' : ''}">${esc(i.status)}</span></div>`).join('') || '<div class="empty">暂无实例</div>'}`;
  $$('#leftPane [data-surface-class]').forEach(el => el.onclick = () => { state.surfaceClassId = el.dataset.surfaceClass; state.surfaceInstId = surfClass().instances[0]?.id || ''; updateHash(); renderAll(); });
  $$('#leftPane [data-surface-inst]').forEach(el => el.onclick = () => { state.surfaceInstId = el.dataset.surfaceInst; updateHash(); renderAll(); });
  $$('#leftPane [data-action="new-surface-instance"]').forEach(b => b.onclick = () => newSurfaceInstance());
}
function renderPanelLeft() {
  const c = panelClass(), instances = c?.instances || [];
  $('#leftPane').innerHTML = `<div class="pane-head"><b>PanelClass · 面板类</b><span class="count">${PC.length}</span></div>
    ${PC.map(x => `<div class="flow-item ${x.id === c.id ? 'on' : ''}" data-panel-class="${esc(x.id)}"><div class="fi-top"><span class="fi-name">${esc(x.icon)} ${esc(x.name)}</span><span class="fi-ver">${x.instances.length}</span></div><div class="fi-id">${esc(x.id)}</div><div class="fi-meta"><span class="fi-badge">${esc(x.group)}</span><span class="fi-badge">${esc(x.modes.join(' / '))}</span></div></div>`).join('')}
    <div class="pane-head" style="margin-top:10px"><b>PanelInstance · 面板实例</b><span class="count">${instances.length}</span></div>
    ${instances.map(i => `<div class="inst-item ${i.label === state.panelInstId ? 'on' : ''}" data-panel-inst="${esc(i.label)}"><div class="ii-top"><span class="ii-name">${esc(i.label)}</span><span class="ii-rev">r${i.rev}</span></div><div class="ii-id">${esc(i.content)}</div><span class="ii-status">${esc(i.mode)} · ${i.width}px</span></div>`).join('') || '<div class="empty">暂无实例</div>'}`;
  $$('#leftPane [data-panel-class]').forEach(el => el.onclick = () => { state.panelClassId = el.dataset.panelClass; state.panelInstId = panelClass().instances[0]?.label || ''; updateHash(); renderAll(); });
  $$('#leftPane [data-panel-inst]').forEach(el => el.onclick = () => { state.panelInstId = el.dataset.panelInst; updateHash(); renderAll(); });
}
function renderGestureLeft() {
  $('#leftPane').innerHTML = `<div class="pane-head"><b>GestureBinding · 手势绑定</b><span class="count">${GB.length}</span></div>
    ${GB.map(g => `<div class="flow-item ${g.pattern === state.gesturePattern ? 'on' : ''}" data-gesture="${esc(g.pattern)}"><div class="fi-top"><span class="fi-name">${esc(g.pattern)} · ${esc(g.name)}</span><span class="fi-ver">${esc(g.effect)}</span></div><div class="fi-id">${esc(g.target)}</div><div class="fi-meta"><span class="fi-badge">${g.kind === 'flow' ? 'FlowInstance' : 'PointInstance'}</span><span class="fi-badge">${esc(g.desc)}</span></div></div>`).join('')}`;
  $$('#leftPane [data-gesture]').forEach(el => el.onclick = () => { state.gesturePattern = el.dataset.gesture; updateHash(); renderAll(); });
}
function renderDockLeft() {
  const tab = dockTab();
  const list = DOCK_TILES.filter(t => t.tab === tab.id);
  $('#leftPane').innerHTML = `<div class="pane-head"><b>Launch Dock · Tabs</b><span class="count">${DOCK_TABS.length}</span></div>
    ${DOCK_TABS.map(t => `<div class="flow-item ${t.id === tab.id ? 'on' : ''}" data-dock-tab="${esc(t.id)}"><div class="fi-top"><span class="fi-name">${esc(t.name)}</span><span class="fi-ver">${DOCK_TILES.filter(x => x.tab === t.id).length}</span></div><div class="fi-id">${esc(t.id)}</div></div>`).join('')}
    <div class="pane-head" style="margin-top:10px"><b>${esc(tab.name)} · Tiles</b><span class="count">${list.length}</span></div>
    ${list.map(t => `<div class="inst-item ${t.id === dockTile().id ? 'on' : ''}" data-dock-tile="${esc(t.id)}"><div class="ii-top"><span class="ii-name">${esc(t.icon)} ${esc(t.name)}</span><span class="ii-rev">${esc(t.kind)}</span></div><div class="ii-id">${esc(t.target)}</div><span class="ii-status">${esc(t.effect)}${t.hotkey ? ' · ⌨' + t.hotkey : ''}</span></div>`).join('')}`;
  $$('#leftPane [data-dock-tab]').forEach(el => el.onclick = () => { state.dockTabId = el.dataset.dockTab; state.dockTileId = DOCK_TILES.find(t => t.tab === state.dockTabId)?.id || ''; updateHash(); renderAll(); });
  $$('#leftPane [data-dock-tile]').forEach(el => el.onclick = () => { state.dockTileId = el.dataset.dockTile; updateHash(); renderAll(); });
}
function wireframe(c, i) {
  const data = i?.dataBindings || [];
  const actions = i?.actionBindings || [];
  const fields = data.length ? data : (c.slots || []).map((s, idx) => ({ slot: s, kind: 'slot', target: s }));
  const regions = c.regions || ['header', 'body', 'footer'];
  return `<div class="wire-stage"><div class="wire"><div class="wire-top"><div class="wire-dots"><i></i><i></i><i></i></div><div class="wire-title">${esc(c.icon)} ${esc(i?.name || c.name)}</div><span class="wire-mode">${esc(i?.placement || 'surface')} · r${i?.revision || 1}</span></div><div class="wire-body">${regions.map(r => {
    const body = r === 'body' || r === 'content';
    return `<div class="wire-region"><div class="wr-k">${esc(r)}</div>${body ? `<div class="wire-fields">${fields.slice(0, 6).map((x, idx) => `<div class="wire-field"><div class="wf-k">${esc(x.slot || 'slot.' + idx)}</div><div class="wf-v">${esc(x.target || 'bound value')}</div></div>`).join('') || '<div class="wire-field"><div class="wf-k">empty</div><div class="wf-v">—</div></div>'}</div>` : `<div class="wire-fields"><div class="wire-field"><div class="wf-k">${esc(r)}</div><div class="wf-v">${esc(c.name)}</div></div><div class="wire-field"><div class="wf-k">state</div><div class="wf-v">${esc(i?.status || 'active')}</div></div></div>`}</div>`;
  }).join('')}</div><div class="wire-actions">${(actions.length ? actions : (c.actions || []).map(a => ({ slot: a, kind: 'action', target: a }))).slice(0, 4).map((a, idx) => `<span class="wire-btn ${idx === 0 ? 'primary' : ''}">${esc(a.slot || a.target || 'action')}</span>`).join('')}</div></div></div>`;
}
function renderMain() {
  if (state.view === 'surfaces') return renderSurfaceMain();
  if (state.view === 'panels') return renderPanelMain();
  if (state.view === 'gestures') return renderGestureMain();
  return renderDockMain();
}
function renderSurfaceMain() {
  const c = surfClass(), i = surfInst(), fam = familyMeta(c.family);
  const data = i?.dataBindings || [], actions = i?.actionBindings || [];
  const bindingRows = [...data.map(x => ({ ...x, group: 'data' })), ...actions.map(x => ({ ...x, group: 'action' }))];
  $('#main').innerHTML = `<div class="hero"><div class="hero-icon" style="color:${fam.color}">${esc(c.icon)}</div><div class="hero-main"><div class="kicker">SurfaceClass · ${esc(fam.short)}</div><h1>${esc(c.name)}</h1><p>${esc(c.summary)}</p></div><div class="hero-actions"><button class="btn" data-action="run-surface">▶ 预览</button><button class="btn primary" data-action="duplicate-surface">⧉ 复制实例</button></div></div>
    <div class="stats"><span class="mini cyan">${c.regions.length} regions</span><span class="mini">${c.slots.length} slots</span><span class="mini">${c.actions.length} actions</span><span class="mini">${c.instances.length} instances</span><span class="mini">${esc(i?.placement || '—')} · r${i?.revision || 1}</span>${c.p0 ? '<span class="mini amber">P0</span>' : ''}</div>
    <div class="sec-head"><b>Surface Instance · 线框预览</b><span class="right"><span class="mini">${esc(i?.id || '')}</span></span></div>${wireframe(c, i)}
    <div class="contract-grid">${[['family', fam.short], ['class', c.id], ['version', 'v1.0.0'], ['placement', i?.placement || '—'], ['revision', 'r' + (i?.revision || 1)], ['status', i?.status || '—']].map(([k, v]) => `<div class="contract-cell"><div class="cc-k">${esc(k)}</div><div class="cc-v">${esc(v)}</div></div>`).join('')}</div>
    <div class="bind-panel"><div class="panel-head"><b>Bindings · 实例绑定</b><span class="sub">data + action</span><span class="right"><span class="mini green">${data.length} data</span><span class="mini amber">${actions.length} action</span></span></div><div style="padding:7px 8px">${bindingRows.map(x => `<div class="bind-row"><span class="bind-dot"></span><span class="bind-slot">${esc(x.slot)}</span><span class="bind-kind ${esc(x.kind)}">${esc(x.kind)}</span><span class="bind-target">${esc(x.target)}</span><span class="mini">${esc(x.group)}</span></div>`).join('') || '<div class="empty">该实例没有绑定。</div>'}</div></div>`;
  $$('#main [data-action]').forEach(b => b.onclick = () => handleAction(b.dataset.action));
}
function renderPanelMain() {
  const c = panelClass(), i = panelInst();
  const states = i?.state ? [i.state] : c.states;
  $('#main').innerHTML = `<div class="hero"><div class="hero-icon">{ }</div><div class="hero-main"><div class="kicker">PanelClass · ${esc(c.group)}</div><h1>${esc(c.name)}</h1><p>${esc(c.desc)}</p></div><div class="hero-actions"><a class="btn primary" href="panel-management.html#${encodeURIComponent(c.id)}">◧ 打开面板管理页 ↗</a><button class="btn" data-action="run-panel">▶ 预览</button><button class="btn" data-action="duplicate-panel">⧉ 复制实例</button></div></div>
    <div class="stats"><span class="mini violet">${c.modes.join(' / ')}</span><span class="mini">${c.regions.length} regions</span><span class="mini cyan">${c.instances.length} instances</span><span class="mini">${esc(i?.mode || 'right')} · ${i?.width || 380}px</span><span class="mini">r${i?.rev || 1}</span></div>
    <div class="sec-head"><b>Panel Anatomy · 结构预览</b><span class="right"><span class="mini">${esc(i?.label || '')}</span></span></div>
    <div class="panel-anatomy"><div class="pa-top"><span class="pa-title">${esc(c.icon)} ${esc(i?.label || c.name)}</span><span class="pa-mode">${esc(i?.mode || c.modes[0])} · ${i?.width || 380}px</span></div><div class="pa-body">${c.regions.map(r => `<div class="pa-region"><div class="pr-k">${esc(r)}</div><div class="pa-content"><span class="pa-chip">${esc(c.content)}</span>${r === 'body' ? `<span class="pa-chip">${esc(i?.content || 'content slot')}</span>` : `<span class="pa-chip">${esc(c.name)}</span>`}</div></div>`).join('')}<div class="pa-meta">${states.map(s => `<span class="pa-badge state">${esc(s)}</span>`).join('')}${c.behaviors.map(b => `<span class="pa-badge behavior">${esc(b)}</span>`).join('')}${c.a11y.map(a => `<span class="pa-badge a11y">${esc(a)}</span>`).join('')}</div></div></div>
    <div class="bind-panel"><div class="panel-head"><b>PanelInstance · 实例</b><span class="sub">${esc(c.id)}</span><span class="right"><span class="mini">${c.instances.length} total</span></span></div><div class="table-wrap"><table><thead><tr><th>Instance</th><th>Mode</th><th>Width</th><th>Content</th><th>State</th><th>Rev</th></tr></thead><tbody>${c.instances.map(x => `<tr class="tr-node ${x.label === state.panelInstId ? 'on' : ''}" data-panel-row="${esc(x.label)}"><td><span class="t-label">${esc(x.label)}</span></td><td class="mono">${esc(x.mode)}</td><td class="mono">${x.width}px</td><td class="mono">${esc(x.content)}</td><td><span class="pill ${x.state === 'error' ? 'ph' : 'ok'}">${esc(x.state)}</span></td><td class="mono">r${x.rev}</td></tr>`).join('')}</tbody></table></div></div>`;
  $$('#main [data-action]').forEach(b => b.onclick = () => handleAction(b.dataset.action));
  $$('#main [data-panel-row]').forEach(el => el.onclick = () => { state.panelInstId = el.dataset.panelRow; renderAll(); });
}
const GESTURE_PATHS = { LDR: [[320,60],[70,60],[70,160],[320,160]], UD: [[190,220],[190,55],[215,220]], RL: [[65,150],[330,150],[65,150]], DR: [[65,65],[65,225],[330,225]], DLU: [[330,60],[330,225],[70,225],[70,60]] };
function gestureSeed(pattern) { return GESTURE_PATHS[pattern] || GESTURE_PATHS.LDR; }
function renderGestureMain() {
  const g = gesture(), pts = gestureSeed(g.pattern);
  const poly = pts.map(p => p.join(',')).join(' ');
  $('#main').innerHTML = `<div class="hero"><div class="hero-icon">G</div><div class="hero-main"><div class="kicker">GestureRecognizer × GestureBinding</div><h1>${esc(g.pattern)} · ${esc(g.name)}</h1><p>${esc(g.desc)}</p></div><div class="hero-actions"><a class="btn primary" href="gesture-management.html#${encodeURIComponent(g.pattern)}">G 打开手势管理页 ↗</a><button class="btn" data-action="run-gesture">▶ 识别预览</button><button class="btn" data-action="duplicate-gesture">⧉ 复制绑定</button></div></div>
    <div class="stats"><span class="mini violet">${GB.length} bindings</span><span class="mini amber">${gestureStats().flow} flow</span><span class="mini cyan">${gestureStats().point} point</span><span class="mini">${esc(g.effect)}</span></div>
    <div class="gesture-stage"><div class="gesture-pad"><div class="gesture-grid"></div><svg class="gesture-svg" viewBox="0 0 400 280" preserveAspectRatio="none"><polyline points="${poly}" fill="none" stroke="#22d3ee" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/><circle cx="${pts[0][0]}" cy="${pts[0][1]}" r="5" fill="#22d3ee"/><circle cx="${pts[pts.length-1][0]}" cy="${pts[pts.length-1][1]}" r="5" fill="#f59e0b"/></svg><div class="gesture-pattern">${esc(g.pattern)}</div><div class="gesture-hint"><b>Gesture Pad</b>点击下方预设，或画一个手势</div></div><div class="gesture-foot">${GB.map(b => `<button class="preset ${b.pattern === g.pattern ? 'on' : ''}" data-preset="${esc(b.pattern)}">${esc(b.pattern)}</button>`).join('')}<span class="mini" style="margin-left:auto">fuzzy ≤1 segment</span></div><div class="gesture-match"><span class="kind-badge ${esc(g.kind)}">${g.kind === 'flow' ? 'FLOW' : 'POINT'}</span><b>${esc(g.name)}</b><span class="mini">${esc(g.target)}</span><span class="mini">${esc(g.effect)}</span></div></div>
    <div class="bind-panel"><div class="panel-head"><b>GestureBinding · 手势 → 目标实例</b><span class="sub">pattern / kind / target</span><span class="right"><span class="mini green">${GB.length} bindings</span></span></div><div class="table-wrap"><table><thead><tr><th>Pattern</th><th>Kind</th><th>Name</th><th>Target</th><th>Effect</th><th>Action</th></tr></thead><tbody>${GB.map(b => `<tr class="tr-node ${b.pattern === g.pattern ? 'on' : ''}" data-gesture-row="${esc(b.pattern)}"><td class="mono">${esc(b.pattern)}</td><td><span class="kind-badge ${esc(b.kind)}">${b.kind === 'flow' ? 'FLOW' : 'POINT'}</span></td><td class="t-label">${esc(b.name)}</td><td class="mono">${esc(b.target)}</td><td class="mono">${esc(b.effect)}</td><td>${flowLink(b.target) ? `<a class="plink" href="${esc(flowLink(b.target))}">打开线层实例 ↗</a>` : '<span class="pill ph">占位</span>'}</td></tr>`).join('')}</tbody></table></div></div>`;
  $$('#main [data-preset]').forEach(b => b.onclick = () => { state.gesturePattern = b.dataset.preset; updateHash(); renderAll(); });
  $$('#main [data-gesture-row]').forEach(el => el.onclick = () => { state.gesturePattern = el.dataset.gestureRow; updateHash(); renderAll(); });
  $$('#main [data-action]').forEach(b => b.onclick = () => handleAction(b.dataset.action));
}
function renderDockMain() {
  const tab = dockTab(), tile = dockTile(), list = DOCK_TILES.filter(t => t.tab === tab.id);
  const link = tile ? flowLink(tile.target) : '';
  $('#main').innerHTML = `<div class="hero"><div class="hero-icon">⌘</div><div class="hero-main"><div class="kicker">SurfaceInstance · launch-dock.desktop@r1</div><h1>CLaunch 式启动坞</h1><p>5 个分页 · 48 个 Tile；flow 与 point 混合启动。点击 Tile 查看目标与绑定。</p></div><div class="hero-actions"><a class="btn primary" href="dock-management.html#${encodeURIComponent(tab.id)}">⌘ 打开启动坞管理页 ↗</a><button class="btn" data-action="run-dock">▶ 预览</button><button class="btn" data-action="duplicate-dock">⧉ 复制 Tile</button></div></div>
    <div class="stats"><span class="mini violet">5 tabs</span><span class="mini">48 tiles</span><span class="mini cyan">${dockStats().flow} flow</span><span class="mini amber">${dockStats().point} point</span><span class="mini">${esc(tab.name)} · ${list.length}</span></div>
    <div class="dock-preview"><div class="dock-preview-head"><span class="dock-preview-title">Launch Dock · ${esc(tab.name)}</span><span class="dock-preview-sub">${esc(tile?.id || '')} · ${esc(tile?.kind || '')}</span></div><div class="dock-tabs">${DOCK_TABS.map(t => `<button class="${t.id === tab.id ? 'on' : ''}" data-dock-tab-main="${esc(t.id)}">${esc(t.name)} <span>${DOCK_TILES.filter(x => x.tab === t.id).length}</span></button>`).join('')}</div><div class="dock-grid">${list.map(t => `<div class="dock-tile ${t.id === tile?.id ? 'on' : ''}" data-kind="${esc(t.kind)}" data-dock-tile-main="${esc(t.id)}"><div class="dock-icon">${esc(t.icon)}</div><div class="dock-label">${esc(t.name)}</div><div class="dock-sub">${esc(t.kind)}</div></div>`).join('')}</div><div class="dock-foot"><span class="dock-page"></span><span class="dock-page dim"></span><span class="dock-page dim"></span><span class="mini" style="margin-left:auto">${list.length} tiles · page 1</span></div></div>
    <div class="bind-panel"><div class="panel-head"><b>${esc(tab.name)} · Tiles</b><span class="sub">target / kind / effect</span><span class="right">${link ? `<a class="plink" href="${esc(link)}">打开线层实例 ↗</a>` : '<span class="pill ph">目标待接入</span>'}</span></div><div class="table-wrap"><table><thead><tr><th>Tile</th><th>Kind</th><th>Target</th><th>Hotkey</th><th>Effect</th><th>Link</th></tr></thead><tbody>${list.map(t => `<tr class="tr-node ${t.id === tile?.id ? 'on' : ''}" data-dock-row="${esc(t.id)}"><td><span class="t-label">${esc(t.icon)} ${esc(t.name)}</span><span class="t-sub">${esc(t.id)}</span></td><td><span class="kind-badge ${esc(t.kind)}">${t.kind === 'flow' ? 'FLOW' : 'POINT'}</span></td><td class="mono">${esc(t.target)}</td><td class="mono">${t.hotkey ? '⌨ ' + t.hotkey : '—'}</td><td class="mono">${esc(t.effect)}</td><td>${flowLink(t.target) ? `<a class="plink" href="${esc(flowLink(t.target))}">打开 ↗</a>` : '<span class="pill ph">占位</span>'}</td></tr>`).join('')}</tbody></table></div></div>`;
  $$('#main [data-dock-tab-main]').forEach(b => b.onclick = () => { state.dockTabId = b.dataset.dockTabMain; state.dockTileId = DOCK_TILES.find(t => t.tab === state.dockTabId)?.id || ''; updateHash(); renderAll(); });
  $$('#main [data-dock-tile-main]').forEach(el => el.onclick = () => { state.dockTileId = el.dataset.dockTileMain; updateHash(); renderAll(); });
  $$('#main [data-dock-row]').forEach(el => el.onclick = () => { state.dockTileId = el.dataset.dockRow; updateHash(); renderAll(); });
  $$('#main [data-action]').forEach(b => b.onclick = () => handleAction(b.dataset.action));
  $$('#main .plink').forEach(a => a.addEventListener('click', e => e.stopPropagation()));
}
function renderInspector() {
  if (state.view === 'surfaces') return renderSurfaceInspector();
  if (state.view === 'panels') return renderPanelInspector();
  if (state.view === 'gestures') return renderGestureInspector();
  return renderDockInspector();
}
function renderSurfaceInspector() {
  const c = surfClass(), i = surfInst();
  if (!c) { $('#inspector').innerHTML = '<div class="empty">选择面层类。</div>'; return; }
  const data = i?.dataBindings || [], actions = i?.actionBindings || [];
  $('#inspector').innerHTML = `<div class="insp-kicker">SurfaceClass · 面层类</div><div class="insp-title">${esc(c.icon)} ${esc(c.name)}</div><div class="insp-id">${esc(c.id)} · ${esc(c.family)}</div>
    <div class="insp-section"><div class="lh">Contract</div><div class="kv"><div class="k">regions</div><div class="v">${esc(c.regions.join(' / '))}</div><div class="k">slots</div><div class="v">${esc(c.slots.join(' / '))}</div><div class="k">actions</div><div class="v">${esc(c.actions.join(' / '))}</div><div class="k">states</div><div class="v">${esc(c.states.join(' / '))}</div></div></div>
    <div class="insp-section"><div class="lh">Instance · ${esc(i?.name || '—')}</div><div class="kv"><div class="k">id</div><div class="v">${esc(i?.id || '—')}</div><div class="k">placement</div><div class="v">${esc(i?.placement || '—')}</div><div class="k">revision</div><div class="v">r${i?.revision || 1}</div><div class="k">status</div><div class="v">${esc(i?.status || '—')}</div><div class="k">data</div><div class="v">${data.length}</div><div class="k">action</div><div class="v">${actions.length}</div></div></div>
    <div class="insp-section"><div class="lh">Data Bindings</div>${data.map(x => `<div class="bind-row"><span class="bind-slot">${esc(x.slot)}</span><span class="bind-kind ${esc(x.kind)}">${esc(x.kind)}</span><span class="bind-target">${esc(x.target)}</span></div>`).join('') || '<div class="empty">无</div>'}</div>
    <div class="insp-section"><div class="lh">Action Bindings</div>${actions.map(x => `<div class="bind-row"><span class="bind-slot">${esc(x.slot)}</span><span class="bind-kind ${esc(x.kind)}">${esc(x.kind)}</span><span class="bind-target">${esc(x.target)}</span></div>`).join('') || '<div class="empty">无</div>'}</div>
    <div class="insp-section"><div class="lh">Actions</div><div class="actions"><button class="btn" data-action="run-surface">▶ 预览</button><button class="btn" data-action="duplicate-surface">⧉ 复制</button><button class="btn danger" data-action="archive-surface">⌫ 归档</button></div></div>`;
  $$('#inspector [data-action]').forEach(b => b.onclick = () => handleAction(b.dataset.action));
}
function renderPanelInspector() {
  const c = panelClass(), i = panelInst();
  if (!c) { $('#inspector').innerHTML = '<div class="empty">选择面板类。</div>'; return; }
  $('#inspector').innerHTML = `<div class="insp-kicker">PanelClass · 面板类</div><div class="insp-title">${esc(c.icon)} ${esc(c.name)}</div><div class="insp-id">${esc(c.id)} · ${esc(c.group)}</div>
    <div class="insp-section"><div class="lh">Contract</div><div class="kv"><div class="k">modes</div><div class="v">${esc(c.modes.join(' / '))}</div><div class="k">regions</div><div class="v">${esc(c.regions.join(' / '))}</div><div class="k">content</div><div class="v">${esc(c.content)}</div><div class="k">version</div><div class="v">v${esc(c.version)}</div></div></div>
    <div class="insp-section"><div class="lh">Instance · ${esc(i?.label || '—')}</div><div class="kv"><div class="k">mode</div><div class="v">${esc(i?.mode || '—')}</div><div class="k">width</div><div class="v">${i?.width || '—'} px</div><div class="k">state</div><div class="v">${esc(i?.state || '—')}</div><div class="k">rev</div><div class="v">r${i?.rev || 1}</div></div></div>
    <div class="insp-section"><div class="lh">States</div>${c.states.map(x => `<span class="pa-badge state">${esc(x)}</span>`).join(' ')}</div>
    <div class="insp-section"><div class="lh">Behaviors</div>${c.behaviors.map(x => `<span class="pa-badge behavior">${esc(x)}</span>`).join(' ')}</div>
    <div class="insp-section"><div class="lh">A11y</div>${c.a11y.map(x => `<span class="pa-badge a11y">${esc(x)}</span>`).join(' ')}</div>
    <div class="insp-section"><div class="lh">Actions</div><div class="actions"><button class="btn" data-action="run-panel">▶ 预览</button><button class="btn" data-action="duplicate-panel">⧉ 复制</button><button class="btn danger" data-action="archive-panel">⌫ 归档</button></div></div>`;
  $$('#inspector [data-action]').forEach(b => b.onclick = () => handleAction(b.dataset.action));
}
function renderGestureInspector() {
  const g = gesture(); const link = flowLink(g.target);
  $('#inspector').innerHTML = `<div class="insp-kicker">GestureBinding · 手势绑定</div><div class="insp-title">${esc(g.pattern)} · ${esc(g.name)}</div><div class="insp-id">${esc(g.target)}</div>
    <div class="insp-section"><div class="lh">Binding</div><div class="kv"><div class="k">pattern</div><div class="v">${esc(g.pattern)}</div><div class="k">kind</div><div class="v">${esc(g.kind)}</div><div class="k">target</div><div class="v">${esc(g.target)}</div><div class="k">effect</div><div class="v">${esc(g.effect)}</div></div></div>
    <div class="insp-section"><div class="lh">Description</div><div style="font-size:8px;line-height:1.55;color:#9fb1c8">${esc(g.desc)}</div></div>
    <div class="insp-section"><div class="lh">Target</div>${link ? `<a class="btn primary" style="width:100%" href="${esc(link)}">打开线层实例 ↗</a>` : '<div class="note">该目标尚未接入线层管理页或点层管理页，先显示占位。</div>'}</div>
    <div class="insp-section"><div class="lh">Actions</div><div class="actions"><button class="btn" data-action="run-gesture">▶ 识别</button><button class="btn" data-action="duplicate-gesture">⧉ 复制</button></div></div>`;
  $$('#inspector [data-action]').forEach(b => b.onclick = () => handleAction(b.dataset.action));
}
function renderDockInspector() {
  const tile = dockTile(); const tab = dockTab(); const link = tile ? flowLink(tile.target) : '';
  $('#inspector').innerHTML = `<div class="insp-kicker">Launch Dock · SurfaceInstance</div><div class="insp-title">CLaunch 式启动坞</div><div class="insp-id">launch-dock.desktop@r1 · ${esc(tab.name)}</div>
    <div class="insp-section"><div class="lh">Dock</div><div class="kv"><div class="k">tabs</div><div class="v">${DOCK_TABS.length}</div><div class="k">tiles</div><div class="v">${DOCK_TILES.length}</div><div class="k">flow</div><div class="v">${dockStats().flow}</div><div class="k">point</div><div class="v">${dockStats().point}</div></div></div>
    ${tile ? `<div class="insp-section"><div class="lh">Selected Tile</div><div class="kv"><div class="k">id</div><div class="v">${esc(tile.id)}</div><div class="k">kind</div><div class="v">${esc(tile.kind)}</div><div class="k">target</div><div class="v">${esc(tile.target)}</div><div class="k">effect</div><div class="v">${esc(tile.effect)}</div><div class="k">hotkey</div><div class="v">${tile.hotkey ? '⌨ ' + esc(tile.hotkey) : '—'}</div></div>${link ? `<a class="btn primary" style="width:100%;margin-top:6px" href="${esc(link)}">打开线层实例 ↗</a>` : '<div class="note" style="margin-top:6px">该 target 尚未接入具体管理页，先显示占位。</div>'}</div>` : ''}
    <div class="insp-section"><div class="lh">Actions</div><div class="actions"><button class="btn" data-action="run-dock">▶ 预览</button><button class="btn" data-action="duplicate-dock">⧉ 复制 Tile</button></div></div>`;
  $$('#inspector [data-action]').forEach(b => b.onclick = () => handleAction(b.dataset.action));
}
function handleAction(action) {
  if (action === 'run-surface' || action === 'run-panel' || action === 'run-gesture' || action === 'run-dock') { showToast('预览运行 · 交互状态正常'); return; }
  if (action === 'duplicate-surface') { const c = surfClass(), i = surfInst(); if (!c || !i) return; const copy = JSON.parse(JSON.stringify(i)); copy.id = `${i.id}.copy-${Date.now()}`; copy.name = `${i.name} 副本`; copy.revision = 1; copy.status = 'draft'; c.instances.push(copy); state.surfaceInstId = copy.id; renderAll(); showToast('已复制 SurfaceInstance'); return; }
  if (action === 'archive-surface') { const i = surfInst(); if (i) { i.status = 'archived'; renderAll(); showToast('已归档 SurfaceInstance'); } return; }
  if (action === 'new-surface-instance') { const c = surfClass(), i = surfInst(); if (!c) return; const base = i ? JSON.parse(JSON.stringify(i)) : { id: `${c.id}.new`, name: `${c.name} 新实例`, desc: '', placement: 'panel', revision: 1, status: 'draft', dataBindings: [], actionBindings: [] }; base.id = `${c.id}.inst-${Date.now()}`; base.name = `${c.name} 新实例`; base.revision = 1; base.status = 'draft'; c.instances.push(base); state.surfaceInstId = base.id; renderAll(); showToast('已新建 SurfaceInstance'); return; }
  if (action === 'duplicate-panel') { const c = panelClass(), i = panelInst(); if (!c || !i) return; const copy = JSON.parse(JSON.stringify(i)); copy.label = `${i.label} 副本`; copy.rev = 1; copy.status = 'draft'; c.instances.push(copy); state.panelInstId = copy.label; renderAll(); showToast('已复制 PanelInstance'); return; }
  if (action === 'archive-panel') { const i = panelInst(); if (i) { i.status = 'archived'; renderAll(); showToast('已归档 PanelInstance'); } return; }
  if (action === 'duplicate-gesture') { const g = gesture(); const copy = JSON.parse(JSON.stringify(g)); copy.pattern = `${g.pattern}2`; copy.name = `${g.name} 副本`; GB.push(copy); state.gesturePattern = copy.pattern; renderAll(); showToast('已复制 GestureBinding'); return; }
  if (action === 'duplicate-dock') { const t = dockTile(); if (!t) return; const copy = JSON.parse(JSON.stringify(t)); copy.id = `${t.id}.copy-${Date.now()}`; copy.name = `${t.name} 副本`; DOCK_TILES.push(copy); state.dockTileId = copy.id; renderAll(); showToast('已复制 Dock Tile'); return; }
}
function newSurfaceInstance() { handleAction('new-surface-instance'); }
function renderAll() { renderTopStats(); renderViewTabs(); renderLeft(); renderMain(); renderInspector(); }
function init() {
  parseHash(); renderAll();
  $('#viewTabs').addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (!b) return; state.view = b.dataset.view; if (state.view === 'dock') { state.dockTabId = DOCK_TABS[0]?.id || 'common'; state.dockTileId = DOCK_TILES.find(t => t.tab === state.dockTabId)?.id || ''; } updateHash(); renderAll(); });
  window.addEventListener('hashchange', () => { parseHash(); renderAll(); });
}
init();
})();
