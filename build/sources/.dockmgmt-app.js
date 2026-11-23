(() => {
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const deep = o => JSON.parse(JSON.stringify(o));
const POINT_TARGETS = POINT_SEED.flatMap(c => c.instances.map(i => ({ id: `point:${c.id}/${i.id}`, kind: 'point', classId: c.id, className: c.name, instanceId: i.id, instanceName: i.name, label: `${c.name} / ${i.name}`, sub: `${c.id} / ${i.id}`, atomRef: `${c.id}/${i.id}`, href: `atom-catalog-management.html#${encodeURIComponent(c.id)}/${encodeURIComponent(i.id)}` })));
const LINE_TARGETS = LINE_DATA.flows.flatMap(f => f.instances.map(i => ({ id: `line:${f.id}/${i.id}`, kind: 'line', flowId: f.id, flowName: f.name, instanceId: i.id, instanceName: i.name, label: `${f.name} / ${i.name}`, sub: `${f.id} / ${i.id}`, atomRef: `${i.id}@r${i.rev}`, href: `line-management.html#${encodeURIComponent(f.id)}/${encodeURIComponent(i.id)}` })));
const ALL_TARGETS = [...POINT_TARGETS, ...LINE_TARGETS];
function resolveTarget(tile) {
  const base = String(tile.target || '').replace(/@r\d+$/, '');
  const t = LINE_TARGETS.find(x => x.instanceId === base) || POINT_TARGETS.find(x => x.instanceId === base);
  if (t) return { ...tile, kind: t.kind === 'point' ? 'point' : 'flow', target: t.atomRef, targetKind: t.kind, targetId: t.id, targetLabel: t.label, href: t.href, sub: tile.sub || t.label };
  return { ...tile, targetKind: tile.kind === 'flow' ? 'line' : 'point', targetId: '', targetLabel: tile.sub || tile.target, href: '' };
}
let TABS = deep(DOCK_DATA.tabs);
let TILES = deep(DOCK_DATA.tiles).map(resolveTarget);
let SETTINGS = { tileSize: 64, columns: 6, gap: 6, theme: 'dark', showLabels: true, showSub: true, position: 'bottom' };
const STORAGE = 'baiying.dockManager.v1';
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE) || 'null');
  if (saved && Array.isArray(saved.tabs) && Array.isArray(saved.tiles) && saved.tabs.length) { TABS = saved.tabs; TILES = saved.tiles; SETTINGS = { ...SETTINGS, ...(saved.settings || {}) }; }
} catch (_) {}
const state = { tabId: TABS[0]?.id || '', tileId: '', query: '', draggingId: null, toastTimer: null };
const tab = () => TABS.find(t => t.id === state.tabId) || TABS[0];
const tabTiles = () => TILES.filter(t => t.tab === tab()?.id);
const tile = () => TILES.find(t => t.id === state.tileId) || tabTiles()[0] || null;
const stats = () => ({ tabs: TABS.length, tiles: TILES.length, flow: TILES.filter(t => t.kind === 'flow').length, point: TILES.filter(t => t.kind === 'point').length, mapped: TILES.filter(t => t.targetId && t.href).length });
function saveData() { try { localStorage.setItem(STORAGE, JSON.stringify({ tabs: TABS, tiles: TILES, settings: SETTINGS, savedAt: new Date().toISOString() })); } catch (_) {} }
function showToast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => t.classList.remove('show'), 1800); }
function ensureSelection() { if (!TABS.some(t => t.id === state.tabId)) state.tabId = TABS[0]?.id || ''; const list = tabTiles(); if (!list.some(t => t.id === state.tileId)) state.tileId = list[0]?.id || ''; }
function updateHash() { const h = `#${encodeURIComponent(state.tabId)}${state.tileId ? '/' + encodeURIComponent(state.tileId) : ''}`; if (location.hash !== h) history.replaceState(null, '', h); }
function parseHash() {
  const parts = (location.hash || '').replace(/^#/, '').split('/').map(decodeURIComponent).filter(Boolean);
  if (parts[0] && TABS.some(t => t.id === parts[0])) state.tabId = parts[0];
  if (parts[1] && TILES.some(t => t.id === parts[1])) state.tileId = parts[1];
  ensureSelection();
}
function renderTopStats() {
  const s = stats();
  $('#topStats').innerHTML = `<span class="mini violet">${s.tabs} tabs</span><span class="mini cyan">${s.tiles} tiles</span><span class="mini">${s.flow} flow</span><span class="mini amber">${s.point} point</span><span class="mini green">${s.mapped} mapped</span><span class="mini">${s.tiles - s.mapped} 占位</span>`;
}
function renderLeft() {
  const active = tab();
  const all = tabTiles();
  const q = state.query.trim().toLowerCase();
  const list = q ? all.filter(t => [t.name, t.id, t.target, t.targetLabel, t.hotkey, t.kind, t.effect].join(' ').toLowerCase().includes(q)) : all;
  $('#leftPane').innerHTML = `<div class="pane-head"><b>Launch Dock · Tabs</b><span class="count">${TABS.length}</span><button data-action="new-tab" title="新建 Tab">＋</button></div>
    <input class="panel-search" id="dockSearch" placeholder="搜索 tile / target / hotkey…" value="${esc(state.query)}">
    ${TABS.map(t => `<div class="flow-item ${t.id === active?.id ? 'on' : ''}" data-dock-tab="${esc(t.id)}"><div class="fi-top"><span class="fi-name">${esc(t.name)}</span><span class="fi-ver">${TILES.filter(x => x.tab === t.id).length}</span></div><div class="fi-id">${esc(t.id)}</div><div class="fi-meta"><button class="tab-mini" data-edit-tab="${esc(t.id)}" title="编辑 Tab">✎</button><button class="tab-mini" data-del-tab="${esc(t.id)}" title="删除 Tab">⌫</button></div></div>`).join('')}
    <div class="pane-head" style="margin-top:10px"><b>${esc(active?.name || '')} · Tiles</b><span class="count">${list.length}</span><button data-action="new-tile" title="新建 Tile">＋</button></div>
    ${list.map(t => `<div class="inst-item ${t.id === state.tileId ? 'on' : ''}" data-dock-tile="${esc(t.id)}"><div class="ii-top"><span class="ii-name">${esc(t.icon)} ${esc(t.name)}</span><span class="ii-rev">${esc(t.kind)}</span></div><div class="ii-id">${esc(t.targetLabel || t.target)}</div><span class="ii-status">${esc(t.effect)}${t.hotkey ? ' · ⌨' + esc(t.hotkey) : ''}</span></div>`).join('') || '<div class="empty">暂无 Tile</div>'}
    <div style="margin-top:10px"><button class="btn" style="width:100%;justify-content:center" data-action="reset-data">↺ 重置示例启动坞</button></div>`;
  const search = $('#dockSearch'); if (search) search.addEventListener('input', e => { state.query = e.target.value; renderLeft(); });
  $$('#leftPane [data-dock-tab]').forEach(el => el.onclick = () => { state.tabId = el.dataset.dockTab; state.tileId = ''; ensureSelection(); updateHash(); renderAll(); });
  $$('#leftPane [data-edit-tab]').forEach(b => b.onclick = e => { e.stopPropagation(); state.tabId = b.dataset.editTab; openTabModal(true); });
  $$('#leftPane [data-del-tab]').forEach(b => b.onclick = e => { e.stopPropagation(); state.tabId = b.dataset.delTab; handleAction('delete-tab'); });
  $$('#leftPane [data-dock-tile]').forEach(el => el.onclick = () => { state.tileId = el.dataset.dockTile; updateHash(); renderAll(); });
  $$('#leftPane [data-action]').forEach(b => b.onclick = () => handleAction(b.dataset.action));
}
function dockPreview() {
  const active = tab(), list = tabTiles(), t = tile();
  return `<div class="dock-stage"><div class="dock-shell ${SETTINGS.theme === 'light' ? 'light' : ''} ${SETTINGS.showLabels ? 'dock-show-labels' : ''} ${SETTINGS.showSub ? 'dock-show-sub' : ''}" style="--tile:${SETTINGS.tileSize}px;--cols:${SETTINGS.columns};--gap:${SETTINGS.gap}px">
    <div class="dock-head"><div class="dock-brand"><b>▣ CLaunch</b><span>${esc(active?.name || '')}</span></div><div class="dock-tabs">${TABS.map(x => `<button class="dock-tab ${x.id === active?.id ? 'on' : ''}" data-dock-tab-main="${esc(x.id)}">${esc(x.name)}</button>`).join('')}</div><div class="dock-tools"><button class="dock-icon-btn" data-action="new-tile">＋</button><button class="dock-icon-btn" data-action="new-tab">▤</button><button class="dock-icon-btn" data-action="edit-tab">✎</button><button class="dock-icon-btn" data-action="delete-tab">⌫</button></div></div>
    <div class="dock-grid">${list.map(x => `<div class="dock-tile ${x.id === t?.id ? 'on' : ''}" draggable="true" data-dock-tile-main="${esc(x.id)}" data-kind="${esc(x.kind)}" title="${esc(x.targetLabel || x.target)}"><span class="dock-map-dot ${x.targetId && x.href ? '' : 'ph'}"></span>${x.hotkey ? `<span class="dock-hotkey">⌨${esc(x.hotkey)}</span>` : ''}<div class="dock-tile-icon">${esc(x.icon)}</div><div class="dock-label">${esc(x.name)}</div><div class="dock-sub">${esc(x.targetLabel || x.target)}</div></div>`).join('') || '<div class="empty" style="grid-column:1/-1">当前 Tab 没有 Tile。</div>'}</div>
    <div class="dock-foot"><span class="dock-page"></span>${TABS.map(x => `<span class="dock-page ${x.id === active?.id ? '' : 'dim'}"></span>`).join('')}<span class="grow"></span><span class="mini">${list.length} tiles · ${SETTINGS.columns} cols · ${SETTINGS.tileSize}px</span></div>
  </div></div>`;
}
function renderMain() {
  const active = tab(), list = tabTiles(), t = tile();
  const s = stats();
  $('#main').innerHTML = `<div class="hero"><div class="hero-icon">⌘</div><div class="hero-main"><div class="kicker">SurfaceInstance · launch-dock.desktop@r1</div><h1>CLaunch 式启动坞</h1><p>分页、Tile、快捷键、拖拽排序、目标映射。点击 Tile 编辑；拖动 Tile 调整顺序。</p></div><div class="hero-actions"><button class="btn primary" data-action="new-tile">＋ Tile</button><button class="btn" data-action="new-tab">＋ Tab</button><button class="btn" data-action="reset-data">↺ 重置</button></div></div>
    <div class="stats"><span class="mini violet">${s.tabs} tabs</span><span class="mini cyan">${s.tiles} tiles</span><span class="mini">${s.flow} flow</span><span class="mini amber">${s.point} point</span><span class="mini green">${s.mapped} mapped</span><span class="mini">${s.tiles - s.mapped} 占位</span></div>
    ${dockPreview()}
    <div class="bind-panel"><div class="panel-head"><b>${esc(active?.name || '')} · Tiles</b><span class="sub">drag to reorder</span><span class="right"><span class="mini">${list.length} tiles</span></span></div><div class="table-wrap"><table><thead><tr><th>Tile</th><th>Kind</th><th>Target</th><th>Hotkey</th><th>Effect</th><th>Status</th><th>Action</th></tr></thead><tbody>${list.map(x => `<tr class="tr-node ${x.id === t?.id ? 'on' : ''}" data-dock-row="${esc(x.id)}"><td><span class="t-label">${esc(x.icon)} ${esc(x.name)}</span><span class="t-sub">${esc(x.id)}</span></td><td><span class="kind-badge ${x.kind}">${x.kind === 'flow' ? 'FLOW' : 'POINT'}</span></td><td class="mono">${esc(x.targetLabel || x.target)}</td><td class="mono">${x.hotkey ? '⌨ ' + esc(x.hotkey) : '—'}</td><td class="mono">${esc(x.effect)}</td><td>${x.targetId && x.href ? '<span class="pill ok">mapped</span>' : '<span class="pill ph">占位</span>'}</td><td>${x.href ? `<a class="plink" href="${esc(x.href)}">打开 ↗</a>` : '<span class="pill ph">待接入</span>'}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">暂无 Tile。</td></tr>'}</tbody></table></div></div>`;
  $$('#main [data-dock-tab-main]').forEach(b => b.onclick = () => { state.tabId = b.dataset.dockTabMain; state.tileId = ''; ensureSelection(); updateHash(); renderAll(); });
  $$('#main [data-dock-tile-main]').forEach(el => {
    el.onclick = () => { state.tileId = el.dataset.dockTileMain; updateHash(); renderAll(); };
    el.addEventListener('dragstart', e => { state.draggingId = el.dataset.dockTileMain; el.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
    el.addEventListener('dragend', () => { state.draggingId = null; el.classList.remove('dragging'); $$('#main .dock-tile').forEach(x => x.classList.remove('drop-target')); });
    el.addEventListener('dragover', e => { e.preventDefault(); if (state.draggingId && state.draggingId !== el.dataset.dockTileMain) el.classList.add('drop-target'); });
    el.addEventListener('dragleave', () => el.classList.remove('drop-target'));
    el.addEventListener('drop', e => { e.preventDefault(); el.classList.remove('drop-target'); if (!state.draggingId || state.draggingId === el.dataset.dockTileMain) return; reorderTiles(state.draggingId, el.dataset.dockTileMain); });
  });
  $$('#main [data-dock-row]').forEach(el => el.onclick = () => { state.tileId = el.dataset.dockRow; updateHash(); renderAll(); });
  $$('#main [data-action]').forEach(b => b.onclick = () => handleAction(b.dataset.action));
  $$('#main .plink').forEach(a => a.addEventListener('click', e => e.stopPropagation()));
}
function reorderTiles(fromId, toId) {
  const from = TILES.findIndex(t => t.id === fromId), to = TILES.findIndex(t => t.id === toId);
  if (from < 0 || to < 0) return;
  const [item] = TILES.splice(from, 1); TILES.splice(to, 0, item); state.tileId = fromId; saveData(); updateHash(); renderAll(); showToast('Tile 顺序已更新');
}
function renderInspector() {
  const t = tile(), active = tab();
  if (!t) {
    $('#inspector').innerHTML = `<div class="insp-kicker">Launch Dock</div><div class="insp-title">CLaunch 式启动坞</div><div class="insp-id">launch-dock.desktop@r1</div>${dockSettingsHTML()}`;
    bindSettings(); return;
  }
  $('#inspector').innerHTML = `<div class="insp-kicker">Dock Tile · ${esc(t.kind)}</div><div class="insp-title">${esc(t.icon)} ${esc(t.name)}</div><div class="insp-id">${esc(t.id)} · ${esc(t.tab)}</div>
    <div class="insp-section"><div class="lh">Tile</div><div class="kv"><div class="k">kind</div><div class="v">${esc(t.kind)}</div><div class="k">target</div><div class="v">${esc(t.targetLabel || t.target)}</div><div class="k">atomRef</div><div class="v">${esc(t.target)}</div><div class="k">effect</div><div class="v">${esc(t.effect)}</div><div class="k">hotkey</div><div class="v">${t.hotkey ? '⌨ ' + esc(t.hotkey) : '—'}</div><div class="k">status</div><div class="v">${t.targetId && t.href ? 'mapped' : 'placeholder'}</div></div></div>
    ${t.href ? `<div class="insp-section"><div class="lh">Target</div><a class="btn primary" style="width:100%" href="${esc(t.href)}">打开目标实例 ↗</a></div>` : '<div class="insp-section"><div class="lh">Target</div><div class="note">该 Tile target 尚未接入点层/线层实例；编辑时可选择实际实例。</div></div>'}
    <div class="insp-section"><div class="lh">Actions</div><div class="actions"><button class="btn" data-action="edit-tile">✎ 编辑</button><button class="btn" data-action="duplicate-tile">⧉ 复制</button><button class="btn danger" data-action="delete-tile">⌫ 删除</button></div></div>
    ${dockSettingsHTML()}`;
  $$('#inspector [data-action]').forEach(b => b.onclick = () => handleAction(b.dataset.action));
  bindSettings();
}
function dockSettingsHTML() {
  return `<div class="insp-section"><div class="lh">Dock Settings</div><div class="dock-settings"><div class="row"><label>tile</label><input id="setTile" type="range" min="48" max="86" value="${SETTINGS.tileSize}"><span class="mono">${SETTINGS.tileSize}px</span></div><div class="row"><label>columns</label><input id="setCols" type="number" min="4" max="8" value="${SETTINGS.columns}"><label>gap</label><input id="setGap" type="number" min="2" max="16" value="${SETTINGS.gap}"></div><div class="row"><label>theme</label><select id="setTheme"><option value="dark" ${SETTINGS.theme === 'dark' ? 'selected' : ''}>dark</option><option value="light" ${SETTINGS.theme === 'light' ? 'selected' : ''}>light</option></select><label class="chk"><input type="checkbox" id="setLabels" ${SETTINGS.showLabels ? 'checked' : ''}> labels</label><label class="chk"><input type="checkbox" id="setSub" ${SETTINGS.showSub ? 'checked' : ''}> sub</label></div></div></div>`;
}
function bindSettings() {
  const bind = (id, fn) => { const el = $('#' + id); if (el) el.addEventListener('input', e => { fn(e); saveData(); renderMain(); }); };
  bind('setTile', e => { SETTINGS.tileSize = Number(e.target.value); });
  bind('setCols', e => { SETTINGS.columns = Number(e.target.value); });
  bind('setGap', e => { SETTINGS.gap = Number(e.target.value); });
  const th = $('#setTheme'); if (th) th.addEventListener('change', e => { SETTINGS.theme = e.target.value; saveData(); renderMain(); });
  const lb = $('#setLabels'); if (lb) lb.addEventListener('change', e => { SETTINGS.showLabels = e.target.checked; saveData(); renderMain(); });
  const sb = $('#setSub'); if (sb) sb.addEventListener('change', e => { SETTINGS.showSub = e.target.checked; saveData(); renderMain(); });
}
function renderAll() { renderTopStats(); renderLeft(); renderMain(); renderInspector(); }
function openModal(html) { $('#modalRoot').innerHTML = `<div class="modal-overlay" id="modalOverlay"><div class="modal">${html}</div></div>`; }
function closeModal() { $('#modalRoot').innerHTML = ''; }
function confirmModal(title, message, label, onConfirm) {
  openModal(`<h3>${esc(title)}</h3><p>${esc(message)}</p><div class="modal-actions"><button class="btn" data-modal-close>取消</button><button class="btn danger" id="modalConfirm">${esc(label)}</button></div>`);
  $('#modalConfirm').onclick = () => { closeModal(); onConfirm(); };
}
function openTabModal(edit = false) {
  const t = edit ? tab() : null;
  openModal(`<h3>${edit ? '编辑 Tab' : '新建 Tab'}</h3><p>CLaunch 分页：每个 Tab 是一页 Tile。</p><div class="form-grid"><div class="field"><label>ID</label><input id="mTabId" value="${esc(t?.id || 'tab.custom')}" ${edit ? 'disabled' : ''}></div><div class="field"><label>名称</label><input id="mTabName" value="${esc(t?.name || '新分页')}"></div></div><div class="modal-actions"><button class="btn" data-modal-close>取消</button><button class="btn primary" id="tabSave">${edit ? '保存' : '创建'}</button></div>`);
  $('#tabSave').onclick = () => {
    const id = $('#mTabId').value.trim(), name = $('#mTabName').value.trim();
    if (!id || !name) { showToast('ID 和名称必填'); return; }
    if (!edit && TABS.some(x => x.id === id)) { showToast('Tab ID 已存在'); return; }
    if (edit) { t.name = name; showToast('Tab 已更新'); }
    else { TABS.push({ id, name }); state.tabId = id; state.tileId = ''; showToast('Tab 已创建'); }
    saveData(); closeModal(); ensureSelection(); updateHash(); renderAll();
  };
}
function openTileModal(edit = false) {
  const t = edit ? tile() : null;
  if (!t && !tab()) return;
  let selectedTargetId = t?.targetId || '';
  let targetKind = t?.targetKind || (t && t.kind === 'flow' ? 'line' : 'point');
  openModal(`<h3>${edit ? '编辑 Tile' : '新建 Tile'}</h3><p>Tile = 图标 + 名称 + 目标实例 + 快捷键。目标可选点层或线层实例。</p>
    <div class="form-grid"><div class="field"><label>名称</label><input id="mTileName" value="${esc(t?.name || 'New Tile')}"></div><div class="field"><label>icon</label><input id="mTileIcon" value="${esc(t?.icon || '▣')}"></div><div class="field"><label>kind</label><select id="mTileKind"><option value="flow" ${t?.kind === 'flow' ? 'selected' : ''}>flow</option><option value="point" ${t?.kind === 'point' ? 'selected' : ''}>point</option></select></div><div class="field"><label>effect</label><select id="mTileEffect">${['L0', 'L1', 'L2'].map(x => `<option value="${x}" ${(t?.effect || 'L1') === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div><div class="field"><label>hotkey</label><input id="mTileHotkey" maxlength="2" value="${esc(t?.hotkey || '')}"></div><div class="field"><label>tab</label><select id="mTileTab">${TABS.map(x => `<option value="${x.id}" ${(t?.tab || state.tabId) === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div></div>
    <div class="target-tabs"><button data-target-kind="point" class="${targetKind === 'point' ? 'on' : ''}">点层实例 · ${POINT_TARGETS.length}</button><button data-target-kind="line" class="${targetKind === 'line' ? 'on' : ''}">线层实例 · ${LINE_TARGETS.length}</button></div><input class="target-search" id="targetSearch" placeholder="搜索实例 / class / flow…"><div class="target-list" id="targetList"></div><div class="target-summary" id="targetSummary"></div>
    <div class="modal-actions"><button class="btn" data-modal-close>取消</button><button class="btn primary" id="tileSave">${edit ? '保存' : '创建'}</button></div>`);
  const renderTargets = () => {
    const q = ($('#targetSearch')?.value || '').trim().toLowerCase();
    const list = (targetKind === 'point' ? POINT_TARGETS : LINE_TARGETS).filter(x => !q || [x.label, x.sub, x.atomRef].join(' ').toLowerCase().includes(q));
    $('#targetList').innerHTML = list.map(x => `<button class="target-item ${x.id === selectedTargetId ? 'on' : ''}" data-target-id="${esc(x.id)}"><span class="target-kind ${x.kind}">${x.kind === 'point' ? 'POINT' : 'LINE'}</span><span class="ti-main"><span class="ti-label">${esc(x.label)}</span><span class="ti-sub">${esc(x.sub)}</span></span><span style="color:#5f7188">选择</span></button>`).join('') || '<div class="empty">没有匹配实例。</div>';
    $$('#targetList [data-target-id]').forEach(el => el.onclick = () => { selectedTargetId = el.dataset.targetId; const target = ALL_TARGETS.find(x => x.id === selectedTargetId); if (target) $('#mTileKind').value = target.kind === 'point' ? 'point' : 'flow'; renderTargets(); updateSummary(); });
    updateSummary();
  };
  const updateSummary = () => {
    const x = ALL_TARGETS.find(y => y.id === selectedTargetId);
    $('#targetSummary').innerHTML = x ? `<span class="target-kind ${x.kind}">${x.kind === 'point' ? 'POINT' : 'LINE'}</span><b>${esc(x.label)}</b><span style="color:#5f7188">${esc(x.atomRef)}</span>` : '<span style="color:#fcd34d">未选择目标 · 保存前请选择点层或线层实例</span>';
  };
  $$('#modalRoot [data-target-kind]').forEach(b => b.onclick = () => { targetKind = b.dataset.targetKind; selectedTargetId = ''; $$('#modalRoot [data-target-kind]').forEach(x => x.classList.toggle('on', x.dataset.targetKind === targetKind)); renderTargets(); });
  $('#targetSearch').addEventListener('input', renderTargets); renderTargets();
  $('#tileSave').onclick = () => {
    const name = $('#mTileName').value.trim(); if (!name) { showToast('名称必填'); return; }
    const target = ALL_TARGETS.find(x => x.id === selectedTargetId);
    if (!target) { showToast('请选择点层或线层实例'); return; }
    const data = { name, icon: $('#mTileIcon').value.trim() || '▣', kind: target.kind === 'point' ? 'point' : 'flow', effect: $('#mTileEffect').value, hotkey: $('#mTileHotkey').value.trim(), tab: $('#mTileTab').value, target: target.atomRef, targetKind: target.kind, targetId: target.id, targetLabel: target.label, href: target.href, sub: target.label };
    if (edit) Object.assign(t, data); else TILES.push({ ...data, id: `tile-${Date.now()}` });
    state.tabId = data.tab; state.tileId = edit ? t.id : TILES[TILES.length - 1].id; saveData(); closeModal(); updateHash(); renderAll(); showToast(edit ? 'Tile 已更新' : 'Tile 已创建');
  };
}
function handleAction(action) {
  const t = tile(), active = tab();
  if (action === 'new-tab') { openTabModal(false); return; }
  if (action === 'edit-tab') { openTabModal(true); return; }
  if (action === 'delete-tab') {
    if (TABS.length <= 1) { showToast('至少保留一个 Tab'); return; }
    const n = TILES.filter(x => x.tab === active.id).length;
    confirmModal('删除 Tab？', `会删除 ${active.name} 及其 ${n} 个 Tile。`, '删除', () => { TABS = TABS.filter(x => x.id !== active.id); TILES = TILES.filter(x => x.tab !== active.id); state.tabId = TABS[0]?.id || ''; state.tileId = ''; saveData(); ensureSelection(); updateHash(); renderAll(); showToast('Tab 已删除'); }); return;
  }
  if (action === 'new-tile') { openTileModal(false); return; }
  if (action === 'edit-tile') { openTileModal(true); return; }
  if (action === 'duplicate-tile') { if (!t) return; const copy = deep(t); copy.id = `${t.id}.copy-${Date.now()}`; copy.name = `${t.name} 副本`; TILES.push(copy); state.tileId = copy.id; saveData(); updateHash(); renderAll(); showToast('Tile 已复制'); return; }
  if (action === 'delete-tile') { if (!t) return; confirmModal('删除 Tile？', `会删除 ${t.name}。`, '删除', () => { TILES = TILES.filter(x => x.id !== t.id); state.tileId = ''; saveData(); ensureSelection(); updateHash(); renderAll(); showToast('Tile 已删除'); }); return; }
  if (action === 'reset-data') { confirmModal('重置示例启动坞？', '会覆盖本地新增/修改，恢复 5 Tabs / 48 Tiles。', '重置', () => { TABS = deep(DOCK_DATA.tabs); TILES = deep(DOCK_DATA.tiles).map(resolveTarget); SETTINGS = { tileSize: 64, columns: 6, gap: 6, theme: 'dark', showLabels: true, showSub: true, position: 'bottom' }; state.tabId = TABS[0].id; state.tileId = ''; saveData(); ensureSelection(); updateHash(); renderAll(); showToast('示例启动坞已重置'); }); return; }
}
function init() {
  parseHash(); ensureSelection(); renderAll();
  $('#modalRoot').addEventListener('click', e => { if (e.target.id === 'modalOverlay' || e.target.closest('[data-modal-close]')) closeModal(); });
  window.addEventListener('hashchange', () => { parseHash(); ensureSelection(); renderAll(); });
}
init();
})();
