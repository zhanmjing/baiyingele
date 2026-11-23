
/* ---------- data ---------- */
const FAMILIES = [
  { id: 'hotkey',   name: '快捷键',   icon: '⌨', color: '#3B82F6' },
  { id: 'window',   name: '窗口',     icon: '▣', color: '#8B5CF6' },
  { id: 'open',     name: '打开',     icon: '↗', color: '#06B6D4' },
  { id: 'settings', name: '系统设置', icon: '◐', color: '#F59E0B' },
  { id: 'capture',  name: '捕获/感知', icon: '◎', color: '#10B981' },
  { id: 'file',     name: '文件/数据', icon: '▤', color: '#EC4899' },
  { id: 'network',  name: '网络',     icon: '⌁', color: '#84CC16' },
  { id: 'human',    name: '人机交互', icon: '☷', color: '#EF4444' },
  { id: 'security', name: '安全/身份', icon: '⚿', color: '#64748B' }
];

const SEED = [
  {
    id: 'win.key.send', name: '发送快捷键', family: 'hotkey', version: '1.0.0',
    status: 'stable', p0: true, official: true, usedBy: 12, success: 99.2, updated: '2026-11-18',
    desc: '向目标窗口发送组合键；复制、粘贴、剪切只是不同 keys 的实例。',
    permissions: ['input.send'], sideEffects: ['write'],
    instances: [
      { id: 'i-copy', name: '复制', params: { keys: 'Ctrl+C', mode: 'press', repeat: 1 }, tags: ['编辑'], usedBy: 8, lastRun: '2 分钟前', status: 'stable', success: 99.4 },
      { id: 'i-paste', name: '粘贴', params: { keys: 'Ctrl+V', mode: 'press', repeat: 1 }, tags: ['编辑'], usedBy: 7, lastRun: '2 分钟前', status: 'stable', success: 99.1 },
      { id: 'i-cut', name: '剪切', params: { keys: 'Ctrl+X', mode: 'press', repeat: 1 }, tags: ['编辑'], usedBy: 3, lastRun: '昨天', status: 'stable', success: 98.8 },
      { id: 'i-undo', name: '撤销', params: { keys: 'Ctrl+Z', mode: 'press', repeat: 1 }, tags: ['编辑'], usedBy: 4, lastRun: '昨天', status: 'stable', success: 99.0 },
      { id: 'i-select-all', name: '全选', params: { keys: 'Ctrl+A', mode: 'press', repeat: 1 }, tags: ['编辑'], usedBy: 2, lastRun: '3 天前', status: 'stable', success: 99.6 }
    ]
  },
  {
    id: 'win.key.trigger', name: '监听快捷键', family: 'hotkey', version: '1.0.0',
    status: 'stable', p0: true, official: true, usedBy: 6, success: 98.6, updated: '2026-11-17',
    desc: '全局或按应用监听组合键，发出 trigger 事件；和发送快捷键共用 Hotkey 契约。',
    permissions: ['input.registerHotkey'], sideEffects: ['read'],
    instances: [
      { id: 'i-trigger-panel', name: '打开面板', params: { keys: 'Ctrl+Alt+Space', scope: 'global' }, tags: ['入口'], usedBy: 5, lastRun: '刚刚', status: 'stable', success: 99.0 },
      { id: 'i-trigger-shot', name: '截图翻译', params: { keys: 'Ctrl+Alt+T', scope: 'global' }, tags: ['截图', 'AI'], usedBy: 3, lastRun: '12 分钟前', status: 'stable', success: 97.8 }
    ]
  },
  {
    id: 'win.window.control', name: '控制窗口', family: 'window', version: '1.2.0',
    status: 'stable', p0: true, official: true, usedBy: 18, success: 96.4, updated: '2026-11-20',
    desc: '按 WindowSelector 找到顶层窗口，执行聚焦、移动、缩放、置顶、关闭等操作。',
    permissions: ['window.read', 'window.control'], sideEffects: ['write'],
    instances: [
      { id: 'i-focus-notepad', name: '聚焦记事本', params: { op: 'focus', selector: { strategy: 'process', process: 'notepad.exe', title: '', titleMatch: 'contains', className: '', match: 'error' } }, tags: ['常用'], usedBy: 4, lastRun: '5 分钟前', status: 'stable', success: 98.2 },
      { id: 'i-move-chrome', name: 'Chrome 移到副屏左半', params: { op: 'move', monitor: 1, rect: '0,0,0.5,1', selector: { strategy: 'process', process: 'chrome.exe', title: 'GitHub', titleMatch: 'contains', className: '', match: 'error' } }, tags: ['多屏'], usedBy: 3, lastRun: '1 小时前', status: 'stable', success: 95.2 },
      { id: 'i-topmost', name: '当前窗口置顶切换', params: { op: 'topmost', mode: 'toggle', selector: { strategy: 'foreground', process: '', title: '', titleMatch: 'contains', className: '', match: 'error' } }, tags: ['窗口'], usedBy: 6, lastRun: '20 分钟前', status: 'stable', success: 99.1 },
      { id: 'i-close-explorer', name: '关闭所有资源管理器', params: { op: 'close', match: 'all', selector: { strategy: 'class', process: '', title: '', titleMatch: 'contains', className: 'CabinetWClass', match: 'all' } }, tags: ['危险'], usedBy: 1, lastRun: '昨天', status: 'draft', success: 92.0 }
    ]
  },
  {
    id: 'win.window.query', name: '查询窗口', family: 'window', version: '1.0.0',
    status: 'stable', p0: true, official: true, usedBy: 9, success: 99.0, updated: '2026-11-12',
    desc: '只读查询顶层窗口，返回 WindowInfo[]；用于选择器测试、批量操作前预览。',
    permissions: ['window.read'], sideEffects: ['read'],
    instances: [
      { id: 'i-list-windows', name: '列出可见窗口', params: { limit: 50, sort: 'z_order', selector: { strategy: 'foreground', process: '', title: '', titleMatch: 'contains', className: '', match: 'all' } }, tags: ['调试'], usedBy: 5, lastRun: '刚刚', status: 'stable', success: 99.8 },
      { id: 'i-foreground', name: '当前前台窗口', params: { limit: 1, sort: 'z_order', selector: { strategy: 'foreground', process: '', title: '', titleMatch: 'contains', className: '', match: 'first' } }, tags: ['常用'], usedBy: 4, lastRun: '刚刚', status: 'stable', success: 99.9 }
    ]
  },
  {
    id: 'win.open', name: '打开目标', family: 'open', version: '1.1.0',
    status: 'stable', p0: true, official: true, usedBy: 14, success: 97.6, updated: '2026-11-19',
    desc: '一个类覆盖文件、文件夹、应用、URL；kind 参数决定解析路径与默认处理器。',
    permissions: ['open.path', 'open.app', 'open.url'], sideEffects: ['write'],
    instances: [
      { id: 'i-open-downloads', name: '打开下载文件夹', params: { kind: 'folder', target: '%USERPROFILE%\\Downloads', app: '', args: '' }, tags: ['常用'], usedBy: 6, lastRun: '10 分钟前', status: 'stable', success: 99.5 },
      { id: 'i-open-github', name: '打开 GitHub', params: { kind: 'url', target: 'https://github.com', app: '', args: '' }, tags: ['网页'], usedBy: 3, lastRun: '昨天', status: 'stable', success: 99.2 },
      { id: 'i-open-project', name: '用 VS Code 打开项目', params: { kind: 'folder', target: 'C:\\project', app: 'code.exe', args: '.' }, tags: ['开发'], usedBy: 5, lastRun: '2 小时前', status: 'stable', success: 96.8 }
    ]
  },
  {
    id: 'win.audio.volume', name: '控制系统音量', family: 'settings', version: '1.0.0',
    status: 'stable', p0: true, official: true, usedBy: 11, success: 99.3, updated: '2026-11-16',
    desc: '主音量与静音控制；action 参数覆盖 up/down/set/mute/toggle。应用音量放 P1。',
    permissions: ['settings.audio.write'], sideEffects: ['write'],
    instances: [
      { id: 'i-vol-up', name: '音量 +5', params: { action: 'up', step: 5, level: 50, app: '' }, tags: ['音量'], usedBy: 5, lastRun: '刚刚', status: 'stable', success: 99.8 },
      { id: 'i-vol-toggle', name: '静音切换', params: { action: 'toggle', step: 5, level: 50, app: '' }, tags: ['音量'], usedBy: 4, lastRun: '30 分钟前', status: 'stable', success: 99.9 },
      { id: 'i-vol-30', name: '设 30%', params: { action: 'set', step: 5, level: 30, app: '' }, tags: ['音量'], usedBy: 2, lastRun: '昨天', status: 'stable', success: 99.6 }
    ]
  },
  {
    id: 'win.display.brightness', name: '控制亮度', family: 'settings', version: '0.9.0',
    status: 'draft', p0: true, official: true, usedBy: 5, success: 94.2, updated: '2026-11-20',
    desc: '内屏走 WMI、外屏走 DDC/CI；不支持时明确失败，不用假值。',
    permissions: ['settings.display.brightness'], sideEffects: ['write'],
    instances: [
      { id: 'i-bright-60', name: '内屏亮度 60%', params: { action: 'set', value: 60, step: 10, monitor: 'internal', method: 'auto' }, tags: ['亮度'], usedBy: 3, lastRun: '1 小时前', status: 'stable', success: 96.5 },
      { id: 'i-bright-up', name: '亮度 +10', params: { action: 'up', value: 60, step: 10, monitor: 'internal', method: 'auto' }, tags: ['亮度'], usedBy: 2, lastRun: '昨天', status: 'draft', success: 91.0 }
    ]
  },
  {
    id: 'win.theme.mode', name: '深浅主题', family: 'settings', version: '1.0.0',
    status: 'stable', p0: true, official: true, usedBy: 8, success: 98.4, updated: '2026-11-15',
    desc: '写 AppsUseLightTheme / SystemUsesLightTheme 并广播 ImmersiveColorSet；部分应用需重启。',
    permissions: ['settings.theme'], sideEffects: ['write'],
    instances: [
      { id: 'i-dark', name: '深色模式', params: { action: 'set', mode: 'dark', scope: 'both' }, tags: ['主题'], usedBy: 5, lastRun: '昨天', status: 'stable', success: 99.0 },
      { id: 'i-light-apps', name: '应用浅色', params: { action: 'set', mode: 'light', scope: 'apps' }, tags: ['主题'], usedBy: 3, lastRun: '3 天前', status: 'stable', success: 97.2 }
    ]
  },
  {
    id: 'win.ocr.read', name: 'OCR 识别', family: 'capture', version: '1.1.0',
    status: 'stable', p0: true, official: true, usedBy: 16, success: 96.8, updated: '2026-11-18',
    desc: '从图片/截图提取文字；优先 Windows AI OCR，语言不支持时回退 PaddleOCR。',
    permissions: ['screen.capture'], sideEffects: ['read'],
    instances: [
      { id: 'i-ocr-auto', name: '截图转文字', params: { image: '$screenshot', lang: 'auto', layout: true }, tags: ['OCR'], usedBy: 9, lastRun: '刚刚', status: 'stable', success: 97.5 },
      { id: 'i-ocr-en', name: '英文截图', params: { image: '$screenshot', lang: 'en', layout: false }, tags: ['OCR'], usedBy: 4, lastRun: '1 小时前', status: 'stable', success: 96.0 }
    ]
  },
  {
    id: 'win.clipboard.get', name: '读取剪贴板', family: 'file', version: '1.0.0',
    status: 'stable', p0: true, official: true, usedBy: 10, success: 99.5, updated: '2026-11-11',
    desc: '读取文本/图片/文件列表；format 参数决定输出类型。',
    permissions: ['clipboard.read'], sideEffects: ['read'],
    instances: [
      { id: 'i-clip-text', name: '取文本', params: { format: 'text' }, tags: ['剪贴板'], usedBy: 7, lastRun: '刚刚', status: 'stable', success: 99.7 },
      { id: 'i-clip-image', name: '取图片', params: { format: 'image' }, tags: ['剪贴板'], usedBy: 3, lastRun: '昨天', status: 'stable', success: 98.9 }
    ]
  },
  {
    id: 'win.http.request', name: 'HTTP 请求', family: 'network', version: '1.0.0',
    status: 'stable', p0: true, official: true, usedBy: 7, success: 97.8, updated: '2026-11-14',
    desc: '统一 GET/POST/PUT/DELETE，带超时、重试、SSRF 防护和响应大小限制。',
    permissions: ['net.http'], sideEffects: ['read', 'write'],
    instances: [
      { id: 'i-http-github', name: 'GET GitHub API', params: { method: 'GET', url: 'https://api.github.com/repos/owner/repo', body: '' }, tags: ['API'], usedBy: 4, lastRun: '2 小时前', status: 'stable', success: 98.6 },
      { id: 'i-http-webhook', name: 'POST Webhook', params: { method: 'POST', url: 'https://example.com/hook', body: '{"event":"done"}' }, tags: ['API'], usedBy: 3, lastRun: '昨天', status: 'draft', success: 94.0 }
    ]
  },
  {
    id: 'ui.form', name: '用户表单', family: 'human', version: '0.8.0',
    status: 'draft', p0: true, official: true, usedBy: 4, success: 97.0, updated: '2026-11-21',
    desc: 'JSON Schema 驱动的表单；取消/超时返回明确状态，审批是 gate 不是这个类。',
    permissions: [], sideEffects: ['read'],
    instances: [
      { id: 'i-form-confirm', name: '发布确认', params: { title: '确认发布', fields: '备注, 版本号' }, tags: ['交互'], usedBy: 4, lastRun: '今天', status: 'draft', success: 96.4 }
    ]
  }
];

/* ---------- helpers ---------- */
const LS_KEY = 'baiying.atomCatalog.v1';
const THEME_KEY = 'baiying.atomCatalog.theme';
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const clone = (v) => JSON.parse(JSON.stringify(v));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const familyById = (id) => FAMILIES.find((f) => f.id === id) || FAMILIES[0];
const classById = (id) => data.find((c) => c.id === id);
const instanceById = (classId, instanceId) => classById(classId)?.instances.find((i) => i.id === instanceId);
const statusLabel = (s) => ({ stable: 'stable', draft: 'draft', deprecated: 'deprecated', archived: 'archived' }[s] || s || 'stable');

function deepClone(v) { return JSON.parse(JSON.stringify(v)); }
function loadData() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return deepClone(SEED);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return deepClone(SEED);
    return parsed;
  } catch (_) { return deepClone(SEED); }
}
function saveData() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch (_) {}
}
let data = loadData();
const state = {
  family: 'all',
  filter: 'all',
  query: '',
  view: 'cards',
  selected: null,
  expanded: new Set([data[0]?.id].filter(Boolean)),
  recording: false
};

function setPath(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (typeof cur[k] !== 'object' || cur[k] === null) cur[k] = {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
}
function getPath(obj, path) {
  return path.split('.').reduce((cur, k) => (cur == null ? undefined : cur[k]), obj);
}
function shortUrl(url) {
  if (!url) return '';
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '').slice(0, 30);
}
function selectorSummary(sel = {}) {
  if (!sel || typeof sel !== 'object') return 'foreground';
  if (sel.strategy === 'foreground') return 'foreground';
  const bits = [];
  if (sel.process) bits.push(`process:${sel.process}`);
  if (sel.className) bits.push(`class:${sel.className}`);
  if (sel.title) bits.push(`title~${sel.title}`);
  if (!bits.length) return sel.strategy || 'foreground';
  return bits.join(' · ');
}
function paramSummary(cls, p = {}) {
  switch (cls.id) {
    case 'win.key.send': return `${p.keys || '—'} · ${p.mode || 'press'}${p.repeat > 1 ? ` ×${p.repeat}` : ''}`;
    case 'win.key.trigger': return `${p.keys || '—'} · ${p.scope || 'global'}`;
    case 'win.window.control': return `${p.op || 'focus'} · ${selectorSummary(p.selector)}`;
    case 'win.window.query': return `${selectorSummary(p.selector)} · limit ${p.limit ?? 20}`;
    case 'win.open': return `${p.kind || 'auto'} · ${p.target || '—'}${p.app ? ` · ${p.app}` : ''}`;
    case 'win.audio.volume': return `${p.action || 'toggle'}${p.level != null ? ` ${p.level}%` : ''}${p.step ? ` +${p.step}` : ''}${p.app ? ` · ${p.app}` : ''}`;
    case 'win.display.brightness': return `${p.action || 'set'} ${p.value ?? ''}${p.monitor ? ` · ${p.monitor}` : ''}`;
    case 'win.theme.mode': return `${p.mode || 'dark'} · ${p.scope || 'both'}`;
    case 'win.ocr.read': return `${p.lang || 'auto'}${p.layout ? ' · layout' : ''}`;
    case 'win.clipboard.get': return `${p.format || 'text'}`;
    case 'win.http.request': return `${p.method || 'GET'} ${shortUrl(p.url)}`;
    case 'ui.form': return p.title || '表单';
    default: return JSON.stringify(p).slice(0, 52);
  }
}
function classSchema(cls) {
  const p = cls.instances[0]?.params || {};
  const properties = {};
  Object.keys(p).forEach((k) => {
    const v = p[k];
    properties[k] = { type: v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v };
  });
  return { type: 'object', properties, required: Object.keys(properties) };
}
function defaultParams(classId) {
  switch (classId) {
    case 'win.key.send': return { keys: 'Ctrl+Shift+K', mode: 'press', repeat: 1 };
    case 'win.key.trigger': return { keys: 'Ctrl+Alt+K', scope: 'global' };
    case 'win.window.control': return { op: 'focus', selector: { strategy: 'foreground', process: '', title: '', titleMatch: 'contains', className: '', match: 'error' } };
    case 'win.window.query': return { limit: 20, sort: 'z_order', selector: { strategy: 'foreground', process: '', title: '', titleMatch: 'contains', className: '', match: 'all' } };
    case 'win.open': return { kind: 'folder', target: '%USERPROFILE%\\Downloads', app: '', args: '' };
    case 'win.audio.volume': return { action: 'toggle', step: 5, level: 50, app: '' };
    case 'win.display.brightness': return { action: 'set', value: 60, step: 10, monitor: 'internal', method: 'auto' };
    case 'win.theme.mode': return { action: 'set', mode: 'dark', scope: 'both' };
    case 'win.ocr.read': return { image: '$screenshot', lang: 'auto', layout: true };
    case 'win.clipboard.get': return { format: 'text' };
    case 'win.http.request': return { method: 'GET', url: 'https://example.com', body: '' };
    case 'ui.form': return { title: '确认操作', fields: '备注' };
    default: return {};
  }
}
function avgSuccess() {
  const all = data.flatMap((c) => c.instances).filter((i) => i.status !== 'archived');
  if (!all.length) return '—';
  return (all.reduce((a, i) => a + (Number(i.success) || 0), 0) / all.length).toFixed(1) + '%';
}
function totalInstances() { return data.reduce((n, c) => n + c.instances.length, 0); }
function activeInstances() { return data.flatMap((c) => c.instances).filter((i) => i.status !== 'archived').length; }
function selectedInstance() {
  if (!state.selected || state.selected.type !== 'instance') return null;
  return instanceById(state.selected.classId, state.selected.instanceId);
}
function selectedClass() {
  if (!state.selected) return null;
  return classById(state.selected.classId);
}
/* ---------- filtering ---------- */
function classMatchesQuery(c) {
  const q = state.query.trim().toLowerCase();
  if (!q) return true;
  const hay = [c.name, c.id, c.desc, familyById(c.family).name, ...(c.permissions || [])].join(' ').toLowerCase();
  return hay.includes(q);
}
function instanceMatchesQuery(c, i) {
  const q = state.query.trim().toLowerCase();
  if (!q) return true;
  const hay = [i.name, i.id, paramSummary(c, i.params), ...(i.tags || []), JSON.stringify(i.params)].join(' ').toLowerCase();
  return hay.includes(q);
}
function visibleInstances(c) {
  let list = c.instances.slice();
  if (state.filter === 'archived') list = list.filter((i) => i.status === 'archived');
  else list = list.filter((i) => i.status !== 'archived');
  if (state.filter === 'draft') list = list.filter((i) => i.status === 'draft');
  if (state.query.trim()) {
    if (!classMatchesQuery(c)) list = list.filter((i) => instanceMatchesQuery(c, i));
  }
  return list;
}
function filteredClasses() {
  let list = data.slice();
  if (state.family !== 'all') list = list.filter((c) => c.family === state.family);
  if (state.filter === 'p0') list = list.filter((c) => c.p0);
  if (state.filter === 'draft') list = list.filter((c) => c.status === 'draft' || c.instances.some((i) => i.status === 'draft'));
  if (state.filter === 'archived') list = list.filter((c) => c.status === 'archived' || c.instances.some((i) => i.status === 'archived'));
  if (state.filter === 'all') list = list.filter((c) => c.status !== 'archived');
  if (state.query.trim()) list = list.filter((c) => classMatchesQuery(c) || c.instances.some((i) => instanceMatchesQuery(c, i)));
  return list;
}

/* ---------- render: chrome ---------- */
function renderSidebar() {
  const total = data.filter((c) => c.status !== 'archived').length;
  const all = `<button class="family-item ${state.family === 'all' ? 'active' : ''}" data-family="all">
      <span class="ficon" style="--c:#3B82F6">◈</span><span>全部</span><span class="fcount">${total}</span>
    </button>`;
  const items = FAMILIES.map((f) => {
    const count = data.filter((c) => c.family === f.id && c.status !== 'archived').length;
    return `<button class="family-item ${state.family === f.id ? 'active' : ''}" data-family="${f.id}">
      <span class="ficon" style="--c:${f.color}">${f.icon}</span><span>${f.name}</span><span class="fcount">${count}</span>
    </button>`;
  }).join('');
  $('#familyNav').innerHTML = all + items;
  $$('#savedViews button').forEach((b) => b.classList.toggle('active', b.dataset.filter === state.filter));
}

function renderStats() {
  const p0 = data.filter((c) => c.p0 && c.status !== 'archived').length;
  const stats = [
    ['原子类', data.filter((c) => c.status !== 'archived').length, '个类 · 版本化'],
    ['实例', activeInstances(), `共 ${totalInstances()} 个 · 含归档`],
    ['P0 核心', p0, '首批交付范围'],
    ['平均成功率', avgSuccess(), '实例运行统计']
  ];
  $('#stats').innerHTML = stats.map(([label, value, hint]) => `
    <div class="stat"><div class="label">${label}</div><div class="value">${value}</div><div class="hint">${hint}</div></div>
  `).join('');
}

function renderChips() {
  const fam = state.family === 'all' ? '全部家族' : familyById(state.family).name;
  const filterLabel = { all: '全部', p0: 'P0 核心', draft: '草稿', archived: '已归档' }[state.filter] || state.filter;
  const chips = [`<span class="chip active">${esc(fam)}</span>`, `<span class="chip active">${filterLabel}</span>`];
  if (state.query.trim()) chips.push(`<span class="chip active">搜索：${esc(state.query.trim())}</span>`);
  $('#filterChips').innerHTML = chips.join('');
}

function renderContent() {
  const list = filteredClasses();
  const fam = state.family === 'all' ? '全部功能家族' : familyById(state.family).name;
  $('#pageTitle').textContent = state.family === 'all' ? '类与实例' : fam;
  $('#pageSub').textContent = `${list.length} 个类 · ${list.reduce((n, c) => n + visibleInstances(c).length, 0)} 个可见实例 · 点类或实例打开 Inspector`;
  if (!list.length) {
    $('#content').innerHTML = `<div class="empty"><strong>没有匹配的类或实例</strong>试试清空搜索、切换家族，或新建一个实例。</div>`;
    return;
  }
  if (state.view === 'table') $('#content').innerHTML = renderTable(list);
  else if (state.view === 'graph') $('#content').innerHTML = renderGraph(list);
  else $('#content').innerHTML = list.map(renderClassCard).join('');
}

/* ---------- render: cards ---------- */
function badge(status) {
  return `<span class="badge ${status}">${statusLabel(status)}</span>`;
}
function renderClassCard(c) {
  const fam = familyById(c.family);
  const instances = visibleInstances(c);
  const rows = instances.map((i) => {
    const selected = state.selected?.type === 'instance' && state.selected.instanceId === i.id;
    return `<tr class="instance-row ${selected ? 'selected' : ''}" data-class="${c.id}" data-instance="${i.id}">
      <td><div class="instance-name"><span class="dot ${i.status}"></span>${esc(i.name)}</div><div class="muted mono" style="font-size:9px;margin-left:14px">${esc(i.id)}</div></td>
      <td><span class="param" title="${esc(JSON.stringify(i.params))}">${esc(paramSummary(c, i.params))}</span></td>
      <td class="muted">${i.usedBy ?? 0}</td>
      <td class="muted">${esc(i.lastRun || '未运行')}</td>
      <td>${badge(i.status)}</td>
      <td><div class="row-actions">
        <button class="mini-btn" data-action="run" data-class="${c.id}" data-instance="${i.id}" title="运行测试">▶</button>
        <button class="mini-btn" data-action="edit" data-class="${c.id}" data-instance="${i.id}" title="编辑">✎</button>
        <button class="mini-btn" data-action="duplicate" data-class="${c.id}" data-instance="${i.id}" title="复制">⧉</button>
        <button class="mini-btn" data-action="${i.status === 'archived' ? 'restore' : 'archive'}" data-class="${c.id}" data-instance="${i.id}" title="${i.status === 'archived' ? '恢复' : '归档'}">${i.status === 'archived' ? '↺' : '⌫'}</button>
      </div></td>
    </tr>`;
  }).join('');
  return `<article class="class-card" data-class="${c.id}">
    <div class="class-head" data-class="${c.id}">
      <div class="class-icon" style="--c:${fam.color}">${fam.icon}</div>
      <div class="class-main">
        <div class="class-title-row">
          <span class="class-title">${esc(c.name)}</span>
          ${badge(c.status)}
          ${c.p0 ? '<span class="badge p0">P0</span>' : ''}
          ${c.official ? '<span class="badge official">official</span>' : ''}
          <span class="badge">v${esc(c.version)}</span>
        </div>
        <div class="class-id">${esc(c.id)}</div>
        <div class="class-desc">${esc(c.desc)}</div>
      </div>
      <div class="class-meta">
        <div class="meta-block"><div class="m">${c.instances.filter((i) => i.status !== 'archived').length}</div><div class="l">实例</div></div>
        <div class="meta-block"><div class="m">${c.usedBy ?? 0}</div><div class="l">被引用</div></div>
        <div class="meta-block"><div class="m">${c.success ?? '—'}%</div><div class="l">成功率</div></div>
      </div>
    </div>
    <table class="instance-table">
      <thead><tr><th>实例</th><th>参数摘要</th><th>引用</th><th>最近运行</th><th>状态</th><th></th></tr></thead>
      <tbody>${rows || `<tr><td colspan="6" class="muted" style="padding:16px">这个类还没有实例。</td></tr>`}</tbody>
    </table>
  </article>`;
}

/* ---------- render: table ---------- */
function renderTable(list) {
  const head = `<thead><tr><th>类 / 实例</th><th>家族</th><th>版本 / 参数</th><th>状态</th><th>引用</th><th>成功率</th><th></th></tr></thead>`;
  const body = list.map((c) => {
    const fam = familyById(c.family);
    const expanded = state.expanded.has(c.id);
    const instances = visibleInstances(c);
    const classRow = `<tr class="class-row" data-class-row="${c.id}">
      <td><span class="chev ${expanded ? 'open' : ''}">▸</span> <span style="color:${fam.color}">${fam.icon}</span> <strong>${esc(c.name)}</strong> <span class="muted mono" style="font-size:9px">${esc(c.id)}</span></td>
      <td class="muted">${fam.name}</td>
      <td class="muted">v${esc(c.version)} · ${c.instances.filter((i) => i.status !== 'archived').length} 个实例</td>
      <td>${badge(c.status)}${c.p0 ? ' <span class="badge p0">P0</span>' : ''}</td>
      <td class="muted">${c.usedBy ?? 0}</td>
      <td class="muted">${c.success ?? '—'}%</td>
      <td><button class="mini-btn" data-action="new-instance" data-class="${c.id}" title="新建实例">＋</button></td>
    </tr>`;
    const instRows = expanded ? instances.map((i) => `<tr class="instance-row" data-class="${c.id}" data-instance="${i.id}">
      <td><span class="muted" style="margin-right:8px">└</span><span class="dot ${i.status}" style="display:inline-block;margin-right:7px"></span>${esc(i.name)}</td>
      <td class="muted">${esc(paramSummary(c, i.params))}</td>
      <td>${badge(i.status)}</td>
      <td class="muted">${i.usedBy ?? 0}</td>
      <td class="muted">${esc(i.lastRun || '未运行')}</td>
      <td class="muted">${i.success ?? '—'}%</td>
      <td><div class="row-actions" style="opacity:1">
        <button class="mini-btn" data-action="run" data-class="${c.id}" data-instance="${i.id}">▶</button>
        <button class="mini-btn" data-action="edit" data-class="${c.id}" data-instance="${i.id}">✎</button>
      </div></td>
    </tr>`).join('') : '';
    return classRow + instRows;
  }).join('');
  return `<table class="catalog-table">${head}<tbody>${body}</tbody></table>`;
}

/* ---------- render: graph ---------- */
function renderGraph(list) {
  return list.map((c) => {
    const fam = familyById(c.family);
    const instances = visibleInstances(c);
    return `<div class="graph-row">
      <div class="graph-class" data-class="${c.id}" style="--c:${fam.color}">
        <div class="g-icon">${fam.icon}</div>
        <div class="g-title">${esc(c.name)}</div>
        <div class="g-id">${esc(c.id)} · v${esc(c.version)}</div>
        <div style="margin-top:8px">${badge(c.status)} ${c.p0 ? '<span class="badge p0">P0</span>' : ''}</div>
      </div>
      <div class="graph-connector"></div>
      <div class="graph-instances">
        ${instances.length ? instances.map((i) => `<button class="graph-instance" data-class="${c.id}" data-instance="${i.id}">
          <span class="dot ${i.status}"></span>${esc(i.name)}<span class="pi">${esc(paramSummary(c, i.params))}</span>
        </button>`).join('') : '<span class="muted" style="font-size:11px">这个类还没有可见实例</span>'}
      </div>
    </div>`;
  }).join('');
}

/* ---------- render: inspector ---------- */
function field(label, path, value, attrs = '') {
  return `<div class="field"><label>${label}</label><input class="input" data-field="${path}" value="${esc(value ?? '')}" ${attrs}></div>`;
}
function numberField(label, path, value, attrs = '') {
  return field(label, path, value, `type="number" data-type="number" ${attrs}`);
}
function selectField(label, path, value, options) {
  return `<div class="field"><label>${label}</label><select data-field="${path}">${options.map((o) => {
    const v = typeof o === 'string' ? o : o[0];
    const t = typeof o === 'string' ? o : o[1];
    return `<option value="${esc(v)}" ${String(value) === String(v) ? 'selected' : ''}>${esc(t)}</option>`;
  }).join('')}</select></div>`;
}
function textareaField(label, path, value, attrs = '') {
  return `<div class="field"><label>${label}</label><textarea data-field="${path}" ${attrs}>${esc(value ?? '')}</textarea></div>`;
}
function checkboxField(label, path, checked) {
  return `<div class="field" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" data-field="${path}" data-type="boolean" ${checked ? 'checked' : ''}><label style="margin:0">${label}</label></div>`;
}
function keyChips(keys) {
  if (!keys) return '';
  return `<div class="key-chips">${String(keys).split('+').map((k) => `<span class="key-chip">${esc(k)}</span>`).join('')}</div>`;
}

function renderInstanceForm(c, i) {
  const p = i.params || {};
  const sel = p.selector || {};
  const keyInput = `<div class="field"><label>组合键</label><div class="key-capture">
      <input class="input" id="hotkeyInput" data-field="keys" value="${esc(p.keys || '')}" placeholder="点击录制，或手动输入 Ctrl+C">
      <button class="btn" data-action="record" type="button">${state.recording ? '录制中…' : '● 录制'}</button>
    </div>${state.recording ? '<div class="muted" style="font-size:10px;margin-top:6px">请按下组合键；Esc 取消，Backspace 清除。</div>' : keyChips(p.keys)}</div>`;

  if (c.id === 'win.key.send') {
    return keyInput
      + `<div class="field-row">${selectField('按键方式', 'mode', p.mode || 'press', ['press', 'down', 'up'])}${numberField('重复次数', 'repeat', p.repeat ?? 1, 'min="1"')}</div>`;
  }
  if (c.id === 'win.key.trigger') {
    return keyInput + selectField('作用域', 'scope', p.scope || 'global', [['global', '全局'], ['app', '当前应用']]);
  }
  if (c.id === 'win.window.control') {
    return selectField('操作', 'op', p.op || 'focus', ['focus', 'move', 'resize', 'minimize', 'maximize', 'restore', 'topmost', 'close'])
      + `<div class="field-row">${selectField('选择策略', 'selector.strategy', sel.strategy || 'foreground', ['foreground', 'process', 'class', 'title', 'under_cursor'])}${field('进程名', 'selector.process', sel.process || '', 'placeholder="chrome.exe"')}</div>`
      + `<div class="field-row">${field('标题包含', 'selector.title', sel.title || '', 'placeholder="GitHub"')}${selectField('标题匹配', 'selector.titleMatch', sel.titleMatch || 'contains', ['contains', 'exact', 'regex'])}</div>`
      + `<div class="field-row">${field('窗口类', 'selector.className', sel.className || '', 'placeholder="CabinetWClass"')}${selectField('多匹配策略', 'selector.match', sel.match || 'error', ['error', 'first', 'last', 'all'])}</div>`
      + `<div class="field-row">${field('目标显示器', 'monitor', p.monitor ?? '', 'placeholder="1" data-type="number"')}${field('矩形 x,y,w,h', 'rect', p.rect || '', 'placeholder="0,0,0.5,1"')}</div>`;
  }
  if (c.id === 'win.window.query') {
    return `<div class="field-row">${selectField('选择策略', 'selector.strategy', sel.strategy || 'foreground', ['foreground', 'process', 'class', 'title', 'under_cursor'])}${numberField('数量上限', 'limit', p.limit ?? 20, 'min="1"')}</div>`
      + selectField('排序', 'sort', p.sort || 'z_order', [['z_order', 'Z 顺序'], ['title', '标题'], ['process', '进程']])
      + `<div class="field-row">${field('进程名', 'selector.process', sel.process || '')}${field('窗口类', 'selector.className', sel.className || '')}</div>`;
  }
  if (c.id === 'win.open') {
    return selectField('目标类型', 'kind', p.kind || 'folder', [['auto', '自动'], ['file', '文件'], ['folder', '文件夹'], ['app', '软件'], ['url', 'URL']])
      + field('目标', 'target', p.target || '', 'placeholder="C:\\path 或 https://..."')
      + `<div class="field-row">${field('指定应用（可选）', 'app', p.app || '', 'placeholder="code.exe"')}${field('参数（逗号分隔）', 'args', Array.isArray(p.args) ? p.args.join(', ') : (p.args || ''), 'data-type="array"')}</div>`;
  }
  if (c.id === 'win.audio.volume') {
    return `<div class="field-row">${selectField('动作', 'action', p.action || 'toggle', ['up', 'down', 'set', 'mute', 'unmute', 'toggle'])}${numberField('步长', 'step', p.step ?? 5, 'min="1" max="100"')}</div>`
      + `<div class="field-row">${numberField('目标音量 %', 'level', p.level ?? 50, 'min="0" max="100"')}${field('应用（可选）', 'app', p.app || '', 'placeholder="cloudmusic.exe"')}</div>`;
  }
  if (c.id === 'win.display.brightness') {
    return `<div class="field-row">${selectField('动作', 'action', p.action || 'set', ['up', 'down', 'set'])}${numberField('目标亮度 %', 'value', p.value ?? 60, 'min="0" max="100"')}</div>`
      + `<div class="field-row">${selectField('显示器', 'monitor', p.monitor || 'internal', [['internal', '内屏'], ['external', '外屏'], ['all', '全部']])}${selectField('方式', 'method', p.method || 'auto', ['auto', 'wmi', 'ddc'])}</div>`;
  }
  if (c.id === 'win.theme.mode') {
    return `<div class="field-row">${selectField('动作', 'action', p.action || 'set', ['set', 'toggle'])}${selectField('模式', 'mode', p.mode || 'dark', ['dark', 'light'])}</div>`
      + selectField('范围', 'scope', p.scope || 'both', [['both', '系统 + 应用'], ['apps', '仅应用'], ['system', '仅系统']]);
  }
  if (c.id === 'win.ocr.read') {
    return field('图片 Artifact', 'image', p.image || '$screenshot', 'placeholder="$screenshot"')
      + `<div class="field-row">${selectField('语言', 'lang', p.lang || 'auto', ['auto', 'zh', 'en', 'ja'])}${checkboxField('输出布局 blocks', 'layout', !!p.layout)}</div>`;
  }
  if (c.id === 'win.clipboard.get') {
    return selectField('格式', 'format', p.format || 'text', [['text', '文本'], ['image', '图片'], ['files', '文件列表'], ['html', 'HTML']]);
  }
  if (c.id === 'win.http.request') {
    return `<div class="field-row">${selectField('方法', 'method', p.method || 'GET', ['GET', 'POST', 'PUT', 'DELETE'])}${field('URL', 'url', p.url || '', 'placeholder="https://..."')}</div>`
      + textareaField('Body', 'body', p.body || '', 'placeholder="{...}"');
  }
  if (c.id === 'ui.form') {
    return field('标题', 'title', p.title || '')
      + textareaField('字段（逗号/换行分隔）', 'fields', Array.isArray(p.fields) ? p.fields.join(', ') : (p.fields || ''), 'data-type="lines"');
  }
  return `<pre class="json">${esc(JSON.stringify(p, null, 2))}</pre>`;
}

function renderInspector() {
  const box = $('#inspector');
  if (!state.selected) {
    box.classList.remove('open');
    box.innerHTML = `<div class="inspector-empty"><div class="big">◇</div><strong>Inspector</strong><br>点击左侧的类或实例，查看契约、参数和实例。</div>`;
    return;
  }
  const c = selectedClass();
  if (!c) { state.selected = null; renderInspector(); return; }
  const fam = familyById(c.family);
  if (state.selected.type === 'class') {
    const instances = c.instances;
    box.classList.add('open');
    box.innerHTML = `
      <div class="inspector-head">
        <div>
          <div class="inspector-kicker">原子类 · CLASS</div>
          <div class="inspector-title">${esc(c.name)}</div>
          <div class="inspector-id">${esc(c.id)} · v${esc(c.version)}</div>
        </div>
        <button class="btn icon ghost close" data-action="close-inspector" aria-label="关闭">✕</button>
      </div>
      <div class="class-title-row">${badge(c.status)}${c.p0 ? '<span class="badge p0">P0</span>' : ''}${c.official ? '<span class="badge official">official</span>' : ''}<span class="badge">${fam.name}</span></div>
      <div class="class-desc" style="margin-top:10px">${esc(c.desc)}</div>
      <div class="section"><div class="section-title">契约</div>
        <div class="kv">
          <span class="k">权限</span><span class="v mono">${esc((c.permissions || []).join(', ') || '—')}</span>
          <span class="k">副作用</span><span class="v mono">${esc((c.sideEffects || []).join(', ') || '—')}</span>
          <span class="k">实例数</span><span class="v">${c.instances.length}</span>
          <span class="k">被引用</span><span class="v">${c.usedBy ?? 0}</span>
          <span class="k">成功率</span><span class="v">${c.success ?? '—'}%</span>
          <span class="k">更新时间</span><span class="v muted">${esc(c.updated || '—')}</span>
        </div>
      </div>
      <div class="section"><div class="section-title">参数 Schema（示例）</div><pre class="json">${esc(JSON.stringify(classSchema(c), null, 2))}</pre></div>
      <div class="section"><div class="section-title">实例 · ${instances.length}</div>
        ${instances.map((i) => `<div class="instance-row" data-class="${c.id}" data-instance="${i.id}" style="padding:8px 0;border-top:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:8px"><span class="dot ${i.status}"></span><strong style="font-size:12px">${esc(i.name)}</strong><span class="badge ${i.status}" style="margin-left:auto">${statusLabel(i.status)}</span></div>
          <div class="muted mono" style="font-size:9px;margin-top:3px">${esc(paramSummary(c, i.params))}</div>
        </div>`).join('') || '<div class="muted" style="font-size:11px">暂无实例。</div>'}
      </div>
      <div class="inspector-actions">
        <button class="btn primary" data-action="new-instance" data-class="${c.id}">＋ 新建实例</button>
        <button class="btn" data-action="edit-class" data-class="${c.id}">编辑类</button>
        <button class="btn danger" data-action="archive-class" data-class="${c.id}">归档类</button>
      </div>`;
    return;
  }

  const i = instanceById(c.id, state.selected.instanceId);
  if (!i) { state.selected = null; renderInspector(); return; }
  box.classList.add('open');
  box.innerHTML = `
    <div class="inspector-head">
      <div>
        <div class="inspector-kicker">实例 · INSTANCE</div>
        <div class="inspector-title">${esc(i.name)}</div>
        <div class="inspector-id">${esc(i.id)} · ${esc(c.id)}@${esc(c.version)}</div>
      </div>
      <button class="btn icon ghost close" data-action="close-inspector" aria-label="关闭">✕</button>
    </div>
    <div class="class-title-row">${badge(i.status)}<span class="badge">${esc(c.name)}</span><button class="badge" data-action="jump-class" data-class="${c.id}" style="cursor:pointer">查看类 →</button></div>
    <div class="section"><div class="section-title">参数 · ${esc(c.name)}</div>${renderInstanceForm(c, i)}</div>
    <div class="section"><div class="section-title">参数预览</div><pre class="json">${esc(JSON.stringify(i.params, null, 2))}</pre></div>
    <div class="section"><div class="section-title">运行与引用</div>
      <div class="kv">
        <span class="k">被引用</span><span class="v">${i.usedBy ?? 0}</span>
        <span class="k">最近运行</span><span class="v">${esc(i.lastRun || '未运行')}</span>
        <span class="k">成功率</span><span class="v">${i.success ?? '—'}%</span>
        <span class="k">revision</span><span class="v">${i.revision ?? 1}</span>
      </div>
    </div>
    <div class="inspector-actions">
      <button class="btn primary" data-action="save-instance" data-class="${c.id}" data-instance="${i.id}">保存</button>
      <button class="btn" data-action="run" data-class="${c.id}" data-instance="${i.id}">▶ 运行测试</button>
      <button class="btn" data-action="duplicate" data-class="${c.id}" data-instance="${i.id}">⧉ 复制</button>
      <button class="btn ${i.status === 'archived' ? '' : 'danger'}" data-action="${i.status === 'archived' ? 'restore' : 'archive'}" data-class="${c.id}" data-instance="${i.id}">${i.status === 'archived' ? '↺ 恢复' : '⌫ 归档'}</button>
    </div>`;
}
/* ---------- interactions ---------- */
let toastTimer = null;
let recordHandler = null;
let modalConfirmAction = null;

function showToast(message, type = 'success') {
  const t = $('#toast');
  if (!t) return;
  t.innerHTML = `<span class="t-dot" style="background:${type === 'error' ? 'var(--danger)' : 'var(--success)'}"></span>${esc(message)}`;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}
function renderAll() {
  renderSidebar();
  renderStats();
  renderChips();
  renderContent();
  renderInspector();
}
function selectClass(classId) {
  state.selected = { type: 'class', classId };
  renderContent();
  renderInspector();
}
function selectInstance(classId, instanceId) {
  state.selected = { type: 'instance', classId, instanceId };
  renderContent();
  renderInspector();
}
function readFormParams() {
  const params = {};
  $$('#inspector [data-field]').forEach((el) => {
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.dataset.type === 'number') v = v === '' ? null : Number(v);
    if (el.dataset.type === 'array') v = String(v).split(',').map((s) => s.trim()).filter(Boolean);
    if (el.dataset.type === 'lines') v = String(v).split(/[,，\n]/).map((s) => s.trim()).filter(Boolean);
    setPath(params, el.dataset.field, v);
  });
  return params;
}
function validateParams(c, p) {
  if ((c.id === 'win.key.send' || c.id === 'win.key.trigger') && !p.keys) return '请先录制或输入组合键';
  if (c.id === 'win.open' && !p.target) return '请填写目标路径或 URL';
  if (c.id === 'win.http.request' && !p.url) return '请填写请求 URL';
  if (c.id === 'win.audio.volume' && p.action === 'set' && (p.level == null || p.level < 0 || p.level > 100)) return '音量需在 0–100';
  if (c.id === 'win.display.brightness' && (p.value == null || p.value < 0 || p.value > 100)) return '亮度需在 0–100';
  return null;
}
function saveInstance(classId, instanceId) {
  if (state.recording) stopRecording();
  const c = classById(classId);
  const i = instanceById(classId, instanceId);
  if (!c || !i) return;
  const params = readFormParams();
  const err = validateParams(c, params);
  if (err) { showToast(err, 'error'); return; }
  i.params = params;
  i.revision = (i.revision || 1) + 1;
  if (!i.lastRun) i.lastRun = '尚未运行';
  saveData();
  renderAll();
  showToast(`已保存「${i.name}」· revision ${i.revision}`);
}
function runInstance(classId, instanceId) {
  const c = classById(classId);
  const i = instanceById(classId, instanceId);
  if (!c || !i) return;
  if (i.status === 'archived') { showToast('已归档实例，先恢复再运行', 'error'); return; }
  const err = validateParams(c, i.params);
  if (err) { showToast(err, 'error'); return; }
  i.lastRun = '刚刚';
  i.success = Math.min(99.9, Number((Number(i.success || 96) + 0.2).toFixed(1)));
  saveData();
  renderContent();
  renderInspector();
  showToast(`运行成功 · ${c.name} / ${i.name} · 128 ms`);
}
function duplicateInstance(classId, instanceId) {
  const c = classById(classId);
  const i = instanceById(classId, instanceId);
  if (!c || !i) return;
  const copy = deepClone(i);
  copy.id = `i-${Date.now().toString(36)}`;
  copy.name = `${i.name} 副本`;
  copy.revision = 1;
  copy.lastRun = '尚未运行';
  copy.status = 'draft';
  copy.usedBy = 0;
  c.instances.push(copy);
  state.selected = { type: 'instance', classId, instanceId: copy.id };
  saveData();
  renderAll();
  showToast(`已复制为「${copy.name}」`);
}
function restoreInstance(classId, instanceId) {
  const i = instanceById(classId, instanceId);
  if (!i) return;
  i.status = 'stable';
  saveData();
  renderAll();
  showToast(`已恢复「${i.name}」`);
}
function archiveInstance(classId, instanceId) {
  const i = instanceById(classId, instanceId);
  if (!i) return;
  if (i.status === 'archived') { restoreInstance(classId, instanceId); return; }
  confirmModal('归档实例？', `「${i.name}」被 ${i.usedBy || 0} 条流程引用。归档不会删除引用，但会标记不可用；可在“已归档”视图恢复。`, '归档', () => {
    i.status = 'archived';
    saveData();
    renderAll();
    showToast(`已归档「${i.name}」`);
  });
}
function archiveClass(classId) {
  const c = classById(classId);
  if (!c) return;
  if (c.instances.length) { showToast(`「${c.name}」下还有 ${c.instances.length} 个实例，先归档或迁移实例`, 'error'); return; }
  confirmModal('归档类？', `「${c.name}」没有实例。归档后会从默认视图消失，但版本和审计记录保留。`, '归档', () => {
    c.status = 'archived';
    state.selected = null;
    saveData();
    renderAll();
    showToast(`已归档「${c.name}」`);
  });
}
function handleAction(el) {
  const a = el.dataset.action;
  const cid = el.dataset.class;
  const iid = el.dataset.instance;
  if (a === 'close-inspector') { state.selected = null; renderContent(); renderInspector(); return; }
  if (a === 'jump-class') { selectClass(cid); return; }
  if (a === 'edit') { selectInstance(cid, iid); return; }
  if (a === 'new-instance') { openNewInstanceModal(cid); return; }
  if (a === 'edit-class') { openEditClassModal(cid); return; }
  if (a === 'archive-class') { archiveClass(cid); return; }
  if (a === 'save-instance') { saveInstance(cid, iid); return; }
  if (a === 'run') { runInstance(cid, iid); return; }
  if (a === 'duplicate') { duplicateInstance(cid, iid); return; }
  if (a === 'archive') { archiveInstance(cid, iid); return; }
  if (a === 'restore') { restoreInstance(cid, iid); return; }
  if (a === 'record') { if (state.recording) stopRecording(); else startRecording(); return; }
}
document.addEventListener('click', (e) => {
  const actionEl = e.target.closest('[data-action]');
  if (actionEl) { handleAction(actionEl); return; }
  const instanceEl = e.target.closest('[data-instance]');
  if (instanceEl) { selectInstance(instanceEl.dataset.class, instanceEl.dataset.instance); return; }
  const classRow = e.target.closest('[data-class-row]');
  if (classRow) {
    const id = classRow.dataset.classRow;
    if (state.expanded.has(id)) state.expanded.delete(id); else state.expanded.add(id);
    renderContent();
    return;
  }
  const classEl = e.target.closest('[data-class]');
  if (classEl) { selectClass(classEl.dataset.class); return; }
  const familyEl = e.target.closest('[data-family]');
  if (familyEl) { state.family = familyEl.dataset.family; renderAll(); return; }
  const filterEl = e.target.closest('[data-filter]');
  if (filterEl) { state.filter = filterEl.dataset.filter; renderAll(); return; }
  const viewEl = e.target.closest('[data-view]');
  if (viewEl) {
    state.view = viewEl.dataset.view;
    $$('#viewSwitch button').forEach((b) => b.classList.toggle('active', b.dataset.view === state.view));
    renderContent();
    return;
  }
});

/* ---------- modal ---------- */
function openModal(html) {
  $('#modalRoot').innerHTML = `<div class="modal-overlay" id="modalOverlay"><div class="modal">${html}</div></div>`;
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  $('#modalRoot').innerHTML = '';
  document.body.style.overflow = '';
  modalConfirmAction = null;
}
function confirmModal(title, message, confirmLabel, onConfirm) {
  modalConfirmAction = onConfirm;
  openModal(`<h3>${esc(title)}</h3><p>${esc(message)}</p>
    <div class="modal-actions">
      <button class="btn ghost" data-modal-close>取消</button>
      <button class="btn danger" id="modalConfirm">${esc(confirmLabel)}</button>
    </div>`);
}
function openNewInstanceModal(preselected) {
  const options = data.filter((c) => c.status !== 'archived').map((c) => `<option value="${esc(c.id)}" ${c.id === preselected ? 'selected' : ''}>${esc(c.name)} · ${esc(c.id)}</option>`).join('');
  openModal(`<h3>新建实例</h3><p>实例 = 类 + 参数。先选类、起名字，参数可以在 Inspector 里继续编辑。</p>
    <div class="field"><label>选择类</label><select id="modalClass">${options}</select></div>
    <div class="field"><label>实例名称</label><input class="input" id="modalName" placeholder="例如：复制 / 聚焦记事本" autofocus></div>
    <div class="modal-actions"><button class="btn ghost" data-modal-close>取消</button><button class="btn primary" id="modalCreateInstance">创建实例</button></div>`);
  setTimeout(() => $('#modalName')?.focus(), 30);
}
function openNewClassModal() {
  const options = FAMILIES.map((f) => `<option value="${f.id}">${f.name}</option>`).join('');
  openModal(`<h3>新建类</h3><p>类是可复用的原子契约；创建后先落为 draft，再补参数、权限和测试。</p>
    <div class="field-row">
      <div class="field"><label>类名称</label><input class="input" id="modalClassName" placeholder="例如：发送快捷键"></div>
      <div class="field"><label>家族</label><select id="modalClassFamily">${options}</select></div>
    </div>
    <div class="field"><label>类 ID</label><input class="input" id="modalClassId" placeholder="win.custom.myAtom"></div>
    <div class="field"><label>描述</label><textarea id="modalClassDesc" placeholder="一句话说明这个类做什么、实例参数是什么"></textarea></div>
    <div class="modal-actions"><button class="btn ghost" data-modal-close>取消</button><button class="btn primary" id="modalCreateClass">创建类</button></div>`);
}
function openEditClassModal(classId) {
  const c = classById(classId);
  if (!c) return;
  openModal(`<h3>编辑类 · 新版本</h3><p>已发布类不原地改：保存会生成新的 minor 版本草稿，实例仍锁定旧版本。</p>
    <div class="field"><label>类名称</label><input class="input" id="editClassName" value="${esc(c.name)}"></div>
    <div class="field"><label>描述</label><textarea id="editClassDesc">${esc(c.desc)}</textarea></div>
    <div class="field"><label>当前版本</label><input class="input" value="${esc(c.version)}" disabled></div>
    <div class="modal-actions"><button class="btn ghost" data-modal-close>取消</button><button class="btn primary" id="modalSaveClass">保存为新版本</button></div>`);
}
$('#modalRoot').addEventListener('click', (e) => {
  if (e.target.id === 'modalOverlay' || e.target.closest('[data-modal-close]')) { closeModal(); return; }
  if (e.target.closest('#modalConfirm')) {
    const fn = modalConfirmAction;
    closeModal();
    if (fn) fn();
    return;
  }
  if (e.target.closest('#modalCreateInstance')) {
    const cid = $('#modalClass').value;
    const c = classById(cid);
    const name = $('#modalName').value.trim();
    if (!c) { showToast('请选择类', 'error'); return; }
    if (!name) { showToast('请填写实例名称', 'error'); return; }
    const inst = {
      id: `i-${Date.now().toString(36)}`, name,
      params: defaultParams(cid), tags: [], usedBy: 0,
      lastRun: '尚未运行', status: 'draft', success: 0, revision: 1
    };
    c.instances.push(inst);
    state.selected = { type: 'instance', classId: cid, instanceId: inst.id };
    saveData(); closeModal(); renderAll();
    showToast(`已创建实例「${name}」`);
    return;
  }
  if (e.target.closest('#modalCreateClass')) {
    const name = $('#modalClassName').value.trim();
    let id = $('#modalClassId').value.trim() || `win.custom.${Date.now().toString(36)}`;
    id = id.replace(/[^a-zA-Z0-9._-]/g, '');
    const family = $('#modalClassFamily').value;
    const desc = $('#modalClassDesc').value.trim() || '自定义原子类。';
    if (!name) { showToast('请填写类名称', 'error'); return; }
    if (!id || data.some((c) => c.id === id)) { showToast('类 ID 为空或已存在', 'error'); return; }
    const cls = {
      id, name, family, version: '0.1.0', status: 'draft', p0: false, official: false,
      usedBy: 0, success: 0, updated: new Date().toISOString().slice(0, 10),
      desc, permissions: [], sideEffects: [], instances: []
    };
    data.push(cls);
    state.selected = { type: 'class', classId: id };
    saveData(); closeModal(); renderAll();
    showToast(`已创建类「${name}」`);
    return;
  }
  if (e.target.closest('#modalSaveClass')) {
    const c = classById(state.selected?.classId);
    if (!c) return;
    const name = $('#editClassName').value.trim();
    const desc = $('#editClassDesc').value.trim();
    if (!name) { showToast('类名称不能为空', 'error'); return; }
    c.name = name; c.desc = desc;
    c.version = bumpMinor(c.version);
    c.status = 'draft';
    c.updated = new Date().toISOString().slice(0, 10);
    saveData(); closeModal(); renderAll();
    showToast(`已生成 v${c.version} 草稿`);
    return;
  }
});
function bumpMinor(v) {
  const parts = String(v).split('.').map((n) => parseInt(n, 10) || 0);
  return `${parts[0] || 0}.${(parts[1] || 0) + 1}.0`;
}
/* ---------- hotkey recorder ---------- */
function startRecording() {
  if (state.recording) { stopRecording(); return; }
  const input = $('#hotkeyInput');
  if (!input) return;
  state.recording = true;
  const btn = document.querySelector('[data-action="record"]');
  if (btn) btn.textContent = '录制中…';
  input.focus();
  input.select();
  input.placeholder = '请按下组合键…';
  recordHandler = (e) => onRecordKey(e);
  window.addEventListener('keydown', recordHandler, true);
}
function stopRecording() {
  state.recording = false;
  if (recordHandler) window.removeEventListener('keydown', recordHandler, true);
  recordHandler = null;
  const btn = document.querySelector('[data-action="record"]');
  if (btn) btn.textContent = '● 录制';
  const input = $('#hotkeyInput');
  if (input) input.placeholder = '点击录制，或手动输入 Ctrl+C';
}
function comboFromEvent(e) {
  const mods = [];
  if (e.ctrlKey) mods.push('Ctrl');
  if (e.altKey) mods.push('Alt');
  if (e.shiftKey) mods.push('Shift');
  if (e.metaKey) mods.push('Win');
  let key = e.key;
  if (key === ' ') key = 'Space';
  if (key === '+') key = 'Plus';
  if (key === '-') key = 'Minus';
  if (key.length === 1) key = key.toUpperCase();
  return [...mods, key].join('+');
}
function onRecordKey(e) {
  if (e.key === 'Escape') {
    e.preventDefault(); e.stopPropagation(); stopRecording(); showToast('已取消录制');
    return;
  }
  if (e.key === 'Backspace') {
    e.preventDefault(); e.stopPropagation();
    const input = $('#hotkeyInput'); if (input) input.value = '';
    return;
  }
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
    e.preventDefault(); e.stopPropagation();
    const mods = [];
    if (e.ctrlKey) mods.push('Ctrl');
    if (e.altKey) mods.push('Alt');
    if (e.shiftKey) mods.push('Shift');
    if (e.metaKey) mods.push('Win');
    const input = $('#hotkeyInput'); if (input) input.value = mods.join('+') + (mods.length ? '+' : '');
    return;
  }
  e.preventDefault(); e.stopPropagation();
  const combo = comboFromEvent(e);
  const input = $('#hotkeyInput');
  if (input) {
    input.value = combo;
    const field = input.closest('.field');
    const chips = field?.querySelector('.key-chips');
    if (chips) chips.innerHTML = combo.split('+').map((k) => `<span class="key-chip">${esc(k)}</span>`).join('');
  }
  stopRecording();
  showToast(`已录制 ${combo}`);
}

/* ---------- theme / keyboard / init ---------- */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(THEME_KEY, theme); } catch (_) {}
  const btn = $('#themeBtn');
  if (btn) btn.textContent = theme === 'dark' ? '☾' : '☀';
}
function toggleTheme() {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
}
function isEditable(el) {
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}
$('#searchInput').addEventListener('input', (e) => {
  state.query = e.target.value;
  renderContent();
  renderChips();
});
$('#newInstanceBtn').addEventListener('click', () => openNewInstanceModal());
$('#themeBtn').addEventListener('click', toggleTheme);
$('#resetBtn').addEventListener('click', () => {
  confirmModal('重置演示数据？', '会清空本地修改，恢复初始的类与实例。', '重置', () => {
    data = deepClone(SEED);
    state.selected = null;
    state.expanded = new Set([data[0]?.id].filter(Boolean));
    saveData();
    renderAll();
    showToast('演示数据已重置');
  });
});
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && !isEditable(e.target)) {
    e.preventDefault();
    $('#searchInput').focus();
    return;
  }
  if (e.key === 'Escape') {
    if ($('#modalRoot').innerHTML) closeModal();
    else if (state.selected) { state.selected = null; renderContent(); renderInspector(); }
  }
});
/* 额外的新建类按钮 */
(function injectNewClassButton() {
  const top = document.querySelector('.top-actions');
  const primary = $('#newInstanceBtn');
  if (!top || !primary || $('#newClassBtn')) return;
  const btn = document.createElement('button');
  btn.id = 'newClassBtn';
  btn.className = 'btn ghost';
  btn.textContent = '+ 新建类';
  btn.addEventListener('click', openNewClassModal);
  top.insertBefore(btn, primary);
})();
applyTheme(localStorage.getItem(THEME_KEY) || 'dark');
renderAll();
