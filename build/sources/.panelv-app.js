(() => {
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const GROUPS = {
  all:     { label: '全部', color: '#22d3ee' },
  inspect: { label: '检查', color: '#22d3ee' },
  edit:    { label: '编辑', color: '#3b82f6' },
  ai:      { label: 'AI', color: '#8b5cf6' },
  data:    { label: '数据', color: '#22c55e' },
  system:  { label: '系统', color: '#f59e0b' }
};

function I(label, content, mode, width, state, data, actions, rev = 1) {
  return { label, content, mode, width, state, data, actions, rev, status: 'active' };
}

function P(id, name, icon, group, desc, modes, regions, content, states, behaviors, a11y, instances) {
  return { id, name, icon, group, desc, modes, regions, content, states, behaviors, a11y, instances, version: '1.0.0' };
}

const CLASSES = [
  P('panel.inspector', 'Inspector Panel', '◧', 'inspect', '属性检查器：选中对象的参数、绑定、revision。',
    ['right', 'floating'], ['header', 'toolbar', 'body', 'footer'], 'surface.inspector',
    ['ready', 'empty', 'error'], ['resizable', 'collapsible', 'pinnable'], ['role=complementary', 'Esc close', 'keyboard resize'], [
      I('point', 'surface.inspector.point', 'right', 380, 'ready', 'selectedPoint + params', ['saveParams', 'reset'], 3),
      I('flow-slot', 'surface.inspector.flow-slot', 'right', 400, 'ready', 'selectedSlot + boundFlow', ['replaceBinding', 'unbind'], 2),
      I('body-manifest', 'surface.inspector.body-manifest', 'right', 440, 'ready', 'bodyManifest', ['editManifest', 'validate'], 1)
    ]),
  P('panel.settings', 'Settings Panel', '⚙', 'edit', '设置面板：分区、字段、保存栏、重启徽标。',
    ['right', 'modal'], ['header', 'toolbar', 'body', 'footer'], 'surface.settings-page',
    ['ready', 'error'], ['resizable', 'saveBar', 'restartBadge'], ['role=dialog when modal', 'focus trap', 'Esc close'], [
      I('app', 'surface.settings.app', 'right', 420, 'ready', 'settingsStore.app', ['save', 'reset'], 2),
      I('body', 'surface.settings.body', 'modal', 620, 'ready', 'settingsStore.body', ['save', 'cancel'], 1),
      I('vpn', 'surface.form.settings.vpn', 'right', 440, 'ready', 'settingsStore.vpn', ['saveSettings', 'testVpn'], 2)
    ]),
  P('panel.command', 'Command Panel', '⌘', 'ai', '命令面板：搜索、结果、快捷键、预览。',
    ['modal'], ['header', 'body', 'footer'], 'surface.command-palette',
    ['ready', 'empty', 'loading'], ['fuzzy', 'keyboard', 'escape', 'backdropClose'], ['role=dialog', 'role=listbox', 'aria-activedescendant'], [
      I('global', 'surface.palette.global', 'modal', 620, 'ready', 'commandIndex', ['command', 'navigate'], 5),
      I('flow-editor', 'surface.palette.flow-editor', 'modal', 560, 'ready', 'flowCommands', ['insertNode', 'navigate'], 2),
      I('body-launcher', 'surface.palette.body-launcher', 'modal', 600, 'ready', 'bodyRegistry', ['install', 'run'], 1)
    ]),
  P('panel.run-history', 'Run History Panel', '◷', 'data', '运行历史：运行列表、详情、重放、错误过滤。',
    ['right', 'bottom'], ['header', 'toolbar', 'body', 'footer'], 'surface.run-history',
    ['ready', 'empty', 'error'], ['resizable', 'filter', 'replay'], ['role=region', 'keyboard rows', 'aria-live'], [
      I('flow', 'surface.run-history.flow', 'right', 460, 'ready', 'flowRuns', ['replay', 'filterErrors'], 2),
      I('vpn', 'surface.run-history.vpn', 'right', 460, 'ready', 'flowRuns + pointRuns', ['replay', 'openSettings'], 2),
      I('body', 'surface.run-history.body', 'right', 520, 'ready', 'bodyRuns', ['replay', 'export'], 1)
    ]),
  P('panel.artifact', 'Artifact Panel', '▤', 'edit', 'AI 产物面板：代码/文档/图，预览、源码、版本、导出。',
    ['right', 'floating'], ['header', 'toolbar', 'body', 'footer'], 'surface.artifact-panel',
    ['ready', 'loading', 'streaming', 'error'], ['resizable', 'previewSource', 'versions', 'export'], ['role=complementary', 'keyboard resize', 'live region'], [
      I('code', 'surface.artifact.code', 'right', 520, 'ready', 'artifact.code', ['edit', 'export', 'version'], 2),
      I('document', 'surface.artifact.document', 'right', 480, 'ready', 'artifact.document', ['edit', 'export', 'version'], 1),
      I('diagram', 'surface.artifact.diagram', 'floating', 540, 'ready', 'artifact.diagram', ['zoom', 'export'], 1)
    ]),
  P('panel.chat', 'Copilot Chat Panel', '✦', 'ai', 'AI 副驾：消息、上下文、流式回复、停止/重新生成。',
    ['right', 'floating'], ['header', 'toolbar', 'body', 'footer'], 'surface.prompt-input + surface.streaming-response',
    ['ready', 'streaming', 'needsApproval', 'error'], ['resizable', 'stop', 'regenerate', 'contextChips'], ['role=complementary', 'live region', 'focus management'], [
      I('support', 'surface.prompt.chat + surface.stream.chat', 'right', 380, 'ready', 'session.chat', ['send', 'attach'], 1),
      I('copilot', 'surface.prompt.chat + surface.stream.chat', 'right', 420, 'streaming', 'session.copilot', ['send', 'stop', 'regenerate'], 3),
      I('inline-edit', 'surface.prompt.inline-edit', 'floating', 440, 'ready', 'selection + instruction', ['apply', 'diff', 'cancel'], 1)
    ]),
  P('panel.approval', 'Approval Panel', '⚠', 'ai', '审批面板：风险、diff、approve/deny、理由。',
    ['modal', 'sheet'], ['header', 'body', 'footer'], 'surface.approval-card',
    ['needsApproval', 'blocked', 'error'], ['modal', 'focusTrap', 'approve', 'deny', 'reason'], ['role=alertdialog', 'focus trap', 'aria-describedby'], [
      I('tool-call', 'surface.approval.tool-call', 'modal', 520, 'needsApproval', 'toolCall + risk', ['approve', 'deny', 'reason'], 1),
      I('payment', 'surface.approval.payment', 'modal', 480, 'needsApproval', 'payment + risk', ['approve', 'deny'], 1),
      I('publish', 'surface.approval.publish', 'modal', 540, 'needsApproval', 'content + audience', ['approve', 'deny', 'preview'], 1)
    ]),
  P('panel.notifications', 'Notification Panel', '◍', 'system', '通知中心：通知列表、操作、dismiss、未读。',
    ['right', 'floating'], ['header', 'body', 'footer'], 'surface.notification',
    ['ready', 'empty'], ['resizable', 'dismiss', 'action'], ['role=log', 'aria-live=polite'], [
      I('center', 'surface.notification.center', 'right', 360, 'ready', 'notifications', ['dismiss', 'markRead'], 1),
      I('vpn', 'surface.notify.vpn', 'floating', 340, 'ready', 'vpnNotifications', ['openSettings', 'retry'], 1),
      I('update', 'surface.notify.update', 'right', 360, 'ready', 'updateNotifications', ['install', 'later'], 1)
    ]),
  P('panel.launcher', 'Launcher Panel', '⌘', 'system', '启动坞：分页、tabs、tiles、快捷键。',
    ['modal'], ['header', 'body', 'footer'], 'surface.launch-dock',
    ['ready', 'empty'], ['tabs', 'pages', 'hotkeys', 'drag'], ['role=dialog', 'role=grid', 'keyboard navigation'], [
      I('desktop', 'surface.dock.desktop', 'modal', 720, 'ready', 'launchItems', ['runFlow', 'reorder'], 1),
      I('dev', 'surface.dock.dev', 'modal', 720, 'ready', 'devItems', ['runFlow', 'reorder'], 1)
    ]),
  P('panel.dashboard', 'Dashboard Panel', '◫', 'data', '仪表盘：KPI、图表、刷新、过滤。',
    ['right', 'bottom'], ['header', 'toolbar', 'body', 'footer'], 'surface.dashboard',
    ['ready', 'loading', 'error'], ['resizable', 'refresh', 'filter'], ['role=region', 'data table semantics', 'aria-live'], [
      I('system', 'surface.dashboard.system', 'right', 520, 'ready', 'metricStream', ['refresh', 'settings'], 2),
      I('vpn', 'surface.dashboard.vpn', 'right', 460, 'ready', 'vpnHealth', ['refresh', 'test'], 1),
      I('body-health', 'surface.dashboard.body-health', 'bottom', 520, 'ready', 'bodyHealth', ['filter', 'refresh'], 1)
    ]),
  P('panel.diff', 'Diff Panel', '≠', 'edit', '差异面板：split/unified、accept/revert。',
    ['right', 'floating'], ['header', 'toolbar', 'body', 'footer'], 'surface.diff',
    ['ready', 'empty', 'error'], ['split', 'unified', 'accept', 'revert'], ['role=region', 'keyboard navigation'], [
      I('flow-version', 'surface.diff.flow-version', 'right', 560, 'ready', 'flowVersionA + flowVersionB', ['accept', 'revert'], 1),
      I('body-manifest', 'surface.diff.body-manifest', 'right', 560, 'ready', 'bodyManifestA + bodyManifestB', ['accept', 'revert'], 1)
    ]),
  P('panel.preview', 'Preview Panel', '◉', 'edit', '文件/内容预览：文本、图片、PDF、视频。',
    ['right', 'floating'], ['header', 'toolbar', 'body', 'footer'], 'surface.preview-window',
    ['ready', 'loading', 'error'], ['resizable', 'zoom', 'openExternal'], ['role=region', 'keyboard zoom'], [
      I('file', 'surface.preview-window.file', 'right', 520, 'ready', 'previewResult', ['zoom', 'openExternal'], 2),
      I('image', 'surface.preview-window.image', 'floating', 560, 'ready', 'previewResult.image', ['fit', 'zoom', 'export'], 1)
    ]),
  P('panel.trace', 'Tool Trace Panel', '⌁', 'inspect', '工具调用轨迹：参数、结果、状态、重试。',
    ['right', 'floating'], ['header', 'toolbar', 'body', 'footer'], 'surface.tool-call-trace',
    ['ready', 'streaming', 'error'], ['resizable', 'filter', 'retry'], ['role=region', 'aria-live=polite'], [
      I('agent', 'surface.trace.agent', 'right', 420, 'ready', 'run.toolCalls', ['retry', 'openDetail'], 1),
      I('mcp', 'surface.trace.mcp', 'right', 420, 'streaming', 'mcp.calls', ['retry', 'cancel'], 1)
    ]),
  P('panel.console', 'Console Panel', '▤', 'data', '日志/终端面板：滚动、过滤、follow、清空。',
    ['bottom', 'floating'], ['header', 'toolbar', 'body', 'footer'], 'surface.log-viewer',
    ['ready', 'empty', 'error'], ['resizable', 'clear', 'filter', 'follow'], ['role=log', 'aria-live=polite'], [
      I('logs', 'surface.log-viewer.logs', 'bottom', 300, 'ready', 'logStream', ['filter', 'clear', 'follow'], 1),
      I('terminal', 'surface.log-viewer.terminal', 'bottom', 320, 'ready', 'terminalSession', ['run', 'clear'], 1)
    ])
];

CLASSES.forEach(c => {
  c.instances.forEach((ins, i) => {
    ins.id = `${c.id}.${ins.label}@r${ins.rev}`;
    ins.classId = c.id;
    ins.index = i;
  });
});

const state = {
  selectedId: 'panel.inspector',
  instanceId: null,
  mode: 'right',
  width: 380,
  panelState: 'ready',
  region: null,
  anatomy: false,
  open: true,
  search: '',
  group: 'all',
  toastTimer: null
};

const selectedClass = () => CLASSES.find(c => c.id === state.selectedId) || CLASSES[0];
const selectedInstance = () => {
  const c = selectedClass();
  return c.instances.find(i => i.id === state.instanceId) || c.instances[0];
};
const totalInstances = () => CLASSES.reduce((n, c) => n + c.instances.length, 0);

/* ============================================================
   1. 渲染基础
   ============================================================ */
function wl(w = '') { return `<div class="wire-line ${w}"></div>`; }
function wr(label, value, hi = false) {
  return `<div class="wire-row"><div class="wire-label">${esc(label)}</div><div class="wire-value ${hi ? 'hi' : ''}">${esc(value)}</div></div>`;
}
function wbox(title, body) { return `<div class="wire-box"><b>${esc(title)}</b>${body}</div>`; }
function wchips(arr, cls = '') { return `<div class="wire-chips">${arr.map(x => `<span class="wire-chip ${cls}">${esc(x)}</span>`).join('')}</div>`; }
function wbtn(text, cls = '') { return `<span class="wire-btn ${cls}">${esc(text)}</span>`; }

function renderStats() {
  $('#statClasses').textContent = CLASSES.length;
  $('#statInstances').textContent = totalInstances();
  $('#statModes').textContent = 6;
}

function renderFilters() {
  const groups = [{ id: 'all', label: '全部' }, ...Object.entries(GROUPS).filter(([id]) => id !== 'all').map(([id, v]) => ({ id, label: v.label }))];
  $('#filters').innerHTML = groups.map(g => {
    const n = g.id === 'all' ? CLASSES.length : CLASSES.filter(c => c.group === g.id).length;
    return `<button class="chip-btn ${state.group === g.id ? 'on' : ''}" data-group="${g.id}">${g.label} ${n}</button>`;
  }).join('');
  $$('#filters [data-group]').forEach(b => b.onclick = () => { state.group = b.dataset.group; renderFilters(); renderCatalog(); });
}

function filteredClasses() {
  const q = state.search.trim().toLowerCase();
  return CLASSES.filter(c => {
    if (state.group !== 'all' && c.group !== state.group) return false;
    if (!q) return true;
    const hay = [c.id, c.name, c.desc, c.content, ...c.instances.map(i => i.id + ' ' + i.content + ' ' + i.data)].join(' ').toLowerCase();
    return hay.includes(q);
  });
}

function renderCatalog() {
  const list = filteredClasses();
  if (!list.length) {
    $('#classList').innerHTML = '<div style="padding:20px 10px;color:var(--faint);font-size:10.5px;text-align:center">没有匹配的 PanelClass。</div>';
    return;
  }
  $('#classList').innerHTML = list.map(c => {
    const color = GROUPS[c.group].color;
    return `<div class="class-item ${c.id === state.selectedId ? 'on' : ''}" data-class="${esc(c.id)}" style="--cat:${color}">
      <div class="class-icon">${esc(c.icon)}</div>
      <div class="class-main"><div class="class-name">${esc(c.name)}</div><div class="class-id">${esc(c.id)}</div></div>
      <div class="class-side"><div class="class-count">${c.instances.length}</div><div class="class-family">${esc(GROUPS[c.group].label)}</div></div>
    </div>`;
  }).join('');
  $$('#classList [data-class]').forEach(el => el.onclick = () => selectClass(el.dataset.class));
}

function renderHero() {
  const c = selectedClass();
  const color = GROUPS[c.group].color;
  $('#heroIcon').textContent = c.icon;
  $('#heroIcon').style.setProperty('--cat', color);
  $('#heroName').textContent = c.name;
  $('#heroId').textContent = `${c.id}@${c.version}`;
  $('#heroDesc').textContent = c.desc;
  $('#heroBadges').innerHTML = `
    <span class="badge cyan">${c.modes.join(' / ')}</span>
    <span class="badge green">${c.instances.length} instances</span>
    <span class="badge amber">panel shell</span>
    <span class="badge">${esc(c.content)}</span>`;
}

function renderInstanceSelect() {
  const c = selectedClass();
  const ins = selectedInstance();
  $('#instanceSel').innerHTML = c.instances.map(i => `<option value="${esc(i.id)}" ${i.id === ins.id ? 'selected' : ''}>${esc(i.label)} · r${i.rev}</option>`).join('');
}

/* ============================================================
   2. 面板内容线框
   ============================================================ */
function skeletonHTML() {
  return `<div style="padding:4px 0">
    <div class="skeleton" style="width:45%"></div>
    <div class="skeleton" style="width:88%"></div>
    <div class="skeleton" style="width:72%"></div>
    <div class="skeleton" style="width:80%;margin-top:14px"></div>
    <div class="skeleton" style="width:60%"></div>
    <div class="skeleton" style="width:90%;margin-top:14px"></div>
    <div class="skeleton" style="width:66%"></div>
  </div>`;
}

function emptyHTML(c, ins) {
  return `<div class="wire-empty"><div style="font-size:24px;margin-bottom:6px;color:var(--faint)">◌</div><b>No content</b><p>${esc(ins.content)} 还没有数据。可以运行上游流程、切换实例或清除筛选。</p><span class="wire-btn">Run upstream</span></div>`;
}

function errorHTML(c, ins) {
  return `<div class="wire-empty" style="color:#fca5a5"><div style="font-size:24px;margin-bottom:6px;color:#fca5a5">!</div><b style="color:#fca5a5">Panel failed to load</b><p style="color:#9f7f86">${esc(ins.content)} 返回错误。检查权限/网络/上游流程，或重试。</p><span class="wire-btn red">Retry</span></div>`;
}

function streamHTML() {
  return `<div class="wire-msg me">帮我总结这个 PR 的风险。</div>
    <div class="wire-msg">正在阅读 diff…<br><span style="color:#5f7188">tool: github.diff · 42 files</span></div>
    <div class="wire-msg">发现 3 个风险点：<br>1. 权限检查缺失<br>2. 错误分支未覆盖<br>3. 缺少回归测试<span style="color:#a5f3fc">▍</span></div>
    <div class="wire-prompt"><span>继续追问…</span><span class="wire-btn">Stop ■</span></div>`;
}

function approvalHTML() {
  return `${wbox('Risk · L2', `<div class="wire-chips"><span class="wire-chip amber">irreversible</span><span class="wire-chip amber">external tool</span><span class="wire-chip">approval required</span></div>`)}
    <div class="wire-diff" style="margin-bottom:8px">
      <div class="wire-code"><span class="del">- openExternal(url)</span><br><span class="add">+ ensureVpn()</span><br><span class="add">+ openExternal(url)</span></div>
      <div class="wire-code">target: browser<br>permission: network<br>effect: L2<br>undo: no</div>
    </div>
    <div style="display:flex;gap:5px;flex-wrap:wrap"><span class="wire-btn">Approve</span><span class="wire-btn red">Deny</span><span class="wire-btn gray">Reason…</span></div>`;
}

function contentHTML(c, ins) {
  if (state.panelState === 'loading') return skeletonHTML();
  if (state.panelState === 'empty') return emptyHTML(c, ins);
  if (state.panelState === 'error') return errorHTML(c, ins);
  if (state.panelState === 'blocked') return errorHTML(c, ins);
  if (state.panelState === 'needsApproval') return approvalHTML();
  if (state.panelState === 'streaming') return streamHTML();

  const f = c.id.split('.')[1];
  if (f === 'inspector') {
    return `<div class="wire-stack">
      ${wr('class', 'point.vpn.status')}
      ${wr('instance', 'vpn.default.status@r1', true)}
      ${wr('revision', 'r1')}
      ${wr('effect', 'L0')}
    </div>
    ${wbox('Params', wchips(['profile=work', 'timeoutMs=12000']))}
    ${wbox('Bindings', wchips(['scope=body.external-access', 'slot=vpn.status']))}
    <div style="display:flex;gap:5px"><span class="wire-btn">Save</span><span class="wire-btn gray">Reset</span></div>`;
  }
  if (f === 'settings') {
    return `${wbox('General', `${wr('Profile', 'work')}${wr('Auto connect', 'on', true)}${wr('Protocol', 'WireGuard')}`)}
      ${wbox('Advanced', `${wr('MTU', '1420')}${wr('DNS', '1.1.1.1')}${wr('Kill switch', 'on', true)}`)}
      <div style="display:flex;gap:5px"><span class="wire-btn">Save changes</span><span class="wire-btn gray">Cancel</span></div>`;
  }
  if (f === 'command') {
    return `<div class="wire-search">⌘ Type a command…</div>
      ${['Open GitHub', 'Ensure VPN', 'Preview file', 'Archive invoice'].map((x, i) => `<div class="wire-list-row"><span class="wr-status" style="background:${i === 0 ? '#22d3ee' : '#22c55e'}"></span><div class="wr-main"><div class="wr-title">${x}</div><div class="wr-sub">${i === 0 ? 'flow · L2' : 'point · L0'}</div></div><span class="wire-chip">↵</span></div>`).join('')}
      <div style="margin-top:6px" class="wire-chips"><span class="wire-chip">↑↓ navigate</span><span class="wire-chip">↵ run</span><span class="wire-chip">esc close</span></div>`;
  }
  if (f === 'run-history') {
    return `<div class="wire-chips" style="margin-bottom:7px"><span class="wire-chip cyan">All</span><span class="wire-chip">Errors</span><span class="wire-chip">Slow</span></div>
      ${['flow.ensure-vpn · ok · 842ms', 'flow.open-site · failed · E_TARGET', 'flow.preview · ok · 120ms', 'flow.archive · ok · 2.4s'].map((x, i) => `<div class="wire-list-row"><span class="wr-status" style="background:${i === 1 ? '#ef4444' : '#22c55e'}"></span><div class="wr-main"><div class="wr-title">${x.split(' · ')[0]}</div><div class="wr-sub">${x.split(' · ').slice(1).join(' · ')}</div></div><span class="wire-chip">↻</span></div>`).join('')}`;
  }
  if (f === 'artifact') {
    return `<div class="wire-chips" style="margin-bottom:7px"><span class="wire-chip cyan">Preview</span><span class="wire-chip">Source</span><span class="wire-chip">Versions</span></div>
      <div class="wire-code">export function PriceTag({ value }) {<br>  return &lt;span className="tag"&gt;{value}&lt;/span&gt;;<br>}</div>
      <div style="display:flex;gap:5px;margin-top:8px"><span class="wire-btn">Edit</span><span class="wire-btn gray">Export</span><span class="wire-btn gray">v2</span></div>`;
  }
  if (f === 'chat') {
    return `<div class="wire-msg me">这个面板应该用什么 placement？</div>
      <div class="wire-msg">持续工作的 side panel 用 docked right；短任务用 floating；不可逆动作才用 modal。</div>
      <div class="wire-msg">推荐：<span style="color:#a5f3fc">panel.inspector · right · resizable</span></div>
      <div class="wire-prompt"><span>Ask anything…</span><span class="wire-btn">Send ↵</span></div>`;
  }
  if (f === 'approval') return approvalHTML();
  if (f === 'notifications') {
    return `<div class="wire-list-row"><span class="wr-status"></span><div class="wr-main"><div class="wr-title">VPN connected</div><div class="wr-sub">just now · network</div></div><span class="wire-chip">dismiss</span></div>
      <div class="wire-list-row"><span class="wr-status" style="background:#f59e0b"></span><div class="wr-main"><div class="wr-title">Update available</div><div class="wr-sub">2 min ago · system</div></div><span class="wire-chip">install</span></div>
      <div class="wire-list-row"><span class="wr-status" style="background:#ef4444"></span><div class="wr-main"><div class="wr-title">Run failed</div><div class="wr-sub">5 min ago · flow</div></div><span class="wire-chip">retry</span></div>`;
  }
  if (f === 'launcher') {
    return `<div class="wire-chips" style="margin-bottom:7px"><span class="wire-chip cyan">常用</span><span class="wire-chip">开发</span><span class="wire-chip">系统</span><span class="wire-chip">工具</span></div>
      <div class="wire-tiles">${Array.from({ length: 12 }, (_, i) => `<div class="wire-tile"><b>${i + 1}</b><span>${['GitHub', 'VPN', 'OCR', '终端', '预览', '发票', '监控', '备份', '外网', '取色', '窗口', '设置'][i]}</span></div>`).join('')}</div>
      <div class="wire-chips" style="margin-top:7px"><span class="wire-chip">1–9 hotkey</span><span class="wire-chip">drag reorder</span></div>`;
  }
  if (f === 'dashboard') {
    return `<div class="wire-kpis"><div class="wire-kpi"><b>42%</b><span>CPU</span></div><div class="wire-kpi"><b>18.4 GB</b><span>MEM</span></div><div class="wire-kpi"><b>64°C</b><span>GPU</span></div></div>
      <div class="wire-chart"><svg viewBox="0 0 300 80" preserveAspectRatio="none"><path d="M0 62 L30 55 L60 58 L90 40 L120 44 L150 28 L180 34 L210 20 L240 26 L270 15 L300 22" fill="none" stroke="#22d3ee" stroke-width="1.5"/><path d="M0 70 L330 70" stroke="rgba(148,163,184,.15)"/></svg></div>
      <div style="display:flex;gap:5px;margin-top:7px"><span class="wire-btn">Refresh</span><span class="wire-btn gray">1s</span><span class="wire-btn gray">60s</span></div>`;
  }
  if (f === 'diff') {
    return `<div class="wire-chips" style="margin-bottom:7px"><span class="wire-chip cyan">Split</span><span class="wire-chip">Unified</span></div>
      <div class="wire-diff"><div class="wire-code"><span class="del">- vpn.status(profile)</span><br><span class="del">- if (!ok) return</span><br><span class="add">+ status = await ensureVpn()</span><br><span class="add">+ if (!status.ok) ask()</span></div><div class="wire-code"><span class="add">+ requireApproval: true</span><br><span class="add">+ timeout: 12000</span><br>  effect: L2<br>  revision: 2</div></div>
      <div style="display:flex;gap:5px;margin-top:7px"><span class="wire-btn">Accept</span><span class="wire-btn red">Revert</span></div>`;
  }
  if (f === 'preview') {
    return `<div class="wire-box" style="height:120px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#15263a,#0b1420)"><span style="font:10px var(--mono);color:#93a4ba">preview content</span></div>
      <div class="wire-chips" style="margin-top:7px"><span class="wire-chip">zoom 100%</span><span class="wire-chip">fit</span><span class="wire-chip">open external</span></div>`;
  }
  if (f === 'trace') {
    return `${['tool: web-search · ok · 420ms', 'tool: github.diff · ok · 310ms', 'tool: sql.query · failed · timeout', 'retry: sql.query · ok · 280ms'].map((x, i) => `<div class="wire-list-row"><span class="wr-status" style="background:${i === 2 ? '#ef4444' : '#22c55e'}"></span><div class="wr-main"><div class="wr-title">${x.split(' · ')[0]}</div><div class="wr-sub">${x.split(' · ').slice(1).join(' · ')}</div></div><span class="wire-chip">${i === 2 ? 'retry' : 'detail'}</span></div>`).join('')}`;
  }
  if (f === 'console') {
    return `<div class="wire-code" style="height:100%;min-height:160px;color:#8fa8c0">12:04:01  INFO  worker started<br>12:04:02  INFO  flow.ensure-vpn · slot vpn.status<br>12:04:02  WARN  vpn.wait · 1200ms<br>12:04:03  OK    vpn.ready · connected<br>12:04:03  INFO  flow.ready · 842ms<span style="color:#a5f3fc">▍</span></div>`;
  }
  return `<div class="wire-stack">${wl('w40')}${wl('w80')}${wl('w60')}</div>`;
}

/* ============================================================
   3. 面板壳 / Inspector
   ============================================================ */
function tabsFor(c) {
  const f = c.id.split('.')[1];
  const map = {
    inspector: ['Properties', 'Bindings', 'History'],
    settings: ['General', 'Advanced'],
    command: ['All', 'Commands', 'Files'],
    'run-history': ['All', 'Errors', 'Slow'],
    artifact: ['Preview', 'Source', 'Versions'],
    chat: ['Chat', 'Context', 'Tools'],
    approval: ['Decision', 'Evidence'],
    notifications: ['All', 'Unread'],
    launcher: ['常用', '开发', '系统', '工具'],
    dashboard: ['Overview', 'History'],
    diff: ['Split', 'Unified'],
    preview: ['Preview', 'Info'],
    trace: ['Calls', 'Errors'],
    console: ['Logs', 'Terminal']
  };
  return map[f] || ['Overview', 'Details'];
}

function panelInner(c, ins) {
  const tabs = tabsFor(c);
  const region = r => `data-region="${r}"${state.region === r ? ' class="region-hl"' : ''}`;
  return `
    <div class="panel-head" ${region('header')}>
      <div class="ph-icon" style="--cat:${GROUPS[c.group].color}">${esc(c.icon)}</div>
      <div class="ph-main"><div class="ph-name">${esc(c.name)}</div><div class="ph-sub">${esc(ins.id)}</div></div>
      <div class="ph-actions"><button class="icon-btn" data-pin title="pin">⌖</button><button class="icon-btn" data-close title="close">×</button></div>
    </div>
    <div class="panel-toolbar" ${region('toolbar')}>
      ${tabs.map((t, i) => `<span class="ptab ${i === 0 ? 'on' : ''}">${esc(t)}</span>`).join('')}
      <span class="ptab-sep"></span>
      <span style="font:8px var(--mono);color:var(--faint);white-space:nowrap">${esc(ins.content)}</span>
    </div>
    <div class="panel-body" ${region('body')}>${contentHTML(c, ins)}</div>
    <div class="panel-foot" ${region('footer')}>
      <span class="dot" style="background:${state.panelState === 'error' || state.panelState === 'blocked' ? 'var(--red)' : state.panelState === 'needsApproval' ? 'var(--amber)' : 'var(--green)'}"></span>
      <span>${esc(state.panelState)}</span><span>· r${ins.rev}</span><span class="grow"></span><span>${esc(state.mode)}</span><span>· Esc close</span>
    </div>`;
}

function renderModeButtons() {
  $$('#modeSeg [data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === state.mode));
}

function renderPanel() {
  const c = selectedClass();
  const ins = selectedInstance();
  const wb = $('#workbench');
  wb.className = `workbench mode-${state.mode}${state.open ? '' : ' panel-closed'}`;
  wb.style.setProperty('--pw', state.width + 'px');
  const shell = $('#panelShell');
  shell.classList.toggle('closed', !state.open);
  shell.classList.toggle('anatomy', state.anatomy);
  shell.innerHTML = panelInner(c, ins);
  $('#width').value = state.width;
  $('#widthV').textContent = state.width;
  $('#stateSel').value = state.panelState;
  $('#anatomy').checked = state.anatomy;
  $('#open').checked = state.open;
  renderModeButtons();
}

function panelJSON() {
  const c = selectedClass();
  const ins = selectedInstance();
  return {
    panelClass: `${c.id}@${c.version}`,
    panelInstance: ins.id,
    contentSurface: ins.content,
    placement: { mode: state.mode, width: state.width },
    state: state.panelState,
    bindings: { data: ins.data, actions: ins.actions },
    revision: ins.rev
  };
}

function renderInspector() {
  const c = selectedClass();
  const ins = selectedInstance();
  const region = state.region;
  $('#inspector').innerHTML = `
    <div class="insp-kicker">PanelClass</div>
    <div class="insp-title">${esc(c.icon)} ${esc(c.name)}</div>
    <div class="insp-id">${esc(c.id)}@${esc(c.version)}</div>

    <div class="insp-section"><div class="lh">Class contract</div><div class="kv">
      <div class="k">modes</div><div class="v">${c.modes.map(m => `<span class="pill cyan">${esc(m)}</span>`).join('')}</div>
      <div class="k">regions</div><div class="v">${c.regions.map(r => `<span class="pill">${esc(r)}</span>`).join('')}</div>
      <div class="k">states</div><div class="v">${c.states.map(s => `<span class="pill">${esc(s)}</span>`).join('')}</div>
      <div class="k">behaviors</div><div class="v">${c.behaviors.map(s => `<span class="pill">${esc(s)}</span>`).join('')}</div>
      <div class="k">a11y</div><div class="v">${c.a11y.map(s => `<span class="pill amber">${esc(s)}</span>`).join('')}</div>
    </div></div>

    <div class="insp-section"><div class="lh">PanelInstance</div><div class="kv">
      <div class="k">instance</div><div class="v mono">${esc(ins.id)}</div>
      <div class="k">content</div><div class="v mono">${esc(ins.content)}</div>
      <div class="k">placement</div><div class="v">${esc(state.mode)} · ${state.width}px</div>
      <div class="k">state</div><div class="v">${esc(state.panelState)}</div>
      <div class="k">revision</div><div class="v">r${ins.rev}</div>
      <div class="k">data</div><div class="v mono">${esc(ins.data)}</div>
      <div class="k">actions</div><div class="v">${ins.actions.map(a => `<span class="pill cyan">${esc(a)}</span>`).join('')}</div>
    </div></div>

    ${region ? `<div class="insp-section"><div class="lh">Region · ${esc(region)}</div><div class="kv">
      <div class="k">role</div><div class="v">${region === 'header' ? 'banner/toolbar' : region === 'body' ? 'main content' : region === 'footer' ? 'status/action bar' : 'toolbar'}</div>
      <div class="k">slots</div><div class="v">${region === 'header' ? 'title · subtitle · actions' : region === 'toolbar' ? 'tabs · filters · search' : region === 'body' ? 'content surface' : 'status · actions'}</div>
      <div class="k">constraint</div><div class="v">${region === 'body' ? 'scroll · min-height 0' : 'fixed height'}</div>
    </div></div>` : ''}

    <div class="insp-section"><div class="lh">Content surface</div><div class="kv">
      <div class="k">surface</div><div class="v mono">${esc(ins.content)}</div>
      <div class="k">data</div><div class="v mono">${esc(ins.data)}</div>
      <div class="k">actions</div><div class="v mono">${esc(ins.actions.join(' · '))}</div>
    </div></div>

    <button class="insp-btn" data-copy-panel>复制 PanelInstance JSON</button>
    <button class="insp-btn" data-toggle-open>${state.open ? '关闭面板' : '打开面板'}</button>`;
  bindInspectorEvents();
}

function bindInspectorEvents() {
  $$('#inspector [data-copy-panel]').forEach(b => b.onclick = () => copyText(JSON.stringify(panelJSON(), null, 2), 'PanelInstance JSON 已复制'));
  $$('#inspector [data-toggle-open]').forEach(b => b.onclick = () => { state.open = !state.open; $('#open').checked = state.open; renderPanel(); renderInspector(); });
}

/* ============================================================
   4. 选择 / 事件
   ============================================================ */
function renderAll() {
  renderStats(); renderFilters(); renderCatalog(); renderHero(); renderInstanceSelect(); renderPanel(); renderInspector();
}

function selectClass(id) {
  state.selectedId = id;
  const c = selectedClass();
  const ins = c.instances[0];
  state.instanceId = ins.id;
  state.mode = ins.mode;
  state.width = ins.width;
  state.panelState = ins.state;
  state.region = null;
  state.open = true;
  renderAll();
}

function selectInstance(ins) {
  state.instanceId = ins.id;
  state.mode = ins.mode;
  state.width = ins.width;
  state.panelState = ins.state;
  state.region = null;
  state.open = true;
  renderHero();
  renderInstanceSelect();
  renderPanel();
  renderInspector();
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => t.classList.remove('show'), 1600);
}

function copyText(text, label) {
  const done = () => toast(label || '已复制');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else fallbackCopy(text, done);
}

function fallbackCopy(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (e) {}
  document.body.removeChild(ta);
  done();
}

function init() {
  renderAll();

  $('#search').addEventListener('input', e => { state.search = e.target.value; renderCatalog(); });
  $$('#modeSeg [data-mode]').forEach(b => b.onclick = () => {
    state.mode = b.dataset.mode;
    if (state.mode === 'modal' || state.mode === 'sheet') state.open = true;
    renderPanel(); renderInspector();
  });
  $('#width').addEventListener('input', e => {
    state.width = +e.target.value;
    $('#widthV').textContent = state.width;
    renderPanel();
  });
  $('#stateSel').addEventListener('change', e => { state.panelState = e.target.value; renderPanel(); renderInspector(); });
  $('#anatomy').addEventListener('change', e => { state.anatomy = e.target.checked; renderPanel(); });
  $('#open').addEventListener('change', e => { state.open = e.target.checked; renderPanel(); renderInspector(); });
  $('#instanceSel').addEventListener('change', e => {
    const ins = selectedClass().instances.find(i => i.id === e.target.value);
    if (ins) selectInstance(ins);
  });
  $('#backdrop').addEventListener('click', () => { state.open = false; $('#open').checked = false; renderPanel(); renderInspector(); });

  $('#panelShell').addEventListener('click', e => {
    if (e.target.closest('[data-close]')) {
      state.open = false; $('#open').checked = false; renderPanel(); renderInspector(); return;
    }
    if (e.target.closest('[data-pin]')) { toast('面板已固定（模拟）'); return; }
    const wireBtn = e.target.closest('.wire-btn');
    if (wireBtn) { toast('模拟动作：' + wireBtn.textContent.trim()); return; }
    const region = e.target.closest('[data-region]');
    if (region) { state.region = region.dataset.region; renderPanel(); renderInspector(); }
  });

  document.addEventListener('keydown', e => {
    if (e.key === '/' && document.activeElement !== $('#search')) { e.preventDefault(); $('#search').focus(); }
    if (e.key === 'Escape') { state.open = false; $('#open').checked = false; renderPanel(); renderInspector(); }
    if (e.key === 'r' || e.key === 'R') { selectClass(state.selectedId); }
  });
}

init();
})();
