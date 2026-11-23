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
