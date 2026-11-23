from pathlib import Path
import json, re, html

mods = json.loads(Path('.point-modules.json').read_text(encoding='utf-8'))
# 解析器对 target_params() 辅助函数取不到，手动补齐
window_target = [
    {'key':'id','label':'窗口 id（来自 window.list）','type':'number','required':False,'options':[],'default':'0'},
    {'key':'query','label':'或按文本查找窗口','type':'text','required':False,'options':[],'default':''},
    {'key':'by','label':'query 匹配字段：title / process / class','type':'text','required':False,'options':[],'default':'title'},
]
for mid in ['window.activate','window.close','window.minimize']:
    mods[mid]['inputs'] = window_target

SUMMARIES = {
 'data.csv':'解析 CSV 文件为行/列数据。',
 'file.exists':'判断路径是否存在，返回是否目录与字节数。',
 'file.list':'按目录、通配符、递归开关枚举文件。',
 'file.read':'读取文本文件，支持最大字节限制。',
 'file.write':'写入/追加文本，可选自动建父目录；L2 不可逆。',
 'flow.wait':'等待指定毫秒，上限 10 分钟。',
 'http.download':'下载 URL 到文件，状态码不对不落盘。',
 'http.request':'发起 HTTP 请求，返回状态、响应体与耗时。',
 'image.convert':'PNG ↔ BMP 格式转换。',
 'image.crop':'按矩形裁剪图片，越界报错。',
 'image.info':'按魔数识别图片格式，返回宽高与字节数。',
 'image.resize':'按 nearest/bilinear 缩放图片。',
 'input.clipboard':'读写剪贴板文本；复制/粘贴是同一类的不同参数。',
 'input.selectedText':'读取当前选中文本；可恢复剪贴板。',
 'input.simulate':'模拟按键、输入文本、点击、移动；键鼠效果不可撤销。',
 'json.get':'按点路径读取 JSON 字段，取不到返回 null。',
 'list.append':'向列表追加一个元素。',
 'list.length':'返回列表长度。',
 'math.add':'两个数字相加。',
 'screen.capture':'抓取屏幕区域并保存 PNG；L2 不可逆。',
 'screen.pixel':'读取屏幕单像素的 RGB / HEX。',
 'sys.env':'按名字读取环境变量，不提供全量枚举。',
 'sys.info':'返回 OS、架构、核数、用户、机器名、主目录。',
 'sys.open':'用系统默认程序打开文件/文件夹/URL。',
 'sys.pause':'暂停全部手势、触发角与摩擦边。',
 'sys.run':'在 cmd.exe 中运行命令，可隐藏窗口。',
 'sys.volume':'音量调高/调低/静音，按步数执行。',
 'text.regex':'正则提取/替换文本。',
 'text.split':'按分隔符或行切分文本。',
 'text.template':'用变量渲染文本模板。',
 'var.const':'写入一个常量值。',
 'web.search':'把关键词或选中文字送进搜索引擎。',
 'window.activate':'按 id/query 查找并聚焦窗口，最小化会自动还原。',
 'window.close':'向窗口发送 WM_CLOSE，让程序有机会保存。',
 'window.control':'对光标下/前台窗口做最大化、最小化、关闭、置顶、左右停靠。',
 'window.find':'按标题/进程/类查找窗口，子串匹配。',
 'window.list':'枚举可见且有标题的顶层窗口。',
 'window.minimize':'最小化指定窗口。',
}
DOMAINS = {
 'text':('文本','T','#60A5FA'), 'list':('列表','L','#34D399'), 'json':('JSON','{}','#FBBF24'),
 'math':('计算','∑','#F472B6'), 'var':('变量','V','#A78BFA'), 'flow':('流程','↳','#22D3EE'),
 'file':('文件','▤','#FB923C'), 'input':('输入','⌨','#3B82F6'), 'window':('窗口','▣','#8B5CF6'),
 'screen':('屏幕','◎','#10B981'), 'image':('图像','▧','#EC4899'), 'data':('数据','▦','#84CC16'),
 'http':('HTTP','⇄','#06B6D4'), 'web':('Web','⌕','#F59E0B'), 'sys':('系统','⚙','#94A3B8'),
}
DOMAIN_ORDER = list(DOMAINS.keys())
PERM_LABELS = {
 'FileRead':'文件读取','FileWrite':'文件写入','ClipboardRead':'剪贴板读取','ClipboardWrite':'剪贴板写入',
 'InputSimulate':'键鼠模拟','UiAutomation':'UI 自动化','ScreenCapture':'屏幕捕获',
 'NetworkOutbound':'网络出站','ProcessControl':'进程控制','RegistryWrite':'注册表写入',
}
EFFECT_LABELS = {'ReadOnly':('L0','只读'),'Reversible':('L1','可逆写'),'Irreversible':('L2','不可逆写'),'System':('L3','系统级')}

# 解析真实动作实例
instances = {mid: [] for mid in mods}
action_files = sorted(Path('examples/actions').glob('*.json'))
def walk(steps, action):
    for s in steps:
        mid = s.get('module')
        if mid:
            instances.setdefault(mid, []).append({
                'actionId': action.get('id',''), 'actionName': action.get('name',''),
                'stepId': s.get('id',''), 'inputs': s.get('inputs',{}), 'output': s.get('output'),
            })
        for k in ('then','else','do'):
            if isinstance(s.get(k), list): walk(s[k], action)
for p in action_files:
    try: a = json.loads(p.read_text(encoding='utf-8'))
    except Exception: continue
    walk(a.get('steps',[]), a)

modules = []
for mid, m in mods.items():
    domain = mid.split('.')[0]
    if domain not in DOMAINS: domain = 'sys'
    effect = m.get('effect','ReadOnly')
    ecode, elabel = EFFECT_LABELS.get(effect, ('L0','只读'))
    modules.append({
        'id': mid, 'name': m.get('name', mid), 'version': m.get('version','0.1.0'),
        'domain': domain, 'domainLabel': DOMAINS[domain][0], 'icon': DOMAINS[domain][1], 'color': DOMAINS[domain][2],
        'effect': ecode, 'effectKey': effect, 'effectLabel': elabel,
        'idempotent': bool(m.get('idempotent')),
        'permissions': [{'key':p,'label':PERM_LABELS.get(p,p)} for p in m.get('permissions',[])],
        'inputs': m.get('inputs',[]), 'outputs': m.get('outputs',[]),
        'summary': SUMMARIES.get(mid, ''),
        'instances': instances.get(mid, []),
    })
modules.sort(key=lambda x: (DOMAIN_ORDER.index(x['domain']) if x['domain'] in DOMAIN_ORDER else 99, x['id']))

domain_list = []
for d in DOMAIN_ORDER:
    ms = [m for m in modules if m['domain']==d]
    if ms:
        domain_list.append({'id':d,'label':DOMAINS[d][0],'icon':DOMAINS[d][1],'color':DOMAINS[d][2],'count':len(ms),'instances':sum(len(m['instances']) for m in ms)})

data = {
    'generatedAt':'2026-11-23',
    'moduleCount':len(modules),
    'actionCount':len(action_files),
    'instanceCount':sum(len(m['instances']) for m in modules),
    'domains':domain_list,
    'modules':modules,
    'effectCounts': {k:sum(1 for m in modules if m['effect']==k) for k in ['L0','L1','L2','L3']},
}

template = r'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>点层现状 · 功能类与实例</title>
<style>
:root{
  --bg:#080d18; --surface:#0f172a; --raised:#151f35; --raised2:#1b2740;
  --border:#25324a; --border-strong:#33415c; --text:#e2e8f0; --muted:#94a3b8; --dim:#64748b;
  --primary:#3b82f6; --success:#22c55e; --warning:#f59e0b; --danger:#ef4444; --new:#8b5cf6;
  --radius:12px; --radius-sm:8px; --mono:ui-monospace,SFMono-Regular,Consolas,'Liberation Mono',monospace;
  --sans:'Segoe UI',system-ui,-apple-system,'Microsoft YaHei',sans-serif;
}
*{box-sizing:border-box}
html,body{height:100%}
body{margin:0;background:radial-gradient(1200px 600px at 18% -10%,rgba(59,130,246,.12),transparent 55%),var(--bg);color:var(--text);font-family:var(--sans);font-size:13px;overflow:hidden}
button,input,select{font:inherit}
button{cursor:pointer}
.topbar{height:64px;display:flex;align-items:center;gap:14px;padding:0 20px;border-bottom:1px solid var(--border);background:rgba(8,13,24,.92);backdrop-filter:blur(14px);position:relative;z-index:10}
.brand{display:flex;align-items:center;gap:10px;min-width:250px}
.logo{width:32px;height:32px;border-radius:9px;display:grid;place-items:center;background:linear-gradient(135deg,#1d4ed8,#7c3aed);color:#fff;font-weight:800;font-size:14px;box-shadow:0 0 0 1px rgba(255,255,255,.12) inset}
.brand b{font-size:14px;letter-spacing:.01em}.brand span{display:block;font-size:9px;color:var(--muted);letter-spacing:.12em;text-transform:uppercase;margin-top:2px}
.search{flex:1;max-width:520px;position:relative}
.search input{width:100%;height:34px;border-radius:9px;border:1px solid var(--border);background:var(--surface);color:var(--text);padding:0 12px 0 34px;outline:none;font-size:12px}
.search input:focus{border-color:rgba(59,130,246,.55);box-shadow:0 0 0 3px rgba(59,130,246,.10)}
.search .ic{position:absolute;left:12px;top:9px;color:var(--dim);font-size:13px}
.seg{display:flex;border:1px solid var(--border);border-radius:8px;overflow:hidden;background:var(--surface)}
.seg button{border:0;background:transparent;color:var(--muted);padding:7px 11px;font-size:11px}
.seg button.active{background:rgba(59,130,246,.14);color:#bfdbfe}
.top-meta{margin-left:auto;color:var(--dim);font-size:10px;text-align:right;line-height:1.5;white-space:nowrap}
.app{display:grid;grid-template-columns:226px minmax(0,1fr) 362px;height:calc(100vh - 64px)}
.sidebar{border-right:1px solid var(--border);background:rgba(10,16,30,.7);padding:16px 12px;overflow:auto}
.side-title{font-size:9px;color:var(--dim);letter-spacing:.14em;text-transform:uppercase;margin:0 8px 9px}
.domain-item{width:100%;display:flex;align-items:center;gap:9px;border:1px solid transparent;background:transparent;color:var(--muted);padding:8px 9px;border-radius:8px;text-align:left;margin-bottom:2px}
.domain-item:hover{background:rgba(255,255,255,.035);color:var(--text)}
.domain-item.active{background:rgba(59,130,246,.11);border-color:rgba(59,130,246,.22);color:#dbeafe}
.domain-icon{width:24px;height:24px;border-radius:6px;display:grid;place-items:center;background:color-mix(in srgb,var(--c) 15%,transparent);color:var(--c);font-family:var(--mono);font-size:11px;flex:0 0 auto}
.domain-item .dn{flex:1;font-size:12px}.fcount{font-family:var(--mono);font-size:10px;color:var(--dim)}
.side-note{margin:16px 8px 0;padding-top:12px;border-top:1px solid var(--border);font-size:10px;line-height:1.65;color:var(--dim)}
.side-note b{color:var(--muted);font-weight:600}
.main{overflow:auto;padding:20px 22px 40px;min-width:0}
.page-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:14px}
.page-head h1{margin:0;font-size:22px;letter-spacing:-.03em}.page-head p{margin:5px 0 0;color:var(--muted);font-size:11px}
.legend{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;padding-top:4px}
.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-bottom:16px}
.stat{border:1px solid var(--border);border-radius:var(--radius);background:linear-gradient(180deg,rgba(255,255,255,.025),transparent 75%),var(--raised);padding:12px 13px}
.stat .l{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim)}.stat .v{font-size:22px;font-weight:750;letter-spacing:-.03em;margin-top:5px}.stat .s{font-size:9px;color:var(--muted);margin-top:2px}
.domain-section{margin-bottom:20px}
.domain-head{display:flex;align-items:center;gap:8px;margin:0 0 9px;color:var(--muted);font-size:10px;letter-spacing:.08em;text-transform:uppercase}
.domain-head .dot{width:7px;height:7px;border-radius:2px;background:var(--c)}.domain-head .cnt{color:var(--dim);font-family:var(--mono)}
.cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.class-card{border:1px solid var(--border);border-radius:var(--radius);background:linear-gradient(180deg,rgba(255,255,255,.018),transparent 55%),var(--raised);overflow:hidden;transition:border-color .12s,transform .12s}
.class-card:hover{border-color:var(--border-strong);transform:translateY(-1px)}
.class-card.selected{border-color:rgba(59,130,246,.55);box-shadow:0 0 0 1px rgba(59,130,246,.2)}
.class-head{display:flex;align-items:flex-start;gap:9px;padding:12px 13px 10px}
.class-icon{width:30px;height:30px;border-radius:8px;display:grid;place-items:center;background:color-mix(in srgb,var(--c) 16%,transparent);color:var(--c);font-family:var(--mono);font-size:12px;flex:0 0 auto}
.class-main{min-width:0;flex:1}.class-title{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:13px;font-weight:650;letter-spacing:-.01em}
.class-id{font-family:var(--mono);font-size:9px;color:var(--dim);margin-top:3px}
.class-summary{font-size:10.5px;color:var(--muted);line-height:1.55;margin:0 13px 9px}
.badges{display:flex;gap:4px;flex-wrap:wrap}
.badge{display:inline-flex;align-items:center;gap:4px;font-size:9px;padding:2px 6px;border-radius:99px;border:1px solid var(--border);color:var(--muted);white-space:nowrap}
.badge.L0{color:#86efac;border-color:rgba(34,197,94,.28);background:rgba(34,197,94,.07)}
.badge.L1{color:#93c5fd;border-color:rgba(59,130,246,.28);background:rgba(59,130,246,.07)}
.badge.L2{color:#fdba74;border-color:rgba(245,158,11,.3);background:rgba(245,158,11,.08)}
.badge.L3{color:#d8b4fe;border-color:rgba(139,92,246,.3);background:rgba(139,92,246,.08)}
.badge.ok{color:#86efac;border-color:rgba(34,197,94,.22);background:rgba(34,197,94,.05)}
.badge.perm{color:#c4b5fd;border-color:rgba(139,92,246,.2);background:rgba(139,92,246,.05)}
.param-row{display:flex;gap:4px;flex-wrap:wrap;padding:0 13px 9px}
.param{font-family:var(--mono);font-size:9px;color:#bfdbfe;border:1px solid rgba(59,130,246,.18);background:rgba(59,130,246,.055);padding:2px 5px;border-radius:4px}
.param .req{color:#fca5a5;margin-left:2px}
.param.more{color:var(--dim);border-color:var(--border);background:transparent}
.instances{border-top:1px solid var(--border);padding:7px 9px 8px;max-height:196px;overflow:auto}
.instances::-webkit-scrollbar{width:5px}.instances::-webkit-scrollbar-thumb{background:var(--border-strong);border-radius:9px}
.instance{width:100%;display:flex;align-items:flex-start;gap:7px;border:0;background:transparent;color:var(--muted);text-align:left;padding:5px 6px;border-radius:6px;font-size:10px}
.instance:hover{background:rgba(59,130,246,.07);color:var(--text)}
.instance .dot{width:5px;height:5px;border-radius:99px;background:var(--c);margin-top:4px;flex:0 0 auto}
.instance .iname{font-weight:600;color:var(--text);font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px}
.instance .iact{font-family:var(--mono);font-size:8px;color:var(--dim);margin-left:4px;white-space:nowrap}
.instance .isum{display:block;font-family:var(--mono);font-size:8.5px;color:var(--dim);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:270px}
.empty{padding:36px;text-align:center;color:var(--muted);border:1px dashed var(--border);border-radius:var(--radius)}
.inspector{border-left:1px solid var(--border);background:rgba(10,16,30,.78);overflow:auto;padding:16px 16px 40px}
.insp-empty{height:80%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--dim);text-align:center;font-size:11px;line-height:1.7}
.insp-empty .big{font-size:30px;color:var(--border-strong);margin-bottom:8px}
.insp-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;padding-bottom:12px;border-bottom:1px solid var(--border)}
.kicker{font-size:9px;letter-spacing:.12em;color:var(--dim);text-transform:uppercase}.insp-title{font-size:17px;font-weight:700;margin:4px 0 2px;letter-spacing:-.02em}.insp-id{font-family:var(--mono);font-size:9px;color:var(--muted);word-break:break-all}
.close{border:0;background:transparent;color:var(--dim);font-size:15px;padding:2px 4px}.close:hover{color:var(--text)}
.insp-section{margin-top:16px}.insp-section h3{font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);margin:0 0 7px;font-weight:600}
.kv{display:grid;grid-template-columns:88px 1fr;gap:6px 8px;font-size:10.5px}.kv .k{color:var(--dim)}.kv .v{color:var(--text);word-break:break-word}
.ptable{width:100%;border-collapse:collapse;font-size:10px}.ptable th{text-align:left;color:var(--dim);font-weight:500;padding:4px 5px;border-bottom:1px solid var(--border);font-size:9px}.ptable td{padding:5px;border-bottom:1px solid rgba(37,50,74,.6);vertical-align:top;color:var(--muted)}.ptable td:first-child{font-family:var(--mono);color:#bfdbfe;white-space:nowrap}
.json{background:#070c16;border:1px solid var(--border);border-radius:8px;padding:9px;font-family:var(--mono);font-size:9.5px;line-height:1.55;color:#cbd5e1;white-space:pre-wrap;word-break:break-word;max-height:260px;overflow:auto}
.mini-btn{border:1px solid var(--border);background:var(--surface);color:var(--muted);padding:4px 7px;border-radius:6px;font-size:9px}.mini-btn:hover{color:var(--text);border-color:var(--border-strong)}
.instance-line{display:flex;align-items:flex-start;gap:7px;padding:6px 0;border-bottom:1px solid rgba(37,50,74,.55);font-size:10px}.instance-line:last-child{border-bottom:0}
.instance-line .nm{font-weight:600;color:var(--text)}.instance-line .aid{font-family:var(--mono);font-size:8px;color:var(--dim);margin-top:2px}
.table-wrap{border:1px solid var(--border);border-radius:var(--radius);overflow:auto;background:var(--raised)}
table.cat{width:100%;border-collapse:collapse;min-width:860px}table.cat th{text-align:left;padding:9px 10px;color:var(--dim);font-size:9px;letter-spacing:.08em;text-transform:uppercase;border-bottom:1px solid var(--border);background:rgba(255,255,255,.015);white-space:nowrap}table.cat td{padding:8px 10px;border-bottom:1px solid var(--border);font-size:11px;vertical-align:top}table.cat tr:last-child td{border-bottom:0}table.cat tr.class-row{cursor:pointer}table.cat tr.class-row:hover{background:rgba(59,130,246,.055)}table.cat tr.inst-row td{padding-left:30px;font-size:10px;color:var(--muted);background:rgba(0,0,0,.08)}.idc{font-family:var(--mono);font-size:9px;color:var(--dim)}.summary-td{max-width:360px;color:var(--muted);font-size:10px}
.toast{position:fixed;bottom:22px;left:50%;transform:translate(-50%,20px);background:#111c31;border:1px solid var(--border-strong);color:var(--text);padding:8px 12px;border-radius:8px;font-size:11px;opacity:0;pointer-events:none;transition:.18s;z-index:50}.toast.show{opacity:1;transform:translate(-50%,0)}
@media(max-width:1250px){.app{grid-template-columns:210px minmax(0,1fr)}.inspector{display:none}.cards{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:900px){.app{grid-template-columns:1fr}.sidebar{display:none}.cards{grid-template-columns:1fr}.top-meta{display:none}.stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
</head>
<body>
<header class="topbar">
  <div class="brand"><div class="logo">点</div><div><b>百应 · 点层现状</b><span>Point Layer · Classes &amp; Instances</span></div></div>
  <div class="search"><span class="ic">⌕</span><input id="q" placeholder="搜索类 id / 名称 / 参数 / 动作实例… 按 / 聚焦"></div>
  <div class="seg" id="viewSwitch"><button data-view="cards" class="active">卡片</button><button data-view="table">表格</button></div>
  <div class="top-meta">数据源：ModuleManifest + examples/actions<br>生成：<span id="genDate"></span></div>
</header>
<div class="app">
  <aside class="sidebar">
    <div class="side-title">Domain</div>
    <div id="domainNav"></div>
    <div class="side-note"><b>当前口径</b><br>类 = 已注册 ModuleManifest。<br>实例 = 示例动作里的真实 step，不是独立实例表。<br><br><b>只显示已落地能力</b><br>规划中的 OCR / 亮度 / AI / UIA 等不混进来。</div>
  </aside>
  <main class="main">
    <div class="page-head"><div><h1>功能类与实例</h1><p id="sub"></p></div><div class="legend" id="legend"></div></div>
    <div class="stats" id="stats"></div>
    <div id="content"></div>
  </main>
  <aside class="inspector" id="inspector"><div class="insp-empty"><div class="big">◇</div><strong>Inspector</strong><br>点一个类或实例<br>查看契约、参数与真实 JSON。</div></aside>
</div>
<div id="toast" class="toast"></div>
<script>
const DATA = __DATA__;
const $ = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
const esc = (v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state = { domain:'all', query:'', view:'cards', selected:null, expanded:new Set() };
const domainById = Object.fromEntries(DATA.domains.map(d=>[d.id,d]));
function inputSummary(inputs){
  if(!inputs || typeof inputs!=='object') return '';
  return Object.entries(inputs).slice(0,4).map(([k,v])=>{
    let s = typeof v==='string'?v:JSON.stringify(v);
    if(s.length>34) s=s.slice(0,33)+'…';
    return `${k}=${s}`;
  }).join(' · ');
}
function effectBadge(m){ return `<span class="badge ${m.effect}">${m.effect} ${m.effectLabel}</span>`; }
function moduleMatches(m){
  const q=state.query.trim().toLowerCase();
  if(!q) return true;
  const hay=[m.id,m.name,m.summary,m.domain,m.domainLabel,...m.inputs.map(p=>p.key+' '+p.label),...m.instances.map(i=>i.actionId+' '+i.actionName+' '+i.stepId+' '+JSON.stringify(i.inputs))].join(' ').toLowerCase();
  return hay.includes(q);
}
function filteredModules(){
  return DATA.modules.filter(m=> (state.domain==='all'||m.domain===state.domain) && moduleMatches(m));
}
function renderNav(){
  const all = `<button class="domain-item ${state.domain==='all'?'active':''}" data-domain="all"><span class="domain-icon" style="--c:#3b82f6">◈</span><span class="dn">全部</span><span class="fcount">${DATA.moduleCount}</span></button>`;
  $('#domainNav').innerHTML = all + DATA.domains.map(d=>`<button class="domain-item ${state.domain===d.id?'active':''}" data-domain="${d.id}"><span class="domain-icon" style="--c:${d.color}">${d.icon}</span><span class="dn">${d.label}</span><span class="fcount">${d.count}</span></button>`).join('');
  $$('#domainNav [data-domain]').forEach(b=>b.onclick=()=>{state.domain=b.dataset.domain; render();});
}
function renderStats(){
  const e=DATA.effectCounts;
  const items=[['功能类',DATA.moduleCount,'已注册 ModuleManifest'],['真实实例',DATA.instanceCount,'来自 '+DATA.actionCount+' 个示例动作'],['Domain',DATA.domains.length,'text / window / sys …'],['被示例引用',DATA.moduleCount+'/'+DATA.moduleCount,'所有类至少被一个动作使用']];
  $('#stats').innerHTML=items.map(([l,v,s])=>`<div class="stat"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
  $('#legend').innerHTML=`<span class="badge L0">L0 只读</span><span class="badge L1">L1 可逆写</span><span class="badge L2">L2 不可逆</span><span class="badge">L3 系统级</span>`;
  $('#genDate').textContent=DATA.generatedAt;
}
function renderCards(list){
  if(!list.length) return `<div class="empty"><b>没有匹配的类</b><br>试试清空搜索或切换 Domain。</div>`;
  return DATA.domains.filter(d=>list.some(m=>m.domain===d.id)).map(d=>{
    const ms=list.filter(m=>m.domain===d.id);
    return `<section class="domain-section"><div class="domain-head" style="--c:${d.color}"><span class="dot"></span>${d.label}<span class="cnt">${ms.length} 类 · ${ms.reduce((n,m)=>n+m.instances.length,0)} 实例</span></div><div class="cards">${ms.map(m=>renderCard(m)).join('')}</div></section>`;
  }).join('');
}
function renderCard(m){
  const selected=state.selected?.type==='class'&&state.selected.id===m.id;
  const params=m.inputs.slice(0,7).map(p=>`<span class="param">${esc(p.key)}${p.required?'<span class="req">*</span>':''}</span>`).join('');
  const more=m.inputs.length>7?`<span class="param more">+${m.inputs.length-7}</span>`:'';
  const inst=m.instances.map((i,idx)=>`<button class="instance" data-class="${m.id}" data-index="${idx}"><span class="dot"></span><span><span class="iname">${esc(i.actionName||i.actionId)}</span><span class="iact">${esc(i.stepId)}</span><span class="isum">${esc(inputSummary(i.inputs)||'（无参数）')}</span></span></button>`).join('')||`<div class="instance"><span class="dot"></span><span class="isum">示例动作里还没有用到这个类</span></div>`;
  return `<article class="class-card ${selected?'selected':''}" data-class="${m.id}">
    <div class="class-head"><div class="class-icon" style="--c:${m.color}">${m.icon}</div><div class="class-main"><div class="class-title">${esc(m.name)} ${effectBadge(m)} ${m.idempotent?'<span class="badge ok">幂等</span>':''}</div><div class="class-id">${esc(m.id)} · v${esc(m.version)}</div></div></div>
    <div class="class-summary">${esc(m.summary)}</div>
    <div class="param-row">${params}${more}</div>
    <div class="badges" style="padding:0 13px 9px">${m.permissions.map(p=>`<span class="badge perm">${esc(p.label)}</span>`).join('')||'<span class="badge">无权限</span>'}<span class="badge">${m.instances.length} 实例</span></div>
    <div class="instances">${inst}</div>
  </article>`;
}
function renderTable(list){
  if(!list.length) return `<div class="empty"><b>没有匹配的类</b></div>`;
  const rows=list.map(m=>{
    const exp=state.expanded.has(m.id);
    const main=`<tr class="class-row" data-class="${m.id}"><td><span class="idc">${exp?'▾':'▸'}</span> <b>${esc(m.name)}</b><div class="idc">${esc(m.id)}</div></td><td>${m.domainLabel}</td><td>${effectBadge(m)}</td><td>${m.permissions.map(p=>esc(p.label)).join(' / ')||'—'}</td><td>${m.inputs.map(p=>`<span class="param">${esc(p.key)}</span>`).join('')||'—'}</td><td>${m.instances.length}</td><td class="summary-td">${esc(m.summary)}</td></tr>`;
    const inst=exp?m.instances.map((i,idx)=>`<tr class="inst-row" data-class="${m.id}" data-index="${idx}"><td>└ ${esc(i.actionName||i.actionId)}<div class="idc">${esc(i.stepId)}</div></td><td colspan="6"><span class="idc">${esc(inputSummary(i.inputs)||'（无参数）')}</span></td></tr>`).join(''):'';
    return main+inst;
  }).join('');
  return `<div class="table-wrap"><table class="cat"><thead><tr><th>类</th><th>Domain</th><th>副作用</th><th>权限</th><th>参数</th><th>实例</th><th>说明</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function render(){
  const list=filteredModules();
  $('#sub').textContent=`${list.length} 个类 · ${list.reduce((n,m)=>n+m.instances.length,0)} 个实例步骤 · 点击类/实例查看详情`;
  $('#content').innerHTML=state.view==='table'?renderTable(list):renderCards(list);
  $$('#content [data-class]').forEach(el=>{
    el.onclick=(e)=>{
      e.stopPropagation();
      const m=DATA.modules.find(x=>x.id===el.dataset.class);
      if(!m) return;
      if(el.dataset.index!==undefined && m.instances[+el.dataset.index]){
        openInstance(m,m.instances[+el.dataset.index]);
      }else if(el.classList.contains('class-row')){
        if(state.expanded.has(m.id)) state.expanded.delete(m.id); else state.expanded.add(m.id);
        render();
      }else{
        openClass(m);
      }
    };
  });
}
function openClass(m){
  state.selected={type:'class',id:m.id};
  render();
  const rows=m.inputs.map(p=>`<tr><td>${esc(p.key)}${p.required?' *':''}</td><td>${esc(p.label)}</td><td>${esc(p.type)}</td><td>${esc((p.options||[]).join(' / ')||'—')}</td></tr>`).join('')||'<tr><td colspan="4" style="color:var(--dim)">无参数</td></tr>';
  const outs=m.outputs.map(o=>`${esc(o.key)}:${esc(o.type)}`).join(' · ')||'—';
  const inst=m.instances.map((i,idx)=>`<div class="instance-line"><div style="flex:1"><div class="nm">${esc(i.actionName||i.actionId)}</div><div class="aid">${esc(i.stepId)} · ${esc(i.actionId)}</div></div><button class="mini-btn" data-inst="${idx}">查看</button></div>`).join('')||'<div class="instance-line" style="color:var(--dim)">无示例实例</div>';
  $('#inspector').innerHTML=`<div class="insp-head"><div><div class="kicker">ModuleManifest · 类</div><div class="insp-title">${esc(m.name)}</div><div class="insp-id">${esc(m.id)} · v${esc(m.version)}</div></div><button class="close" data-close>✕</button></div>
    <div class="badges" style="margin-top:10px">${effectBadge(m)}${m.idempotent?'<span class="badge ok">幂等</span>':'<span class="badge">非幂等</span>'}<span class="badge">${m.domainLabel}</span><span class="badge">${m.instances.length} 实例</span></div>
    <div class="insp-section"><h3>说明</h3><div style="font-size:11px;line-height:1.65;color:var(--muted)">${esc(m.summary)}</div></div>
    <div class="insp-section"><h3>契约</h3><div class="kv"><span class="k">副作用</span><span class="v">${m.effect} ${m.effectLabel}</span><span class="k">幂等</span><span class="v">${m.idempotent?'是':'否'}</span><span class="k">权限</span><span class="v">${m.permissions.map(p=>esc(p.label)).join(' / ')||'无'}</span><span class="k">输出</span><span class="v">${outs}</span></div></div>
    <div class="insp-section"><h3>输入参数</h3><table class="ptable"><thead><tr><th>参数</th><th>说明</th><th>类型</th><th>候选</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="insp-section"><h3>真实实例 · ${m.instances.length}</h3>${inst}</div>`;
  $('#inspector [data-close]').onclick=()=>{state.selected=null;render();$('#inspector').innerHTML='<div class="insp-empty"><div class="big">◇</div><strong>Inspector</strong><br>点一个类或实例<br>查看契约、参数与真实 JSON。</div>';};
  $$('#inspector [data-inst]').forEach(b=>b.onclick=()=>openInstance(m,m.instances[+b.dataset.inst]));
  $('#inspector').scrollTop=0;
}
function openInstance(m,i){
  state.selected={type:'instance',id:m.id,index:m.instances.indexOf(i)};
  render();
  $('#inspector').innerHTML=`<div class="insp-head"><div><div class="kicker">Instance · 真实 step</div><div class="insp-title">${esc(i.actionName||i.actionId)}</div><div class="insp-id">${esc(i.stepId)} · ${esc(m.id)}</div></div><button class="close" data-close>✕</button></div>
    <div class="badges" style="margin-top:10px">${effectBadge(m)}<span class="badge">${esc(m.domainLabel)}</span><span class="badge">${esc(i.actionId)}</span></div>
    <div class="insp-section"><h3>步骤 JSON</h3><pre class="json">${esc(JSON.stringify({id:i.stepId,module:m.id,inputs:i.inputs,output:i.output},null,2))}</pre></div>
    <div class="insp-section"><h3>所属动作</h3><div class="kv"><span class="k">动作</span><span class="v">${esc(i.actionName||i.actionId)}</span><span class="k">动作 id</span><span class="v">${esc(i.actionId)}</span><span class="k">步骤 id</span><span class="v">${esc(i.stepId)}</span></div></div>
    <div class="insp-section"><button class="mini-btn" data-copy>复制步骤 JSON</button> <button class="mini-btn" data-class-link>查看类</button></div>`;
  $('#inspector [data-close]').onclick=()=>{state.selected=null;render();$('#inspector').innerHTML='<div class="insp-empty"><div class="big">◇</div><strong>Inspector</strong><br>点一个类或实例<br>查看契约、参数与真实 JSON。</div>';};
  $('#inspector [data-class-link]').onclick=()=>openClass(m);
  $('#inspector [data-copy]').onclick=async()=>{try{await navigator.clipboard.writeText(JSON.stringify({id:i.stepId,module:m.id,inputs:i.inputs,output:i.output},null,2));toast('已复制 JSON');}catch(e){toast('复制失败，请手动选择');}};
  $('#inspector').scrollTop=0;
}
let tt=null;function toast(s){const t=$('#toast');t.textContent=s;t.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('show'),1600);}
$('#q').oninput=e=>{state.query=e.target.value;render();};
$$('#viewSwitch [data-view]').forEach(b=>b.onclick=()=>{state.view=b.dataset.view;$$('#viewSwitch [data-view]').forEach(x=>x.classList.toggle('active',x===b));render();});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(e.target.tagName)){e.preventDefault();$('#q').focus();}if(e.key==='Escape'){state.selected=null;render();$('#inspector').innerHTML='<div class="insp-empty"><div class="big">◇</div><strong>Inspector</strong><br>点一个类或实例<br>查看契约、参数与真实 JSON。</div>';}});
renderNav(); renderStats(); render();
</script>
</body>
</html>'''
html = template.replace('__DATA__', json.dumps(data, ensure_ascii=False))
Path('point-layer-current.html').write_text(html, encoding='utf-8')
print('modules', len(modules), 'instances', data['instanceCount'], 'actions', data['actionCount'], 'domains', len(data['domains']))
print('bytes', len(html.encode('utf-8')))
print('effectCounts', data['effectCounts'])
