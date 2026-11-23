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
