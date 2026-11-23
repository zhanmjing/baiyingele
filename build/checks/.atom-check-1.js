
/* ===== 可选加载 / 资源管理扩展 ===== */
const AI_CLASS = {
  id: 'ai.llm.complete', name: 'LLM 补全', family: 'ai', version: '1.0.0',
  status: 'stable', p0: true, official: true, usedBy: 9, success: 97.4, updated: '2026-11-21',
  desc: '调用本地或云端模型补全/总结/翻译；模型是包资源，未加载时不占显存。',
  permissions: ['ai.llm'], sideEffects: ['read', 'network'],
  instances: [
    { id: 'i-llm-summarize', name: '总结选中文本', params: { model: 'local.qwen3.5-7b', prompt: '请总结以下内容', temperature: 0.2, maxTokens: 1024 }, tags: ['AI'], usedBy: 5, lastRun: '1 小时前', status: 'stable', success: 97.8 },
    { id: 'i-llm-translate', name: '翻译成英文', params: { model: 'cloud.gpt-5.5', prompt: 'Translate to English', temperature: 0.1, maxTokens: 800 }, tags: ['AI'], usedBy: 4, lastRun: '昨天', status: 'stable', success: 96.6 }
  ]
};
const PACK_PROFILES = {
  'win.key.send':            { memoryMB: 4.2,  diskMB: 1.1,  gpuMB: 0,    handles: 12, threads: 2, model: '', deps: ['SendInput'], state: 'loaded',    policy: 'pinned',    lastUsed: '刚刚' },
  'win.key.trigger':         { memoryMB: 3.8,  diskMB: 0.9,  gpuMB: 0,    handles: 8,  threads: 2, model: '', deps: ['RegisterHotKey'], state: 'loaded',    policy: 'pinned',    lastUsed: '刚刚' },
  'win.window.control':      { memoryMB: 6.4,  diskMB: 2.2,  gpuMB: 0,    handles: 18, threads: 3, model: '', deps: ['Win32', 'UIA'], state: 'loaded',    policy: 'on-demand', lastUsed: '5 分钟前' },
  'win.window.query':        { memoryMB: 2.1,  diskMB: 0.7,  gpuMB: 0,    handles: 6,  threads: 1, model: '', deps: ['EnumWindows'], state: 'installed', policy: 'on-demand', lastUsed: '1 小时前' },
  'win.open':                { memoryMB: 3.4,  diskMB: 1.4,  gpuMB: 0,    handles: 10, threads: 2, model: '', deps: ['ShellExecuteEx'], state: 'loaded',    policy: 'on-demand', lastUsed: '10 分钟前' },
  'win.audio.volume':        { memoryMB: 5.1,  diskMB: 1.8,  gpuMB: 0,    handles: 14, threads: 2, model: '', deps: ['WASAPI'], state: 'loaded',    policy: 'on-demand', lastUsed: '刚刚' },
  'win.display.brightness':  { memoryMB: 4.6,  diskMB: 1.2,  gpuMB: 0,    handles: 9,  threads: 2, model: '', deps: ['WMI', 'DDC/CI'], state: 'installed', policy: 'on-demand', lastUsed: '昨天' },
  'win.theme.mode':          { memoryMB: 2.2,  diskMB: 0.6,  gpuMB: 0,    handles: 4,  threads: 1, model: '', deps: ['Registry'], state: 'installed', policy: 'on-demand', lastUsed: '昨天' },
  'win.ocr.read':            { memoryMB: 48,   diskMB: 26,   gpuMB: 0,    handles: 12, threads: 2, model: 'Windows AI OCR', deps: ['Windows AI APIs'], state: 'loaded', policy: 'preload', lastUsed: '12 分钟前' },
  'win.clipboard.get':       { memoryMB: 2.0,  diskMB: 0.5,  gpuMB: 0,    handles: 6,  threads: 1, model: '', deps: ['Win32 Clipboard'], state: 'loaded',    policy: 'on-demand', lastUsed: '刚刚' },
  'win.http.request':        { memoryMB: 7.8,  diskMB: 2.4,  gpuMB: 0,    handles: 20, threads: 4, model: '', deps: ['WinHTTP'], state: 'installed', policy: 'on-demand', lastUsed: '2 小时前' },
  'ui.form':                 { memoryMB: 3.0,  diskMB: 0.8,  gpuMB: 0,    handles: 5,  threads: 1, model: '', deps: ['WinUI'], state: 'installed', policy: 'on-demand', lastUsed: '今天' },
  'ai.llm.complete':         { memoryMB: 2048, diskMB: 5200, gpuMB: 6144, handles: 22, threads: 6, model: 'Qwen3.5-7B Q4', deps: ['ONNX Runtime', 'DirectML'], state: 'available', policy: 'on-demand', lastUsed: '—' }
};
function ensureAiClass() {
  if (!FAMILIES.some((f) => f.id === 'ai')) FAMILIES.push({ id: 'ai', name: 'AI/语言', icon: '✦', color: '#8B5CF6' });
  if (!data.some((c) => c.id === 'ai.llm.complete')) data.push(JSON.parse(JSON.stringify(AI_CLASS)));
}
function ensurePackProfiles() {
  ensureAiClass();
  data.forEach((c) => {
    const profile = PACK_PROFILES[c.id] || {};
    const base = {
      packId: `${c.id}.pack`, memoryMB: 2, diskMB: 0.5, gpuMB: 0,
      handles: 4, threads: 1, model: '', deps: [], state: 'installed',
      policy: 'on-demand', lastUsed: '—', ...profile
    };
    if (!c.pack) c.pack = base;
    else Object.keys(base).forEach((k) => { if (c.pack[k] === undefined) c.pack[k] = base[k]; });
  });
}
function fmtMB(mb) {
  if (mb === null || mb === undefined) return '—';
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb * 10) / 10} MB`;
}
function loadBadge(state) {
  const map = {
    loaded: ['loaded', '● 已加载'],
    installed: ['installed', '○ 已安装'],
    available: ['available', '↓ 可下载'],
    loading: ['loading', '◌ 加载中']
  };
  const [cls, label] = map[state] || map.installed;
  return `<span class="load-badge ${cls}">${label}</span>`;
}
function loadActionButtons(c) {
  const p = c.pack;
  if (!p) return '';
  if (p.state === 'loading') return '<button class="load-btn" disabled>加载中…</button>';
  if (p.state === 'available') return `<button class="load-btn primary" data-load-action="install" data-pack-class="${c.id}">下载/安装</button>`;
  if (p.state === 'installed') return `<button class="load-btn primary" data-load-action="load" data-pack-class="${c.id}">加载</button><button class="load-btn" data-load-action="preload" data-pack-class="${c.id}">预加载</button>`;
  return `<button class="load-btn danger" data-load-action="unload" data-pack-class="${c.id}">卸载</button><button class="load-btn" data-load-action="pin" data-pack-class="${c.id}">${p.policy === 'pinned' ? '取消固定' : '固定'}</button>`;
}
function resourceSection(c) {
  const p = c.pack;
  if (!p) return '';
  return `<div class="section resource-section">
    <div class="section-title">资源与加载</div>
    <div class="res-grid">
      <span class="k">状态</span><span class="v">${loadBadge(p.state)}</span>
      <span class="k">内存（峰值估算）</span><span class="v">${fmtMB(p.memoryMB)}</span>
      <span class="k">磁盘</span><span class="v">${fmtMB(p.diskMB)}</span>
      <span class="k">GPU 显存</span><span class="v">${p.gpuMB ? fmtMB(p.gpuMB) : '—'}</span>
      <span class="k">句柄 / 线程</span><span class="v">${p.handles} / ${p.threads}</span>
      <span class="k">模型</span><span class="v">${p.model || '—'}</span>
      <span class="k">依赖</span><span class="v">${(p.deps || []).join(', ') || '—'}</span>
      <span class="k">加载策略</span><span class="v">${p.policy}</span>
    </div>
    <div class="load-inline">${loadActionButtons(c)}</div>
  </div>`;
}
function loadFilterMatch(c) {
  const f = state.loadFilter || 'all';
  const p = c.pack;
  if (f === 'loaded') return p.state === 'loaded';
  if (f === 'installed') return p.state === 'installed';
  if (f === 'available') return p.state === 'available';
  if (f === 'heavy') return (p.memoryMB || 0) >= 100 || (p.gpuMB || 0) > 0 || (p.diskMB || 0) >= 100;
  return true;
}
function renderLoadView(list) {
  ensurePackProfiles();
  $('#pageTitle').textContent = '加载管理';
  $('#pageSub').textContent = '按需加载类/实例；显示内存、磁盘、GPU、句柄、线程、模型与依赖。';
  const loaded = data.filter((c) => c.pack.state === 'loaded');
  const installed = data.filter((c) => c.pack.state === 'installed');
  const available = data.filter((c) => c.pack.state === 'available');
  const sum = (arr, key) => arr.reduce((n, c) => n + (Number(c.pack[key]) || 0), 0);
  const mem = sum(loaded, 'memoryMB');
  const diskInstalled = sum([...loaded, ...installed], 'diskMB');
  const diskAvailable = sum(available, 'diskMB');
  const gpuLoaded = sum(loaded, 'gpuMB');
  const gpuAvailable = sum(available, 'gpuMB');
  const handles = sum(loaded, 'handles');
  const threads = sum(loaded, 'threads');
  const budget = 512;
  const pct = Math.min(100, Math.round((mem / budget) * 100));
  const rows = list.filter(loadFilterMatch).map((c) => {
    const p = c.pack;
    const fam = familyById(c.family);
    const rowClass = p.state === 'available' ? 'row-available' : p.state === 'loading' ? 'row-loading' : '';
    const deps = (p.deps || []).map((d) => `<span class="res-pill">${esc(d)}</span>`).join('');
    return `<tr class="${rowClass}" data-class="${c.id}">
      <td><div class="load-name"><div class="li" style="--c:${fam.color}">${fam.icon}</div><div><div class="ln">${esc(c.name)} ${c.p0 ? '<span class="badge p0">P0</span>' : ''}</div><div class="lid">${esc(c.id)}</div></div></div></td>
      <td>${loadBadge(p.state)}</td>
      <td><select class="policy-select" data-load-policy="${c.id}" ${p.state === 'available' ? 'disabled' : ''}>${['on-demand', 'preload', 'pinned'].map((x) => `<option value="${x}" ${p.policy === x ? 'selected' : ''}>${x}</option>`).join('')}</select></td>
      <td><div class="res-num">${fmtMB(p.memoryMB)}</div><div class="res-sub">峰值估算</div></td>
      <td><div class="res-num">${fmtMB(p.diskMB)}</div><div class="res-sub">安装体积</div></td>
      <td><div class="res-num ${p.gpuMB ? '' : 'muted'}">${p.gpuMB ? fmtMB(p.gpuMB) : '—'}</div><div class="res-sub">${p.gpuMB ? '显存' : '无 GPU'}</div></td>
      <td><div class="res-num">${p.handles} / ${p.threads}</div><div class="res-sub">句柄 / 线程</div></td>
      <td>${p.model ? `<span class="res-pill model">${esc(p.model)}</span>` : ''}${deps || (!p.model ? '<span class="res-num muted">—</span>' : '')}</td>
      <td><div class="res-num">${c.instances.length}</div><div class="res-sub">实例 · ${c.usedBy || 0} 引用</div></td>
      <td><div class="res-num muted">${esc(p.lastUsed || '—')}</div></td>
      <td><div class="load-actions">${loadActionButtons(c)}</div></td>
    </tr>`;
  }).join('');
  const filters = [['all', '全部'], ['loaded', '已加载'], ['installed', '已安装'], ['available', '可下载'], ['heavy', '重资源']]
    .map(([k, label]) => `<button class="chip ${((state.loadFilter || 'all') === k) ? 'active' : ''}" data-load-filter="${k}">${label}</button>`).join('');
  $('#content').innerHTML = `<div class="load-view">
    <div class="load-summary">
      <div class="load-card"><div class="lbl">已加载包</div><div class="val">${loaded.length}</div><div class="sub">${installed.length} 已安装 · ${available.length} 可下载</div></div>
      <div class="load-card"><div class="lbl">已加载内存</div><div class="val">${fmtMB(mem)}</div><div class="sub">句柄 ${handles} · 线程 ${threads}</div></div>
      <div class="load-card"><div class="lbl">已安装磁盘</div><div class="val">${fmtMB(diskInstalled)}</div><div class="sub">可下载 ${fmtMB(diskAvailable)}</div></div>
      <div class="load-card"><div class="lbl">GPU 显存</div><div class="val">${gpuLoaded ? fmtMB(gpuLoaded) : '0 MB'}</div><div class="sub">${gpuAvailable ? `未加载模型潜在 ${fmtMB(gpuAvailable)}` : '无 GPU 包'}</div></div>
    </div>
    <div class="budget">
      <div class="budget-head"><strong>内存预算 ${budget} MB</strong><span>${fmtMB(mem)} / ${budget} MB · ${pct}%</span></div>
      <div class="budget-bar"><span class="used" style="width:${pct}%"></span></div>
      <div class="budget-legend"><span><i style="background:var(--primary)"></i>已加载包</span><span><i style="background:var(--new)"></i>GPU 显存另计</span><span>kernel + 元数据常驻约 12 MB</span></div>
    </div>
    <div class="load-toolbar">${filters}<span class="load-note" style="margin-left:auto">点击行打开 Inspector；操作按钮不触发选中。</span></div>
    <div class="load-table-wrap">${rows ? `<table class="load-table"><thead><tr><th>类 / 包</th><th>状态</th><th>策略</th><th>内存</th><th>磁盘</th><th>GPU</th><th>句柄/线程</th><th>模型 / 依赖</th><th>引用</th><th>最近使用</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty" style="border:0"><strong>没有匹配的包</strong>切换过滤器或搜索。</div>'}</div>
    <div class="load-note">资源为演示估算：内存/GPU 是峰值占用，磁盘是安装体积；真实值以包 manifest 和运行时计量为准。卸载只释放运行资源，已安装文件仍在磁盘。</div>
  </div>`;
}
function handleLoadAction(el) {
  const c = classById(el.dataset.packClass);
  if (!c || !c.pack) return;
  const p = c.pack;
  const a = el.dataset.loadAction;
  if (a === 'install') {
    p.state = 'installed'; p.lastUsed = '刚刚'; saveData(); renderAll();
    showToast(`已安装「${c.name}」包，尚未加载`);
    return;
  }
  if (a === 'load' || a === 'preload') {
    if (p.state === 'loading') return;
    if (p.state === 'available') p.state = 'installed';
    p.state = 'loading'; renderAll();
    setTimeout(() => {
      p.state = 'loaded'; p.lastUsed = '刚刚';
      if (a === 'preload') p.policy = 'preload';
      saveData(); renderAll();
      showToast(`已加载「${c.name}」${a === 'preload' ? '（预加载）' : ''}`);
    }, 600);
    return;
  }
  if (a === 'unload') {
    p.state = 'installed'; p.lastUsed = '刚刚';
    if (p.policy === 'pinned') p.policy = 'on-demand';
    saveData(); renderAll();
    showToast(`已卸载「${c.name}」，下次触发会重新加载`);
    return;
  }
  if (a === 'pin') {
    p.policy = p.policy === 'pinned' ? 'on-demand' : 'pinned';
    if (p.policy === 'pinned' && p.state !== 'loaded') p.state = 'loaded';
    saveData(); renderAll();
    showToast(p.policy === 'pinned' ? `已固定「${c.name}」` : `已取消固定「${c.name}」`);
  }
}
function setPackPolicy(classId, policy) {
  const c = classById(classId);
  if (!c || !c.pack) return;
  const p = c.pack;
  p.policy = policy;
  if (policy !== 'on-demand' && p.state === 'installed') p.state = 'loaded';
  p.lastUsed = '刚刚';
  saveData(); renderAll();
  showToast(`「${c.name}」策略：${policy}`);
}

/* 包装原有渲染，不破坏原逻辑 */
const baseRenderContent = renderContent;
renderContent = function () {
  ensurePackProfiles();
  if (state.view === 'load') { renderLoadView(filteredClasses()); return; }
  baseRenderContent();
};
const baseRenderClassCard = renderClassCard;
renderClassCard = function (c) {
  let html = baseRenderClassCard(c);
  const p = c.pack;
  if (!p) return html;
  html = html.replace(`<span class="badge">v${esc(c.version)}</span>`, `<span class="badge">v${esc(c.version)}</span>${loadBadge(p.state)}`);
  const line = `<div class="class-res-line"><span class="res-pill">内存 ${fmtMB(p.memoryMB)}</span><span class="res-pill">磁盘 ${fmtMB(p.diskMB)}</span>${p.gpuMB ? `<span class="res-pill gpu">GPU ${fmtMB(p.gpuMB)}</span>` : ''}${p.model ? `<span class="res-pill model">${esc(p.model)}</span>` : ''}</div>`;
  return html.replace(/<\/div>\r?\n      <div class="class-meta">/, `${line}</div>\n      <div class="class-meta">`);
};
const baseRenderInspector = renderInspector;
renderInspector = function () {
  baseRenderInspector();
  const c = selectedClass();
  if (!c || !c.pack) return;
  const box = $('#inspector');
  if (!box || box.querySelector('.resource-section')) return;
  const actions = box.querySelector('.inspector-actions');
  if (actions) actions.insertAdjacentHTML('beforebegin', resourceSection(c));
  else box.insertAdjacentHTML('beforeend', resourceSection(c));
};
const baseDefaultParams = defaultParams;
defaultParams = function (classId) {
  if (classId === 'ai.llm.complete') return { model: 'local.qwen3.5-7b', prompt: '请总结以下内容', temperature: 0.2, maxTokens: 1024 };
  return baseDefaultParams(classId);
};
const baseParamSummary = paramSummary;
paramSummary = function (cls, p = {}) {
  if (cls.id === 'ai.llm.complete') return `${p.model || 'local'} · ${String(p.prompt || '').slice(0, 22)}`;
  return baseParamSummary(cls, p);
};
const baseRenderInstanceForm = renderInstanceForm;
renderInstanceForm = function (c, i) {
  if (c.id === 'ai.llm.complete') {
    const p = i.params || {};
    return selectField('模型', 'model', p.model || 'local.qwen3.5-7b', [['local.qwen3.5-7b', '本地 Qwen3.5-7B（2 GB 内存 / 6 GB 显存）'], ['cloud.gpt-5.5', '云端 GPT-5.5（无本地显存）'], ['cloud.claude-fable-5.2', '云端 Claude Fable 5.2']])
      + textareaField('提示词', 'prompt', p.prompt || '')
      + `<div class="field-row">${numberField('temperature', 'temperature', p.temperature ?? 0.2, 'step="0.1" min="0" max="2"')}${numberField('maxTokens', 'maxTokens', p.maxTokens ?? 1024, 'min="1"')}</div>`;
  }
  return baseRenderInstanceForm(c, i);
};

/* 视图按钮与事件 */
(function addLoadViewButton() {
  const sw = $('#viewSwitch');
  if (!sw || sw.querySelector('[data-view="load"]')) return;
  const btn = document.createElement('button');
  btn.dataset.view = 'load';
  btn.textContent = '加载';
  sw.appendChild(btn);
})();
document.addEventListener('click', (e) => {
  const loadBtn = e.target.closest('[data-load-action]');
  if (loadBtn) { e.preventDefault(); e.stopPropagation(); handleLoadAction(loadBtn); return; }
  const filterBtn = e.target.closest('[data-load-filter]');
  if (filterBtn) { e.stopPropagation(); state.loadFilter = filterBtn.dataset.loadFilter; renderContent(); return; }
  if (e.target.closest('[data-load-policy]')) e.stopPropagation();
}, true);
document.addEventListener('change', (e) => {
  const sel = e.target.closest('[data-load-policy]');
  if (sel) { e.stopPropagation(); setPackPolicy(sel.dataset.loadPolicy, sel.value); }
}, true);
const baseRenderAll = renderAll;
renderAll = function () { ensurePackProfiles(); baseRenderAll(); };
ensurePackProfiles();
state.loadFilter = state.loadFilter || 'all';
saveData();
renderAll();

