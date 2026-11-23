(() => {
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const deep = o => JSON.parse(JSON.stringify(o));
const SURFACE_SET = new Set(SURFACE_IDS);
const POINT_SET = new Set(POINT_IDS);
const LINE_SET = new Set(LINE_IDS);
function withLifecycle(c) { return { ...c, status: c.status || 'active', lifecycle: c.lifecycle || { status: 'active', trust: 'signed', update: 'manual', isolation: 'process', autoStart: false } }; }
let CLASSES = deep(BODY_DATA.classes).map(withLifecycle);
const STORAGE = 'baiying.bodyManager.v1';
try { const saved = JSON.parse(localStorage.getItem(STORAGE) || 'null'); if (saved && Array.isArray(saved.classes) && saved.classes.length) CLASSES = saved.classes.map(withLifecycle); } catch (_) {}
const state = { classId: CLASSES[0]?.id || '', instLabel: CLASSES[0]?.instances[0]?.label || '', tab: 'composition', query: '', cat: 'all', prio: 'all', toastTimer: null };
const cls = () => CLASSES.find(c => c.id === state.classId) || CLASSES[0];
const ins = () => cls()?.instances.find(i => i.label === state.instLabel) || cls()?.instances[0] || null;
const totalInstances = () => CLASSES.reduce((n, c) => n + c.instances.length, 0);
const catMeta = { content: 'Content', input: 'Input', system: 'System', utility: 'Utility', dev: 'Dev', ai: 'AI', business: 'Business', media: 'Media' };
function showToast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => t.classList.remove('show'), 1800); }
function saveData() { try { localStorage.setItem(STORAGE, JSON.stringify({ classes: CLASSES, savedAt: new Date().toISOString() })); } catch (_) {} }
function ensureSelection() { if (!CLASSES.some(c => c.id === state.classId)) state.classId = CLASSES[0]?.id || ''; const c = cls(); if (!c?.instances.some(i => i.label === state.instLabel)) state.instLabel = c?.instances[0]?.label || ''; }
function updateHash() { const h = `#${encodeURIComponent(state.classId)}${state.instLabel ? '/' + encodeURIComponent(state.instLabel) : ''}`; if (location.hash !== h) history.replaceState(null, '', h); }
function parseHash() { const parts = (location.hash || '').replace(/^#/, '').split('/').map(decodeURIComponent).filter(Boolean); if (parts[0] && CLASSES.some(c => c.id === parts[0])) state.classId = parts[0]; const c = cls(); if (parts[1] && c.instances.some(i => i.label === parts[1])) state.instLabel = parts[1]; ensureSelection(); }
function renderTopStats() { const p0 = CLASSES.filter(c => c.prio === 'P0').length; const cats = [...new Set(CLASSES.map(c => c.cat))].length; $('#topStats').innerHTML = `<span class="mini violet">${CLASSES.length} BodyClass</span><span class="mini cyan">${totalInstances()} BodyInstance</span><span class="mini amber">${p0} P0</span><span class="mini">${cats} categories</span><span class="mini green">${CLASSES.filter(c => c.lifecycle.status === 'active').length} active</span>`; }
function filteredClasses() {
  const q = state.query.trim().toLowerCase();
  return CLASSES.filter(c => {
    if (state.cat !== 'all' && c.cat !== state.cat) return false;
    if (state.prio !== 'all' && c.prio !== state.prio) return false;
    if (!q) return true;
    return [c.id, c.name, c.desc, c.cat, c.prio, ...c.instances.map(i => i.label + ' ' + i.desc)].join(' ').toLowerCase().includes(q);
  });
}
function renderLeft() {
  const c = cls(), list = filteredClasses();
  const cats = [...new Set(CLASSES.map(x => x.cat))];
  $('#leftPane').innerHTML = `<div class="pane-head"><b>BodyClass · 体层类</b><span class="count">${CLASSES.length}</span><button data-action="new-class" title="新建 BodyClass">＋</button></div>
    <input class="panel-search" id="bodySearch" placeholder="搜索 body / 实例 / 描述…" value="${esc(state.query)}">
    <div class="fi-meta" style="margin-bottom:5px"><button class="tab-mini ${state.cat === 'all' ? 'on' : ''}" data-cat="all">全部</button>${cats.map(x => `<button class="tab-mini ${state.cat === x ? 'on' : ''}" data-cat="${esc(x)}">${esc(catMeta[x] || x)}</button>`).join('')}</div>
    <div class="fi-meta" style="margin-bottom:5px">${['all', 'P0', 'P1', 'P2'].map(x => `<button class="tab-mini ${state.prio === x ? 'on' : ''}" data-prio="${x}">${x === 'all' ? '全部优先级' : x}</button>`).join('')}</div>
    ${list.map(x => `<div class="flow-item ${x.id === c?.id ? 'on' : ''}" data-body-class="${esc(x.id)}"><div class="fi-top"><span class="fi-name">${esc(x.icon)} ${esc(x.name)}</span><span class="fi-ver">${x.instances.length}</span></div><div class="fi-id">${esc(x.id)}</div><div class="fi-meta"><span class="fi-badge">${esc(x.cat)}</span><span class="prio-badge ${esc(x.prio)}">${esc(x.prio)}</span></div></div>`).join('') || '<div class="empty">没有匹配的 BodyClass。</div>'}
    <div class="pane-head" style="margin-top:10px"><b>BodyInstance · 体实例</b><span class="count">${c?.instances.length || 0}</span><button data-action="new-instance" title="新建 BodyInstance">＋</button></div>
    ${(c?.instances || []).map(i => `<div class="inst-item ${i.label === state.instLabel ? 'on' : ''}" data-body-inst="${esc(i.label)}"><div class="ii-top"><span class="ii-name">${esc(i.label)}</span><span class="ii-rev">r${i.rev}</span></div><div class="ii-id">${esc(i.desc)}</div><span class="ii-status ${i.status === 'draft' ? 'draft' : ''}">${esc(i.status || 'active')}</span></div>`).join('') || '<div class="empty">暂无实例</div>'}
    <div style="margin-top:10px"><button class="btn" style="width:100%;justify-content:center" data-action="reset-data">↺ 重置示例数据</button></div>`;
  const search = $('#bodySearch'); if (search) search.addEventListener('input', e => { state.query = e.target.value; renderLeft(); });
  $$('#leftPane [data-body-class]').forEach(el => el.onclick = () => { state.classId = el.dataset.bodyClass; state.instLabel = cls().instances[0]?.label || ''; updateHash(); renderAll(); });
  $$('#leftPane [data-body-inst]').forEach(el => el.onclick = () => { state.instLabel = el.dataset.bodyInst; updateHash(); renderAll(); });
  $$('#leftPane [data-cat]').forEach(b => b.onclick = () => { state.cat = b.dataset.cat; renderLeft(); });
  $$('#leftPane [data-prio]').forEach(b => b.onclick = () => { state.prio = b.dataset.prio; renderLeft(); });
  $$('#leftPane [data-action]').forEach(b => b.onclick = () => handleAction(b.dataset.action));
}
function componentHref(kind, id) {
  if (kind === 'surface' && SURFACE_SET.has(id)) return `surface-management.html#surfaces/${encodeURIComponent(id)}`;
  if (kind === 'point' && POINT_SET.has(id)) return `atom-catalog-management.html#${encodeURIComponent(id)}`;
  if (kind === 'flow' && LINE_SET.has(id)) return `line-management.html#${encodeURIComponent(id)}`;
  return '';
}
function compChip(kind, id) {
  const href = componentHref(kind, id);
  return `<a class="comp-chip ${href ? 'mapped' : 'ph'}" ${href ? `href="${esc(href)}"` : ''} title="${href ? '打开对应管理页' : '未接入管理页'}">${esc(id)}${href ? '<span class="arrow">↗</span>' : '<span class="arrow">·ph</span>'}</a>`;
}
function stackChip(kind, id) {
  const href = componentHref(kind, id);
  return `<div class="stack-chip ${href ? 'mapped' : 'ph'}" ${href ? `data-open-href="${esc(href)}"` : ''}>${esc(id)}${href ? ' ↗' : ' ·ph'}</div>`;
}
function renderComposition(c) {
  return `<div class="body-summary"><div class="bi">${esc(c.icon)}</div><div class="bm"><div class="bn">${esc(c.name)} <span class="prio-badge ${esc(c.prio)}">${esc(c.prio)}</span></div><div class="bid">${esc(c.id)} · v${esc(c.version)} · ${esc(c.cat)}</div><div class="bd">${esc(c.desc)}</div></div><div class="fi-meta"><span class="fi-badge">${c.flows.length} flows</span><span class="fi-badge">${c.surfaces.length} surfaces</span><span class="fi-badge">${c.points.length} points</span><span class="fi-badge">${c.instances.length} inst</span></div></div>
    <div class="body-stack"><div class="stack-col">${c.flows.map(x => stackChip('flow', x)).join('') || '<div class="stack-chip ph">no flow</div>'}</div><div class="stack-core"><div class="sc-i">${esc(c.icon)}</div><div class="sc-n">${esc(c.name)}</div><div class="sc-id">${esc(c.id)}</div><div class="stack-line"></div><div class="mini">BodyClass</div></div><div class="stack-col">${c.surfaces.map(x => stackChip('surface', x)).join('')}${c.points.map(x => stackChip('point', x)).join('')}</div></div>
    <div class="comp-grid"><div class="comp-col"><div class="comp-head"><b>Line</b> · flows</div>${c.flows.map(x => compChip('flow', x)).join('') || '<div class="comp-chip ph">no flow</div>'}</div><div class="comp-col"><div class="comp-head"><b>Surface</b> · UI</div>${c.surfaces.map(x => compChip('surface', x)).join('') || '<div class="comp-chip ph">no surface</div>'}</div><div class="comp-col"><div class="comp-head"><b>Point</b> · atoms</div>${c.points.map(x => compChip('point', x)).join('') || '<div class="comp-chip ph">no point</div>'}</div></div>`;
}
function renderInstances(c) {
  return `<div class="sec-head"><b>BodyInstance · ${c.instances.length}</b><span class="right"><button class="btn small" data-action="new-instance">＋ 新建实例</button></span></div><div class="instance-grid">${c.instances.map(i => `<div class="instance-card ${i.label === state.instLabel ? 'on' : ''}" data-body-inst-main="${esc(i.label)}"><div class="ic-top"><span class="ic-name">${esc(i.label)}</span><span class="ic-rev">r${i.rev}</span></div><div class="ic-desc">${esc(i.desc)}</div><div class="ic-meta"><span class="ic-badge ${i.status === 'active' ? 'on' : i.status === 'draft' ? 'draft' : ''}">${esc(i.status || 'active')}</span>${(i.acts || []).slice(0, 3).map(a => `<span class="ic-badge">${esc(a)}</span>`).join('')}<span class="ic-badge">${i.settings ? 'settings' : 'no settings'}</span></div></div>`).join('') || '<div class="empty">暂无实例。</div>'}</div>`;
}
function manifestOf(c) { return { id: c.id, name: c.name, icon: c.icon, category: c.cat, priority: c.prio, version: c.version, desc: c.desc, composition: { flows: c.flows, surfaces: c.surfaces, points: c.points }, settings: c.settings, permissions: c.perms, tests: c.tests, lifecycle: c.lifecycle, instances: c.instances }; }
function renderManifest(c) {
  return `<div class="sec-head"><b>Manifest · 体层清单</b><span class="right"><button class="btn small" data-action="edit-manifest">✎ 编辑 Manifest</button></span></div><pre class="manifest-pre">${esc(JSON.stringify(manifestOf(c), null, 2))}</pre>`;
}
function renderLifecycle(c) {
  const l = c.lifecycle;
  return `<div class="sec-head"><b>Lifecycle · 生命周期设置</b><span class="right"><button class="btn primary small" data-action="save-lifecycle">保存</button></span></div><div class="life-grid"><div class="life-item"><label>status</label><select id="lifeStatus">${['active', 'draft', 'archived'].map(x => `<option value="${x}" ${l.status === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div><div class="life-item"><label>trust</label><select id="lifeTrust">${['signed', 'unsigned', 'local'].map(x => `<option value="${x}" ${l.trust === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div><div class="life-item"><label>update</label><select id="lifeUpdate">${['manual', 'auto', 'pinned'].map(x => `<option value="${x}" ${l.update === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div><div class="life-item"><label>isolation</label><select id="lifeIsolation">${['process', 'container', 'vm'].map(x => `<option value="${x}" ${l.isolation === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div><div class="life-item"><label>autoStart</label><select id="lifeAuto">${['false', 'true'].map(x => `<option value="${x}" ${String(l.autoStart) === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div><div class="life-item"><label>installed</label><div class="val">${c.instances.length} instances</div></div></div><div class="settings-list"><div class="setting-row"><span class="sk">status</span><span class="sv">${esc(l.status)}</span></div><div class="setting-row"><span class="sk">trust</span><span class="sv">${esc(l.trust)}</span></div><div class="setting-row"><span class="sk">update</span><span class="sv">${esc(l.update)}</span></div><div class="setting-row"><span class="sk">isolation</span><span class="sv">${esc(l.isolation)}</span></div></div>`;
}
function renderSettings(c) {
  return `<div class="sec-head"><b>Function Settings · ${c.settings.length}</b><span class="right"><button class="btn small" data-action="edit-class">✎ 编辑设置</button></span></div><div class="settings-list">${c.settings.map(x => `<div class="setting-row"><span class="sk">${esc(x)}</span><span class="sv">body setting</span></div>`).join('') || '<div class="empty">无 settings</div>'}</div><div class="sec-head"><b>Permissions · ${c.perms.length}</b></div><div class="settings-list">${c.perms.map(x => `<div class="setting-row"><span class="sk">${esc(x)}</span><span class="sv">permission</span></div>`).join('') || '<div class="empty">无 permissions</div>'}</div><div class="sec-head"><b>Tests · ${c.tests.length}</b></div><div class="settings-list">${c.tests.map(x => `<div class="setting-row"><span class="sk">${esc(x)}</span><span class="sv">test</span></div>`).join('') || '<div class="empty">无 tests</div>'}</div>`;
}
function renderMain() {
  const c = cls(), i = ins();
  if (!c) { $('#main').innerHTML = '<div class="empty">没有 BodyClass。</div>'; return; }
  const tabs = [['composition', '组合'], ['instances', '实例'], ['manifest', 'Manifest'], ['lifecycle', '生命周期'], ['settings', '设置']];
  let content = '';
  if (state.tab === 'composition') content = renderComposition(c);
  else if (state.tab === 'instances') content = renderInstances(c);
  else if (state.tab === 'manifest') content = renderManifest(c);
  else if (state.tab === 'lifecycle') content = renderLifecycle(c);
  else content = renderSettings(c);
  $('#main').innerHTML = `<div class="hero"><div class="hero-icon">${esc(c.icon)}</div><div class="hero-main"><div class="kicker">BodyClass · ${esc(c.cat)}</div><h1>${esc(c.name)}</h1><p>${esc(c.desc)}</p></div><div class="hero-actions"><button class="btn" data-action="edit-class">✎ 编辑类</button><button class="btn primary" data-action="new-instance">＋ 实例</button><button class="btn danger" data-action="delete-class">⌫ 删除类</button></div></div>
    <div class="stats"><span class="prio-badge ${esc(c.prio)}">${esc(c.prio)}</span><span class="mini">${c.flows.length} flows</span><span class="mini">${c.surfaces.length} surfaces</span><span class="mini">${c.points.length} points</span><span class="mini cyan">${c.instances.length} instances</span><span class="mini">v${esc(c.version)}</span><span class="mini green">${esc(c.lifecycle.status)}</span>${i ? `<span class="mini amber">${esc(i.label)} · r${i.rev}</span>` : ''}</div>
    <div class="body-tabbar">${tabs.map(([id, label]) => `<button class="body-tab ${state.tab === id ? 'on' : ''}" data-body-tab="${id}">${label}</button>`).join('')}</div>${content}`;
  $$('#main [data-body-tab]').forEach(b => b.onclick = () => { state.tab = b.dataset.bodyTab; renderMain(); });
  $$('#main [data-action]').forEach(b => b.onclick = () => handleAction(b.dataset.action));
  $$('#main [data-body-inst-main]').forEach(el => el.onclick = () => { state.instLabel = el.dataset.bodyInstMain; updateHash(); renderAll(); });
  $$('#main [data-open-href]').forEach(el => el.onclick = () => { window.location.href = el.dataset.openHref; });
}
function renderInspector() {
  const c = cls(), i = ins();
  if (!c) { $('#inspector').innerHTML = '<div class="empty">选择 BodyClass。</div>'; return; }
  $('#inspector').innerHTML = `<div class="insp-kicker">BodyClass · 体层类</div><div class="insp-title">${esc(c.icon)} ${esc(c.name)}</div><div class="insp-id">${esc(c.id)} · v${esc(c.version)}</div>
    <div class="insp-section"><div class="lh">Contract</div><div class="kv"><div class="k">category</div><div class="v">${esc(c.cat)}</div><div class="k">priority</div><div class="v">${esc(c.prio)}</div><div class="k">status</div><div class="v">${esc(c.lifecycle.status)}</div><div class="k">trust</div><div class="v">${esc(c.lifecycle.trust)}</div><div class="k">update</div><div class="v">${esc(c.lifecycle.update)}</div><div class="k">isolation</div><div class="v">${esc(c.lifecycle.isolation)}</div></div></div>
    <div class="insp-section"><div class="lh">Composition</div><div class="kv"><div class="k">flows</div><div class="v">${esc(c.flows.join(' / ') || '—')}</div><div class="k">surfaces</div><div class="v">${esc(c.surfaces.join(' / ') || '—')}</div><div class="k">points</div><div class="v">${esc(c.points.join(' / ') || '—')}</div></div></div>
    <div class="insp-section"><div class="lh">Settings / Permissions</div><div class="kv"><div class="k">settings</div><div class="v">${esc(c.settings.join(' / ') || '—')}</div><div class="k">perms</div><div class="v">${esc(c.perms.join(' / ') || '—')}</div><div class="k">tests</div><div class="v">${esc(c.tests.join(' / ') || '—')}</div></div></div>
    ${i ? `<div class="insp-section"><div class="lh">Instance · ${esc(i.label)}</div><div class="kv"><div class="k">rev</div><div class="v">r${i.rev}</div><div class="k">status</div><div class="v">${esc(i.status || 'active')}</div><div class="k">desc</div><div class="v">${esc(i.desc)}</div><div class="k">acts</div><div class="v">${esc((i.acts || []).join(' / ') || '—')}</div><div class="k">settings</div><div class="v">${esc(i.settings || '—')}</div></div><div class="actions" style="margin-top:5px"><button class="btn" data-action="run-instance">▶ 运行</button><button class="btn" data-action="edit-instance">✎ 编辑</button><button class="btn" data-action="duplicate-instance">⧉ 复制</button><button class="btn danger" data-action="delete-instance">⌫ 删除</button></div></div>` : ''}
    <div class="insp-section"><div class="lh">Class Actions</div><div class="actions"><button class="btn" data-action="edit-class">✎ 编辑</button><button class="btn" data-action="new-instance">＋ 实例</button><button class="btn danger" data-action="delete-class">⌫ 删除</button></div></div>`;
  $$('#inspector [data-action]').forEach(b => b.onclick = () => handleAction(b.dataset.action));
}
function renderAll() { renderTopStats(); renderLeft(); renderMain(); renderInspector(); }
function openModal(html) { $('#modalRoot').innerHTML = `<div class="modal-overlay" id="modalOverlay"><div class="modal">${html}</div></div>`; }
function closeModal() { $('#modalRoot').innerHTML = ''; }
function confirmModal(title, message, label, onConfirm) {
  openModal(`<h3>${esc(title)}</h3><p>${esc(message)}</p><div class="modal-actions"><button class="btn" data-modal-close>取消</button><button class="btn danger" id="modalConfirm">${esc(label)}</button></div>`);
  $('#modalConfirm').onclick = () => { closeModal(); onConfirm(); };
}
function openClassModal(edit = false) {
  const c = edit ? cls() : null;
  openModal(`<h3>${edit ? '编辑 BodyClass' : '新建 BodyClass'}</h3><p>BodyClass = 体层蓝图：组合 flows / surfaces / points，并声明 settings / perms / tests。</p>
    <div class="form-grid"><div class="field"><label>ID</label><input id="mClassId" value="${esc(c?.id || 'body.custom')}" ${edit ? 'disabled' : ''}></div><div class="field"><label>名称</label><input id="mClassName" value="${esc(c?.name || 'Custom Body')}"></div><div class="field"><label>icon</label><input id="mClassIcon" value="${esc(c?.icon || '◈')}"></div><div class="field"><label>category</label><input id="mClassCat" value="${esc(c?.cat || 'utility')}"></div><div class="field"><label>priority</label><select id="mClassPrio">${['P0', 'P1', 'P2'].map(x => `<option value="${x}" ${(c?.prio || 'P1') === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div><div class="field"><label>version</label><input id="mClassVersion" value="${esc(c?.version || '0.1.0')}"></div><div class="field full"><label>desc</label><textarea id="mClassDesc">${esc(c?.desc || '')}</textarea></div><div class="field"><label>flows</label><input id="mClassFlows" value="${esc((c?.flows || []).join(', '))}"></div><div class="field"><label>surfaces</label><input id="mClassSurfaces" value="${esc((c?.surfaces || []).join(', '))}"></div><div class="field"><label>points</label><input id="mClassPoints" value="${esc((c?.points || []).join(', '))}"></div><div class="field"><label>settings</label><input id="mClassSettings" value="${esc((c?.settings || []).join(', '))}"></div><div class="field"><label>permissions</label><input id="mClassPerms" value="${esc((c?.perms || []).join(', '))}"></div><div class="field"><label>tests</label><input id="mClassTests" value="${esc((c?.tests || []).join(', '))}"></div></div>
    <div class="modal-actions"><button class="btn" data-modal-close>取消</button><button class="btn primary" id="classSave">${edit ? '保存' : '创建'}</button></div>`);
  $('#classSave').onclick = () => {
    const id = $('#mClassId').value.trim(), name = $('#mClassName').value.trim(); if (!id || !name) { showToast('ID 和名称必填'); return; }
    if (!edit && CLASSES.some(x => x.id === id)) { showToast('ID 已存在'); return; }
    const data = { id, name, icon: $('#mClassIcon').value.trim() || '◈', cat: $('#mClassCat').value.trim() || 'utility', prio: $('#mClassPrio').value, version: $('#mClassVersion').value.trim() || '1.0.0', desc: $('#mClassDesc').value.trim(), flows: $('#mClassFlows').value.split(',').map(s => s.trim()).filter(Boolean), surfaces: $('#mClassSurfaces').value.split(',').map(s => s.trim()).filter(Boolean), points: $('#mClassPoints').value.split(',').map(s => s.trim()).filter(Boolean), settings: $('#mClassSettings').value.split(',').map(s => s.trim()).filter(Boolean), perms: $('#mClassPerms').value.split(',').map(s => s.trim()).filter(Boolean), tests: $('#mClassTests').value.split(',').map(s => s.trim()).filter(Boolean) };
    if (edit) { Object.assign(c, data); showToast('BodyClass 已更新'); }
    else { CLASSES.push({ ...data, instances: [], lifecycle: { status: 'active', trust: 'signed', update: 'manual', isolation: 'process', autoStart: false } }); state.classId = id; state.instLabel = ''; showToast('BodyClass 已创建'); }
    saveData(); closeModal(); ensureSelection(); updateHash(); renderAll();
  };
}
function openInstanceModal(edit = false) {
  const c = cls(), i = edit ? ins() : null; if (!c) return;
  openModal(`<h3>${edit ? '编辑 BodyInstance' : '新建 BodyInstance'}</h3><p>BodyInstance = BodyClass + 安装配置 + revision。</p><div class="form-grid"><div class="field"><label>label</label><input id="mInstLabel" value="${esc(i?.label || 'New Instance')}"></div><div class="field"><label>status</label><select id="mInstStatus">${['active', 'draft', 'archived'].map(x => `<option value="${x}" ${(i?.status || 'active') === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div><div class="field"><label>rev</label><input id="mInstRev" type="number" value="${i?.rev || 1}"></div><div class="field full"><label>desc</label><textarea id="mInstDesc">${esc(i?.desc || '')}</textarea></div><div class="field full"><label>acts</label><input id="mInstActs" value="${esc((i?.acts || []).join(', '))}"></div><div class="field full"><label>settings</label><input id="mInstSettings" value="${esc(i?.settings || '')}"></div></div><div class="modal-actions"><button class="btn" data-modal-close>取消</button><button class="btn primary" id="instSave">${edit ? '保存新 revision' : '创建'}</button></div>`);
  $('#instSave').onclick = () => {
    const label = $('#mInstLabel').value.trim(); if (!label) { showToast('label 必填'); return; }
    const data = { label, desc: $('#mInstDesc').value.trim(), rev: edit ? (i.rev || 1) + 1 : Number($('#mInstRev').value) || 1, acts: $('#mInstActs').value.split(',').map(s => s.trim()).filter(Boolean), settings: $('#mInstSettings').value.trim(), status: $('#mInstStatus').value };
    if (edit) Object.assign(i, data); else c.instances.push(data);
    state.instLabel = label; saveData(); closeModal(); updateHash(); renderAll(); showToast(edit ? 'BodyInstance 已更新 · rev +1' : 'BodyInstance 已创建');
  };
}
function openManifestModal() {
  const c = cls(); if (!c) return;
  openModal(`<h3>编辑 Manifest</h3><p>直接编辑 JSON；保存后回写 BodyClass。</p><textarea id="manifestText" style="width:100%;min-height:360px;border:1px solid var(--line);border-radius:5px;background:#08111b;color:#b9c7da;font:6.5px/1.55 var(--mono);padding:7px;resize:vertical">${esc(JSON.stringify(manifestOf(c), null, 2))}</textarea><div class="modal-actions"><button class="btn" data-modal-close>取消</button><button class="btn primary" id="manifestSave">验证并保存</button></div>`);
  $('#manifestSave').onclick = () => {
    try {
      const m = JSON.parse($('#manifestText').value);
      if (!m.id || !m.name) throw new Error('id/name required');
      c.name = m.name; c.icon = m.icon || c.icon; c.cat = m.category || c.cat; c.prio = m.priority || c.prio; c.version = m.version || c.version; c.desc = m.desc || c.desc;
      c.flows = m.composition?.flows || c.flows; c.surfaces = m.composition?.surfaces || c.surfaces; c.points = m.composition?.points || c.points;
      c.settings = m.settings || c.settings; c.perms = m.permissions || c.perms; c.tests = m.tests || c.tests;
      if (m.lifecycle) c.lifecycle = { ...c.lifecycle, ...m.lifecycle };
      if (Array.isArray(m.instances)) c.instances = m.instances;
      saveData(); closeModal(); renderAll(); showToast('Manifest 已保存');
    } catch (e) { showToast('Manifest JSON 错误：' + e.message); }
  };
}
function saveLifecycle() {
  const c = cls(); if (!c) return;
  c.lifecycle = { status: $('#lifeStatus').value, trust: $('#lifeTrust').value, update: $('#lifeUpdate').value, isolation: $('#lifeIsolation').value, autoStart: $('#lifeAuto').value === 'true' };
  saveData(); renderAll(); showToast('生命周期设置已保存');
}
function handleAction(action) {
  const c = cls(), i = ins();
  if (action === 'new-class') { openClassModal(false); return; }
  if (action === 'edit-class') { openClassModal(true); return; }
  if (action === 'delete-class') { if (!c) return; confirmModal('删除 BodyClass？', `会删除 ${c.id} 及其 ${c.instances.length} 个实例。`, '删除', () => { CLASSES = CLASSES.filter(x => x.id !== c.id); state.classId = CLASSES[0]?.id || ''; state.instLabel = ''; ensureSelection(); saveData(); updateHash(); renderAll(); showToast('BodyClass 已删除'); }); return; }
  if (action === 'new-instance') { openInstanceModal(false); return; }
  if (action === 'edit-instance') { openInstanceModal(true); return; }
  if (action === 'duplicate-instance') { if (!i) return; const copy = deep(i); copy.label = `${i.label} 副本`; copy.rev = 1; copy.status = 'draft'; c.instances.push(copy); state.instLabel = copy.label; saveData(); updateHash(); renderAll(); showToast('BodyInstance 已复制'); return; }
  if (action === 'delete-instance') { if (!i) return; confirmModal('删除 BodyInstance？', `会删除 ${i.label}。`, '删除', () => { c.instances = c.instances.filter(x => x.label !== i.label); state.instLabel = c.instances[0]?.label || ''; ensureSelection(); saveData(); updateHash(); renderAll(); showToast('BodyInstance 已删除'); }); return; }
  if (action === 'run-instance') { showToast(`运行 ${i?.label || c?.name || 'body'} · 模拟正常`); return; }
  if (action === 'edit-manifest') { openManifestModal(); return; }
  if (action === 'save-lifecycle') { saveLifecycle(); return; }
  if (action === 'reset-data') { confirmModal('重置示例数据？', '会覆盖本地新增/修改，恢复 29 BodyClass / 82 BodyInstance。', '重置', () => { CLASSES = deep(BODY_DATA.classes).map(withLifecycle); state.classId = CLASSES[0].id; state.instLabel = CLASSES[0].instances[0]?.label || ''; saveData(); ensureSelection(); updateHash(); renderAll(); showToast('示例数据已重置'); }); return; }
}
function init() {
  parseHash(); ensureSelection(); renderAll();
  $('#modalRoot').addEventListener('click', e => { if (e.target.id === 'modalOverlay' || e.target.closest('[data-modal-close]')) closeModal(); });
  window.addEventListener('hashchange', () => { parseHash(); ensureSelection(); renderAll(); });
}
init();
})();
