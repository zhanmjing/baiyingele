
const TARGETS=[
  {id:'vpn.default.status@r1',kind:'point',name:'检测 VPN 状态',classId:'vpn.status',revision:1,effect:'L0',last:'2 分钟前',favorite:true,desc:'读取 VPN 软件进程、窗口与隧道状态，不做任何修改。',params:{app:'DefaultVPN',check:'process + window + tunnel',timeoutMs:3000}},
  {id:'vpn.default.launch@r1',kind:'point',name:'启动默认 VPN',classId:'app.launch',revision:1,effect:'L1',last:'5 分钟前',favorite:true,desc:'启动默认 VPN 软件，可等待主窗口出现。',params:{app:'DefaultVPN',args:'--minimized',waitForWindow:true}},
  {id:'vpn.default.connect@r1',kind:'point',name:'连接 VPN',classId:'vpn.connect',revision:1,effect:'L2',last:'12 分钟前',favorite:false,desc:'通过 UI 自动化点击默认配置的连接按钮；需要 UiAutomation 权限。',params:{profile:'default',method:'uia',timeoutMs:15000}},
  {id:'open.browser.github@r1',kind:'point',name:'打开 GitHub',classId:'sys.open',revision:1,effect:'L1',last:'1 分钟前',favorite:true,desc:'用默认浏览器打开 GitHub。',params:{url:'https://github.com',kind:'url'}},
  {id:'notify.system@r1',kind:'point',name:'系统通知',classId:'notify.toast',revision:1,effect:'L0',last:'刚刚',favorite:false,desc:'发送一条系统通知，不阻塞流程。',params:{level:'info',duration:2500}},
  {id:'inst.ensure-vpn-ask@r2',kind:'flow',name:'确保 VPN（询问）',classId:'flow.ensure-vpn',revision:2,effect:'L2',last:'5 分钟前',favorite:true,desc:'检测 → 启动/询问 → 等待 → 连接；VPN 保障的可复用子流程。',slots:['status','launch','connect','notify'],nodes:['检测 VPN','启动/询问','等待连接','通知']},
  {id:'inst.site-github@r1',kind:'flow',name:'打开 GitHub',classId:'flow.open-external-site',revision:1,effect:'L2',last:'1 分钟前',favorite:true,desc:'确保 VPN → 可达性检查 → 打开 URL → 通知。',slots:['vpn','check','open','notify'],nodes:['VPN 保障','可达性','打开 URL','通知']},
  {id:'inst.workspace-dev@r3',kind:'flow',name:'开发工作区',classId:'flow.open-workspace',revision:3,effect:'L1',last:'1 小时前',favorite:false,desc:'VS Code + 终端 + 双屏布局 + 聚焦编辑器。',slots:['ensureEditor','ensureTerminal','layout','focus'],nodes:['VS Code','终端','布局','聚焦']},
  {id:'inst.invoice-company@r6',kind:'flow',name:'公司发票归档',classId:'flow.batch-archive',revision:6,effect:'L1',last:'昨天',favorite:false,desc:'扫描目录 → OCR → 提取 → 校验 → 归档；批量遍历。',slots:['list','ocr','extract','validate','move'],nodes:['扫描','OCR','提取','校验','归档']},
];
const $=(s,el=document)=>el.querySelector(s);
const $$=(s,el=document)=>[...el.querySelectorAll(s)];
const esc=(s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const byId=(id)=>TARGETS.find(t=>t.id===id);
const state={tab:'all',query:'',selectedId:'inst.site-github@r1',timer:null,run:null,toastTimer:null};

function filtered(){
  const q=state.query.trim().toLowerCase();
  return TARGETS.filter(t=>{
    if(state.tab==='point'&&t.kind!=='point')return false;
    if(state.tab==='flow'&&t.kind!=='flow')return false;
    if(state.tab==='favorite'&&!t.favorite)return false;
    if(state.tab==='recent'&&!['刚刚','1 分钟前','2 分钟前','5 分钟前','12 分钟前'].includes(t.last))return false;
    if(!q)return true;
    return [t.id,t.name,t.classId,t.desc,t.kind,(t.params?JSON.stringify(t.params):''),(t.slots||[]).join(' ')].join(' ').toLowerCase().includes(q);
  });
}

function renderTabs(){
  $$('#tabs [data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===state.tab));
}

function renderList(){
  const items=filtered();
  if(!items.length){$('#list').innerHTML=`<div class="empty">没有匹配的实例</div>`;return;}
  const groups={point:items.filter(t=>t.kind==='point'),flow:items.filter(t=>t.kind==='flow')};
  let html='';
  if(groups.point.length){html+=`<div class="group-label">PointInstance · ${groups.point.length}</div>`+groups.point.map(itemRow).join('');}
  if(groups.flow.length){html+=`<div class="group-label">FlowInstance · ${groups.flow.length}</div>`+groups.flow.map(itemRow).join('');}
  $('#list').innerHTML=html;
  $$('#list [data-id]').forEach(el=>el.onclick=(e)=>{
    if(e.target.closest('[data-star]'))return;
    state.selectedId=el.dataset.id;renderList();renderPreview();
  });
  $$('#list [data-star]').forEach(b=>b.onclick=(e)=>{
    e.stopPropagation();
    const t=byId(b.dataset.star);t.favorite=!t.favorite;renderList();renderPreview();toast(t.favorite?'已收藏':'已取消收藏');
  });
}

function itemRow(t){
  const active=t.id===state.selectedId;
  return `<div class="item ${active?'active':''}" data-id="${esc(t.id)}" role="button" tabindex="0">
    <span class="kind ${t.kind}">${t.kind==='point'?'PT':'FLOW'}</span>
    <span class="item-main">
      <span class="item-title"><b>${esc(t.name)}</b><span class="eff">${esc(t.effect)}</span></span>
      <span class="item-sub">${esc(t.id)} · ${esc(t.classId)}</span>
      <span class="item-meta"><span>${esc(t.last)}</span><span>${t.kind==='point'?'PointRun':'FlowRun'}</span></span>
    </span>
    <button class="star ${t.favorite?'on':''}" data-star="${esc(t.id)}" title="收藏">${t.favorite?'★':'☆'}</button>
  </div>`;
}

function renderPreview(){
  const t=byId(state.selectedId)||TARGETS[0];
  const isPoint=t.kind==='point';
  const params=t.params?Object.entries(t.params).map(([k,v])=>`<div class="param"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`).join(''):'';
  const slots=(t.slots||[]).map(s=>`<span class="chip ok">${esc(s)}</span>`).join('');
  $('#preview').innerHTML=`
    <div class="preview-kicker">${isPoint?'POINTINSTANCE':'FLOWINSTANCE'}</div>
    <h2>${esc(t.name)}</h2>
    <div class="id">${esc(t.id)} @ r${t.revision}</div>
    <p class="desc">${esc(t.desc)}</p>
    <div class="badges"><span class="badge ${t.kind}">${isPoint?'POINT':'FLOW'}</span><span class="badge">${esc(t.classId)}</span><span class="badge">${esc(t.effect)}</span><span class="badge green">${esc(t.last)}</span></div>
    <div class="section"><h4>${isPoint?'参数':'槽位'} <span>${isPoint?Object.keys(t.params||{}).length:(t.slots||[]).length}</span></h4>${isPoint?`<div class="params">${params}</div>`:`<div class="slot-list">${slots}</div>`}</div>
    <div class="section"><h4>启动方式</h4><div class="kv">
      <span class="k">run type</span><span class="v"><code>${isPoint?'PointRun':'FlowRun'}</code></span>
      <span class="k">target</span><span class="v"><code>${esc(t.id)}</code></span>
      <span class="k">preview</span><span class="v">${isPoint?'单项进度 + 输出':'节点逐个点亮 + slotRuns'}</span>
    </div></div>`;
  $('#runBtn').textContent=isPoint?'▶ 启动点实例':'▶ 启动线实例';
  $('#previewHint').textContent=isPoint?'PointRun ready':'FlowRun ready';
  $('#favoriteBtn').textContent=t.favorite?'★ 已收藏':'☆ 收藏';
}

function openConsole(t){
  $('#console').classList.remove('hidden');
  $('#consoleKicker').textContent=t.kind==='point'?'POINT RUN':'FLOW RUN';
  $('#consoleTitle').textContent=t.name;
  $('#consoleSub').textContent=`${t.id} @ r${t.revision} · ${t.classId}`;
  $('#statusText').textContent='准备启动…';
  $('#progressBar').style.width='0%';
  $('#logs').innerHTML='';
  $('#result').className='result';
  $('#result').textContent='';
  $('#againBtn').disabled=true;
  $('#cancelBtn').disabled=false;
  $('#pulse').style.display='block';
  $('#runVisual').innerHTML=t.kind==='flow'?flowMap(t):pointRing();
}

function flowMap(t){
  return `<div class="flow-map">${t.nodes.map((n,i)=>`<div class="flow-node" data-step="${i}"><b>${esc(n)}</b>slot.${esc((t.slots||[])[i]||('s'+i))}</div>${i<t.nodes.length-1?'<div class="flow-arrow"></div>':''}`).join('')}</div>`;
}
function pointRing(){
  return `<div class="point-run"><div class="ring" id="ring" style="--p:0%"><div><b id="ringVal">0%</b><small>POINT RUN</small></div></div></div>`;
}

function addLog(msg,type=''){
  const time=new Date().toLocaleTimeString('zh-CN',{hour12:false});
  const el=document.createElement('div');
  el.className='log-line '+type;
  el.innerHTML=`<span class="t">${time}</span><span class="m">${esc(msg)}</span>`;
  $('#logs').appendChild(el);$('#logs').scrollTop=$('#logs').scrollHeight;
}

function startRun(){
  const t=byId(state.selectedId)||TARGETS[0];
  if(state.timer){clearInterval(state.timer);state.timer=null;}
  state.run={target:t,index:0,total:t.kind==='flow'?t.nodes.length:4,status:'running'};
  openConsole(t);
  addLog(`启动 ${t.kind==='point'?'PointRun':'FlowRun'}：${t.id}@r${t.revision}`);
  addLog(`加载 ${t.kind==='point'?'PointInstance':'FlowInstance'} 绑定与 revision`);
  const tick=()=>{
    const r=state.run;if(!r||r.status!=='running')return;
    const i=r.index;
    if(t.kind==='flow'){
      $$('.flow-node').forEach((n,idx)=>{n.classList.remove('running');if(idx<i)n.classList.add('ok');if(idx===i)n.classList.add('running');});
      addLog(`slotRuns[${i}] · ${t.nodes[i]} · ${t.slots[i]} → running`);
      $('#statusText').textContent=`运行 ${t.nodes[i]}（${i+1}/${r.total}）`;
    }else{
      const pct=Math.round(((i+1)/r.total)*100);
      const ring=$('#ring');if(ring)ring.style.setProperty('--p',pct+'%');
      const rv=$('#ringVal');if(rv)rv.textContent=pct+'%';
      addLog(['加载点实例','校验参数','执行原子能力','写入 PointRun'][i]||`step ${i+1}`);
      $('#statusText').textContent=`执行 ${i+1}/${r.total}`;
    }
    r.index++;
    const pct=Math.round((r.index/r.total)*100);
    $('#progressBar').style.width=pct+'%';
    if(r.index>=r.total){clearInterval(state.timer);state.timer=null;finishRun(t,true);}
  };
  tick();
  state.timer=setInterval(tick,650);
}

function finishRun(t,ok){
  state.run={target:t,status:ok?'ok':'failed'};
  $('#pulse').style.display='none';
  $('#progressBar').style.width='100%';
  $('#statusText').textContent=ok?'完成':'失败';
  if(t.kind==='flow'){
    $$('.flow-node').forEach(n=>{n.classList.remove('running');n.classList.add(ok?'ok':'failed');});
    addLog('FlowRun 完成 · slotRuns 全部成功', 'ok');
  }else{
    const ring=$('#ring');if(ring)ring.style.setProperty('--p','100%');
    const rv=$('#ringVal');if(rv)rv.textContent='100%';
    addLog('PointRun 完成 · 输出已写入运行记录','ok');
  }
  const result=$('#result');
  result.className='result show';
  result.textContent=ok?`${t.kind==='point'?'PointRun':'FlowRun'} ${t.id}@r${t.revision} 成功 · ${t.kind==='point'?'1 个叶子实例':'slotRuns 已记录'} · 用时 2.6s`:`${t.kind==='point'?'PointRun':'FlowRun'} ${t.id}@r${t.revision} 失败 · 查看运行历史`;
  $('#againBtn').disabled=false;
  $('#cancelBtn').disabled=true;
}

function cancelRun(){
  if(!state.run||state.run.status!=='running')return;
  clearInterval(state.timer);state.timer=null;
  state.run.status='canceled';
  $('#pulse').style.display='none';
  $('#statusText').textContent='已取消';
  addLog('用户取消运行','err');
  $('#result').className='result show';
  $('#result').textContent='运行已取消；已完成的 slotRuns / PointRuns 保留在运行历史。';
  $('#againBtn').disabled=false;
  $('#cancelBtn').disabled=true;
}

function closeConsole(){
  if(state.timer){clearInterval(state.timer);state.timer=null;}
  $('#console').classList.add('hidden');
  state.run=null;
}

function toast(msg){
  const t=$('#toast');t.textContent=msg;t.classList.add('show');
  clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>t.classList.remove('show'),1700);
}

function initTheme(){
  let saved=null;try{saved=localStorage.getItem('quick-launch-theme');}catch(e){}
  if(saved==='light')document.body.classList.add('light');
  updateTheme();
  $('#themeBtn').onclick=()=>{
    document.body.classList.toggle('light');
    try{localStorage.setItem('quick-launch-theme',document.body.classList.contains('light')?'light':'dark');}catch(e){}
    updateTheme();toast(document.body.classList.contains('light')?'浅色主题':'深色主题');
  };
}
function updateTheme(){$('#themeBtn').textContent=document.body.classList.contains('light')?'☀':'☾';}

function moveSelection(dir){
  const items=filtered();if(!items.length)return;
  let idx=items.findIndex(t=>t.id===state.selectedId);
  if(idx<0)idx=0;
  idx=(idx+dir+items.length)%items.length;
  state.selectedId=items[idx].id;renderList();renderPreview();
}

function init(){
  initTheme();renderTabs();renderList();renderPreview();
  $('#search').oninput=(e)=>{state.query=e.target.value;renderList();};
  $$('#tabs [data-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;renderTabs();renderList();});
  $('#runBtn').onclick=startRun;
  $('#inspectBtn').onclick=()=>toast(`模拟：打开 ${byId(state.selectedId).kind==='point'?'surface.inspector.point':'surface.inspector.slot-vpn'}`);
  $('#favoriteBtn').onclick=()=>{const t=byId(state.selectedId);t.favorite=!t.favorite;renderList();renderPreview();toast(t.favorite?'已收藏':'已取消收藏');};
  $('#cancelBtn').onclick=cancelRun;
  $('#againBtn').onclick=startRun;
  $('#consoleClose').onclick=closeConsole;
  $('#historyBtn').onclick=()=>toast('模拟：打开 surface.run-history.flow');
  $('#console').onclick=(e)=>{if(e.target===$('#console'))closeConsole();};
  document.addEventListener('keydown',(e)=>{
    if(!$('#console').classList.contains('hidden')){
      if(e.key==='Escape')closeConsole();
      return;
    }
    if(e.key==='ArrowDown'){e.preventDefault();moveSelection(1);}
    if(e.key==='ArrowUp'){e.preventDefault();moveSelection(-1);}
    if(e.key==='Enter'&&document.activeElement!==$('#search')){e.preventDefault();startRun();}
    if(e.key==='/'&&document.activeElement!==$('#search')){e.preventDefault();$('#search').focus();}
    if(e.key==='Escape'&&document.activeElement===$('#search')){state.query='';$('#search').value='';$('#search').blur();renderList();}
  });
}
document.addEventListener('DOMContentLoaded',init);

