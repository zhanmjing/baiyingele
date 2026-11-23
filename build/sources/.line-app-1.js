const DATA = __DATA__;
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
