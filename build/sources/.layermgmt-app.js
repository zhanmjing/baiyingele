(() => {
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LAYERS = [
  { id: 'point', label: '点层', icon: '◆', color: '#22d3ee' },
  { id: 'line', label: '线层', icon: '↝', color: '#3b82f6' },
  { id: 'surface', label: '面层', icon: '▦', color: '#8b5cf6' },
  { id: 'body', label: '体层', icon: '▣', color: '#f59e0b' },
  { id: 'field', label: '场层', icon: '✦', color: '#ec4899' }
];
const state = {
  layer: 'point',
  expanded: new Set(),
  selectedClassId: null,
  selectedInstanceId: null,
  query: '',
  toastTimer: null
};
const cat = () => LAYER_CATALOGS[state.layer];
const layerMeta = () => LAYERS.find(l => l.id === state.layer) || LAYERS[0];
const currentClass = () => { const c = cat(); return c?.classes.find(x => x.id === state.selectedClassId) || c?.classes[0] || null; };
const currentInstance = () => { const c = currentClass(); return c?.instances.find(i => i.id === state.selectedInstanceId) || c?.instances[0] || null; };
const totalInstances = c => c.classes.reduce((n, x) => n + x.instances.length, 0);

function parseHash() {
  const parts = (location.hash || '').replace(/^#/, '').split('/').map(decodeURIComponent);
  const layer = LAYERS.find(l => l.id === parts[0])?.id;
  if (layer) state.layer = layer;
  const c = cat();
  if (parts[1] && c.classes.some(x => x.id === parts[1])) state.selectedClassId = parts[1];
  const cls = currentClass();
  if (parts[2] && cls?.instances.some(i => i.id === parts[2])) state.selectedInstanceId = parts[2];
  ensureSelection();
  if (state.selectedClassId) state.expanded.add(state.selectedClassId);
}
function ensureSelection() {
  const c = cat();
  if (!c.classes.some(x => x.id === state.selectedClassId)) {
    state.selectedClassId = c.classes[0]?.id || null;
    state.selectedInstanceId = c.classes[0]?.instances[0]?.id || null;
  }
  const cls = currentClass();
  if (cls && !cls.instances.some(i => i.id === state.selectedInstanceId)) state.selectedInstanceId = cls.instances[0]?.id || null;
}
function updateHash() {
  const h = `#${state.layer}${state.selectedClassId ? '/' + encodeURIComponent(state.selectedClassId) : ''}${state.selectedInstanceId ? '/' + encodeURIComponent(state.selectedInstanceId) : ''}`;
  if (location.hash !== h) history.replaceState(null, '', h);
}
function showToast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => t.classList.remove('show'), 1700);
}
function renderTabs() {
  $('#layerTabs').innerHTML = LAYERS.map(l => {
    const c = LAYER_CATALOGS[l.id];
    return `<button class="${l.id === state.layer ? 'on' : ''}" data-layer="${l.id}">${l.icon} ${l.label}<span>${c.classes.length}/${totalInstances(c)}</span></button>`;
  }).join('');
}
function filteredClasses() {
  const q = state.query.trim().toLowerCase();
  const c = cat();
  if (!q) return c.classes.map(cls => ({ cls, instances: cls.instances }));
  return c.classes.map(cls => {
    const classHit = [cls.id, cls.name, cls.group, cls.status, cls.summary].join(' ').toLowerCase().includes(q);
    const inst = cls.instances.filter(i => [i.id, i.name, i.detail, i.status].join(' ').toLowerCase().includes(q));
    return { cls, instances: classHit ? cls.instances : inst };
  }).filter(x => x.instances.length || [x.cls.id, x.cls.name, x.cls.group, x.cls.status, x.cls.summary].join(' ').toLowerCase().includes(q));
}
function renderMain() {
  const c = cat();
  const m = layerMeta();
  const list = filteredClasses();
  const stable = c.classes.filter(x => x.status === 'stable').length;
  const draft = c.classes.filter(x => x.status === 'draft').length;
  const archived = c.classes.filter(x => x.status === 'archived').length;
  const rows = list.map(({ cls, instances }) => {
    const open = state.expanded.has(cls.id);
    const sel = cls.id === state.selectedClassId;
    const instRows = open ? instances.map(i => `<tr class="inst-row ${i.id === state.selectedInstanceId ? 'on' : ''}" data-cls="${esc(cls.id)}" data-ins="${esc(i.id)}"><td><span class="indent">└</span><span class="inst-name">${esc(i.name)}</span><span class="inst-id">${esc(i.id)}</span></td><td>${esc(cls.group)}</td><td><span class="status ${esc(i.status)}">${esc(i.status)}</span></td><td>${esc(cls.effect || 'L0')}</td><td>r${i.rev}</td><td class="detail">${esc(i.detail || '')}</td></tr>`).join('') : '';
    return `<tr class="cls-row ${sel ? 'on' : ''}" data-cls="${esc(cls.id)}"><td><span class="chev">${open ? '▾' : '▸'}</span><b>${esc(cls.name)}</b><span class="cls-id">${esc(cls.id)}</span></td><td>${esc(cls.group)}</td><td><span class="status ${esc(cls.status)}">${esc(cls.status)}</span></td><td>${esc(cls.effect || 'L0')}</td><td>${cls.instances.length}</td><td class="detail">${esc(cls.summary || '')}</td></tr>${instRows}`;
  }).join('');
  $('#main').innerHTML = `<div class="head"><div class="head-icon" style="color:${m.color}">${m.icon}</div><div class="head-main"><div class="kicker">Layer Management / ${esc(state.layer)}</div><h1>${esc(m.label)} · 类与实例管理</h1><p>类与实例合并在一张表；展开类查看实例，点击行打开右侧 Inspector。管理动作在点层完整管理页或对应层 manager 中完成。</p></div><div class="head-actions">${state.layer === 'point' ? '<button class="btn primary" data-open-point>打开点层管理页 ↗</button>' : ''}<a class="btn" href="settings-workspace-two-tabs.html">⚙ 设置</a></div></div>
    <div class="stats"><span class="mini cyan">${c.classes.length} classes</span><span class="mini">${totalInstances(c)} instances</span><span class="mini green">${stable} stable</span><span class="mini amber">${draft} draft</span><span class="mini">${archived} archived</span></div>
    <div class="toolbar"><button class="btn" data-expand-all>展开全部类</button><button class="btn" data-collapse-all>收起全部</button><span class="mini">${list.length} 个类匹配</span></div>
    <div class="table-wrap"><table><thead><tr><th>类 / 实例</th><th>Group</th><th>Status</th><th>Effect</th><th>Inst</th><th>Summary / Detail</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="empty">没有匹配的类或实例。</td></tr>'}</tbody></table></div>`;
  $$('#main [data-expand-all]').forEach(b => b.onclick = () => { c.classes.forEach(x => state.expanded.add(x.id)); renderMain(); });
  $$('#main [data-collapse-all]').forEach(b => b.onclick = () => { state.expanded.clear(); renderMain(); });
  $$('#main [data-open-point]').forEach(b => b.onclick = () => window.open('atom-catalog-management.html', '_blank', 'noopener'));
  $$('#main .cls-row').forEach(el => el.onclick = () => {
    state.selectedClassId = el.dataset.cls;
    const cls = c.classes.find(x => x.id === state.selectedClassId);
    state.selectedInstanceId = cls?.instances[0]?.id || null;
    if (state.expanded.has(state.selectedClassId)) state.expanded.delete(state.selectedClassId); else state.expanded.add(state.selectedClassId);
    updateHash(); renderMain(); renderInspector();
  });
  $$('#main .inst-row').forEach(el => el.onclick = () => {
    state.selectedClassId = el.dataset.cls; state.selectedInstanceId = el.dataset.ins;
    state.expanded.add(state.selectedClassId); updateHash(); renderMain(); renderInspector();
  });
}
function renderInspector() {
  const c = currentClass(); const i = currentInstance();
  if (!c) { $('#inspector').innerHTML = '<div class="empty">选择类或实例。</div>'; return; }
  const m = layerMeta();
  $('#inspector').innerHTML = `<div class="insp-kicker">${esc(m.label)} · Class</div><div class="insp-title">${esc(c.name)}</div><div class="insp-id">${esc(c.id)} · v${esc(c.version || '1.0.0')}</div>
    <div class="sec"><div class="lh">Contract</div><div class="kv"><div class="k">group</div><div class="v">${esc(c.group)}</div><div class="k">status</div><div class="v">${esc(c.status)}</div><div class="k">effect</div><div class="v">${esc(c.effect || 'L0')}</div><div class="k">instances</div><div class="v">${c.instances.length}</div><div class="k">priority</div><div class="v">${esc(c.priority || '—')}</div></div></div>
    <div class="sec"><div class="lh">Summary</div><div style="font-size:8px;line-height:1.5;color:#9fb1c8">${esc(c.summary || '')}</div></div>
    <div class="sec"><div class="lh">Instances · ${c.instances.length}</div><div class="inst-list">${c.instances.slice(0, 20).map(x => `<button class="inst-btn ${x.id === i?.id ? 'on' : ''}" data-insp="${esc(x.id)}"><span>${esc(x.id)}</span><span>r${x.rev}</span></button>`).join('') || '<div class="empty">No instances.</div>'}</div>${c.instances.length > 20 ? `<div class="mini" style="margin-top:4px">+${c.instances.length - 20} more</div>` : ''}</div>
    ${i ? `<div class="sec"><div class="lh">Selected instance</div><div class="kv"><div class="k">id</div><div class="v">${esc(i.id)}</div><div class="k">status</div><div class="v">${esc(i.status)}</div><div class="k">revision</div><div class="v">r${i.rev}</div></div><div style="font-size:7.5px;line-height:1.5;color:var(--faint);margin-top:5px;word-break:break-word">${esc(i.detail || '')}</div></div>` : ''}
    ${state.layer === 'point' ? '<button class="btn primary" style="width:100%;justify-content:center" data-open-point>打开点层完整管理页 ↗</button>' : '<div class="mini">该层 CRUD 在 registry / body manager 中完成。</div>'}`;
  $$('#inspector [data-insp]').forEach(b => b.onclick = () => { state.selectedInstanceId = b.dataset.insp; state.expanded.add(state.selectedClassId); updateHash(); renderMain(); renderInspector(); });
  $$('#inspector [data-open-point]').forEach(b => b.onclick = () => window.open('atom-catalog-management.html', '_blank', 'noopener'));
}
function renderAll() { renderTabs(); const sl = $('#settingsLink'); if (sl) sl.href = `settings-workspace-settings-only.html#${state.layer}`; renderMain(); renderInspector(); }
function init() {
  parseHash();
  renderAll();
  $('#layerTabs').addEventListener('click', e => {
    const b = e.target.closest('[data-layer]'); if (!b) return;
    state.layer = b.dataset.layer; state.query = ''; $('#search').value = '';
    state.selectedClassId = null; state.selectedInstanceId = null; state.expanded.clear();
    ensureSelection(); state.expanded.add(state.selectedClassId); updateHash(); renderAll();
  });
  $('#search').addEventListener('input', e => { state.query = e.target.value; renderMain(); });
  window.addEventListener('hashchange', () => { parseHash(); renderAll(); });
}
init();
})();
