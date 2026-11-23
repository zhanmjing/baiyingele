(() => {
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const EFFECT = { L0: '#22c55e', L1: '#22d3ee', L2: '#f59e0b', L3: '#ef4444' };
const STATUS_LABEL = { ok: 'ok', warn: 'warn', err: 'error', disabled: 'disabled' };

function I(label, rev, status, activation, binding) { return { label, rev, status, activation, binding }; }
function P(id, domain, group, effect, summary, params, inputs, outputs, permissions, instances) {
  return { id, domain, group, effect, summary, params, inputs, outputs, permissions, instances, version: '1.0.0' };
}

const CLASSES = [
  P('point.vpn.status', 'vpn', 'network', 'L0', '读取当前 VPN 连接状态、profile 与出口 IP。',
    [{ k: 'profile', t: 'string', d: 'work' }, { k: 'timeoutMs', t: 'number', d: '12000' }],
    [{ n: 'profile', t: 'string' }], [{ n: 'status', t: 'VpnStatus' }], ['network'], [
      I('default', 3, 'ok', 'Ctrl+Alt+V', 'flow.ensure-vpn.vpn.status'),
      I('work', 2, 'ok', 'gesture LDR', 'surface.settings.vpn'),
      I('personal', 1, 'warn', 'manual', 'flow.open-site.guard')
    ]),
  P('point.vpn.connect', 'vpn', 'network', 'L2', '连接指定 VPN profile；可能改变网络状态。',
    [{ k: 'profile', t: 'string', d: 'work' }, { k: 'killSwitch', t: 'boolean', d: 'true' }],
    [{ n: 'profile', t: 'string' }], [{ n: 'status', t: 'VpnStatus' }], ['network', 'process'], [
      I('work', 2, 'ok', 'Ctrl+Alt+E', 'flow.ensure-vpn.connect'),
      I('personal', 1, 'disabled', 'manual', 'surface.settings.vpn')
    ]),
  P('point.browser.open', 'browser', 'network', 'L2', '在默认或指定浏览器打开 URL，可先走 VPN 守卫。',
    [{ k: 'url', t: 'url', d: 'https://github.com' }, { k: 'newWindow', t: 'boolean', d: 'true' }],
    [{ n: 'url', t: 'url' }], [{ n: 'opened', t: 'boolean' }], ['network', 'shell'], [
      I('default', 4, 'ok', 'Ctrl+Alt+G', 'flow.open-site.open'),
      I('work', 2, 'ok', 'palette', 'flow.ensure-vpn.open')
    ]),
  P('point.file.preview', 'file', 'content', 'L0', '生成文件预览：文本、图片、PDF、视频。',
    [{ k: 'path', t: 'path', d: '' }, { k: 'mode', t: 'enum', d: 'text' }],
    [{ n: 'path', t: 'path' }], [{ n: 'preview', t: 'PreviewResult' }], ['filesystem'], [
      I('text', 2, 'ok', 'Space', 'surface.preview.file'),
      I('image', 1, 'ok', 'Space', 'surface.preview.image'),
      I('pdf', 1, 'warn', 'Space', 'surface.preview.file')
    ]),
  P('point.ocr.text', 'ocr', 'content', 'L1', '从图片/屏幕区域识别文本，可选语言与模式。',
    [{ k: 'lang', t: 'enum', d: 'zh-CN' }, { k: 'mode', t: 'enum', d: 'screen' }],
    [{ n: 'image', t: 'ImageRef' }], [{ n: 'text', t: 'string' }], ['filesystem', 'ai'], [
      I('screen', 2, 'ok', 'Ctrl+Shift+O', 'flow.ocr.recognize'),
      I('file', 1, 'ok', 'context menu', 'flow.ocr.file')
    ]),
  P('point.clipboard.write', 'clipboard', 'system', 'L1', '写入文本/图片/HTML 到剪贴板。',
    [{ k: 'format', t: 'enum', d: 'text' }], [{ n: 'value', t: 'any' }], [{ n: 'written', t: 'boolean' }], ['clipboard'], [
      I('text', 3, 'ok', 'Ctrl+Shift+V', 'surface.paste-preview'),
      I('image', 1, 'ok', 'gesture X1', 'surface.paste-preview')
    ]),
  P('point.notify.toast', 'notify', 'system', 'L0', '显示 toast/banner，可带动作。',
    [{ k: 'level', t: 'enum', d: 'info' }, { k: 'timeoutMs', t: 'number', d: '3000' }],
    [{ n: 'message', t: 'string' }], [{ n: 'shown', t: 'boolean' }], ['ui'], [
      I('info', 1, 'ok', 'system', 'flow.notify'),
      I('error', 1, 'ok', 'system', 'flow.notify')
    ]),
  P('point.window.focus', 'window', 'system', 'L1', '按标题/进程聚焦窗口；可能抢焦点。',
    [{ k: 'match', t: 'string', d: 'chrome' }], [{ n: 'match', t: 'string' }], [{ n: 'focused', t: 'boolean' }], ['process', 'uia'], [
      I('title', 2, 'ok', 'Ctrl+Alt+W', 'flow.focus-window'),
      I('process', 1, 'warn', 'manual', 'flow.focus-window')
    ]),
  P('point.fs.hash', 'fs', 'content', 'L0', '计算文件/目录摘要，用于校验与构建。',
    [{ k: 'algo', t: 'enum', d: 'sha256' }], [{ n: 'path', t: 'path' }], [{ n: 'hash', t: 'string' }], ['filesystem'], [
      I('sha256', 1, 'ok', 'build', 'flow.build.verify'),
      I('md5', 1, 'disabled', 'legacy', 'flow.build.verify')
    ]),
  P('point.ai.translate', 'ai', 'ai', 'L1', '翻译文本/网页/屏幕内容，支持源语言自动检测。',
    [{ k: 'source', t: 'enum', d: 'auto' }, { k: 'target', t: 'enum', d: 'zh-CN' }],
    [{ n: 'text', t: 'string' }], [{ n: 'translated', t: 'string' }], ['ai', 'network'], [
      I('en-zh', 2, 'ok', 'Ctrl+Alt+T', 'surface.hud.translate'),
      I('auto-zh', 1, 'ok', 'gesture LDR', 'surface.hud.translate')
    ]),
  P('point.git.diff', 'git', 'content', 'L0', '读取工作区/暂存区/PR diff。',
    [{ k: 'repo', t: 'path', d: '' }, { k: 'staged', t: 'boolean', d: 'false' }],
    [{ n: 'repo', t: 'path' }], [{ n: 'diff', t: 'DiffResult' }], ['filesystem', 'process'], [
      I('work', 2, 'ok', 'Ctrl+Alt+D', 'surface.diff.flow-version'),
      I('pr', 1, 'warn', 'palette', 'surface.diff.flow-version')
    ]),
  P('point.net.reachable', 'net', 'network', 'L0', '检查 host:port 是否可达，用于预检/守卫。',
    [{ k: 'host', t: 'string', d: 'github.com' }, { k: 'timeoutMs', t: 'number', d: '2000' }],
    [{ n: 'host', t: 'string' }], [{ n: 'reachable', t: 'boolean' }], ['network'], [
      I('default', 2, 'ok', 'flow.ensure-vpn', 'flow.ensure-vpn.precheck'),
      I('github', 1, 'ok', 'manual', 'flow.open-site.precheck')
    ])
];

CLASSES.forEach(c => c.instances.forEach((ins, i) => {
  ins.id = `${c.id}.${ins.label}@r${ins.rev}`;
  ins.classId = c.id;
  ins.index = i;
}));

const GROUPS = {
  all: '全部', network: '网络', content: '内容', system: '系统', ai: 'AI'
};

const PROFILE_NAMES = ['Debug', 'Release', 'Signed', 'Portable'];
const PROFILE_VALUES = {
  Debug:    { optimizeLevel: 'none', sourceMaps: true, strip: false, sign: false, timestamp: false, channel: 'dev' },
  Release:  { optimizeLevel: 'balanced', sourceMaps: false, strip: true, sign: true, timestamp: true, channel: 'stable' },
  Signed:   { optimizeLevel: 'size', sourceMaps: false, strip: true, sign: true, timestamp: true, channel: 'stable' },
  Portable: { optimizeLevel: 'speed', sourceMaps: false, strip: true, sign: false, timestamp: false, channel: 'beta' }
};

const OPTION_GROUPS = [
  { id: 'target', label: 'Target & Runtime' },
  { id: 'codegen', label: 'Codegen' },
  { id: 'optimize', label: 'Optimization' },
  { id: 'validate', label: 'Validation & Tests' },
  { id: 'sign', label: 'Signing & Trust' },
  { id: 'deps', label: 'Dependencies & Lock' },
  { id: 'permissions', label: 'Permissions & Effects' },
  { id: 'output', label: 'Output & Publish' },
  { id: 'advanced', label: 'Advanced' }
];

const OPTIONS = [
  { key: 'runtime', group: 'target', label: 'Runtime', desc: '目标运行时；影响兼容性与产物大小。', type: 'enum', enum: ['win-x64', 'win-arm64', 'wasm'], default: 'win-x64', project: 'win-x64', impact: 'compatibility' },
  { key: 'arch', group: 'target', label: 'Architecture', desc: '目标 CPU 架构。', type: 'enum', enum: ['x64', 'arm64'], default: 'x64', project: 'x64' },
  { key: 'sdk', group: 'target', label: 'SDK', desc: '用于生成 host/loader 的 SDK。', type: 'enum', enum: ['net9', 'node22', 'python312'], default: 'net9', project: 'net9' },

  { key: 'manifest', group: 'codegen', label: 'Generate manifest', desc: '生成 body.json / blockmap。', type: 'bool', default: true, project: true },
  { key: 'typedStubs', group: 'codegen', label: 'Typed stubs', desc: '生成 Point/Flow 的类型化 stub。', type: 'bool', default: true, project: true },
  { key: 'docs', group: 'codegen', label: 'Generate docs', desc: '生成 API/参数文档。', type: 'bool', default: false },
  { key: 'sourceMaps', group: 'codegen', label: 'Source maps', desc: '调试用；增大产物。', type: 'bool', default: false, profile: true },

  { key: 'optimizeLevel', group: 'optimize', label: 'Optimization', desc: '体积/速度的取舍。', type: 'enum', enum: ['none', 'balanced', 'size', 'speed'], default: 'balanced', profile: true, impact: 'size' },
  { key: 'treeShake', group: 'optimize', label: 'Tree shake', desc: '移除未引用的点/流程。', type: 'bool', default: true, project: true, impact: 'size' },
  { key: 'strip', group: 'optimize', label: 'Strip symbols', desc: '移除调试符号。', type: 'bool', default: true, profile: true },
  { key: 'aot', group: 'optimize', label: 'AOT compile', desc: '提前编译；可能影响启动与兼容性。', type: 'bool', default: false, advanced: true, impact: 'speed' },

  { key: 'contractTests', group: 'validate', label: 'Contract tests', desc: '运行 Point/Flow 契约测试。', type: 'bool', default: true, policy: true },
  { key: 'effectAudit', group: 'validate', label: 'Effect audit', desc: '审计 L2/L3 效果与权限。', type: 'bool', default: true, policy: true },
  { key: 'permissionAudit', group: 'validate', label: 'Permission audit', desc: '检查 requested vs declared permissions。', type: 'bool', default: true, policy: true },
  { key: 'deterministic', group: 'validate', label: 'Deterministic build', desc: '可复现构建；固定时间戳/顺序。', type: 'bool', default: true, project: true },

  { key: 'sign', group: 'sign', label: 'Sign artifact', desc: '对包进行签名。', type: 'bool', default: true, profile: true, impact: 'security' },
  { key: 'timestamp', group: 'sign', label: 'Timestamp', desc: '签名时间戳。', type: 'bool', default: true, profile: true },
  { key: 'certRef', group: 'sign', label: 'Certificate ref', desc: '证书引用，不存明文。', type: 'string', default: 'env:CERT_REF', project: 'env:CERT_REF', advanced: true },

  { key: 'lockfile', group: 'deps', label: 'Lockfile', desc: '依赖锁定文件。', type: 'string', default: 'body.lock', project: 'body.lock' },
  { key: 'allowPrerelease', group: 'deps', label: 'Allow prerelease', desc: '允许预发布依赖；生产环境通常关闭。', type: 'bool', default: false, policy: true },

  { key: 'maxEffect', group: 'permissions', label: 'Max effect', desc: '允许的最高效果等级。', type: 'enum', enum: ['L0', 'L1', 'L2', 'L3'], default: 'L2', policy: 'L2', impact: 'security' },
  { key: 'requested', group: 'permissions', label: 'Requested permissions', desc: '逗号分隔的权限集合。', type: 'string', default: 'network,process,uia', project: 'network,process,uia' },

  { key: 'output', group: 'output', label: 'Output path', desc: '产物输出目录。', type: 'string', default: 'dist/', project: 'dist/' },
  { key: 'channel', group: 'output', label: 'Channel', desc: '发布通道。', type: 'enum', enum: ['dev', 'beta', 'stable'], default: 'stable', profile: true },
  { key: 'format', group: 'output', label: 'Format', desc: '产物格式。', type: 'enum', enum: ['pkg', 'zip', 'msix'], default: 'pkg', project: 'pkg' },

  { key: 'concurrency', group: 'advanced', label: 'Concurrency', desc: '编译并发度。', type: 'number', default: 4, project: 4, advanced: true },
  { key: 'cache', group: 'advanced', label: 'Build cache', desc: '复用编译缓存。', type: 'bool', default: true, project: true, advanced: true }
];

const state = {
  tab: 'matrix',
  selectedId: 'point.vpn.status',
  instanceId: null,
  search: '',
  group: 'all',
  profile: 'Release',
  target: 'body-package',
  values: {},
  dirty: false,
  buildRunning: false,
  buildSteps: [],
  artifact: null,
  diag: [
    { severity: 'warning', code: 'W_EFFECT_L2', message: 'point.browser.open 声明 L2；需要审批守卫。', target: 'point.browser.open' },
    { severity: 'warning', code: 'W_POINT_UNUSED', message: 'point.fs.hash.md5 未被引用，tree-shake 将移除。', target: 'point.fs.hash.md5' },
    { severity: 'info', code: 'I_SIGN_PENDING', message: '签名将在 Package 阶段执行。', target: 'sign' }
  ],
  logs: [],
  dockTab: 'build',
  toastTimer: null
};

const selectedClass = () => CLASSES.find(c => c.id === state.selectedId) || CLASSES[0];
const selectedInstance = () => {
  const c = selectedClass();
  return c.instances.find(i => i.id === state.instanceId) || c.instances[0];
};
const allInstances = () => CLASSES.flatMap(c => c.instances);
const totalInstances = () => allInstances().length;

function baseForOption(o, profile) {
  if (o.policy !== undefined) return { value: o.policy, source: 'policy' };
  if (o.profile && PROFILE_VALUES[profile] && PROFILE_VALUES[profile][o.key] !== undefined) {
    return { value: PROFILE_VALUES[profile][o.key], source: 'profile' };
  }
  if (o.project !== undefined) return { value: o.project, source: 'project' };
  return { value: o.default, source: 'default' };
}

function initValues(profile) {
  state.values = {};
  for (const o of OPTIONS) state.values[o.key] = baseForOption(o, profile);
}
initValues(state.profile);

/* ============================================================
   渲染
   ============================================================ */
function filteredClasses() {
  const q = state.search.trim().toLowerCase();
  return CLASSES.filter(c => {
    if (state.group !== 'all' && c.group !== state.group) return false;
    if (!q) return true;
    const hay = [c.id, c.domain, c.summary, ...c.params.map(p => p.k), ...c.instances.map(i => i.id + ' ' + i.binding + ' ' + i.activation)].join(' ').toLowerCase();
    return hay.includes(q);
  });
}

function renderHeader() {
  const c = selectedClass();
  const ins = selectedInstance();
  const icon = { matrix: '◆', instances: '▤', settings: '⚙', build: '▶' }[state.tab] || '◆';
  $('#mhIcon').textContent = icon;
  if (state.tab === 'settings') {
    $('#mhKicker').textContent = 'BUILD SETTINGS';
    $('#mhTitle').textContent = '编译设置';
    $('#mhSub').textContent = `BuildProfileInstance · ${state.profile} · ${state.target}`;
    $('#mhBadges').innerHTML = `<span class="badge cyan">${esc(state.profile)}</span><span class="badge amber">${esc(state.target)}</span><span class="badge">${state.dirty ? 'dirty' : 'clean'}</span>`;
  } else if (state.tab === 'build') {
    $('#mhKicker').textContent = 'BUILD RUN';
    $('#mhTitle').textContent = '构建流水线';
    $('#mhSub').textContent = `flow.build · ${state.profile} · ${state.target}`;
    $('#mhBadges').innerHTML = `<span class="badge cyan">${state.buildRunning ? 'running' : state.artifact ? 'done' : 'idle'}</span><span class="badge amber">${state.target}</span><span class="badge">${state.profile}</span>`;
  } else if (state.tab === 'instances') {
    $('#mhKicker').textContent = 'POINT INSTANCES';
    $('#mhTitle').textContent = '点实例表';
    $('#mhSub').textContent = `${totalInstances()} 个实例 · 按类、状态、revision 浏览`;
    $('#mhBadges').innerHTML = `<span class="badge cyan">${totalInstances()} instances</span><span class="badge green">${CLASSES.length} classes</span><span class="badge">PointInstance</span>`;
  } else {
    $('#mhKicker').textContent = 'POINT MATRIX';
    $('#mhTitle').textContent = '点层可视化';
    $('#mhSub').textContent = `${c.id} · ${ins.label} · class × instance × ports × bindings`;
    $('#mhBadges').innerHTML = `<span class="badge cyan">${esc(c.effect)}</span><span class="badge green">${c.instances.length} instances</span><span class="badge">${esc(c.domain)}</span>`;
  }
  $('#buildBtn').disabled = state.buildRunning;
  $('#buildBtn').textContent = state.buildRunning ? 'Building…' : 'Build ▸';
}

function renderSidebar() {
  const groups = Object.entries(GROUPS);
  $('#filters').innerHTML = groups.map(([id, label]) => `<button class="chip ${state.group === id ? 'on' : ''}" data-group="${id}">${label}</button>`).join('');
  $$('#filters [data-group]').forEach(b => b.onclick = () => { state.group = b.dataset.group; renderSidebar(); renderMatrix(); renderInstances(); });
  const list = filteredClasses();
  if (!list.length) {
    $('#classList').innerHTML = '<div style="padding:18px 8px;text-align:center;color:var(--faint);font-size:9px">没有匹配的 PointClass。</div>';
    return;
  }
  $('#classList').innerHTML = list.map(c => `<div class="class-item ${c.id === state.selectedId ? 'on' : ''}" data-class="${esc(c.id)}" style="--ec:${EFFECT[c.effect]}">
    <span class="effect"></span>
    <div class="class-main"><div class="class-name">${esc(c.id)}</div><div class="class-sub">${esc(c.domain)} · ${esc(c.effect)} · ${c.instances.length} inst</div></div>
    <div class="class-count">${c.instances.length}</div>
  </div>`).join('');
  $$('#classList [data-class]').forEach(el => el.onclick = () => selectClass(el.dataset.class));
}

function colorFor(c, ins) {
  if (ins.status === 'disabled') return '#475569';
  if (ins.status === 'err') return '#ef4444';
  if (ins.status === 'warn') return '#f59e0b';
  return EFFECT[c.effect];
}

function renderMatrix() {
  const list = filteredClasses();
  const cells = [];
  cells.push('<div class="mh">PointClass</div>');
  for (let i = 1; i <= 3; i++) cells.push(`<div class="mh">inst-${i}</div>`);
  cells.push('<div class="mh">more</div>');
  if (!list.length) {
    cells.push('<div class="row-label">—</div><div class="cell" style="grid-column:span 4;color:var(--faint);font-family:var(--mono)">no matching points</div>');
  }
  list.forEach(c => {
    cells.push(`<div class="row-label"><span class="effect" style="--ec:${EFFECT[c.effect]}"></span><div class="rl-main"><div class="rl-id">${esc(c.id)}</div><div class="rl-sub">${esc(c.domain)} · ${esc(c.effect)} · ${c.instances.length} inst</div></div></div>`);
    const visible = c.instances.slice(0, 3);
    for (let i = 0; i < 3; i++) {
      const ins = visible[i];
      if (!ins) { cells.push('<div class="cell"></div>'); continue; }
      const ec = colorFor(c, ins);
      const cls = ins.status === 'warn' ? 'warn' : ins.status === 'err' ? 'err' : ins.status === 'disabled' ? 'disabled' : '';
      const sel = ins.id === state.instanceId ? ' sel' : '';
      cells.push(`<div class="cell${sel}"><button class="dotbtn ${cls}" data-class="${esc(c.id)}" data-inst="${esc(ins.id)}" style="--ec:${ec}" title="${esc(ins.id)}"><span class="rev">r${ins.rev}</span></button></div>`);
    }
    const more = c.instances.length - 3;
    cells.push(`<div class="cell">${more > 0 ? `<span class="cell-more">+${more}</span>` : ''}</div>`);
  });
  const grid = $('#matrix');
  grid.innerHTML = cells.join('');
  $$('#matrix .dotbtn').forEach(b => b.onclick = () => selectInstance(CLASSES.find(c => c.id === b.dataset.class).instances.find(i => i.id === b.dataset.inst)));
  renderRelation();
}

function renderRelation() {
  const c = selectedClass();
  const ins = selectedInstance();
  const inPorts = c.inputs.map(p => `<div class="port-row"><span class="dir">→</span><span>${esc(p.n)}</span><span class="pty">${esc(p.t)}</span></div>`).join('');
  const outPorts = c.outputs.map(p => `<div class="port-row"><span class="dir">←</span><span>${esc(p.n)}</span><span class="pty">${esc(p.t)}</span></div>`).join('');
  $('#relation').innerHTML = `
    <div class="rel-col"><h4>Ports · Input / Output</h4>${inPorts || '<div class="port-row">—</div>'}${outPorts || ''}</div>
    <div class="rel-arrow">→</div>
    <div class="rel-col"><h4>PointInstance</h4><div class="port-row"><span class="dir">◆</span><span>${esc(ins.id)}</span></div><div class="port-row"><span class="dir">·</span><span>${esc(ins.status)} · r${ins.rev}</span></div><div class="port-row"><span class="dir">·</span><span>${esc(ins.activation)}</span></div></div>
    <div class="rel-arrow">→</div>
    <div class="rel-col"><h4>Bindings</h4><div class="binding-row"><b>flow / surface</b>${esc(ins.binding)}<br><span>scope=${esc(c.domain)} · effect=${esc(c.effect)}</span></div><div class="binding-row"><b>permissions</b><span>${c.permissions.map(esc).join(' · ')}</span></div></div>`;
}

function renderInstances() {
  const rows = filteredClasses().flatMap(c => c.instances.map(ins => `<tr data-class="${esc(c.id)}" data-inst="${esc(ins.id)}" style="${ins.id === state.instanceId ? 'background:rgba(34,211,238,.05)' : ''}">
    <td class="mono">${esc(c.id)}</td>
    <td class="mono">${esc(ins.label)}</td>
    <td><span class="status ${esc(ins.status)}">${esc(ins.status)}</span></td>
    <td>r${ins.rev}</td>
    <td>${esc(ins.activation)}</td>
    <td class="mono" style="max-width:180px;overflow:hidden;text-overflow:ellipsis">${esc(ins.binding)}</td>
    <td><span class="badge" style="color:${EFFECT[c.effect]};border-color:${EFFECT[c.effect]}44">${esc(c.effect)}</span></td>
  </tr>`)).join('');
  $('#instTable').innerHTML = `<thead><tr><th>Class</th><th>Instance</th><th>Status</th><th>Rev</th><th>Activation</th><th>Binding</th><th>Effect</th></tr></thead><tbody>${rows || '<tr><td colspan="7" style="color:var(--faint)">no matching instances</td></tr>'}</tbody>`;
  $$('#instTable tbody tr[data-inst]').forEach(tr => tr.onclick = () => selectInstance(CLASSES.find(c => c.id === tr.dataset.class).instances.find(i => i.id === tr.dataset.inst)));
}

function renderInspectorPoint() {
  const c = selectedClass();
  const ins = selectedInstance();
  $('#inspector').innerHTML = `
    <div class="insp-kicker">PointClass</div>
    <div class="insp-title">◆ ${esc(c.id)}</div>
    <div class="insp-id">${esc(c.id)}@${esc(c.version)}</div>
    <div class="insp-section"><div class="lh">Contract</div><div class="kv">
      <div class="k">domain</div><div class="v">${esc(c.domain)}</div>
      <div class="k">effect</div><div class="v"><span class="pill amber">${esc(c.effect)}</span></div>
      <div class="k">summary</div><div class="v">${esc(c.summary)}</div>
      <div class="k">permissions</div><div class="v">${c.permissions.map(p => `<span class="pill">${esc(p)}</span>`).join('')}</div>
    </div></div>
    <div class="insp-section"><div class="lh">Selected Instance</div><div class="kv">
      <div class="k">instance</div><div class="v mono">${esc(ins.id)}</div>
      <div class="k">status</div><div class="v"><span class="pill ${ins.status === 'ok' ? 'green' : ins.status === 'warn' ? 'amber' : ''}">${esc(ins.status)}</span></div>
      <div class="k">revision</div><div class="v">r${ins.rev}</div>
      <div class="k">activation</div><div class="v">${esc(ins.activation)}</div>
      <div class="k">binding</div><div class="v mono">${esc(ins.binding)}</div>
    </div></div>
    <div class="insp-section"><div class="lh">Params</div><div class="kv">
      ${c.params.map(p => `<div class="k">${esc(p.k)}</div><div class="v"><span class="pill">${esc(p.t)}</span> default=${esc(p.d || '—')}</div>`).join('')}
    </div></div>
    <div class="insp-section"><div class="lh">Ports</div><div class="kv">
      ${c.inputs.map(p => `<div class="k">in</div><div class="v"><span class="pill cyan">${esc(p.n)}</span> ${esc(p.t)}</div>`).join('')}
      ${c.outputs.map(p => `<div class="k">out</div><div class="v"><span class="pill green">${esc(p.n)}</span> ${esc(p.t)}</div>`).join('')}
    </div></div>
    <button class="insp-btn" data-run-point>▶ 运行 Point 实例</button>
    <button class="insp-btn" data-copy-instance>复制 PointInstance JSON</button>`;
  $$('#inspector [data-run-point]').forEach(b => b.onclick = () => runPoint());
  $$('#inspector [data-copy-instance]').forEach(b => b.onclick = () => copyText(JSON.stringify(pointInstanceJSON(), null, 2), 'PointInstance JSON 已复制'));
}

function buildSummary() {
  const maxEffect = state.values.maxEffect?.value || 'L2';
  const sign = state.values.sign?.value ? 'pending' : 'unsigned';
  const runtime = state.values.runtime?.value || 'win-x64';
  const errs = 0;
  return {
    target: state.target,
    profile: state.profile,
    runtime,
    estSize: state.profile === 'Debug' ? '42.8 MB' : state.profile === 'Signed' ? '17.9 MB' : '18.4 MB',
    warnings: state.diag.filter(d => d.severity === 'warning').length,
    errors: errs,
    permissions: 6,
    maxEffect,
    signature: state.artifact ? state.artifact.signature : sign,
    digest: state.artifact ? state.artifact.digest : 'sha256:—',
    reproducible: state.values.deterministic?.value ? 'yes' : 'no'
  };
}

function renderInspectorBuild() {
  const s = buildSummary();
  $('#inspector').innerHTML = `
    <div class="insp-kicker">Build Summary</div>
    <div class="insp-title">⚙ ${esc(state.profile)} Profile</div>
    <div class="insp-id">${esc(state.target)} · ${esc(s.runtime)}</div>
    <div class="insp-section"><div class="lh">Effective Summary</div><div class="summary">
      <div class="sbox"><b>${esc(s.estSize)}</b><span>est. size</span></div>
      <div class="sbox"><b>${s.warnings}</b><span>warnings</span></div>
      <div class="sbox"><b>${s.errors}</b><span>errors</span></div>
      <div class="sbox"><b>${s.permissions}</b><span>permissions</span></div>
      <div class="sbox"><b>${esc(s.maxEffect)}</b><span>max effect</span></div>
      <div class="sbox"><b>${esc(s.reproducible)}</b><span>reproducible</span></div>
    </div></div>
    <div class="insp-section"><div class="lh">Trust</div><div class="kv">
      <div class="k">signature</div><div class="v">${esc(s.signature)}</div>
      <div class="k">digest</div><div class="v mono" style="word-break:break-all">${esc(s.digest)}</div>
      <div class="k">target</div><div class="v">${esc(s.target)}</div>
      <div class="k">profile</div><div class="v">${esc(s.profile)}</div>
    </div></div>
    <button class="insp-btn" data-build ${state.buildRunning ? 'disabled' : ''}>${state.buildRunning ? 'Building…' : 'Build ▸'}</button>
    <button class="insp-btn" data-dry>Dry run</button>`;
  $$('#inspector [data-build]').forEach(b => b.onclick = () => runBuild());
  $$('#inspector [data-dry]').forEach(b => b.onclick = () => dryRun());
}

function renderInspector() {
  if (state.tab === 'settings' || state.tab === 'build') renderInspectorBuild();
  else renderInspectorPoint();
}

function optionControl(o, v, disabled) {
  if (o.type === 'bool') return `<input type="checkbox" data-opt="${esc(o.key)}" ${v ? 'checked' : ''} ${disabled ? 'disabled' : ''}>`;
  if (o.type === 'enum') return `<select data-opt="${esc(o.key)}" ${disabled ? 'disabled' : ''}>${o.enum.map(x => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>`;
  return `<input type="text" data-opt="${esc(o.key)}" value="${esc(v)}" ${disabled ? 'disabled' : ''}>`;
}

function sourceLabel(src) {
  return { default: 'default', project: 'project', profile: 'profile', override: 'override', policy: 'policy' }[src] || src;
}

function renderSettings() {
  $$('#profileSeg [data-profile]').forEach(b => b.classList.toggle('on', b.dataset.profile === state.profile));
  $('#targetSel').value = state.target;
  $('#dirtyBadge').textContent = state.dirty ? 'dirty' : 'clean';
  $('#dirtyBadge').style.color = state.dirty ? '#fcd34d' : '#86efac';
  $('#settingsGroups').innerHTML = OPTION_GROUPS.map(g => {
    const opts = OPTIONS.filter(o => o.group === g.id);
    if (!opts.length) return '';
    const rows = opts.map(o => {
      const cur = state.values[o.key];
      const locked = cur.source === 'policy';
      const val = o.type === 'bool' ? (cur.value ? 'on' : 'off') : cur.value;
      return `<div class="setting-row">
        <div class="setting-label"><b>${esc(o.label)}</b><span>${esc(o.desc)}${o.impact ? ' · affects ' + esc(o.impact) : ''}</span></div>
        <div class="setting-control">${optionControl(o, cur.value, locked)}</div>
        <div class="setting-meta"><span class="src ${cur.source}">${sourceLabel(cur.source)}</span><span class="setting-val">${esc(val)}</span></div>
        <div style="text-align:right">${cur.source === 'override' ? `<button class="reset" data-reset="${esc(o.key)}">reset</button>` : locked ? '<span style="font:7px var(--mono);color:#fca5a5">locked</span>' : ''}</div>
      </div>`;
    }).join('');
    return `<div class="setting-group"><div class="gh"><b>${esc(g.label)}</b><span>${opts.length} options</span></div>${rows}</div>`;
  }).join('');
  $$('#settingsGroups [data-opt]').forEach(el => {
    el.addEventListener('change', () => {
      const key = el.dataset.opt;
      const o = OPTIONS.find(x => x.key === key);
      let val = el.type === 'checkbox' ? el.checked : el.value;
      if (o.type === 'number') val = Number(val);
      state.values[key] = { value: val, source: 'override' };
      state.dirty = Object.values(state.values).some(v => v.source === 'override');
      renderSettings(); renderHeader(); renderInspector();
      log(`override ${key} = ${val}`, 'warn', 'build');
    });
  });
  $$('#settingsGroups [data-reset]').forEach(b => b.onclick = () => {
    const o = OPTIONS.find(x => x.key === b.dataset.reset);
    state.values[o.key] = baseForOption(o, state.profile);
    state.dirty = Object.values(state.values).some(v => v.source === 'override');
    renderSettings(); renderHeader(); renderInspector();
    log(`reset ${o.key} to ${state.values[o.key].source}`, 'info', 'build');
  });
}

/* ============================================================
   构建 / 日志 / 交互
   ============================================================ */
function makeSteps() {
  return [
    { name: 'Resolve', sub: 'point refs · lockfile · profile', status: 'pending', time: '' },
    { name: 'Validate', sub: 'schema · contract · effect audit', status: 'pending', time: '' },
    { name: 'Plan', sub: 'graph plan · permissions · output', status: 'pending', time: '' },
    { name: 'Compile', sub: 'codegen · optimize · tree-shake', status: 'pending', time: '' },
    { name: 'Sign', sub: 'certificate · timestamp · digest', status: 'pending', time: '' },
    { name: 'Package', sub: 'manifest · payload · blockmap', status: 'pending', time: '' },
    { name: 'Verify', sub: 'hash · signature · install dry-run', status: 'pending', time: '' },
    { name: 'Publish', sub: 'channel · artifact · receipt', status: 'pending', time: '' }
  ];
}

function stepHTML(s, i) {
  const icon = s.status === 'ok' ? '✓' : s.status === 'failed' ? '!' : s.status === 'running' ? '·' : s.status === 'skipped' ? '–' : String(i + 1);
  return `<div class="step ${esc(s.status)}"><div class="sic">${icon}</div><div class="st-main"><div class="st-name">${esc(s.name)}</div><div class="st-sub">${esc(s.sub)}</div></div><div class="st-time">${esc(s.time || '')}</div></div>`;
}

function renderBuild() {
  $('#pipeline').innerHTML = state.buildSteps.map(stepHTML).join('');
  $('#diags').innerHTML = state.diag.map(d => `<div class="diag ${esc(d.severity)}"><div class="dg-code">${esc(d.code)}</div><div class="dg-msg">${esc(d.message)}<br><span style="color:var(--faint)">${esc(d.target || '')}</span></div></div>`).join('');
  $('#artifact').innerHTML = state.artifact ? `<div class="artifact"><h4>✓ BUILD ARTIFACT</h4><div class="kv">
    <div class="k">name</div><div>${esc(state.artifact.name)}</div>
    <div class="k">version</div><div>${esc(state.artifact.version)}</div>
    <div class="k">size</div><div>${esc(state.artifact.size)}</div>
    <div class="k">digest</div><div style="word-break:break-all">${esc(state.artifact.digest)}</div>
    <div class="k">signature</div><div>${esc(state.artifact.signature)}</div>
    <div class="k">channel</div><div>${esc(state.artifact.channel)}</div>
    <div class="k">files</div><div>${state.artifact.files.map(esc).join(' · ')}</div>
  </div></div>` : `<div style="border:1px dashed var(--line);border-radius:7px;padding:12px;color:var(--faint);font:8px var(--mono);text-align:center">No artifact yet. Run Build or Dry run.</div>`;
}

function nowTime() {
  const d = new Date();
  return d.toTimeString().slice(0, 8);
}

function log(msg, cls = 'info', tab = 'build') {
  state.logs.push({ time: nowTime(), msg, cls, tab });
  if (state.logs.length > 200) state.logs.shift();
  renderDock();
}

function renderDock() {
  $$('#dockTabs [data-dock]').forEach(b => b.classList.toggle('on', b.dataset.dock === state.dockTab));
  let rows = state.logs;
  if (state.dockTab === 'problems') rows = rows.filter(l => l.cls === 'warn' || l.cls === 'err');
  else if (state.dockTab !== 'build') rows = rows.filter(l => l.tab === state.dockTab);
  else rows = rows.filter(l => l.tab === 'build');
  $('#dockBody').innerHTML = rows.length ? rows.map(l => `<div class="log"><span class="t">${esc(l.time)}</span>  <span class="${esc(l.cls)}">${esc(l.msg)}</span></div>`).join('') : '<div class="log" style="color:var(--faint)">No entries.</div>';
  const body = $('#dockBody');
  body.scrollTop = body.scrollHeight;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runBuild() {
  if (state.buildRunning) return;
  state.buildRunning = true;
  state.artifact = null;
  state.buildSteps = makeSteps();
  state.tab = 'build';
  switchTab('build');
  renderHeader(); renderInspector();
  log(`build start · ${state.profile} · ${state.target}`, 'info', 'build');
  for (let i = 0; i < state.buildSteps.length; i++) {
    const s = state.buildSteps[i];
    s.status = 'running';
    renderBuild();
    log(`${s.name.toLowerCase()} · running`, 'info', 'build');
    await sleep(260);
    s.status = 'ok';
    s.time = `${120 + i * 37}ms`;
    renderBuild();
    log(`${s.name.toLowerCase()} · ok`, 'ok', 'build');
  }
  state.artifact = {
    name: 'external-access.body.pkg',
    version: '1.4.2',
    size: state.profile === 'Debug' ? '42.8 MB' : state.profile === 'Signed' ? '17.9 MB' : '18.4 MB',
    digest: 'sha256:9f2c4e71a8d3b6f0c1e5…',
    signature: state.values.sign?.value ? 'valid' : 'unsigned',
    channel: state.values.channel?.value || 'stable',
    files: ['manifest.json', 'payload', 'blockmap', 'signature']
  };
  state.buildRunning = false;
  renderBuild(); renderHeader(); renderInspector();
  log('build complete · artifact ready', 'ok', 'build');
  toast('Build complete · artifact ready');
}

function dryRun() {
  switchTab('build');
  state.buildSteps = makeSteps().map((s, i) => ({ ...s, status: i < 3 ? 'ok' : 'skipped', time: i < 3 ? `${90 + i * 21}ms` : '' }));
  state.artifact = null;
  renderBuild(); renderHeader(); renderInspector();
  log('dry run · resolve / validate / plan ok', 'ok', 'build');
  log('dry run · no artifact written', 'warn', 'build');
  toast('Dry run · 0 errors · 2 warnings');
}

function pointInstanceJSON() {
  const c = selectedClass();
  const ins = selectedInstance();
  return {
    pointClass: `${c.id}@${c.version}`,
    pointInstance: ins.id,
    params: Object.fromEntries(c.params.map(p => [p.k, p.d])),
    inputs: c.inputs,
    outputs: c.outputs,
    effects: c.effect,
    permissions: c.permissions,
    bindings: [ins.binding],
    revision: ins.rev
  };
}

function runPoint() {
  const ins = selectedInstance();
  log(`run ${ins.id} · input sample`, 'info', 'runs');
  toast(`Running ${ins.id}`);
  setTimeout(() => {
    log(`run ${ins.id} · ok · 42ms`, 'ok', 'runs');
    toast('Point run ok · 42ms');
  }, 420);
}

function switchTab(tab) {
  state.tab = tab;
  $$('#tabs [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  $$('.view').forEach(v => v.classList.toggle('on', v.id === `view-${tab}`));
  if (tab === 'settings') renderSettings();
  if (tab === 'build') renderBuild();
  if (tab === 'matrix') renderMatrix();
  if (tab === 'instances') renderInstances();
  renderHeader();
  renderInspector();
}

function selectClass(id) {
  state.selectedId = id;
  state.instanceId = selectedClass().instances[0].id;
  state.tab = 'matrix';
  switchTab('matrix');
  renderSidebar();
}

function selectInstance(ins) {
  state.selectedId = ins.classId;
  state.instanceId = ins.id;
  renderSidebar();
  if (state.tab === 'matrix') renderMatrix();
  if (state.tab === 'instances') renderInstances();
  renderHeader();
  renderInspector();
  renderMatrix();
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
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  else fallbackCopy(text, done);
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
  state.instanceId = selectedClass().instances[0].id;
  state.buildSteps = makeSteps();
  $('#profileSeg').innerHTML = PROFILE_NAMES.map(p => `<button data-profile="${p}" class="${p === state.profile ? 'on' : ''}">${p}</button>`).join('');
  $$('#profileSeg [data-profile]').forEach(b => b.onclick = () => {
    state.profile = b.dataset.profile;
    initValues(state.profile);
    state.dirty = false;
    renderSettings(); renderHeader(); renderInspector();
    log(`profile ${state.profile} loaded`, 'info', 'build');
  });
  $('#targetSel').addEventListener('change', e => {
    state.target = e.target.value;
    state.dirty = true;
    renderSettings(); renderHeader(); renderInspector();
    log(`target ${state.target}`, 'info', 'build');
  });
  $('#tabs').addEventListener('click', e => {
    const b = e.target.closest('[data-tab]');
    if (b) switchTab(b.dataset.tab);
  });
  $('#search').addEventListener('input', e => {
    state.search = e.target.value;
    renderSidebar(); renderMatrix(); renderInstances();
  });
  $('#buildBtn').addEventListener('click', runBuild);
  $('#dockTabs').addEventListener('click', e => {
    const b = e.target.closest('[data-dock]');
    if (b) { state.dockTab = b.dataset.dock; renderDock(); }
  });
  $('#clearDock').addEventListener('click', () => { state.logs = []; renderDock(); });

  renderSidebar();
  renderHeader();
  renderMatrix();
  renderInstances();
  renderSettings();
  renderBuild();
  renderInspector();
  log('Point registry loaded · 12 classes / 26 instances', 'ok', 'build');
  log('Selected point.vpn.status.default@r3', 'info', 'runs');
  log('Build profile Release loaded', 'info', 'build');
  log('2 warnings · 0 errors · signature pending', 'warn', 'build');
}

init();
})();
