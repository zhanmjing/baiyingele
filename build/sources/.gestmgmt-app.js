(() => {
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const deep = o => JSON.parse(JSON.stringify(o));
const POINT_TARGETS = POINT_SEED.flatMap(c => c.instances.map(i => ({
  id: `point:${c.id}/${i.id}`, kind: 'point', classId: c.id, className: c.name, instanceId: i.id, instanceName: i.name,
  label: `${c.name} / ${i.name}`, sub: `${c.id} / ${i.id}`, atomRef: `${c.id}/${i.id}`,
  href: `atom-catalog-management.html#${encodeURIComponent(c.id)}/${encodeURIComponent(i.id)}`
})));
const LINE_TARGETS = LINE_DATA.flows.flatMap(f => f.instances.map(i => ({
  id: `line:${f.id}/${i.id}`, kind: 'line', flowId: f.id, flowName: f.name, instanceId: i.id, instanceName: i.name,
  label: `${f.name} / ${i.name}`, sub: `${f.id} / ${i.id}`, atomRef: `${i.id}@r${i.rev}`,
  href: `line-management.html#${encodeURIComponent(f.id)}/${encodeURIComponent(i.id)}`
})));
const ALL_TARGETS = [...POINT_TARGETS, ...LINE_TARGETS];
const STORAGE = 'baiying.gestureManager.v1';
function resolveLegacy(g) {
  const base = String(g.target || '').replace(/@r\d+$/, '');
  const t = LINE_TARGETS.find(x => x.instanceId === base) || POINT_TARGETS.find(x => x.instanceId === base);
  if (t) return { ...g, kind: t.kind === 'point' ? 'point' : 'flow', target: t.atomRef, targetKind: t.kind, targetId: t.id, targetLabel: t.label, href: t.href };
  return { ...g, targetKind: g.kind === 'flow' ? 'line' : 'point', targetId: '', targetLabel: g.target, href: '' };
}
let GESTURES = deep(GESTURE_DATA).map(resolveLegacy);
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE) || 'null');
  if (saved && Array.isArray(saved.bindings) && saved.bindings.length) GESTURES = saved.bindings;
} catch (_) {}
const state = { pattern: GESTURES[0]?.pattern || '', query: '', recorderActive: false, recordPoints: [], drawing: false, pendingEditId: null, toastTimer: null };
const gesture = () => GESTURES.find(g => g.pattern === state.pattern) || GESTURES[0] || null;
const stats = () => ({ total: GESTURES.length, mapped: GESTURES.filter(g => g.targetId && g.href).length, point: GESTURES.filter(g => g.targetKind === 'point').length, line: GESTURES.filter(g => g.targetKind === 'line').length });
function saveData() { try { localStorage.setItem(STORAGE, JSON.stringify({ bindings: GESTURES, savedAt: new Date().toISOString() })); } catch (_) {} }
function showToast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => t.classList.remove('show'), 1800); }
function updateHash() { const h = `#${encodeURIComponent(state.pattern)}`; if (location.hash !== h) history.replaceState(null, '', h); }
function parseHash() {
  const p = decodeURIComponent((location.hash || '').replace(/^#/, ''));
  if (p && GESTURES.some(g => g.pattern === p)) state.pattern = p;
  if (!gesture() && GESTURES[0]) state.pattern = GESTURES[0].pattern;
}
function renderTopStats() {
  const s = stats();
  $('#topStats').innerHTML = `<span class="mini violet">${s.total} bindings</span><span class="mini green">${s.mapped} mapped</span><span class="mini cyan">${s.point} point</span><span class="mini">${s.line} line</span><span class="mini amber">recorder ${state.recorderActive ? 'active' : 'off'}</span>`;
}
function filteredGestures() {
  const q = state.query.trim().toLowerCase();
  if (!q) return GESTURES;
  return GESTURES.filter(g => [g.pattern, g.name, g.target, g.targetLabel, g.kind, g.effect, g.desc].join(' ').toLowerCase().includes(q));
}
function renderLeft() {
  const list = filteredGestures();
  $('#leftPane').innerHTML = `<div class="pane-head"><b>GestureBinding · 手势绑定</b><span class="count">${GESTURES.length}</span><button data-action="new-gesture" title="新建手势（启用识别）">＋</button></div>
    <input class="panel-search" id="gestureSearch" placeholder="搜索 pattern / name / target…" value="${esc(state.query)}">
    ${list.map(g => `<div class="flow-item ${g.pattern === state.pattern ? 'on' : ''}" data-gesture="${esc(g.pattern)}"><div class="fi-top"><span class="fi-name">${esc(g.pattern)} · ${esc(g.name)}</span><span class="fi-ver">${esc(g.effect)}</span></div><div class="fi-id">${esc(g.target)}</div><div class="fi-meta"><span class="fi-badge">${g.targetKind === 'point' ? 'PointInstance' : 'FlowInstance'}</span><span class="fi-badge">${g.targetId ? 'mapped' : 'placeholder'}</span></div></div>`).join('') || '<div class="empty">没有匹配的手势。</div>'}
    <div style="margin-top:10px"><button class="btn" style="width:100%;justify-content:center" data-action="reset-data">↺ 重置示例手势</button></div>`;
  const search = $('#gestureSearch'); if (search) search.addEventListener('input', e => { state.query = e.target.value; renderLeft(); });
  $$('#leftPane [data-gesture]').forEach(el => el.onclick = () => { state.pattern = el.dataset.gesture; updateHash(); renderAll(); });
  $$('#leftPane [data-action]').forEach(b => b.onclick = () => handleAction(b.dataset.action));
}
const GESTURE_PATHS = {
  LDR: [[360,60],[70,60],[70,170],[360,170]],
  UD: [[220,200],[220,50],[245,200]],
  RL: [[70,130],[360,130],[70,130]],
  DR: [[70,60],[70,190],[360,190]],
  DLU: [[360,60],[360,190],[70,190],[70,60]]
};
function pathFor(pattern) { return GESTURE_PATHS[pattern] || GESTURE_PATHS.LDR; }
function staticSVG(g) {
  const pts = pathFor(g.pattern);
  return `<svg class="pad-static" viewBox="0 0 430 230" preserveAspectRatio="none"><polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="#22d3ee" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${pts[0][0]}" cy="${pts[0][1]}" r="5" fill="#22d3ee"/><circle cx="${pts[pts.length-1][0]}" cy="${pts[pts.length-1][1]}" r="5" fill="#f59e0b"/></svg>`;
}
function mapped(g) { return !!(g.targetId && g.href); }
function renderMain() {
  const g = gesture();
  if (!g) { $('#main').innerHTML = '<div class="empty">没有手势绑定。</div>'; return; }
  const s = stats();
  $('#main').innerHTML = `<div class="hero"><div class="hero-icon">G</div><div class="hero-main"><div class="kicker">GestureBinding · ${esc(g.targetKind)}</div><h1>${esc(g.pattern)} · ${esc(g.name)}</h1><p>${esc(g.desc)}</p></div><div class="hero-actions"><button class="btn" data-action="edit-gesture">✎ 编辑</button><button class="btn" data-action="rerecord">● 重录</button><button class="btn" data-action="duplicate-gesture">⧉ 复制</button><button class="btn danger" data-action="delete-gesture">⌫ 删除</button></div></div>
    <div class="stats"><span class="mini violet">${s.total} bindings</span><span class="mini green">${s.mapped} mapped</span><span class="mini cyan">${s.point} point targets</span><span class="mini">${s.line} line targets</span><span class="mini amber">recorder off</span></div>
    <div class="map-chain"><div class="map-node gesture"><div class="mn-k">Gesture</div><div class="mn-v">${esc(g.pattern)} · ${esc(g.name)}</div></div><span class="map-arrow">→</span><div class="map-node ${g.targetKind === 'point' ? 'point' : 'line'}"><div class="mn-k">Target Layer</div><div class="mn-v">${g.targetKind === 'point' ? 'PointInstance' : 'FlowInstance'}</div></div><span class="map-arrow">→</span><div class="map-node target"><div class="mn-k">AtomRef</div><div class="mn-v">${esc(g.targetLabel || g.target)}</div></div>${mapped(g) ? `<a class="btn primary" href="${esc(g.href)}">打开目标实例 ↗</a>` : '<span class="pill ph">占位 · 未接入</span>'}</div>
    <div class="pad-idle"><div class="pad-grid"></div>${staticSVG(g)}<div class="pad-lock"><div class="pad-lock-card"><b>手势识别未启用</b><span>只在新建 / 重录手势时启动；识别完成后自动关闭</span><button class="btn primary" data-action="new-gesture">＋ 新建手势（启用识别）</button></div></div><div class="pad-foot"><span class="mini">${esc(g.pattern)}</span><span class="mini">${esc(g.effect)}</span><span class="grow"></span><span class="mini">${mapped(g) ? 'mapped' : 'placeholder'}</span></div></div>
    <div class="bind-panel"><div class="panel-head"><b>GestureBinding · 手势 → 目标实例</b><span class="sub">point / line</span><span class="right"><span class="mini green">${s.mapped} mapped</span><span class="mini amber">${s.total - s.mapped} 占位</span></span></div><div class="table-wrap"><table><thead><tr><th>Pattern</th><th>Kind</th><th>Name</th><th>Target</th><th>Effect</th><th>Status</th><th>Action</th></tr></thead><tbody>${GESTURES.map(x => `<tr class="tr-node ${x.pattern === g.pattern ? 'on' : ''}" data-gesture-row="${esc(x.pattern)}"><td class="mono">${esc(x.pattern)}</td><td><span class="kind-badge ${x.targetKind === 'point' ? 'point' : 'line'}">${x.targetKind === 'point' ? 'POINT' : 'LINE'}</span></td><td class="t-label">${esc(x.name)}</td><td class="mono">${esc(x.targetLabel || x.target)}</td><td class="mono">${esc(x.effect)}</td><td>${mapped(x) ? '<span class="pill ok">mapped</span>' : '<span class="pill ph">占位</span>'}</td><td>${mapped(x) ? `<a class="plink" href="${esc(x.href)}">打开 ↗</a>` : '<span class="pill ph">待接入</span>'}</td></tr>`).join('')}</tbody></table></div></div>`;
  $$('#main [data-action]').forEach(b => b.onclick = () => handleAction(b.dataset.action));
  $$('#main [data-gesture-row]').forEach(el => el.onclick = () => { state.pattern = el.dataset.gestureRow; updateHash(); renderAll(); });
  $$('#main .plink').forEach(a => a.addEventListener('click', e => e.stopPropagation()));
}
function renderInspector() {
  const g = gesture();
  if (!g) { $('#inspector').innerHTML = '<div class="empty">选择手势。</div>'; return; }
  $('#inspector').innerHTML = `<div class="insp-kicker">GestureBinding · 手势绑定</div><div class="insp-title">${esc(g.pattern)} · ${esc(g.name)}</div><div class="insp-id">${esc(g.target)}</div>
    <div class="insp-section"><div class="lh">Binding</div><div class="kv"><div class="k">pattern</div><div class="v">${esc(g.pattern)}</div><div class="k">kind</div><div class="v">${g.targetKind === 'point' ? 'point' : 'line'}</div><div class="k">target</div><div class="v">${esc(g.targetLabel || g.target)}</div><div class="k">atomRef</div><div class="v">${esc(g.target)}</div><div class="k">effect</div><div class="v">${esc(g.effect)}</div></div></div>
    <div class="insp-section"><div class="lh">Description</div><div style="font-size:8px;line-height:1.55;color:#9fb1c8">${esc(g.desc)}</div></div>
    <div class="insp-section"><div class="lh">Target</div>${mapped(g) ? `<a class="btn primary" style="width:100%" href="${esc(g.href)}">打开${g.targetKind === 'point' ? '点层' : '线层'}实例 ↗</a>` : '<div class="note">该手势 target 尚未映射到点层/线层实例，先显示占位。编辑绑定可选择实际实例。</div>'}</div>
    <div class="insp-section"><div class="lh">Actions</div><div class="actions"><button class="btn" data-action="edit-gesture">✎ 编辑</button><button class="btn" data-action="rerecord">● 重录</button><button class="btn" data-action="duplicate-gesture">⧉ 复制</button><button class="btn danger" data-action="delete-gesture">⌫ 删除</button></div></div>`;
  $$('#inspector [data-action]').forEach(b => b.onclick = () => handleAction(b.dataset.action));
}
function renderAll() { renderTopStats(); renderLeft(); renderMain(); renderInspector(); }
function openModal(html) { $('#modalRoot').innerHTML = `<div class="modal-overlay" id="modalOverlay"><div class="modal">${html}</div></div>`; }
function closeModal() { state.recorderActive = false; state.drawing = false; state.pendingEditId = null; $('#modalRoot').innerHTML = ''; }
function confirmModal(title, message, label, onConfirm) {
  openModal(`<h3>${esc(title)}</h3><p>${esc(message)}</p><div class="modal-actions"><button class="btn" data-modal-close>取消</button><button class="btn danger" id="modalConfirm">${esc(label)}</button></div>`);
  $('#modalConfirm').onclick = () => { closeModal(); onConfirm(); };
}
function dirOf(dx, dy) {
  const a = Math.atan2(dy, dx) * 180 / Math.PI;
  if (a >= -22.5 && a < 22.5) return 'R';
  if (a >= 22.5 && a < 67.5) return 'DR';
  if (a >= 67.5 && a < 112.5) return 'D';
  if (a >= 112.5 && a < 157.5) return 'DL';
  if (a >= 157.5 || a < -157.5) return 'L';
  if (a >= -157.5 && a < -112.5) return 'UL';
  if (a >= -112.5 && a < -67.5) return 'U';
  return 'UR';
}
function recognize(points) {
  const filtered = [];
  for (const p of points) {
    const last = filtered[filtered.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= 14) filtered.push(p);
  }
  const dirs = [];
  for (let i = 1; i < filtered.length; i++) {
    const d = dirOf(filtered[i].x - filtered[i - 1].x, filtered[i].y - filtered[i - 1].y);
    if (dirs[dirs.length - 1] !== d) dirs.push(d);
  }
  return dirs.join('');
}
function openRecordModal(editPattern = null) {
  state.recorderActive = true; state.pendingEditId = editPattern; state.recordPoints = []; state.drawing = false;
  openModal(`<h3>${editPattern ? '重录手势' : '新建手势 · 录制'}</h3><p>按住左键在画布上画；抬手识别后识别器自动关闭，再选择映射到点层或线层实例。</p>
    <div class="record-pad" id="recordPad"><div class="rg"></div><svg class="record-svg" id="recordSvg" viewBox="0 0 600 230" preserveAspectRatio="none"><polyline id="recordLine" points="" fill="none" stroke="#22d3ee" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg><div class="record-hint" id="recordHint"><b>Gesture Pad</b>按住左键画手势</div></div>
    <div class="record-readout"><span class="mini">Recognized</span><span class="record-pattern" id="recordPattern">—</span><span class="mini" id="recordDirs"></span><button class="btn small" id="recordClear" style="margin-left:auto">清空</button></div>
    <div class="modal-actions"><button class="btn" data-modal-close>取消</button></div>`);
  const pad = $('#recordPad'), line = $('#recordLine'), patternEl = $('#recordPattern'), dirsEl = $('#recordDirs'), hint = $('#recordHint');
  const toLocal = e => { const r = pad.getBoundingClientRect(); return { x: (e.clientX - r.left) * 600 / r.width, y: (e.clientY - r.top) * 230 / r.height }; };
  const draw = () => { line.setAttribute('points', state.recordPoints.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')); hint.style.display = state.recordPoints.length ? 'none' : 'block'; dirsEl.textContent = recognize(state.recordPoints); };
  pad.addEventListener('pointerdown', e => { e.preventDefault(); state.drawing = true; state.recordPoints = [toLocal(e)]; pad.setPointerCapture?.(e.pointerId); draw(); });
  pad.addEventListener('pointermove', e => { if (!state.drawing) return; state.recordPoints.push(toLocal(e)); draw(); });
  const finish = () => {
    if (!state.drawing) return; state.drawing = false;
    const p = recognize(state.recordPoints);
    if (!p) { showToast('请画出至少一段方向'); draw(); return; }
    patternEl.textContent = p; dirsEl.textContent = '✓ ' + p;
    state.recorderActive = false;
    const edit = state.pendingEditId;
    setTimeout(() => { closeModal(); openBindingModal(edit, p); }, 220);
  };
  pad.addEventListener('pointerup', finish);
  pad.addEventListener('pointercancel', finish);
  $('#recordClear').onclick = () => { state.recordPoints = []; patternEl.textContent = '—'; dirsEl.textContent = ''; draw(); };
}
function openBindingModal(editPattern = null, patternOverride = null) {
  const edit = !!editPattern;
  const g = edit ? gesture() : null;
  if (edit && !g) return;
  let selectedTargetId = g?.targetId || '';
  let targetKind = g?.targetKind || 'point';
  openModal(`<h3>${edit ? '编辑手势绑定' : '新建手势绑定'}</h3><p>${patternOverride ? '手势已识别。' : ''}选择映射到点层或线层实例；保存后生成 GestureBinding。</p>
    <div class="form-grid"><div class="field"><label>pattern</label><input id="gPattern" value="${esc(patternOverride || g?.pattern || '')}" placeholder="LDR"></div><div class="field"><label>名称</label><input id="gName" value="${esc(g?.name || '新手势')}"></div><div class="field"><label>effect</label><select id="gEffect">${['L0', 'L1', 'L2'].map(x => `<option value="${x}" ${(g?.effect || 'L0') === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div><div class="field full"><label>说明</label><textarea id="gDesc">${esc(g?.desc || '')}</textarea></div></div>
    <div class="target-tabs"><button data-target-kind="point" class="${targetKind === 'point' ? 'on' : ''}">点层实例 · ${POINT_TARGETS.length}</button><button data-target-kind="line" class="${targetKind === 'line' ? 'on' : ''}">线层实例 · ${LINE_TARGETS.length}</button></div>
    <input class="target-search" id="targetSearch" placeholder="搜索实例 / class / flow…">
    <div class="target-list" id="targetList"></div><div class="target-summary" id="targetSummary"></div>
    <div class="modal-actions"><button class="btn" data-modal-close>取消</button><button class="btn primary" id="gestureSave">保存绑定</button></div>`);
  const renderTargets = () => {
    const q = ($('#targetSearch')?.value || '').trim().toLowerCase();
    const list = (targetKind === 'point' ? POINT_TARGETS : LINE_TARGETS).filter(t => !q || [t.label, t.sub, t.atomRef].join(' ').toLowerCase().includes(q));
    $('#targetList').innerHTML = list.map(t => `<button class="target-item ${t.id === selectedTargetId ? 'on' : ''}" data-target-id="${esc(t.id)}"><span class="target-kind ${t.kind}">${t.kind === 'point' ? 'POINT' : 'LINE'}</span><span class="ti-main"><span class="ti-label">${esc(t.label)}</span><span class="ti-sub">${esc(t.sub)}</span></span><span style="color:#5f7188">选择</span></button>`).join('') || '<div class="empty">没有匹配实例。</div>';
    $$('#targetList [data-target-id]').forEach(el => el.onclick = () => { selectedTargetId = el.dataset.targetId; renderTargets(); updateSummary(); });
    updateSummary();
  };
  const updateSummary = () => {
    const t = ALL_TARGETS.find(x => x.id === selectedTargetId);
    $('#targetSummary').innerHTML = t ? `<span class="target-kind ${t.kind}">${t.kind === 'point' ? 'POINT' : 'LINE'}</span><b>${esc(t.label)}</b><span style="color:#5f7188">${esc(t.atomRef)}</span>` : '<span style="color:#fcd34d">未选择目标 · 保存前请选择点层或线层实例</span>';
  };
  $$('#modalRoot [data-target-kind]').forEach(b => b.onclick = () => { targetKind = b.dataset.targetKind; selectedTargetId = ''; $$('#modalRoot [data-target-kind]').forEach(x => x.classList.toggle('on', x.dataset.targetKind === targetKind)); renderTargets(); });
  $('#targetSearch').addEventListener('input', renderTargets);
  renderTargets();
  $('#gestureSave').onclick = () => {
    const pattern = $('#gPattern').value.trim().toUpperCase();
    const name = $('#gName').value.trim();
    const target = ALL_TARGETS.find(x => x.id === selectedTargetId);
    if (!pattern || !name) { showToast('pattern 和名称必填'); return; }
    if (!target) { showToast('请先选择点层或线层实例'); return; }
    if (GESTURES.some(x => x.pattern === pattern && x !== g)) { showToast('pattern 已存在'); return; }
    const binding = { pattern, name, kind: target.kind === 'point' ? 'point' : 'flow', target: target.atomRef, effect: $('#gEffect').value, desc: $('#gDesc').value.trim(), targetKind: target.kind, targetId: target.id, targetLabel: target.label, href: target.href };
    if (edit) Object.assign(g, binding); else GESTURES.push(binding);
    state.pattern = pattern; saveData(); closeModal(); updateHash(); renderAll(); showToast(edit ? '手势绑定已更新' : '手势绑定已创建');
  };
}
function handleAction(action) {
  const g = gesture();
  if (action === 'new-gesture') { openRecordModal(); return; }
  if (action === 'edit-gesture') { if (g) openBindingModal(g.pattern); return; }
  if (action === 'rerecord') { if (g) openRecordModal(g.pattern); return; }
  if (action === 'duplicate-gesture') { if (!g) return; const copy = deep(g); copy.pattern = `${g.pattern}2`; copy.name = `${g.name} 副本`; GESTURES.push(copy); state.pattern = copy.pattern; saveData(); updateHash(); renderAll(); showToast('手势绑定已复制'); return; }
  if (action === 'delete-gesture') { if (!g) return; confirmModal('删除手势绑定？', `会删除 ${g.pattern} · ${g.name}。`, '删除', () => { GESTURES = GESTURES.filter(x => x.pattern !== g.pattern); state.pattern = GESTURES[0]?.pattern || ''; saveData(); updateHash(); renderAll(); showToast('手势绑定已删除'); }); return; }
  if (action === 'reset-data') { confirmModal('重置示例手势？', '会覆盖本地新增/修改，恢复 5 条示例手势。', '重置', () => { GESTURES = deep(GESTURE_DATA).map(resolveLegacy); state.pattern = GESTURES[0]?.pattern || ''; saveData(); updateHash(); renderAll(); showToast('示例手势已重置'); }); return; }
}
function init() {
  parseHash(); renderAll();
  $('#modalRoot').addEventListener('click', e => { if (e.target.id === 'modalOverlay' || e.target.closest('[data-modal-close]')) closeModal(); });
  window.addEventListener('hashchange', () => { parseHash(); renderAll(); });
}
init();
})();
