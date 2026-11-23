const DATA = __DATA__;
const $ = (s,el=document)=>el.querySelector(s);
const $$ = (s,el=document)=>[...el.querySelectorAll(s)];
const esc = (s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const allInstances = ()=>DATA.classes.flatMap(c=>c.instances.map(i=>({...i,className:c.name,classId:c.id,family:c.family,classIcon:c.icon})));
const classById = (id)=>DATA.classes.find(c=>c.id===id);
const familyMeta = (id)=>DATA.families[id]||{name:id,short:id,color:'#3b82f6',desc:''};
const instanceById = (id)=>allInstances().find(i=>i.id===id);

const state = {
  family:'all', p0:false, query:'', view:'cards',
  selected:{type:'class',classId:DATA.classes[0].id},
  toastTimer:null
};

function selectedClassId(){return state.selected.classId;}
function selectedInstance(){return state.selected.type==='instance'?instanceById(state.selected.instanceId):null;}

function renderStats(){
  const s=DATA.stats;
  const items=[
    {k:'SurfaceClass',v:s.classes,s:'可复用交互模式',c:'var(--blue)'},
    {k:'SurfaceInstance',v:s.instances,s:'具体数据/动作绑定',c:'var(--cyan)'},
    {k:'Families',v:s.families,s:'Input / Browse / Visualize / Communicate',c:'var(--violet)'},
    {k:'P0',v:s.p0,s:'先做的最小闭环',c:'var(--amber)'},
  ];
  $('#stats').innerHTML=items.map(x=>`<div class="stat" style="--accent:${x.c}"><div class="stat-k">${x.k}</div><div class="stat-v">${x.v}</div><div class="stat-s">${x.s}</div></div>`).join('');
}

function renderFamilies(){
  const counts={all:DATA.classes.length};
  Object.keys(DATA.families).forEach(k=>counts[k]=DATA.classes.filter(c=>c.family===k).length);
  $('#familyCount').textContent=`${DATA.stats.classes} 类 · ${DATA.stats.instances} 实例`;
  const row=(k,name,color,n)=>`<button class="family-btn ${state.family===k?'active':''}" data-family="${k}" style="--c:${color}"><span class="family-dot"></span><span>${esc(name)}</span><span class="n">${n}</span></button>`;
  $('#families').innerHTML=[
    row('all','全部面层类','#94a3b8',counts.all),
    ...Object.entries(DATA.families).map(([k,f])=>row(k,f.short,f.color,counts[k]||0))
  ].join('');
  $$('#families [data-family]').forEach(b=>b.onclick=()=>{state.family=b.dataset.family;renderFamilies();renderContent();});
}

function renderFilters(){
  $('#filters').innerHTML=`
    <button class="filter-btn ${state.p0?'active':''}" data-p0>只看 P0 <span class="check">${state.p0?'✓':''}</span></button>
    <button class="filter-btn" data-reset>清空筛选 <span class="check">↺</span></button>`;
  $$('#filters [data-p0]').forEach(b=>b.onclick=()=>{state.p0=!state.p0;renderFilters();renderContent();});
  $$('#filters [data-reset]').forEach(b=>b.onclick=()=>{state.family='all';state.p0=false;state.query='';$('#search').value='';renderFamilies();renderFilters();renderContent();});
}

function matches(c){
  if(state.family!=='all' && c.family!==state.family) return false;
  if(state.p0 && !c.p0) return false;
  const q=state.query.trim().toLowerCase();
  if(!q) return true;
  const hay=[
    c.id,c.name,c.summary,c.family,
    ...(c.regions||[]),...(c.slots||[]),...(c.actions||[]),...(c.states||[]),
    ...c.instances.flatMap(i=>[i.id,i.name,i.desc,i.placement,...(i.dataBindings||[]).flatMap(b=>[b.slot,b.kind,b.target]),...(i.actionBindings||[]).flatMap(b=>[b.slot,b.kind,b.target])])
  ].join(' ').toLowerCase();
  return hay.includes(q);
}

function filteredClasses(){return DATA.classes.filter(matches);}

function renderContent(){
  const classes=filteredClasses();
  const instCount=classes.reduce((n,c)=>n+c.instances.length,0);
  $('#mainCount').textContent=`${classes.length} 类 · ${instCount} 实例`;
  const sel=state.selected.type==='instance'?instanceById(state.selected.instanceId):null;
  $('#mainSub').textContent=state.query||state.family!=='all'||state.p0
    ? `筛选：${state.query?`“${state.query}” · `:''}${state.family==='all'?'全部家族':familyMeta(state.family).short}${state.p0?' · 只看 P0':''}`
    : '15 个交互模式，36 个实例。点类看契约，点实例看它绑定了哪个 Flow / Point。';
  if(!classes.length){$('#content').innerHTML=`<div class="empty"><b>没有匹配的面层类</b>试试清空搜索或切换家族。</div>`;return;}
  if(state.view==='table') renderTable(classes);
  else if(state.view==='graph') renderGraph(classes);
  else renderCards(classes);
  bindContentEvents();
}

function classCard(c){
  const f=familyMeta(c.family);
  const active=state.selected.classId===c.id;
  return `<article class="class-card ${active?'selected':''}" data-class="${esc(c.id)}" style="--c:${f.color}">
    <div class="card-head">
      <div class="class-icon">${esc(c.icon)}</div>
      <div class="class-title"><h3>${esc(c.name)}</h3><code>${esc(c.id)}</code></div>
      ${c.p0?'<span class="p0">P0</span>':''}
    </div>
    <div class="card-desc">${esc(c.summary)}</div>
    <div class="tags"><span class="pill fam">${esc(f.short)}</span><span class="pill mono">${c.instances.length} 实例</span><span class="pill mono">${c.states.length} 状态</span></div>
    <div class="instances">${c.instances.map(i=>`<button class="inst-chip" data-instance="${esc(i.id)}" data-class-id="${esc(c.id)}"><span class="dot"></span><b>${esc(i.name)}</b><code>${esc(i.id)}</code></button>`).join('')}</div>
  </article>`;
}

function renderCards(classes){
  const groups={};
  classes.forEach(c=>{(groups[c.family]??=[]).push(c);});
  $('#content').innerHTML=Object.entries(groups).map(([fam,list])=>{
    const f=familyMeta(fam);
    return `<section class="family-section">
      <div class="family-head"><h2 style="color:${f.color}">${esc(f.name)}</h2><span class="cnt">${list.length} 类</span><span class="line"></span></div>
      <div class="catalog-grid">${list.map(classCard).join('')}</div>
    </section>`;
  }).join('');
}

function renderTable(classes){
  $('#content').innerHTML=`<table class="catalog-table"><thead><tr><th>面层类</th><th>家族</th><th>用途</th><th>实例</th><th>状态</th></tr></thead><tbody>
    ${classes.map(c=>{const f=familyMeta(c.family);return `<tr data-class="${esc(c.id)}" class="${state.selected.classId===c.id?'selected':''}" style="--c:${f.color}">
      <td><div style="display:flex;align-items:center;gap:8px"><span class="class-icon" style="width:30px;height:30px;font-size:13px">${esc(c.icon)}</span><div><b>${esc(c.name)}</b><span class="id">${esc(c.id)}</span></div></div></td>
      <td><span class="pill fam" style="--c:${f.color}">${esc(f.short)}</span></td>
      <td class="desc">${esc(c.summary)}</td>
      <td>${c.instances.map(i=>`<button class="inst-chip" data-instance="${esc(i.id)}" data-class-id="${esc(c.id)}"><span class="dot"></span>${esc(i.name)}</button>`).join('')}</td>
      <td>${c.p0?'<span class="p0">P0</span>':'<span class="pill mono">P1/P2</span>'}</td>
    </tr>`;}).join('')}
  </tbody></table>`;
}

function renderGraph(classes){
  const focus=classById(state.selected.classId)&&classes.some(c=>c.id===state.selected.classId)
    ? classById(state.selected.classId) : classes[0];
  const f=familyMeta(focus.family);
  const n=focus.instances.length;
  const gap=62,startY=42,height=Math.max(330,startY+(n-1)*gap+78);
  const centers=focus.instances.map((_,i)=>startY+i*gap+24);
  const cy=n?Math.round((centers[0]+centers[n-1])/2):height/2;
  const lines=focus.instances.map((_,i)=>`<path d="M249,${cy} C360,${cy} 440,${centers[i]} 560,${centers[i]}" fill="none" stroke="${f.color}" stroke-opacity=".35" stroke-width="1.4"/>`).join('');
  const instNodes=focus.instances.map((i,idx)=>`<button class="graph-node graph-inst" data-instance="${esc(i.id)}" data-class-id="${esc(focus.id)}" style="left:560px;top:${centers[idx]-24}px;--c:${f.color}"><span class="dot"></span><span><b>${esc(i.name)}</b><code>${esc(i.id)}</code></span></button>`).join('');
  $('#content').innerHTML=`<div class="graph-toolbar"><label>聚焦类</label><select id="graphSelect">${classes.map(c=>`<option value="${esc(c.id)}" ${c.id===focus.id?'selected':''}>${esc(c.name)} · ${esc(c.id)}</option>`).join('')}</select><span class="muted" style="font-size:10px">${n} 个实例 · 点击节点查看 Inspector</span></div>
    <div class="graph-wrap"><div class="graph" style="height:${height}px">
      <svg width="820" height="${height}" viewBox="0 0 820 ${height}">${lines}</svg>
      <button class="graph-node graph-class" data-class="${esc(focus.id)}" style="left:14px;top:${cy-60}px;--c:${f.color}">
        <div class="kicker" style="color:${f.color}">SURFACECLASS</div>
        <h3>${esc(focus.icon)} ${esc(focus.name)}</h3><code>${esc(focus.id)}</code>
        <p>${esc(focus.summary)}</p>
        <div class="chips" style="margin-top:8px">${focus.actions.slice(0,4).map(a=>`<span class="chip action">${esc(a)}</span>`).join('')}</div>
      </button>
      ${instNodes}
    </div></div>
    <div class="graph-legend"><span><i></i>SurfaceClass</span><span><i class="inst"></i>SurfaceInstance</span><span>连线 = 实例化关系</span></div>`;
  $('#graphSelect').onchange=(e)=>selectClass(e.target.value);
}

function bindContentEvents(){
  $('#content').onclick=(e)=>{
    const inst=e.target.closest('[data-instance]');
    if(inst){selectInstance(inst.dataset.classId,inst.dataset.instance);return;}
    const cl=e.target.closest('[data-class]');
    if(cl){selectClass(cl.dataset.class);}
  };
}

function selectClass(id){
  state.selected={type:'class',classId:id};
  renderContent();renderInspector();
}
function selectInstance(classId,instanceId){
  state.selected={type:'instance',classId,instanceId};
  renderContent();renderInspector();
}

function renderInspector(){
  if(state.selected.type==='instance'){
    const i=instanceById(state.selected.instanceId);
    if(i){renderInstanceInspector(i);return;}
  }
  const c=classById(state.selected.classId)||DATA.classes[0];
  state.selected={type:'class',classId:c.id};
  renderClassInspector(c);
}

function renderClassInspector(c){
  const f=familyMeta(c.family);
  $('#inspector').style.setProperty('--c',f.color);
  $('#inspector').innerHTML=`
    <div class="insp-head">
      <div class="kicker">SURFACECLASS</div>
      <h2>${esc(c.icon)} ${esc(c.name)}</h2>
      <code>${esc(c.id)}</code>
      <p class="insp-sub">${esc(c.summary)}</p>
    </div>
    <div class="insp-section"><h4>契约</h4><div class="kv">
      <div class="k">family</div><div class="v"><span class="chip" style="color:${f.color}">${esc(f.name)}</span></div>
      <div class="k">priority</div><div class="v">${c.p0?'<span class="p0">P0</span>':'<span class="pill mono">P1 / P2</span>'}</div>
      <div class="k">instances</div><div class="v"><code>${c.instances.length}</code> 个</div>
      <div class="k">version</div><div class="v"><code>v1.0.0</code>（mock）</div>
    </div></div>
    <div class="insp-section"><h4>区域 <span class="n">${c.regions.length}</span></h4><div class="chips">${c.regions.map(x=>`<span class="chip">${esc(x)}</span>`).join('')}</div></div>
    <div class="insp-section"><h4>槽位 <span class="n">${c.slots.length}</span></h4><div class="chips">${c.slots.map(x=>`<span class="chip">${esc(x)}</span>`).join('')}</div></div>
    <div class="insp-section"><h4>动作 <span class="n">${c.actions.length}</span></h4><div class="chips">${c.actions.map(x=>`<span class="chip action">${esc(x)}</span>`).join('')}</div></div>
    <div class="insp-section"><h4>状态 <span class="n">${c.states.length}</span></h4><div class="chips">${c.states.map(x=>`<span class="chip state">${esc(x)}</span>`).join('')}</div></div>
    <div class="insp-section"><h4>实例 <span class="n">${c.instances.length}</span></h4><div class="inst-list">${c.instances.map(i=>`<button class="inst-row" data-instance="${esc(i.id)}" data-class-id="${esc(c.id)}"><span class="dot"></span><b>${esc(i.name)}</b><code>${esc(i.id)}</code></button>`).join('')}</div></div>
    <div class="side-note" style="margin-top:14px"><b>面层规则：</b>类管交互模式，实例管数据/动作/位置/主题/权限。页面不是类，页面是多个实例的组合。</div>`;
  $$('#inspector [data-instance]').forEach(b=>b.onclick=()=>selectInstance(b.dataset.classId,b.dataset.instance));
}

function renderInstanceInspector(i){
  const c=classById(i.classId)||classById(state.selected.classId);
  const f=familyMeta(c.family);
  $('#inspector').style.setProperty('--c',f.color);
  const bindRows=(rows,kind)=>rows.length?rows.map(b=>`<tr><td class="mono">${esc(b.slot)}</td><td><span class="type-tag ${kind==='action'?'action':''}">${esc(b.kind)}</span></td><td class="mono">${esc(b.target)}</td></tr>`).join(''):`<tr><td colspan="3" class="muted" style="padding:8px">无绑定</td></tr>`;
  $('#inspector').innerHTML=`
    <button class="back" data-open-class="${esc(c.id)}">← 返回 ${esc(c.name)}</button>
    <div class="insp-head">
      <div class="kicker">SURFACEINSTANCE</div>
      <h2>${esc(i.name)}</h2>
      <code>${esc(i.id)}</code>
      <p class="insp-sub">${esc(i.desc)}</p>
    </div>
    <div class="insp-section"><h4>实例</h4><div class="kv">
      <div class="k">surface</div><div class="v"><code>${esc(c.id)}</code> @ v1.0.0</div>
      <div class="k">placement</div><div class="v"><span class="chip">${esc(i.placement)}</span></div>
      <div class="k">revision</div><div class="v"><code>r${i.revision}</code></div>
      <div class="k">status</div><div class="v"><span class="chip state">${esc(i.status)}</span></div>
    </div></div>
    <div class="insp-section"><h4>数据绑定 <span class="n">${i.dataBindings.length}</span></h4><table class="bind-table"><thead><tr><th>slot</th><th>kind</th><th>target</th></tr></thead><tbody>${bindRows(i.dataBindings,'data')}</tbody></table></div>
    <div class="insp-section"><h4>动作绑定 <span class="n">${i.actionBindings.length}</span></h4><table class="bind-table"><thead><tr><th>slot</th><th>kind</th><th>target</th></tr></thead><tbody>${bindRows(i.actionBindings,'action')}</tbody></table></div>
    <div class="insp-section"><h4>实例 JSON</h4><pre class="json">${esc(JSON.stringify(i,null,2))}</pre></div>`;
  $$('#inspector [data-open-class]').forEach(b=>b.onclick=()=>selectClass(b.dataset.openClass));
}

function toast(msg){
  const t=$('#toast');t.textContent=msg;t.classList.add('show');
  clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>t.classList.remove('show'),1800);
}

function initTheme(){
  let saved=null;try{saved=localStorage.getItem('surface-theme');}catch(e){}
  if(saved==='light')document.body.classList.add('light');
  updateThemeBtn();
  $('#themeBtn').onclick=()=>{
    document.body.classList.toggle('light');
    try{localStorage.setItem('surface-theme',document.body.classList.contains('light')?'light':'dark');}catch(e){}
    updateThemeBtn();
    toast(document.body.classList.contains('light')?'已切换浅色主题':'已切换深色主题');
  };
}
function updateThemeBtn(){$('#themeBtn').textContent=document.body.classList.contains('light')?'☀':'☾';}

function init(){
  renderStats();renderFamilies();renderFilters();renderContent();renderInspector();initTheme();
  $('#search').oninput=(e)=>{state.query=e.target.value;renderContent();};
  $$('#viewSeg [data-view]').forEach(b=>b.onclick=()=>{
    state.view=b.dataset.view;
    $$('#viewSeg [data-view]').forEach(x=>x.classList.toggle('active',x===b));
    renderContent();
  });
  document.addEventListener('keydown',(e)=>{
    if(e.key==='/' && document.activeElement!==$('#search')){e.preventDefault();$('#search').focus();}
    if(e.key==='Escape'){if(document.activeElement===$('#search')){state.query='';$('#search').value='';$('#search').blur();renderContent();}}
  });
}
document.addEventListener('DOMContentLoaded',init);
