const BINDINGS=[
  {pattern:'LDR',name:'打开 GitHub',kind:'flow',target:'inst.site-github@r1',effect:'L2',desc:'确保 VPN → 可达性 → 打开 URL → 通知'},
  {pattern:'UD',name:'检测 VPN 状态',kind:'point',target:'vpn.default.status@r1',effect:'L0',desc:'读取进程/窗口/隧道状态，不做修改'},
  {pattern:'RL',name:'开发工作区',kind:'flow',target:'inst.workspace-dev@r3',effect:'L1',desc:'VS Code + 终端 + 双屏布局'},
  {pattern:'DR',name:'打开终端',kind:'point',target:'open.terminal@r1',effect:'L1',desc:'打开默认终端'},
  {pattern:'DLU',name:'确保 VPN',kind:'flow',target:'inst.ensure-vpn-ask@r2',effect:'L2',desc:'检测 → 启动/询问 → 等待 → 连接'},
];
const $=(s,el=document)=>el.querySelector(s);
const $$=(s,el=document)=>[...el.querySelectorAll(s)];
const esc=(s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const OPP={R:'L',L:'R',U:'D',D:'U',NE:'SW',NW:'SE',SE:'NW',SW:'NE'};
const VEC={R:[1,0],L:[-1,0],U:[0,-1],D:[0,1],NE:[.7,-.7],NW:[-.7,-.7],SE:[.7,.7],SW:[-.7,.7]};
const state={drawing:false,points:[],dirs:[],lastDir:null,pattern:'',match:null,fuzzy:false,toastTimer:null,bubbleTimer:null,progressTimer:null};

function dirOf(dx,dy){
  const a=Math.atan2(dy,dx)*180/Math.PI;
  if(a>=-22.5&&a<22.5)return 'R';
  if(a>=22.5&&a<67.5)return 'SE';
  if(a>=67.5&&a<112.5)return 'D';
  if(a>=112.5&&a<157.5)return 'SW';
  if(a>=157.5||a<-157.5)return 'L';
  if(a>=-157.5&&a<-112.5)return 'NW';
  if(a>=-112.5&&a<-67.5)return 'U';
  return 'NE';
}
function normalize(p){return (p||'').replace(/\s+/g,'').toUpperCase();}
function editDistance(a,b){
  const n=a.length,m=b.length;let prev=Array.from({length:m+1},(_,i)=>i),cur=new Array(m+1);
  for(let i=1;i<=n;i++){cur[0]=i;for(let j=1;j<=m;j++){const cost=a[i-1]===b[j-1]?0:1;cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+cost);}[prev,cur]=[cur,prev];}
  return prev[m];
}
function findMatch(pattern){
  const p=normalize(pattern);if(!p)return null;
  const exact=BINDINGS.find(b=>b.pattern===p);if(exact)return {binding:exact,quality:'exact',distance:0};
  if(state.fuzzy){
    let best=null;
    for(const b of BINDINGS){const d=editDistance(p,b.pattern);if(d<=1&&(!best||d<best.distance))best={binding:b,quality:'fuzzy',distance:d};}
    if(best)return best;
  }
  return null;
}
function setPhase(t){const el=$('#phase');el.textContent=t;el.className='phase '+(t==='drawing'?'drawing':'');}
function setPadHint(show){$('#padHint').style.display=show?'block':'none';}
function renderTrail(){
  const svg=$('#trail');
  if(!state.points.length){svg.innerHTML='';return;}
  const pts=state.points.map(p=>`${p.x},${p.y}`).join(' ');
  const first=state.points[0],last=state.points[state.points.length-1];
  svg.innerHTML=`<polyline points="${pts}" fill="none" stroke="#06b6d4" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${first.x}" cy="${first.y}" r="4" fill="#22c55e"/><circle cx="${last.x}" cy="${last.y}" r="4" fill="#f59e0b"/>`;
}
function renderDirs(){
  $('#dirs').innerHTML=state.dirs.length?state.dirs.map((d,i)=>`<span class="dir">${esc(d)}</span>`).join('<span style="color:var(--faint);font-size:9px">→</span>'):`<span style="font-size:9px;color:var(--faint)">方向序列会出现在这里</span>`;
  $('#pattern').textContent=state.pattern||'—';
}
function renderBindings(){
  $('#bindings').innerHTML=BINDINGS.map(b=>`<div class="binding ${state.match&&state.match.binding.pattern===b.pattern?'hit':''}" data-pattern="${b.pattern}"><div class="binding-top"><span class="pattern-pill">${b.pattern}</span><span class="type-badge ${b.kind}">${b.kind==='flow'?'FLOW':'POINT'}</span><span class="binding-name">${esc(b.name)}</span></div><div class="binding-sub">${esc(b.target)} · ${b.effect}</div></div>`).join('');
  $$('#bindings [data-pattern]').forEach(el=>el.onclick=()=>preset(el.dataset.pattern));
}
function renderMatch(){
  const m=state.match;
  if(!state.pattern){$('#match').className='match empty';$('#match').textContent='画一个手势，或点上方预设';return;}
  if(!m){$('#match').className='match';$('#match').innerHTML=`<div class="k">NO MATCH</div><h3>未匹配手势</h3><div class="target">${esc(state.pattern)} 没有绑定；可以打开模糊匹配，或在绑定表里新增。</div>`;return;}
  const b=m.binding;
  $('#match').className='match';
  $('#match').innerHTML=`<div class="k">MATCH · ${m.quality.toUpperCase()}${m.quality==='fuzzy'?' · distance '+m.distance:''}</div><h3>${esc(b.name)}</h3><div class="target">${esc(b.target)}</div><div class="meta"><span class="type-badge ${b.kind}">${b.kind==='flow'?'FLOW':'POINT'}</span><span class="type-badge" style="color:#fcd34d;border-color:rgba(245,158,11,.2);background:rgba(245,158,11,.07)">${b.effect}</span><span class="type-badge" style="color:var(--dim)">${esc(b.pattern)}</span></div><button class="run" id="runBtn">▶ 启动 ${b.kind==='flow'?'FlowInstance':'PointInstance'}</button>`;
  $('#runBtn').onclick=runMatch;
}
function updateMatch(){
  state.match=findMatch(state.pattern);
  renderBindings();renderMatch();renderDirs();
}
function finishGesture(){
  state.drawing=false;setPhase('done');
  state.pattern=state.dirs.join('');
  updateMatch();
  setPadHint(!state.points.length);
}
function localPoint(e){
  const r=$('#pad').getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};
}
function setViewBox(){
  const r=$('#pad').getBoundingClientRect();$('#trail').setAttribute('viewBox',`0 0 ${r.width} ${r.height}`);
}
function down(e){
  if(e.button!==0)return;e.preventDefault();$('#pad').setPointerCapture(e.pointerId);
  setViewBox();state.drawing=true;state.points=[];state.dirs=[];state.pattern='';state.match=null;state.lastDir=null;
  const p=localPoint(e);state.points.push(p);state.lastDir=p;setPhase('drawing');setPadHint(false);renderTrail();renderDirs();renderBindings();renderMatch();
}
function move(e){
  if(!state.drawing)return;e.preventDefault();
  const p=localPoint(e);state.points.push(p);renderTrail();
  const dx=p.x-state.lastDir.x,dy=p.y-state.lastDir.y;const dist=Math.hypot(dx,dy);
  if(dist<24)return;
  const d=dirOf(dx,dy);const last=state.dirs[state.dirs.length-1];
  if(d===last){state.lastDir=p;return;}
  if(last&&OPP[last]===d){state.dirs.pop();state.lastDir=p;renderDirs();return;}
  state.dirs.push(d);state.lastDir=p;renderDirs();
}
function up(e){
  if(!state.drawing)return;e.preventDefault();
  const p=localPoint(e);state.points.push(p);renderTrail();
  finishGesture();
}
function preset(pattern){
  const dirs=pattern.split(/\s+/).filter(Boolean);
  setViewBox();const r=$('#pad').getBoundingClientRect();
  let x=r.width/2,y=r.height/2;state.points=[{x,y}];state.dirs=[];state.lastDir={x,y};
  for(const d of dirs){const v=VEC[d]||[1,0];x+=v[0]*64;y+=v[1]*64;state.points.push({x,y});state.dirs.push(d);}
  state.pattern=dirs.join('');setPhase('done');setPadHint(false);renderTrail();updateMatch();
}
function clearPad(){
  state.drawing=false;state.points=[];state.dirs=[];state.pattern='';state.match=null;state.lastDir=null;
  setPhase('idle');setPadHint(true);renderTrail();renderDirs();renderBindings();renderMatch();
}
function runMatch(){
  if(!state.match)return;const b=state.match.binding;
  const bubble=$('#bubble');bubble.classList.add('show');
  $('#bubbleKind').textContent=b.kind==='flow'?'FLOW':'POINT';
  $('#bubbleKind').className='type-badge '+b.kind;
  $('#bubbleName').textContent=b.name;
  $('#bubbleStatus').textContent='running';
  $('#bubbleSub').textContent=`${b.kind==='flow'?'FlowRun':'PointRun'} · ${b.target} · ${b.effect}`;
  $('#bubbleBar').style.width='0%';$('#bubblePct').textContent='0%';
  if(state.progressTimer)clearInterval(state.progressTimer);
  let pct=0;
  state.progressTimer=setInterval(()=>{
    pct=Math.min(100,pct+Math.floor(Math.random()*8)+4);
    $('#bubbleBar').style.width=pct+'%';$('#bubblePct').textContent=pct+'%';
    if(pct>=100){clearInterval(state.progressTimer);state.progressTimer=null;$('#bubbleStatus').textContent='ok';$('#bubbleSub').textContent=`${b.kind==='flow'?'FlowRun':'PointRun'} 完成 · 已写入运行记录`;state.bubbleTimer=setTimeout(()=>bubble.classList.remove('show'),1600);}
  },60);
  if(state.bubbleTimer){clearTimeout(state.bubbleTimer);state.bubbleTimer=null;}
}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>t.classList.remove('show'),1500);}
function initTheme(){
  let saved=null;try{saved=localStorage.getItem('gesture-binding-theme');}catch(e){}
  if(saved==='light')document.body.classList.add('light');updateTheme();
  $('#themeBtn').onclick=()=>{document.body.classList.toggle('light');try{localStorage.setItem('gesture-binding-theme',document.body.classList.contains('light')?'light':'dark');}catch(e){}updateTheme();};
}
function updateTheme(){$('#themeBtn').textContent=document.body.classList.contains('light')?'☀':'☾';}
function init(){
  initTheme();renderBindings();renderMatch();renderDirs();
  const pad=$('#pad');pad.addEventListener('pointerdown',down);pad.addEventListener('pointermove',move);pad.addEventListener('pointerup',up);pad.addEventListener('pointercancel',up);
  $$('.preset[data-preset]').forEach(b=>b.onclick=()=>preset(b.dataset.preset));
  $('#clear').onclick=clearPad;
  $('#fuzzy').onchange=(e)=>{state.fuzzy=e.target.checked;if(state.pattern)updateMatch();toast(state.fuzzy?'模糊匹配已开启（≤1 段）':'模糊匹配已关闭');};
  document.addEventListener('keydown',(e)=>{if(e.key==='Escape'){clearPad();$('#bubble').classList.remove('show');}});
}
document.addEventListener('DOMContentLoaded',init);
