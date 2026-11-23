

const DATA = {"points": {"screen.capture": {"label": "截屏", "icon": "▣", "color": "#10b981"}, "ocr.read": {"label": "OCR", "icon": "◎", "color": "#f59e0b"}, "translate.text": {"label": "翻译", "icon": "文", "color": "#8b5cf6"}, "render.overlay": {"label": "浮层", "icon": "◫", "color": "#06b6d4"}, "file.watch": {"label": "文件监听", "icon": "◉", "color": "#3b82f6"}, "extract.invoice": {"label": "发票提取", "icon": "⌁", "color": "#ec4899"}, "validate.invoice": {"label": "发票校验", "icon": "✓", "color": "#22c55e"}, "file.move": {"label": "移动文件", "icon": "↦", "color": "#f97316"}, "notify.tray": {"label": "托盘通知", "icon": "◔", "color": "#94a3b8"}, "input.clipboard": {"label": "读剪贴板", "icon": "▤", "color": "#3b82f6"}, "text.template": {"label": "文本模板", "icon": "{}", "color": "#a78bfa"}, "file.write": {"label": "写文件", "icon": "✎", "color": "#f97316"}, "notify.toast": {"label": "Toast", "icon": "◔", "color": "#94a3b8"}, "flow.ensure-vpn": {"label": "VPN 保障", "icon": "VPN", "color": "#f59e0b"}, "net.reachable": {"label": "可达性", "icon": "↔", "color": "#06b6d4"}, "sys.open": {"label": "打开 URL", "icon": "↗", "color": "#3b82f6"}}, "pins": {"cap.region": {"pointClass": "screen.capture", "rev": 2, "params": {"x": 0, "y": 0, "width": 800, "height": 600}}, "ocr.zh.screen": {"pointClass": "ocr.read", "rev": 3, "params": {"lang": "zh", "layout": true}}, "ocr.ja.screen": {"pointClass": "ocr.read", "rev": 1, "params": {"lang": "ja", "layout": true}}, "trans.en2zh": {"pointClass": "translate.text", "rev": 1, "params": {"from": "en", "to": "zh"}}, "trans.ja2zh": {"pointClass": "translate.text", "rev": 2, "params": {"from": "ja", "to": "zh"}}, "overlay.toast": {"pointClass": "render.overlay", "rev": 2, "params": {"position": "bottom", "duration": 2500}}, "watch.inbox": {"pointClass": "file.watch", "rev": 1, "params": {"dir": "C:\\inbox", "events": ["create"]}}, "ocr.zh.invoice": {"pointClass": "ocr.read", "rev": 4, "params": {"lang": "zh", "layout": true}}, "ocr.en.invoice": {"pointClass": "ocr.read", "rev": 2, "params": {"lang": "en", "layout": false}}, "extract.vendor": {"pointClass": "extract.invoice", "rev": 2, "params": {"rules": "company", "fields": ["vendor", "amount", "date"]}}, "extract.personal": {"pointClass": "extract.invoice", "rev": 1, "params": {"rules": "personal", "fields": ["amount", "date"]}}, "validate.amount": {"pointClass": "validate.invoice", "rev": 1, "params": {"required": ["vendor", "amount"], "maxAmount": 50000}}, "validate.personal": {"pointClass": "validate.invoice", "rev": 1, "params": {"required": ["amount"], "maxAmount": 5000}}, "move.archive": {"pointClass": "file.move", "rev": 2, "params": {"to": "C:\\archive\\company", "overwrite": false}}, "notify.unmatched": {"pointClass": "notify.tray", "rev": 1, "params": {"title": "未匹配发票", "level": "warning"}}, "clip.text": {"pointClass": "input.clipboard", "rev": 1, "params": {"format": "text"}}, "template.markdown": {"pointClass": "text.template", "rev": 2, "params": {"tpl": "# {text}"}}, "write.append": {"pointClass": "file.write", "rev": 3, "params": {"append": true, "createDirs": true}}, "write.daily": {"pointClass": "file.write", "rev": 1, "params": {"append": false, "createDirs": true}}, "notify.toast": {"pointClass": "notify.toast", "rev": 1, "params": {"title": "已保存", "level": "success"}}, "inst.ensure-vpn-ask": {"pointClass": "flow.ensure-vpn", "rev": 2, "params": {"mode": "ask", "autoConnect": false, "timeoutSec": 30}}, "net.reachable.github": {"pointClass": "net.reachable", "rev": 1, "params": {"host": "github.com", "port": 443, "timeoutMs": 5000}}, "net.reachable.youtube": {"pointClass": "net.reachable", "rev": 1, "params": {"host": "www.youtube.com", "port": 443, "timeoutMs": 5000}}, "open.browser.github": {"pointClass": "sys.open", "rev": 1, "params": {"url": "https://github.com", "kind": "url"}}, "open.browser.youtube": {"pointClass": "sys.open", "rev": 2, "params": {"url": "https://www.youtube.com", "kind": "url"}}, "notify.system": {"pointClass": "notify.toast", "rev": 1, "params": {"level": "info", "duration": 2500}}}, "flows": [{"id": "flow.screenshot-translate", "name": "截图翻译", "family": "采集 → 转换 → 输出", "version": "1.2.0", "desc": "截屏 → OCR → 翻译 → 浮层；同一个类，不同语言/开关就是不同实例。", "w": 1000, "h": 320, "params": [{"key": "sourceLang", "label": "源语言", "type": "enum", "options": ["en", "ja", "zh"], "default": "en"}, {"key": "targetLang", "label": "目标语言", "type": "enum", "options": ["zh", "en"], "default": "zh"}, {"key": "overlay", "label": "显示浮层", "type": "bool", "default": true}], "nodes": [{"id": "capture", "x": 30, "y": 110, "w": 150, "h": 82, "label": "截屏", "kind": "point", "gate": null, "pointClass": "screen.capture", "pointInstance": "cap.region", "abstract": ["region"], "inputs": [], "outputs": [{"name": "image", "type": "Image"}]}, {"id": "ocr", "x": 280, "y": 110, "w": 150, "h": 82, "label": "OCR", "kind": "point", "gate": null, "pointClass": "ocr.read", "pointInstance": "ocr.zh.screen", "abstract": ["$sourceLang"], "inputs": [{"name": "image", "type": "Image"}], "outputs": [{"name": "text", "type": "Text"}]}, {"id": "translate", "x": 530, "y": 110, "w": 150, "h": 82, "label": "翻译", "kind": "point", "gate": null, "pointClass": "translate.text", "pointInstance": "trans.en2zh", "abstract": ["$sourceLang → $targetLang"], "inputs": [{"name": "text", "type": "Text"}], "outputs": [{"name": "text", "type": "Text"}]}, {"id": "overlay", "x": 780, "y": 110, "w": 150, "h": 82, "label": "浮层", "kind": "point", "gate": null, "pointClass": "render.overlay", "pointInstance": "overlay.toast", "abstract": ["if $overlay"], "inputs": [{"name": "text", "type": "Text"}], "outputs": []}], "edges": [{"from": "capture", "to": "ocr", "label": "Image"}, {"from": "ocr", "to": "translate", "label": "Text"}, {"from": "translate", "to": "overlay", "label": "Text"}], "code": [{"text": "flow screenshotTranslate(sourceLang, targetLang, overlay) {", "node": null}, {"text": "  shot       = screen.capture(region)", "node": "capture"}, {"text": "  text       = ocr.read(shot, lang = sourceLang)", "node": "ocr"}, {"text": "  translated = translate.text(text, from = sourceLang, to = targetLang)", "node": "translate"}, {"text": "  if (overlay) render.overlay(translated)", "node": "overlay"}, {"text": "}", "node": null}], "instances": [{"id": "inst.en-zh", "name": "英 → 中", "rev": 4, "args": {"sourceLang": "en", "targetLang": "zh", "overlay": true}, "pins": {"capture": "cap.region", "ocr": "ocr.zh.screen", "translate": "trans.en2zh", "overlay": "overlay.toast"}, "trace": {"capture": {"ms": 120, "status": "ok"}, "ocr": {"ms": 480, "status": "ok"}, "translate": {"ms": 760, "status": "ok"}, "overlay": {"ms": 90, "status": "ok"}}}, {"id": "inst.ja-zh", "name": "日 → 中", "rev": 2, "args": {"sourceLang": "ja", "targetLang": "zh", "overlay": false}, "pins": {"capture": "cap.region", "ocr": "ocr.ja.screen", "translate": "trans.ja2zh", "overlay": "overlay.toast"}, "trace": {"capture": {"ms": 115, "status": "ok"}, "ocr": {"ms": 510, "status": "ok"}, "translate": {"ms": 820, "status": "ok"}, "overlay": {"ms": 0, "status": "skipped"}}}]}, {"id": "flow.invoice-archive", "name": "发票归档", "family": "批量 / 文件处理", "version": "2.0.0", "desc": "监听目录 → 遍历文件 → OCR → 提取 → 校验 → 分支移动/通知；规则不同是实例，图相同。", "w": 1160, "h": 430, "params": [{"key": "watchDir", "label": "监考目录", "type": "folder", "default": "C:\\inbox"}, {"key": "vendorRules", "label": "供应商规则", "type": "enum", "options": ["company", "personal"], "default": "company"}, {"key": "archiveDir", "label": "归档目录", "type": "folder", "default": "C:\\archive"}, {"key": "ocrLang", "label": "OCR 语言", "type": "enum", "options": ["zh", "en"], "default": "zh"}], "nodes": [{"id": "watch", "x": 20, "y": 175, "w": 140, "h": 82, "label": "监听目录", "kind": "point", "gate": null, "pointClass": "file.watch", "pointInstance": "watch.inbox", "abstract": ["$watchDir"], "inputs": [], "outputs": [{"name": "files", "type": "File[]"}]}, {"id": "foreach", "x": 180, "y": 175, "w": 120, "h": 82, "label": "遍历文件", "kind": "gate", "gate": "foreach", "pointClass": null, "pointInstance": null, "abstract": ["file in files"], "inputs": [{"name": "files", "type": "File[]"}], "outputs": [{"name": "file", "type": "File"}]}, {"id": "ocr", "x": 330, "y": 175, "w": 140, "h": 82, "label": "OCR", "kind": "point", "gate": null, "pointClass": "ocr.read", "pointInstance": "ocr.zh.invoice", "abstract": ["$ocrLang"], "inputs": [{"name": "file", "type": "File"}], "outputs": [{"name": "text", "type": "Text"}]}, {"id": "extract", "x": 490, "y": 175, "w": 140, "h": 82, "label": "提取发票", "kind": "point", "gate": null, "pointClass": "extract.invoice", "pointInstance": "extract.vendor", "abstract": ["$vendorRules"], "inputs": [{"name": "text", "type": "Text"}], "outputs": [{"name": "invoice", "type": "Invoice"}]}, {"id": "validate", "x": 650, "y": 175, "w": 140, "h": 82, "label": "校验", "kind": "point", "gate": null, "pointClass": "validate.invoice", "pointInstance": "validate.amount", "abstract": ["rules = $vendorRules"], "inputs": [{"name": "invoice", "type": "Invoice"}], "outputs": [{"name": "ok", "type": "Bool"}]}, {"id": "if", "x": 810, "y": 175, "w": 120, "h": 82, "label": "if 命中", "kind": "gate", "gate": "if", "pointClass": null, "pointInstance": null, "abstract": ["ok?"], "inputs": [{"name": "invoice", "type": "Invoice"}], "outputs": [{"name": "ok", "type": "Bool"}, {"name": "else", "type": "Bool"}]}, {"id": "move", "x": 960, "y": 60, "w": 140, "h": 82, "label": "移动归档", "kind": "point", "gate": null, "pointClass": "file.move", "pointInstance": "move.archive", "abstract": ["to = $archiveDir"], "inputs": [{"name": "file", "type": "File"}], "outputs": []}, {"id": "notify", "x": 960, "y": 290, "w": 140, "h": 82, "label": "未匹配通知", "kind": "point", "gate": null, "pointClass": "notify.tray", "pointInstance": "notify.unmatched", "abstract": ["$(else)"], "inputs": [{"name": "file", "type": "File"}], "outputs": []}], "edges": [{"from": "watch", "to": "foreach", "label": "File[]"}, {"from": "foreach", "to": "ocr", "label": "File"}, {"from": "ocr", "to": "extract", "label": "Text"}, {"from": "extract", "to": "validate", "label": "Invoice"}, {"from": "validate", "to": "if", "label": "Bool"}, {"from": "if", "to": "move", "label": "true", "tone": "ok"}, {"from": "if", "to": "notify", "label": "false", "tone": "warn"}], "code": [{"text": "flow invoiceArchive(watchDir, vendorRules, archiveDir, ocrLang) {", "node": null}, {"text": "  files = file.watch(watchDir)", "node": "watch"}, {"text": "  foreach (file in files) {", "node": "foreach"}, {"text": "    text    = ocr.read(file, lang = ocrLang)", "node": "ocr"}, {"text": "    invoice = extract.invoice(text, rules = vendorRules)", "node": "extract"}, {"text": "    ok      = validate.invoice(invoice, rules = vendorRules)", "node": "validate"}, {"text": "    if (ok) file.move(file, archiveDir)", "node": "if"}, {"text": "    else    notify.unmatched(file)", "node": "notify"}, {"text": "  }", "node": null}, {"text": "}", "node": null}], "instances": [{"id": "inst.company", "name": "公司发票", "rev": 6, "args": {"watchDir": "C:\\inbox", "vendorRules": "company", "archiveDir": "C:\\archive\\company", "ocrLang": "zh"}, "pins": {"watch": "watch.inbox", "ocr": "ocr.zh.invoice", "extract": "extract.vendor", "validate": "validate.amount", "move": "move.archive", "notify": "notify.unmatched"}, "trace": {"watch": {"ms": 80, "status": "ok"}, "foreach": {"ms": 20, "status": "ok"}, "ocr": {"ms": 520, "status": "ok"}, "extract": {"ms": 40, "status": "ok"}, "validate": {"ms": 10, "status": "ok"}, "if": {"ms": 1, "status": "ok"}, "move": {"ms": 60, "status": "ok"}, "notify": {"ms": 0, "status": "skipped"}}}, {"id": "inst.personal", "name": "个人发票", "rev": 2, "args": {"watchDir": "C:\\inbox", "vendorRules": "personal", "archiveDir": "C:\\archive\\personal", "ocrLang": "en"}, "pins": {"watch": "watch.inbox", "ocr": "ocr.en.invoice", "extract": "extract.personal", "validate": "validate.personal", "move": "move.archive", "notify": "notify.unmatched"}, "trace": {"watch": {"ms": 75, "status": "ok"}, "foreach": {"ms": 18, "status": "ok"}, "ocr": {"ms": 430, "status": "ok"}, "extract": {"ms": 35, "status": "ok"}, "validate": {"ms": 9, "status": "ok"}, "if": {"ms": 1, "status": "ok"}, "move": {"ms": 0, "status": "skipped"}, "notify": {"ms": 50, "status": "ok"}}}]}, {"id": "flow.clipboard-to-file", "name": "剪贴板存文件", "family": "输入 → 处理 → 保存", "version": "1.0.0", "desc": "读剪贴板 → 模板 → 写文件 → 通知；路径/追加开关不同就是不同实例。", "w": 930, "h": 300, "params": [{"key": "path", "label": "目标文件", "type": "file", "default": "~/inbox.md"}, {"key": "append", "label": "追加写入", "type": "bool", "default": true}], "nodes": [{"id": "clip", "x": 30, "y": 110, "w": 150, "h": 82, "label": "读剪贴板", "kind": "point", "gate": null, "pointClass": "input.clipboard", "pointInstance": "clip.text", "abstract": ["format = text"], "inputs": [], "outputs": [{"name": "text", "type": "Text"}]}, {"id": "template", "x": 270, "y": 110, "w": 150, "h": 82, "label": "模板", "kind": "point", "gate": null, "pointClass": "text.template", "pointInstance": "template.markdown", "abstract": ["tpl = markdown"], "inputs": [{"name": "text", "type": "Text"}], "outputs": [{"name": "body", "type": "Text"}]}, {"id": "write", "x": 510, "y": 110, "w": 150, "h": 82, "label": "写文件", "kind": "point", "gate": null, "pointClass": "file.write", "pointInstance": "write.append", "abstract": ["$path, append=$append"], "inputs": [{"name": "body", "type": "Text"}], "outputs": []}, {"id": "notify", "x": 750, "y": 110, "w": 140, "h": 82, "label": "通知", "kind": "point", "gate": null, "pointClass": "notify.toast", "pointInstance": "notify.toast", "abstract": ["success"], "inputs": [], "outputs": []}], "edges": [{"from": "clip", "to": "template", "label": "Text"}, {"from": "template", "to": "write", "label": "Text"}, {"from": "write", "to": "notify", "label": "done"}], "code": [{"text": "flow clipboardToFile(path, append) {", "node": null}, {"text": "  text = input.clipboard.read(format = text)", "node": "clip"}, {"text": "  body = text.template(text, tpl = markdown)", "node": "template"}, {"text": "  file.write(path, body, append = append)", "node": "write"}, {"text": "  notify.toast(\"saved\")", "node": "notify"}, {"text": "}", "node": null}], "instances": [{"id": "inst.inbox", "name": "收件箱", "rev": 3, "args": {"path": "~/inbox.md", "append": true}, "pins": {"clip": "clip.text", "template": "template.markdown", "write": "write.append", "notify": "notify.toast"}, "trace": {"clip": {"ms": 20, "status": "ok"}, "template": {"ms": 5, "status": "ok"}, "write": {"ms": 15, "status": "ok"}, "notify": {"ms": 10, "status": "ok"}}}, {"id": "inst.daily", "name": "每日笔记", "rev": 1, "args": {"path": "~/daily/2026-11-23.md", "append": false}, "pins": {"clip": "clip.text", "template": "template.markdown", "write": "write.daily", "notify": "notify.toast"}, "trace": {"clip": {"ms": 18, "status": "ok"}, "template": {"ms": 4, "status": "ok"}, "write": {"ms": 22, "status": "ok"}, "notify": {"ms": 8, "status": "ok"}}}]}, {"id": "flow.open-external-site", "name": "打开外网网站", "family": "外网访问 / Guard 组合", "version": "1.0.0", "desc": "解析站点策略 → 确保 VPN → 可选可达性检查 → 打开 URL → 通知。YouTube/GitHub 只是不同实例。", "w": 1000, "h": 320, "params": [{"key": "url", "label": "目标 URL", "type": "text", "required": true, "default": "https://github.com"}, {"key": "vpnRequirement", "label": "VPN 策略", "type": "enum", "options": ["required", "preferred", "none"], "default": "required"}, {"key": "checkReachability", "label": "检查可达性", "type": "bool", "default": true}], "nodes": [{"id": "vpn", "x": 30, "y": 110, "w": 160, "h": 82, "label": "VPN 保障", "kind": "subflow", "gate": null, "pointClass": "flow.ensure-vpn", "pointInstance": "inst.ensure-vpn-ask", "abstract": ["vpnRequirement"], "inputs": [], "outputs": [{"name": "guard", "type": "GuardResult"}]}, {"id": "check", "x": 280, "y": 110, "w": 150, "h": 82, "label": "可达性检查", "kind": "point", "gate": null, "pointClass": "net.reachable", "pointInstance": "net.reachable.github", "abstract": ["host = url.host"], "inputs": [{"name": "guard", "type": "GuardResult"}], "outputs": [{"name": "reachable", "type": "Bool"}]}, {"id": "open", "x": 530, "y": 110, "w": 150, "h": 82, "label": "打开 URL", "kind": "point", "gate": null, "pointClass": "sys.open", "pointInstance": "open.browser.github", "abstract": ["url, kind=url"], "inputs": [{"name": "reachable", "type": "Bool"}], "outputs": [{"name": "opened", "type": "Bool"}]}, {"id": "notify", "x": 780, "y": 110, "w": 150, "h": 82, "label": "通知", "kind": "point", "gate": null, "pointClass": "notify.toast", "pointInstance": "notify.system", "abstract": ["success"], "inputs": [{"name": "opened", "type": "Bool"}], "outputs": []}], "edges": [{"from": "vpn", "to": "check", "label": "GuardResult"}, {"from": "check", "to": "open", "label": "Bool"}, {"from": "open", "to": "notify", "label": "Bool"}], "code": [{"text": "flow openExternalSite(url, vpnRequirement) {", "node": null}, {"text": "  guard     = ensureVpn(vpnRequirement)", "node": "vpn"}, {"text": "  reachable = net.reachable(url.host)", "node": "check"}, {"text": "  opened    = sys.open(url)", "node": "open"}, {"text": "  notify.toast(opened ? \"opened\" : guard.reason)", "node": "notify"}, {"text": "}", "node": null}], "instances": [{"id": "inst.site-github", "name": "GitHub", "rev": 1, "args": {"url": "https://github.com", "vpnRequirement": "required", "checkReachability": true}, "pins": {"vpn": "inst.ensure-vpn-ask", "check": "net.reachable.github", "open": "open.browser.github", "notify": "notify.system"}, "trace": {"vpn": {"ms": 1300, "status": "ok"}, "check": {"ms": 60, "status": "ok"}, "open": {"ms": 20, "status": "ok"}, "notify": {"ms": 10, "status": "ok"}}}, {"id": "inst.site-youtube", "name": "YouTube", "rev": 3, "args": {"url": "https://www.youtube.com", "vpnRequirement": "required", "checkReachability": true}, "pins": {"vpn": "inst.ensure-vpn-ask", "check": "net.reachable.youtube", "open": "open.browser.youtube", "notify": "notify.system"}, "trace": {"vpn": {"ms": 1500, "status": "ok"}, "check": {"ms": 75, "status": "ok"}, "open": {"ms": 25, "status": "ok"}, "notify": {"ms": 10, "status": "ok"}}}]}]};
const $ = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
const esc = (v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = (v)=>{
  if(v===null||v===undefined) return '—';
  if(typeof v==='boolean') return v?'true':'false';
  if(typeof v==='object') return JSON.stringify(v);
  return String(v);
};
const truncate = (s,n=30)=> s.length>n ? s.slice(0,n-1)+'…' : s;
const LAST = DATA.flows[DATA.flows.length-1];
const state = {flowId:LAST.id, instanceId:LAST.instances[0].id, mode:'instance', selected:null};
const flow = ()=>DATA.flows.find(f=>f.id===state.flowId);
const inst = ()=>flow().instances.find(i=>i.id===state.instanceId) || flow().instances[0];
const point = (id)=>DATA.points[id] || {label:id,icon:'?',color:'#64748b'};
const pin = (id)=>DATA.pins[id] || null;
const pinFor = (node)=>{
  if(node.kind==='gate') return null;
  const id = (inst()?.pins||{})[node.id] || node.pointInstance;
  return id ? {id, ...(pin(id)||{})} : null;
};
const defaultPinFor = (node)=> node.kind==='gate' ? null : (node.pointInstance ? {id:node.pointInstance, ...(pin(node.pointInstance)||{})} : null);
const nodeColor = (node)=> node.kind==='gate' ? '#8b5cf6' : node.kind==='subflow' ? '#f59e0b' : point(node.pointClass).color;
const nodeIcon = (node)=> node.kind==='gate' ? (node.gate==='if'?'IF':'∀') : node.kind==='subflow' ? 'VPN' : point(node.pointClass).icon;
const nodeParams = (node)=>{
  if(node.kind==='gate') return [node.abstract[0]||node.gate];
  if(state.mode==='class') return [`accepts ${node.pointClass}`, ...node.abstract];
  const p = pinFor(node);
  return p ? Object.entries(p.params||{}).map(([k,v])=>`${k}=${fmt(v)}`) : [];
};
const traceOf = (node)=> (inst()?.trace||{})[node.id] || null;

function renderSidebar(){
  $('#flowNav').innerHTML = DATA.flows.map(f=>`<button class="flow-card ${f.id===state.flowId?'active':''}" data-flow="${f.id}"><div class="fname">${esc(f.name)}<span class="fver">v${esc(f.version)}</span></div><div class="fmeta">${esc(f.family)} · ${f.nodes.length} 节点 · ${f.instances.length} 实例</div><div class="fdesc">${esc(f.desc)}</div></button>`).join('');
  $('#instanceNav').innerHTML = flow().instances.map(i=>`<button class="inst-card ${i.id===state.instanceId?'active':''}" data-inst="${i.id}"><span class="inst-dot"></span><div><div class="iname">${esc(i.name)}</div><div class="imeta">${esc(i.id)} · rev${i.rev} · ${Object.entries(i.args).slice(0,2).map(([k,v])=>k+'='+fmt(v)).join(' · ')}</div></div></button>`).join('');
  $$('#flowNav [data-flow]').forEach(b=>b.onclick=()=>{state.flowId=b.dataset.flow;state.instanceId=flow().instances[0].id;state.selected=null;renderAll();});
  $$('#instanceNav [data-inst]').forEach(b=>b.onclick=()=>{state.instanceId=b.dataset.inst;state.selected=null;renderAll();});
}

function renderHero(){
  const f=flow(), i=inst();
  const modeLabel={class:'类定义',instance:'实例绑定',trace:'运行轨迹'}[state.mode];
  $('#hero').innerHTML=`<div class="hero"><div><div class="eyebrow">FlowClass · 线层功能类</div><h1>${esc(f.name)}</h1><p>${esc(f.family)} · ${esc(f.desc)}</p></div><div class="mode-tabs">${[['class','类定义'],['instance','实例绑定'],['trace','运行轨迹']].map(([k,l])=>`<button data-mode="${k}" class="${state.mode===k?'active':''}">${l}</button>`).join('')}</div></div>`;
  $$('#hero [data-mode]').forEach(b=>b.onclick=()=>{state.mode=b.dataset.mode;renderAll();});
  const pins = f.nodes.filter(n=>n.kind!=='gate').map(n=>state.mode==='class'?defaultPinFor(n):pinFor(n)).filter(Boolean);
  const pinText = pins.slice(0,3).map(p=>`${p.id}@r${p.rev}`).join(' · ') + (pins.length>3?` +${pins.length-3}`:'');
  $('#resolution').innerHTML=`
    <div class="res-node"><span class="rk">FlowClass</span><span class="rv">${esc(f.id)}</span><span class="ri">v${esc(f.version)} · slots + defaults</span></div>
    <span class="res-arrow">→ <b>slots + defaults</b></span>
    <div class="res-node"><span class="rk">FlowInstance</span><span class="rv">${esc(i.id)}</span><span class="ri">rev${i.rev}</span></div>
    <span class="res-arrow">→ <b>bindings</b></span>
    <div class="res-node"><span class="rk">Instance pins</span><span class="rv">${pinText}</span><span class="ri">${pins.length} 个绑定</span></div>
    <span class="res-arrow" style="margin-left:auto">${modeLabel}</span>`;
  $('#paramsBar').innerHTML=`<span class="params-label">${state.mode==='class'?'params':'args'}</span>`+f.params.map(p=>{
    if(state.mode==='class') return `<span class="param-chip"><b>${esc(p.key)}</b> <span class="ty">${esc(p.type)}${p.required?'*':''}</span></span>`;
    const v=(i.args||{})[p.key];
    return `<span class="param-chip"><b>${esc(p.key)}</b>=${esc(fmt(v))}<span class="ty"> ${esc(p.type)}</span></span>`;
  }).join('')+`<span class="param-chip"><span class="ty">${state.mode==='class'?'实例化时填值':'由 FlowInstance 锁定'}</span></span>`;
}
function highlight(text){
  const re=/(\bflow\b|\bif\b|\belse\b|\bforeach\b|\bin\b|\breturn\b)|("[^"]*")|(\b[A-Za-z_][\w.]*(?=\())/g;
  let out='', last=0, m;
  while((m=re.exec(text))){
    out+=esc(text.slice(last,m.index));
    const cls=m[1]?'kw':m[2]?'str':'fn';
    out+=`<span class="${cls}">${esc(m[0])}</span>`;
    last=m.index+m[0].length;
  }
  out+=esc(text.slice(last));
  return out;
}
function codePin(node){
  if(!node) return '';
  if(node.kind==='gate') return `<span class="code-pin gate">gate:${esc(node.gate)}</span>`;
  const p=pinFor(node);
  const dp=node.pointInstance?pin(node.pointInstance):null;
  if(state.mode==='trace'){const t=traceOf(node);return `<span class="code-pin ${t&&t.status==='ok'?'ms':''}">${t?t.ms+'ms · '+t.status:'—'}</span>`;}
  if(state.mode==='class') return `<span class="code-pin">slot.${esc(node.id)} · ${esc(node.pointInstance||'—')}${dp?'@r'+dp.rev:''}</span>`;
  if(!p) return `<span class="code-pin">slot.${esc(node.id)} · ${esc(node.pointClass)}</span>`;
  return `<span class="code-pin">slot.${esc(node.id)} → ${esc(p.id)}@r${p.rev}</span>`;
}
function renderCode(){
  const f=flow();
  $('#codeSub').textContent = `${f.id} · v${f.version}`;
  $('#codeMode').textContent = state.mode==='class'?'PointClass':'PointInstance';
  $('#codeBody').innerHTML=f.code.map((line,idx)=>{
    const node=line.node?f.nodes.find(n=>n.id===line.node):null;
    const active=state.selected===line.node;
    return `<div class="code-line ${line.node?'':'no-node'} ${active?'active':''}" data-node="${line.node||''}"><span class="ln">${idx+1}</span><span class="code-text">${highlight(line.text)}</span>${codePin(node)}</div>`;
  }).join('');
  $$('#codeBody [data-node]').forEach(el=>{if(el.dataset.node) el.onclick=()=>selectNode(el.dataset.node);});
  const active=$('#codeBody .code-line.active'); if(active) active.scrollIntoView({block:'nearest'});
}

function edgeSvg(f){
  const map=Object.fromEntries(f.nodes.map(n=>[n.id,n]));
  const selected=state.selected;
  return f.edges.map((e)=>{
    const a=map[e.from], b=map[e.to];
    if(!a||!b) return '';
    const x1=a.x+a.w, y1=a.y+a.h/2, x2=b.x, y2=b.y+b.h/2;
    const dx=Math.max(50,(x2-x1)*.42);
    const d=`M ${x1} ${y1} C ${x1+dx} ${y1}, ${x2-dx} ${y2}, ${x2} ${y2}`;
    const active=selected&&(e.from===selected||e.to===selected);
    const sa=traceOf(a), sb=traceOf(b);
    const skipped=state.mode==='trace'&&((sa&&sa.status==='skipped')||(sb&&sb.status==='skipped'));
    const cls=`flow-edge ${active?'active':''} ${skipped?'skipped':''}`;
    const mx=(x1+x2)/2, my=(y1+y2)/2-5;
    const label=e.label?`<text class="edge-label" x="${mx}" y="${my}" text-anchor="middle">${esc(e.label)}</text>`:'';
    return `<path class="${cls}" d="${d}" marker-end="url(#arrow)"/>${label}`;
  }).join('');
}
function renderGraph(){
  const f=flow();
  const svg=`<svg width="${f.w}" height="${f.h}" viewBox="0 0 ${f.w} ${f.h}"><defs><marker id="arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7" fill="#475569"/></marker></defs>${edgeSvg(f)}</svg>`;
  const nodes=f.nodes.map(n=>{
    const p=pinFor(n), col=nodeColor(n), t=traceOf(n);
    const skipped=state.mode==='trace'&&t&&t.status==='skipped';
    const params=nodeParams(n).slice(0,3).map(x=>`<span class="np ${n.kind==='gate'?'gate':''}">${esc(truncate(x,24))}</span>`).join('');
    const dp=n.pointInstance?pin(n.pointInstance):null;
    const kind=n.kind==='gate'?`GATE · ${n.gate.toUpperCase()}`:n.kind==='subflow'?'SUBFLOW':(state.mode==='class'?'SLOT · DEFAULT':'SLOT · BOUND');
    const sub=n.kind==='gate'?`gate:${n.gate}`:(state.mode==='class'?`slot.${n.id} · default ${n.pointInstance||'—'}${dp?'@r'+dp.rev:''}`:`slot.${n.id} → ${p?p.id+' @r'+p.rev:n.pointClass}`);
    const ins=n.inputs.map(x=>x.type).join(' / ')||'—';
    const outs=n.outputs.map(x=>x.type).join(' / ')||'—';
    return `<div class="flow-node ${n.kind} ${state.selected===n.id?'selected':''} ${skipped?'skipped':''}" data-node="${n.id}" style="left:${n.x}px;top:${n.y}px;width:${n.w}px;--c:${col}">
      <div class="node-head"><span class="node-icon">${nodeIcon(n)}</span><span class="node-kind">${kind}</span>${state.mode==='trace'?`<span class="node-ms ${t&&t.status==='skipped'?'skip':''}">${t?t.ms+'ms':'—'}</span>`:''}</div>
      <div class="node-name">${esc(n.label)}</div>
      <div class="node-sub">${esc(sub)}</div>
      <div class="node-params">${params}</div>
      <div class="node-foot"><span>in: ${esc(ins)}</span><span>out: ${esc(outs)}</span></div>
    </div>`;
  }).join('');
  $('#canvas').style.width=f.w+'px'; $('#canvas').style.height=f.h+'px';
  $('#canvas').innerHTML=svg+nodes;
  $('#graphSub').textContent=`${f.nodes.length} 节点 · ${f.edges.length} 条类型化边`;
  $('#graphMode').textContent=state.mode==='class'?'抽象 PointClass':'实例 PointInstance';
  $$('#canvas [data-node]').forEach(el=>el.onclick=()=>selectNode(el.dataset.node));
}
function renderTrace(){
  const f=flow(), i=inst();
  if(state.mode!=='trace'){ $('#tracePanel').style.display='none'; $('#tracePanel').innerHTML=''; return; }
  const max=Math.max(1,...f.nodes.map(x=>(traceOf(x)?.ms)||0));
  const rows=f.nodes.map(n=>{
    const t=traceOf(n);
    if(!t) return '';
    const pct=Math.max(2,Math.round(t.ms/max*100));
    const skipped=t.status==='skipped';
    return `<div class="trace-row ${state.selected===n.id?'active':''} ${skipped?'skipped':''}" data-node="${n.id}"><span class="trace-name">${esc(n.label)}</span><div class="trace-bar"><i style="width:${skipped?0:pct}%"></i></div><span class="trace-ms">${skipped?'skipped':t.ms+'ms'}</span></div>`;
  }).join('');
  const total=f.nodes.reduce((n,x)=>n+((traceOf(x)?.ms)||0),0);
  $('#tracePanel').style.display='block';
  $('#tracePanel').innerHTML=`<div class="trace-head"><b>执行轨迹</b><span>FlowInstance ${esc(i.name)} · rev${i.rev}</span><span class="right">total ${total} ms</span></div><div class="trace-list">${rows}</div>`;
  $$('#tracePanel [data-node]').forEach(el=>el.onclick=()=>selectNode(el.dataset.node));
}

function bindingRows(f){
  return f.nodes.map(n=>{
    if(n.kind==='gate') return `<tr data-node="${n.id}"><td class="mono">slot.${esc(n.id)}</td><td><span class="pill gate">gate</span> ${esc(n.gate)}</td><td class="mono">—</td><td class="mono">—</td></tr>`;
    const p=pinFor(n), dp=n.pointInstance?pin(n.pointInstance):null;
    const type=n.kind==='subflow'?'flow':'point';
    return `<tr data-node="${n.id}"><td class="mono">slot.${esc(n.id)}</td><td><span class="pill">${type}</span> <span class="mono">${esc(n.pointClass)}</span></td><td class="mono">${esc(n.pointInstance||'—')}${dp?'@r'+dp.rev:''}</td><td class="mono">${p?esc(p.id)+'@r'+p.rev:'—'}</td></tr>`;
  }).join('');
}
function renderInspector(){
  const f=flow(), i=inst();
  if(!state.selected){
    $('#inspector').innerHTML=`<div class="insp-head"><div><div class="kicker">FlowInstance · 绑定视图</div><div class="insp-title">线层如何用点实例</div><div class="insp-id">${esc(f.id)} → ${esc(i.id)} · rev${i.rev}</div></div></div>
      <div class="insp-section"><h3>解析链</h3><div class="res-chain">
        <div class="chain-step"><span class="chain-dot"></span><div><div class="chain-label">FlowClass</div><div class="chain-val">${esc(f.id)}</div><div class="chain-sub">v${esc(f.version)} · ${f.nodes.length} 节点</div></div></div>
        <div class="chain-step"><span class="chain-dot" style="background:#8b5cf6;box-shadow:0 0 0 1px rgba(139,92,246,.35)"></span><div><div class="chain-label">FlowInstance</div><div class="chain-val">${esc(i.id)}</div><div class="chain-sub">rev${i.rev} · ${esc(i.name)}</div></div></div>
        <div class="chain-step"><span class="chain-dot" style="background:#22c55e;box-shadow:0 0 0 1px rgba(34,197,94,.35)"></span><div><div class="chain-label">PointInstance pins</div><div class="chain-val">${f.nodes.filter(n=>n.kind!=='gate').length} 个</div><div class="chain-sub">每个节点锁定一个点层实例 revision</div></div></div>
      </div></div>
      <div class="insp-section"><h3>实例参数 args</h3><pre class="json">${esc(JSON.stringify(i.args,null,2))}</pre></div>
      <div class="insp-section"><h3>槽位 → 点实例</h3><table class="bind-table"><thead><tr><th>Slot</th><th>accepts</th><th>default</th><th>bound</th></tr></thead><tbody>${bindingRows(f)}</tbody></table></div>
      <div class="insp-note"><b>关键：</b>FlowClass = 点实例槽位 + 默认点实例；FlowInstance = 每个槽位绑定具体 PointInstance。线层节点本身不实现功能，只负责组合。</div>`;
    $$('#inspector [data-node]').forEach(el=>el.onclick=()=>selectNode(el.dataset.node));
    return;
  }
  const n=f.nodes.find(x=>x.id===state.selected); if(!n) return;
  const p=state.mode==='class'?defaultPinFor(n):pinFor(n), t=traceOf(n);
  const paramJson=n.kind==='gate'?{gate:n.gate,condition:n.abstract.join(' ')}:(p?p.params:{abstract:n.abstract});
  $('#inspector').innerHTML=`<div class="insp-head"><div><div class="kicker">FlowNode · ${n.kind==='gate'?'GATE':n.kind==='subflow'?'SUBFLOW':'SLOT'}</div><div class="insp-title">${esc(n.label)}</div><div class="insp-id">${esc(n.id)} · ${n.kind==='gate'?'gate:'+esc(n.gate):esc(n.pointClass)}</div></div><button data-back style="border:0;background:transparent;color:var(--dim);font-size:14px">✕</button></div>
    <div class="insp-section"><h3>解析链</h3><div class="res-chain">
      <div class="chain-step"><span class="chain-dot"></span><div><div class="chain-label">FlowNode / Slot</div><div class="chain-val">slot.${esc(n.id)}</div><div class="chain-sub">${n.kind==='gate'?'线层门节点':'可绑定 PointInstance 的槽位'}</div></div></div>
      ${n.kind==='gate'?`<div class="chain-step"><span class="chain-dot" style="background:#8b5cf6"></span><div><div class="chain-label">Gate</div><div class="chain-val">${esc(n.gate)}</div><div class="chain-sub">由线层引擎执行</div></div></div>`:`<div class="chain-step"><span class="chain-dot" style="background:#22c55e"></span><div><div class="chain-label">${n.kind==='subflow'?'FlowInstance':'PointInstance'}</div><div class="chain-val">${esc(p?p.id:'—')}${p?' @r'+p.rev:''}</div><div class="chain-sub">accepts: ${esc(n.pointClass)}</div></div></div>`}
    </div></div>
    <div class="insp-section"><h3>端口</h3><div class="kv"><span class="k">输入</span><span class="v">${n.inputs.map(x=>esc(x.name)+':'+esc(x.type)).join(' · ')||'—'}</span><span class="k">输出</span><span class="v">${n.outputs.map(x=>esc(x.name)+':'+esc(x.type)).join(' · ')||'—'}</span></div></div>
    <div class="insp-section"><h3>${n.kind==='gate'?'门参数':'点实例参数'}</h3><pre class="json">${esc(JSON.stringify(paramJson,null,2))}</pre></div>
    ${t?`<div class="insp-section"><h3>本次运行</h3><div class="kv"><span class="k">状态</span><span class="v">${t.status}</span><span class="k">耗时</span><span class="v">${t.ms} ms</span></div></div>`:''}
    <div class="insp-note">${n.kind==='gate'?'门节点不绑定点实例，它改变线层的执行顺序/分支。':n.kind==='subflow'?'子流程槽位绑定一个 FlowInstance；它是线层组合的复用单元，不是点实例。':'点节点只声明“要哪个点类”；FlowInstance 通过 pin 把它解析成具体 PointInstance，并把参数/版本固定下来。'}</div>`;
  $('#inspector [data-back]').onclick=()=>{state.selected=null;renderCode();renderGraph();renderInspector();};
}

function selectNode(id){ state.selected = state.selected===id?null:id; renderCode(); renderGraph(); renderTrace(); renderInspector(); }
function renderAll(){ renderSidebar(); renderHero(); renderCode(); renderGraph(); renderTrace(); renderInspector(); }
renderAll();

