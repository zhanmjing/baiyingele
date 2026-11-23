
(() => {
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const canvas = $('#gl');
const ctx = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1;

const state = {
  yaw: -0.62, pitch: 0.38, dist: 18.2,
  autoRotate: true, time: 0,
  dragging: false, lastX: 0, lastY: 0, moved: 0,
  zScale: 1.0,
  showCompose: true, showLabels: true, showGrid: true,
  selection: null, hover: null
};

const CAM_FOV = 780;
const X0 = -3.55, X1 = 3.55, Y0 = -1.05, Y1 = 1.72;
const CLASS_Y = -0.62;
const INST_Y = [0.42, 1.14];
const Z_BASE = [0, 2.4, 4.8, 7.2];

const LAYERS = [
  {
    id: 'point', name: '点', color: '#22c55e', z: Z_BASE[0],
    classes: [
      { id: 'vpn.status', short: 'vpn.status', version: '1.0.0', contract: 'PointClass', instances: [
        { id: 'vpn.default.status@r1', short: 'default', revision: 1, effect: 'L0', status: 'active', params: '{ profile: "default" }' },
        { id: 'vpn.work.status@r1', short: 'work', revision: 1, effect: 'L0', status: 'active', params: '{ profile: "work" }' }
      ]},
      { id: 'net.reachable', short: 'net.reachable', version: '1.0.0', contract: 'PointClass', instances: [
        { id: 'net.reachable.default@r1', short: 'default', revision: 1, effect: 'L0', status: 'active', params: '{ url: "github.com" }' }
      ]},
      { id: 'browser.open', short: 'browser.open', version: '1.0.0', contract: 'PointClass', instances: [
        { id: 'browser.open.chrome@r1', short: 'chrome', revision: 1, effect: 'L1', status: 'active', params: '{ target: "_blank" }' },
        { id: 'browser.open.edge@r1', short: 'edge', revision: 1, effect: 'L1', status: 'active', params: '{ target: "_blank" }' }
      ]},
      { id: 'notify.toast', short: 'notify.toast', version: '1.0.0', contract: 'PointClass', instances: [
        { id: 'notify.toast.default@r1', short: 'default', revision: 1, effect: 'L1', status: 'active', params: '{ durationMs: 2400 }' }
      ]},
      { id: 'render.text', short: 'render.text', version: '1.0.0', contract: 'PointClass', instances: [
        { id: 'render.text.default@r1', short: 'default', revision: 1, effect: 'L0', status: 'active', params: '{ wrap: true }' }
      ]},
      { id: 'render.image', short: 'render.image', version: '1.0.0', contract: 'PointClass', instances: [
        { id: 'render.image.default@r1', short: 'default', revision: 1, effect: 'L0', status: 'active', params: '{ fit: "contain" }' }
      ]}
    ]
  },
  {
    id: 'line', name: '线', color: '#8b5cf6', z: Z_BASE[1],
    classes: [
      { id: 'flow.open-external-site', short: 'open-external', version: '1.0.0', contract: 'FlowClass', instances: [
        { id: 'inst.site-github@r1', short: 'github', revision: 1, effect: 'L2', status: 'active', params: '{ vpn: "required" }' },
        { id: 'inst.site-youtube@r3', short: 'youtube', revision: 3, effect: 'L2', status: 'active', params: '{ vpn: "required" }' }
      ]},
      { id: 'flow.ensure-vpn', short: 'ensure-vpn', version: '1.0.0', contract: 'FlowClass', instances: [
        { id: 'inst.ensure-vpn-ask@r2', short: 'ask', revision: 2, effect: 'L2', status: 'active', params: '{ ask: true }' },
        { id: 'inst.ensure-vpn-auto@r1', short: 'auto', revision: 1, effect: 'L2', status: 'active', params: '{ ask: false }' }
      ]},
      { id: 'flow.vpn-profile', short: 'vpn-profile', version: '1.0.0', contract: 'FlowClass', instances: [
        { id: 'inst.vpn-profile.work@r1', short: 'work', revision: 1, effect: 'L1', status: 'active', params: '{ name: "work" }' }
      ]},
      { id: 'flow.preview-file', short: 'preview-file', version: '1.0.0', contract: 'FlowClass', instances: [
        { id: 'inst.preview-file.image@r1', short: 'image', revision: 1, effect: 'L0', status: 'active', params: '{ renderer: "image" }' },
        { id: 'inst.preview-file.text@r1', short: 'text', revision: 1, effect: 'L0', status: 'active', params: '{ renderer: "text" }' }
      ]}
    ]
  },
  {
    id: 'surface', name: '面', color: '#3b82f6', z: Z_BASE[2],
    classes: [
      { id: 'surface.site-launcher', short: 'site-launcher', version: '1.0.0', contract: 'SurfaceClass', instances: [
        { id: 'surface.site-launcher@r3', short: 'main', revision: 3, effect: 'L2', status: 'active', params: '{ placement: "main" }' }
      ]},
      { id: 'surface.settings.vpn', short: 'settings.vpn', version: '1.0.0', contract: 'SurfaceClass', instances: [
        { id: 'surface.settings.vpn@r2', short: 'settings', revision: 2, effect: 'L1', status: 'active', params: '{ scope: "user" }' }
      ]},
      { id: 'surface.run-history', short: 'run-history', version: '1.0.0', contract: 'SurfaceClass', instances: [
        { id: 'surface.run-history.vpn@r2', short: 'vpn', revision: 2, effect: 'L0', status: 'active', params: '{ filter: "errors" }' }
      ]},
      { id: 'surface.preview-window', short: 'preview-window', version: '1.0.0', contract: 'SurfaceClass', instances: [
        { id: 'surface.preview-window.image@r1', short: 'image', revision: 1, effect: 'L0', status: 'active', params: '{ fit: "contain" }' },
        { id: 'surface.preview-window.text@r1', short: 'text', revision: 1, effect: 'L0', status: 'active', params: '{ wrap: true }' }
      ]}
    ]
  },
  {
    id: 'body', name: '体', color: '#f59e0b', z: Z_BASE[3],
    classes: [
      { id: 'body.external-access', short: 'external-access', version: '1.0.0', contract: 'BodyClass', instances: [
        { id: 'body.external-access.work@r3', short: 'work', revision: 3, effect: 'L2', status: 'active', params: '{ vpn: "work" }' },
        { id: 'body.external-access.personal@r2', short: 'personal', revision: 2, effect: 'L2', status: 'active', params: '{ vpn: "personal" }' }
      ]},
      { id: 'body.file-preview', short: 'file-preview', version: '1.0.0', contract: 'BodyClass', instances: [
        { id: 'body.file-preview.image@r1', short: 'image', revision: 1, effect: 'L0', status: 'active', params: '{ renderer: "image" }' },
        { id: 'body.file-preview.text@r1', short: 'text', revision: 1, effect: 'L0', status: 'active', params: '{ renderer: "text" }' }
      ]}
    ]
  }
];

const COMPOSE = [
  ['body.external-access.work@r3', 'surface.site-launcher@r3'],
  ['body.external-access.work@r3', 'surface.settings.vpn@r2'],
  ['body.external-access.work@r3', 'surface.run-history.vpn@r2'],
  ['body.external-access.personal@r2', 'surface.site-launcher@r3'],
  ['body.external-access.personal@r2', 'surface.settings.vpn@r2'],
  ['body.file-preview.image@r1', 'surface.preview-window.image@r1'],
  ['body.file-preview.text@r1', 'surface.preview-window.text@r1'],

  ['surface.site-launcher@r3', 'inst.site-github@r1'],
  ['surface.site-launcher@r3', 'inst.site-youtube@r3'],
  ['surface.site-launcher@r3', 'inst.ensure-vpn-ask@r2'],
  ['surface.settings.vpn@r2', 'inst.vpn-profile.work@r1'],
  ['surface.settings.vpn@r2', 'inst.ensure-vpn-auto@r1'],
  ['surface.run-history.vpn@r2', 'inst.site-github@r1'],
  ['surface.run-history.vpn@r2', 'inst.ensure-vpn-ask@r2'],
  ['surface.preview-window.image@r1', 'inst.preview-file.image@r1'],
  ['surface.preview-window.text@r1', 'inst.preview-file.text@r1'],

  ['inst.site-github@r1', 'vpn.default.status@r1'],
  ['inst.site-github@r1', 'net.reachable.default@r1'],
  ['inst.site-github@r1', 'browser.open.chrome@r1'],
  ['inst.site-youtube@r3', 'vpn.default.status@r1'],
  ['inst.site-youtube@r3', 'net.reachable.default@r1'],
  ['inst.site-youtube@r3', 'browser.open.edge@r1'],
  ['inst.ensure-vpn-ask@r2', 'vpn.default.status@r1'],
  ['inst.ensure-vpn-ask@r2', 'vpn.work.status@r1'],
  ['inst.ensure-vpn-ask@r2', 'notify.toast.default@r1'],
  ['inst.ensure-vpn-auto@r1', 'vpn.work.status@r1'],
  ['inst.ensure-vpn-auto@r1', 'notify.toast.default@r1'],
  ['inst.vpn-profile.work@r1', 'vpn.work.status@r1'],
  ['inst.preview-file.image@r1', 'render.image.default@r1'],
  ['inst.preview-file.text@r1', 'render.text.default@r1']
];

/* ============================================================
   1. 布局：X 类，Y 实例，Z 层
   ============================================================ */
function layerZ(layer) { return layer.z * state.zScale; }

function layout() {
  const classes = [], instances = [], byId = new Map();
  LAYERS.forEach(layer => {
    const n = layer.classes.length;
    const stepX = 1.18;
    layer.classes.forEach((cls, ci) => {
      cls.layer = layer;
      cls.x = (ci - (n - 1) / 2) * stepX;
      cls.y = CLASS_Y;
      cls.z = layerZ(layer);
      classes.push(cls);
      cls.instances.forEach((ins, ii) => {
        ins.layer = layer;
        ins.cls = cls;
        ins.x = cls.x;
        ins.y = INST_Y[ii] ?? (INST_Y[0] + ii * 0.72);
        ins.z = layerZ(layer);
        instances.push(ins);
        byId.set(ins.id, ins);
      });
    });
  });
  return { classes, instances, byId };
}
let NODES = layout();

function nodeById(id) { return NODES.byId.get(id); }

/* ============================================================
   2. 摄像机
   ============================================================ */
function project(p) {
  const cy = Math.cos(state.yaw), sy = Math.sin(state.yaw);
  const x1 = p.x * cy - p.z * sy;
  const z1 = p.x * sy + p.z * cy;
  const cp = Math.cos(state.pitch), sp = Math.sin(state.pitch);
  const y1 = p.y * cp - z1 * sp;
  const z2 = p.y * sp + z1 * cp;
  const depth = Math.max(1.0, state.dist + z2);
  const s = CAM_FOV / depth;
  return { x: W / 2 + x1 * s, y: H / 2 - y1 * s, z: depth, s };
}

function resize() {
  const r = canvas.getBoundingClientRect();
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = Math.max(1, r.width); H = Math.max(1, r.height);
  canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize);

function poly(pts) {
  ctx.beginPath();
  pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
  ctx.closePath();
}

/* ============================================================
   3. 绘制
   ============================================================ */
let pickables = [];

function drawBackground() {
  const g = ctx.createRadialGradient(W * 0.52, H * 0.4, 20, W * 0.52, H * 0.4, Math.max(W, H) * 0.75);
  g.addColorStop(0, 'rgba(34,211,238,0.055)');
  g.addColorStop(0.45, 'rgba(59,130,246,0.02)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawLayerPlane(layer) {
  const z = layerZ(layer);
  const corners = [
    { x: X0, y: Y0, z }, { x: X1, y: Y0, z }, { x: X1, y: Y1, z }, { x: X0, y: Y1, z }
  ].map(project);
  poly(corners);
  ctx.fillStyle = layer.color + '10';
  ctx.fill();
  ctx.strokeStyle = layer.color + '3c';
  ctx.lineWidth = 1;
  ctx.stroke();

  if (state.showGrid) {
    // X 方向：每个类一根竖线（Y 方向）
    layer.classes.forEach(cls => {
      const a = project({ x: cls.x, y: Y0, z });
      const b = project({ x: cls.x, y: Y1, z });
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = layer.color + '16'; ctx.lineWidth = 0.7; ctx.stroke();
    });
    // Y 方向：类行 + 实例行
    [-0.62, 0.42, 1.14].forEach(y => {
      const a = project({ x: X0, y, z });
      const b = project({ x: X1, y, z });
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = layer.color + (y === -0.62 ? '24' : '12');
      ctx.lineWidth = y === -0.62 ? 1.0 : 0.7;
      ctx.stroke();
    });
  }
}

function drawAxes() {
  const o = { x: -4.15, y: -1.3, z: 0 };
  const xEnd = { x: 4.15, y: -1.3, z: 0 };
  const yEnd = { x: -4.15, y: 2.15, z: 0 };
  const zEnd = { x: -4.15, y: -1.3, z: 7.2 * state.zScale };
  const p0 = project(o), px = project(xEnd), py = project(yEnd), pz = project(zEnd);

  const arrow = (a, b, color, label) => {
    ctx.strokeStyle = color; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - Math.cos(ang - 0.4) * 8, b.y - Math.sin(ang - 0.4) * 8);
    ctx.lineTo(b.x - Math.cos(ang + 0.4) * 8, b.y - Math.sin(ang + 0.4) * 8);
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    ctx.font = '600 11px "Cascadia Code", Consolas, monospace';
    ctx.fillStyle = color;
    ctx.fillText(label, b.x + (b.x >= a.x ? 8 : -8) - (b.x >= a.x ? 0 : 48), b.y + (label === 'Y · 实例' ? -8 : 16));
  };
  arrow(p0, px, 'rgba(103,232,249,.75)', 'X · 类');
  arrow(p0, py, 'rgba(196,181,253,.75)', 'Y · 实例');
  arrow(p0, pz, 'rgba(252,211,77,.75)', 'Z · 层');

  // Z 层刻度
  LAYERS.forEach(layer => {
    const p = project({ x: -4.15, y: -1.3, z: layerZ(layer) });
    ctx.fillStyle = layer.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, TAU); ctx.fill();
    ctx.font = '9px "Cascadia Code", Consolas, monospace';
    ctx.fillStyle = layer.color + 'cc';
    ctx.fillText(layer.name, p.x - 20, p.y + 3);
  });
}

function drawClassInstanceLinks() {
  NODES.classes.forEach(cls => {
    const a = project({ x: cls.x, y: cls.y, z: cls.z });
    cls.instances.forEach(ins => {
      const b = project({ x: ins.x, y: ins.y, z: ins.z });
      const selected = state.selection && ((state.selection.kind === 'class' && state.selection.obj === cls) || (state.selection.kind === 'instance' && state.selection.obj === ins));
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = selected ? cls.layer.color + 'bb' : cls.layer.color + '2e';
      ctx.lineWidth = selected ? 1.5 : 0.8;
      ctx.stroke();
      ctx.setLineDash([]);
    });
  });
}

function drawComposeLinks() {
  if (!state.showCompose) return;
  const t = state.time;
  COMPOSE.forEach((pair, idx) => {
    const a = nodeById(pair[0]), b = nodeById(pair[1]);
    if (!a || !b) return;
    const p1 = project(a), p2 = project(b);
    const mid = project({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + 0.32, z: (a.z + b.z) / 2 });
    const selected = state.selection && state.selection.kind === 'instance' && (state.selection.obj === a || state.selection.obj === b);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.quadraticCurveTo(mid.x, mid.y, p2.x, p2.y);
    ctx.strokeStyle = selected ? 'rgba(165,243,252,.65)' : 'rgba(226,240,255,.12)';
    ctx.lineWidth = selected ? 1.4 : 0.7;
    ctx.setLineDash([2, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 组合关系上的小粒子
    const k = ((t * 0.00012 + idx * 0.173) % 1);
    const q = quadPoint(p1, { x: mid.x, y: mid.y }, p2, k);
    ctx.fillStyle = selected ? 'rgba(165,243,252,.9)' : 'rgba(226,240,255,.38)';
    ctx.beginPath(); ctx.arc(q.x, q.y, selected ? 2.2 : 1.2, 0, TAU); ctx.fill();
  });
}

function quadPoint(a, m, b, t) {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * m.x + t * t * b.x, y: u * u * a.y + 2 * u * t * m.y + t * t * b.y };
}

function drawClassNode(cls) {
  const c = project({ x: cls.x, y: cls.y, z: cls.z });
  const s = 0.17 * c.s / 42;
  const corners = [
    [-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]
  ].map(([dx,dy,dz]) => project({ x: cls.x + dx*s, y: cls.y + dy*s, z: cls.z + dz*s }));
  const edges = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
  const sel = state.selection && state.selection.kind === 'class' && state.selection.obj === cls;
  const hov = state.hover && state.hover.kind === 'class' && state.hover.obj === cls;
  for (const [a,b] of edges) {
    ctx.beginPath(); ctx.moveTo(corners[a].x, corners[a].y); ctx.lineTo(corners[b].x, corners[b].y);
    ctx.strokeStyle = sel || hov ? '#e0f2fe' : cls.layer.color;
    ctx.lineWidth = sel ? 1.8 : 1.0;
    ctx.stroke();
  }
  if (sel || hov) {
    ctx.strokeStyle = cls.layer.color + 'aa'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(c.x, c.y, 13, 0, TAU); ctx.stroke();
  }
  pickables.push({ kind: 'class', obj: cls, x: c.x, y: c.y, r: 12 });
  return c;
}

function drawInstanceNode(ins) {
  const c = project({ x: ins.x, y: ins.y, z: ins.z });
  const base = 4.2 + clamp(c.s * 0.02, 0, 2.2);
  const sel = state.selection && state.selection.kind === 'instance' && state.selection.obj === ins;
  const hov = state.hover && state.hover.kind === 'instance' && state.hover.obj === ins;
  const parentSel = state.selection && state.selection.kind === 'class' && state.selection.obj === ins.cls;
  const color = ins.layer.color;
  const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, base * 4);
  g.addColorStop(0, color + 'aa');
  g.addColorStop(0.25, color + '33');
  g.addColorStop(1, color + '00');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(c.x, c.y, base * 4, 0, TAU); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(c.x, c.y, base, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  ctx.beginPath(); ctx.arc(c.x - base * 0.25, c.y - base * 0.3, Math.max(0.7, base * 0.28), 0, TAU); ctx.fill();
  if (ins.effect === 'L2' || ins.effect === 'L3') {
    ctx.strokeStyle = ins.effect === 'L3' ? 'rgba(239,68,68,.8)' : 'rgba(245,158,11,.8)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(c.x, c.y, base + 4, 0, TAU); ctx.stroke();
  }
  if (sel || hov || parentSel) {
    ctx.strokeStyle = sel || hov ? '#fff' : color;
    ctx.lineWidth = sel ? 1.6 : 1.0;
    ctx.beginPath(); ctx.arc(c.x, c.y, base + 6, 0, TAU); ctx.stroke();
  }
  pickables.push({ kind: 'instance', obj: ins, x: c.x, y: c.y, r: 12 });
  return c;
}

function drawNodeLabels() {
  // 类标签：X 轴下方
  if (state.showLabels) {
    NODES.classes.forEach(cls => {
      const p = project({ x: cls.x, y: Y0 - 0.13, z: cls.z });
      ctx.font = '9px "Cascadia Code", Consolas, monospace';
      ctx.fillStyle = cls.layer.color + 'b0';
      ctx.textAlign = 'center';
      ctx.fillText(cls.short, p.x, p.y + 3);
      ctx.textAlign = 'left';
    });
  }
  // 层标签
  LAYERS.forEach(layer => {
    const p = project({ x: X0 - 0.18, y: Y1 + 0.12, z: layerZ(layer) });
    ctx.font = '600 11px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = layer.color;
    ctx.fillText(layer.name + '层', p.x - 18, p.y);
    ctx.font = '9px "Cascadia Code", Consolas, monospace';
    ctx.fillStyle = layer.color + '88';
    ctx.fillText('Z=' + layer.z.toFixed(1), p.x - 18, p.y + 12);
  });
  // 悬停/选中实例标签
  const sel = state.selection && state.selection.kind === 'instance' ? state.selection.obj : null;
  const hov = state.hover && state.hover.kind === 'instance' ? state.hover.obj : null;
  [sel, hov].filter(Boolean).forEach(ins => {
    const c = project({ x: ins.x, y: ins.y, z: ins.z });
    ctx.font = '9px "Cascadia Code", Consolas, monospace';
    ctx.fillStyle = 'rgba(226,240,255,.92)';
    ctx.fillText(ins.id, c.x + 10, c.y - 7);
  });
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  drawBackground();
  pickables = [];

  // 平面从远到近
  [...LAYERS].sort((a, b) => layerZ(b) - layerZ(a)).forEach(drawLayerPlane);
  drawAxes();
  drawComposeLinks();
  drawClassInstanceLinks();

  // 节点从远到近
  const items = [];
  NODES.classes.forEach(cls => items.push({ type: 'class', obj: cls, depth: project({ x: cls.x, y: cls.y, z: cls.z }).z }));
  NODES.instances.forEach(ins => items.push({ type: 'instance', obj: ins, depth: project({ x: ins.x, y: ins.y, z: ins.z }).z }));
  items.sort((a, b) => b.depth - a.depth);
  for (const it of items) it.type === 'class' ? drawClassNode(it.obj) : drawInstanceNode(it.obj);

  drawNodeLabels();
  updateStatus();
}

/* ============================================================
   4. 交互
   ============================================================ */
function hitTest(x, y) {
  let best = null, bd = 14;
  for (const p of pickables) {
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < bd) { bd = d; best = { kind: p.kind, obj: p.obj }; }
  }
  return best;
}

function inspectorHTML(sel) {
  if (!sel) return '<div class="empty">点击空心类方块或实心实例点。拖拽旋转，滚轮缩放。</div>';
  if (sel.kind === 'class') {
    const c = sel.obj;
    return `<h3>类 · ${esc(c.id)}</h3><div class="sub">${esc(c.contract)}@${esc(c.version)} · ${esc(c.layer.name)}层</div>
      <div class="kv"><div class="k">X 轴</div><div class="v">类列 ${NODES.classes.filter(x => x.layer === c.layer).indexOf(c) + 1}</div><div class="k">Z 层</div><div class="v">${esc(c.layer.name)} · Z=${c.layer.z.toFixed(1)}</div><div class="k">实例</div><div class="v">${c.instances.length}</div><div class="k">instances</div><div class="v">${c.instances.map(i => `<span class="pill">${esc(i.short)}</span>`).join('')}</div></div>`;
  }
  const i = sel.obj;
  return `<h3>实例 · ${esc(i.id)}</h3><div class="sub">${esc(i.cls.contract)} ${esc(i.cls.id)}@${esc(i.cls.version)} · ${esc(i.layer.name)}层</div>
    <div class="kv"><div class="k">Y 轴</div><div class="v">实例行 ${i.cls.instances.indexOf(i) + 1}</div><div class="k">revision</div><div class="v">r${i.revision}</div><div class="k">effect</div><div class="v"><span class="pill ${i.layer.id}">${esc(i.effect)}</span></div><div class="k">status</div><div class="v">${esc(i.status)}</div><div class="k">params</div><div class="v"><code>${esc(i.params)}</code></div></div>`;
}

function inspect(sel) {
  state.selection = sel;
  $('#inspector').innerHTML = inspectorHTML(sel);
  draw();
}

function updateStatus() {
  const s = state.selection;
  $('#status').innerHTML = s ? `selected · <b>${esc(s.kind)}</b>` : `idle · <b>0</b> selected`;
}

function resetView() {
  state.yaw = -0.62; state.pitch = 0.38; state.dist = 18.2;
}

/* ============================================================
   5. 事件与动画
   ============================================================ */
canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId);
  state.dragging = true; state.moved = 0;
  state.lastX = e.clientX; state.lastY = e.clientY;
  canvas.classList.add('dragging');
});
canvas.addEventListener('pointermove', e => {
  const r = canvas.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  if (state.dragging) {
    const dx = e.clientX - state.lastX, dy = e.clientY - state.lastY;
    state.lastX = e.clientX; state.lastY = e.clientY;
    state.moved += Math.abs(dx) + Math.abs(dy);
    state.yaw += dx * 0.008;
    state.pitch = clamp(state.pitch + dy * 0.006, -1.15, 1.15);
  } else {
    const hit = hitTest(mx, my);
    state.hover = hit;
    canvas.style.cursor = hit ? 'pointer' : 'grab';
  }
});
canvas.addEventListener('pointerup', e => {
  canvas.classList.remove('dragging');
  const wasDrag = state.moved > 5;
  state.dragging = false;
  if (!wasDrag) {
    const r = canvas.getBoundingClientRect();
    const hit = hitTest(e.clientX - r.left, e.clientY - r.top);
    if (hit) inspect(hit);
  }
});
canvas.addEventListener('pointercancel', () => { state.dragging = false; canvas.classList.remove('dragging'); });
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  state.dist = clamp(state.dist + e.deltaY * 0.012, 9, 34);
}, { passive: false });

$('#zScale').addEventListener('input', e => {
  state.zScale = +e.target.value / 100;
  $('#zScaleV').textContent = e.target.value + '%';
  NODES = layout();
  state.selection = null;
  state.hover = null;
  $('#inspector').innerHTML = inspectorHTML(null);
});
$('#showCompose').addEventListener('change', e => { state.showCompose = e.target.checked; });
$('#showLabels').addEventListener('change', e => { state.showLabels = e.target.checked; });
$('#showGrid').addEventListener('change', e => { state.showGrid = e.target.checked; });
$('#autoRotate').addEventListener('change', e => { state.autoRotate = e.target.checked; });
$('#resetBtn').addEventListener('click', resetView);
document.addEventListener('keydown', e => {
  if (e.key === 'r' || e.key === 'R') resetView();
  if (e.key === 'Escape') { state.selection = null; $('#inspector').innerHTML = inspectorHTML(null); }
});

function frame(t) {
  state.time = t;
  if (state.autoRotate && !state.dragging) state.yaw += 0.0007;
  draw();
  requestAnimationFrame(frame);
}

resize();
$('#inspector').innerHTML = inspectorHTML(null);
requestAnimationFrame(frame);
})();

