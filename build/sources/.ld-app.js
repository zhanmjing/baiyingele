const TABS=[
  {id:'common',name:'常用'},
  {id:'dev',name:'开发'},
  {id:'system',name:'系统'},
  {id:'tools',name:'工具'},
  {id:'web',name:'外网'},
];

const TILES=[
  {id:'github',tab:'common',name:'GitHub',sub:'inst.site-github',kind:'flow',icon:'GH',hotkey:'1',target:'inst.site-github@r1',effect:'L2'},
  {id:'youtube',tab:'common',name:'YouTube',sub:'inst.site-youtube',kind:'flow',icon:'▶',hotkey:'2',target:'inst.site-youtube@r3',effect:'L2'},
  {id:'vpn',tab:'common',name:'确保 VPN',sub:'inst.ensure-vpn-ask',kind:'flow',icon:'VPN',hotkey:'3',target:'inst.ensure-vpn-ask@r2',effect:'L2'},
  {id:'vscode',tab:'common',name:'VS Code',sub:'inst.open-app-vscode',kind:'flow',icon:'VS',hotkey:'4',target:'inst.open-app-vscode-project@r2',effect:'L1'},
  {id:'terminal',tab:'common',name:'终端',sub:'open.terminal',kind:'point',icon:'>_',hotkey:'5',target:'open.terminal@r1',effect:'L1'},
  {id:'translate',tab:'common',name:'截图翻译',sub:'inst.screenshot-en-zh',kind:'flow',icon:'文',hotkey:'6',target:'inst.screenshot-en-zh@r4',effect:'L1'},
  {id:'invoice',tab:'common',name:'发票归档',sub:'inst.invoice-company',kind:'flow',icon:'¥',hotkey:'7',target:'inst.invoice-company@r6',effect:'L1'},
  {id:'clipboard',tab:'common',name:'剪贴板存文件',sub:'inst.clipboard-inbox',kind:'flow',icon:'▤',hotkey:'8',target:'inst.clipboard-inbox@r3',effect:'L1'},
  {id:'sysmon',tab:'common',name:'系统监控',sub:'sys.metrics.snapshot',kind:'point',icon:'◉',hotkey:'9',target:'sys.metrics.snapshot@r1',effect:'L0'},
  {id:'settings',tab:'common',name:'设置',sub:'settings.open',kind:'point',icon:'⚙',hotkey:'0',target:'settings.open@r1',effect:'L0'},
  {id:'google',tab:'common',name:'Google',sub:'inst.site-google',kind:'flow',icon:'G',hotkey:'',target:'inst.site-google@r1',effect:'L2'},
  {id:'openai',tab:'common',name:'OpenAI',sub:'inst.site-openai',kind:'flow',icon:'AI',hotkey:'',target:'inst.site-openai@r1',effect:'L2'},

  {id:'dev-github',tab:'dev',name:'GitHub',sub:'inst.site-github',kind:'flow',icon:'GH',hotkey:'1',target:'inst.site-github@r1',effect:'L2'},
  {id:'dev-vscode',tab:'dev',name:'VS Code',sub:'inst.open-app-vscode',kind:'flow',icon:'VS',hotkey:'2',target:'inst.open-app-vscode-project@r2',effect:'L1'},
  {id:'dev-terminal',tab:'dev',name:'终端',sub:'open.terminal',kind:'point',icon:'>_',hotkey:'3',target:'open.terminal@r1',effect:'L1'},
  {id:'dev-http',tab:'dev',name:'GitHub API',sub:'inst.http-github-status',kind:'flow',icon:'{}',hotkey:'4',target:'inst.http-github-status@r2',effect:'L1'},
  {id:'dev-json',tab:'dev',name:'JSON 格式化',sub:'json.format',kind:'point',icon:'{}',hotkey:'5',target:'json.format@r1',effect:'L0'},
  {id:'dev-regex',tab:'dev',name:'正则测试',sub:'text.regex',kind:'point',icon:'.*',hotkey:'6',target:'text.regex@r1',effect:'L0'},
  {id:'dev-docker',tab:'dev',name:'Docker',sub:'inst.ensure-service-docker',kind:'flow',icon:'DK',hotkey:'7',target:'inst.ensure-service-docker@r1',effect:'L1'},
  {id:'dev-logs',tab:'dev',name:'运行日志',sub:'flow.run.logs',kind:'point',icon:'≡',hotkey:'8',target:'flow.run.logs@r1',effect:'L0'},

  {id:'sys-cpu',tab:'system',name:'CPU',sub:'sys.cpu.stats',kind:'point',icon:'CPU',hotkey:'1',target:'sys.cpu.stats@r1',effect:'L0'},
  {id:'sys-gpu',tab:'system',name:'GPU',sub:'sys.gpu.stats',kind:'point',icon:'GPU',hotkey:'2',target:'sys.gpu.stats@r1',effect:'L0'},
  {id:'sys-mem',tab:'system',name:'内存',sub:'sys.memory.stats',kind:'point',icon:'RAM',hotkey:'3',target:'sys.memory.stats@r1',effect:'L0'},
  {id:'sys-net',tab:'system',name:'网速',sub:'sys.network.stats',kind:'point',icon:'NET',hotkey:'4',target:'sys.network.stats@r1',effect:'L0'},
  {id:'sys-disk',tab:'system',name:'磁盘',sub:'sys.disk.stats',kind:'point',icon:'DSK',hotkey:'5',target:'sys.disk.stats@r1',effect:'L0'},
  {id:'sys-uptime',tab:'system',name:'开机时长',sub:'sys.uptime',kind:'point',icon:'UP',hotkey:'6',target:'sys.uptime@r1',effect:'L0'},
  {id:'sys-temp',tab:'system',name:'温度',sub:'sys.sensors.temp',kind:'point',icon:'°C',hotkey:'7',target:'sys.sensors.temp@r1',effect:'L0'},
  {id:'sys-proc',tab:'system',name:'进程 Top',sub:'sys.process.top',kind:'point',icon:'TOP',hotkey:'8',target:'sys.process.top@r1',effect:'L0'},
  {id:'sys-service',tab:'system',name:'服务状态',sub:'service.status',kind:'point',icon:'SVC',hotkey:'9',target:'service.status@r1',effect:'L0'},
  {id:'sys-power',tab:'system',name:'电源',sub:'sys.power.status',kind:'point',icon:'PWR',hotkey:'0',target:'sys.power.status@r1',effect:'L0'},

  {id:'tool-ocr',tab:'tools',name:'OCR',sub:'ocr.read',kind:'point',icon:'OCR',hotkey:'1',target:'ocr.read@r1',effect:'L0'},
  {id:'tool-translate',tab:'tools',name:'翻译',sub:'translate.text',kind:'point',icon:'文',hotkey:'2',target:'translate.text@r1',effect:'L1'},
  {id:'tool-clip',tab:'tools',name:'剪贴板',sub:'input.clipboard',kind:'point',icon:'▤',hotkey:'3',target:'input.clipboard@r1',effect:'L0'},
  {id:'tool-write',tab:'tools',name:'写文件',sub:'file.write',kind:'point',icon:'✎',hotkey:'4',target:'file.write@r1',effect:'L1'},
  {id:'tool-hash',tab:'tools',name:'哈希',sub:'hash.sha256',kind:'point',icon:'#',hotkey:'5',target:'hash.sha256@r1',effect:'L0'},
  {id:'tool-zip',tab:'tools',name:'压缩',sub:'file.zip',kind:'point',icon:'ZIP',hotkey:'6',target:'file.zip@r1',effect:'L1'},
  {id:'tool-color',tab:'tools',name:'取色',sub:'screen.color',kind:'point',icon:'◐',hotkey:'7',target:'screen.color@r1',effect:'L0'},
  {id:'tool-timer',tab:'tools',name:'计时器',sub:'timer.start',kind:'point',icon:'◷',hotkey:'8',target:'timer.start@r1',effect:'L0'},

  {id:'web-github',tab:'web',name:'GitHub',sub:'inst.site-github',kind:'flow',icon:'GH',hotkey:'1',target:'inst.site-github@r1',effect:'L2'},
  {id:'web-youtube',tab:'web',name:'YouTube',sub:'inst.site-youtube',kind:'flow',icon:'▶',hotkey:'2',target:'inst.site-youtube@r3',effect:'L2'},
  {id:'web-google',tab:'web',name:'Google',sub:'inst.site-google',kind:'flow',icon:'G',hotkey:'3',target:'inst.site-google@r1',effect:'L2'},
  {id:'web-openai',tab:'web',name:'OpenAI',sub:'inst.site-openai',kind:'flow',icon:'AI',hotkey:'4',target:'inst.site-openai@r1',effect:'L2'},
  {id:'web-x',tab:'web',name:'X',sub:'inst.site-x',kind:'flow',icon:'X',hotkey:'5',target:'inst.site-x@r1',effect:'L2'},
  {id:'web-so',tab:'web',name:'StackOverflow',sub:'inst.site-so',kind:'flow',icon:'SO',hotkey:'6',target:'inst.site-so@r1',effect:'L2'},
  {id:'web-bili',tab:'web',name:'Bilibili',sub:'inst.site-bili',kind:'flow',icon:'B',hotkey:'7',target:'inst.site-bili@r1',effect:'L2'},
  {id:'web-reddit',tab:'web',name:'Reddit',sub:'inst.site-reddit',kind:'flow',icon:'R',hotkey:'8',target:'inst.site-reddit@r1',effect:'L2'},
  {id:'web-gmail',tab:'web',name:'Gmail',sub:'inst.site-gmail',kind:'flow',icon:'M',hotkey:'9',target:'inst.site-gmail@r1',effect:'L2'},
  {id:'web-maps',tab:'web',name:'Maps',sub:'inst.site-maps',kind:'flow',icon:'⌖',hotkey:'0',target:'inst.site-maps@r1',effect:'L2'},
];

const $=(s,el=document)=>el.querySelector(s);
const $$=(s,el=document)=>[...el.querySelectorAll(s)];
const esc=(s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={tab:'common',page:0,query:'',pinned:true,size:74,dragId:null,ctxTile:null,hideTimer:null,launchTimer:null,toastTimer:null,bubbleTimer:null,justDragged:false};

function currentTiles(){
  const q=state.query.trim().toLowerCase();
  return TILES.filter(t=>t.tab===state.tab&&(!q||[t.id,t.name,t.sub,t.target,t.kind].join(' ').toLowerCase().includes(q)));
}
function pageCount(){return Math.max(1,Math.ceil(currentTiles().length/10));}
function pageTiles(){
  const all=currentTiles();
  return all.slice(state.page*10,state.page*10+10);
}

function renderTabs(){
  $('#tabs').innerHTML=TABS.map(t=>`<button class="tab ${state.tab===t.id?'active':''}" data-tab="${t.id}">${esc(t.name)}</button>`).join('');
  $$('#tabs [data-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;state.page=0;state.query='';$('#search').value='';render();});
}
function renderGrid(){
  const tiles=pageTiles();
  if(!tiles.length){$('#grid').innerHTML=`<div class="tile" style="grid-column:1/-1;min-height:160px;justify-content:center;color:var(--faint)">没有匹配的图标</div>`;return;}
  $('#grid').innerHTML=tiles.map((t,i)=>`<button class="tile" draggable="true" data-tile-id="${esc(t.id)}" data-kind="${t.kind}" title="${esc(t.name)} · ${esc(t.target)}">
    <span class="hotkey">${esc(t.hotkey||'')}</span>
    <span class="tile-icon">${esc(t.icon)}<span class="kind-dot">${t.kind==='flow'?'FL':'PT'}</span></span>
    <span class="tile-label">${esc(t.name)}</span>
    <span class="tile-sub">${esc(t.sub)}</span>
  </button>`).join('');
  bindTiles();
}
function bindTiles(){
  $$('#grid [data-tile-id]').forEach(el=>{
    el.onclick=()=>{if(state.dragId||state.justDragged)return;const t=TILES.find(x=>x.id===el.dataset.tileId);if(t)launch(t);};
    el.oncontextmenu=(e)=>{e.preventDefault();openCtx(e,tilesById(el.dataset.tileId));};
    el.ondragstart=(e)=>{state.dragId=el.dataset.tileId;el.classList.add('dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',state.dragId);};
    el.ondragover=(e)=>{e.preventDefault();el.classList.add('drop-target');};
    el.ondragleave=()=>el.classList.remove('drop-target');
    el.ondrop=(e)=>{e.preventDefault();el.classList.remove('drop-target');const from=state.dragId,to=el.dataset.tileId;if(!from||from===to)return;const a=TILES.findIndex(x=>x.id===from),b=TILES.findIndex(x=>x.id===to);if(a<0||b<0)return;const [m]=TILES.splice(a,1);TILES.splice(b,0,m);state.dragId=null;renderGrid();toast('已调整图标顺序');};
    el.ondragend=()=>{el.classList.remove('dragging');state.dragId=null;state.justDragged=true;setTimeout(()=>state.justDragged=false,220);};
  });
}
function tilesById(id){return TILES.find(t=>t.id===id);}

function renderPages(){
  const n=pageCount();const dots=[];
  for(let i=0;i<n;i++)dots.push(`<button class="page-dot ${i===state.page?'active':''}" data-page="${i}" title="第 ${i+1} 页"></button>`);
  $('#pages').innerHTML=dots.join('');
  $$('#pages [data-page]').forEach(b=>b.onclick=()=>{state.page=Number(b.dataset.page);renderGrid();renderPages();});
}
function render(){renderTabs();renderGrid();renderPages();}

function launch(t){
  if(state.launchTimer){clearInterval(state.launchTimer);state.launchTimer=null;}
  if(state.bubbleTimer){clearTimeout(state.bubbleTimer);state.bubbleTimer=null;}
  const bubble=$('#bubble');bubble.classList.add('show');
  $('#lbKind').textContent=t.kind==='flow'?'FLOW':'POINT';
  $('#lbKind').className='lb-kind '+(t.kind==='flow'?'flow':'');
  $('#lbName').textContent=t.name;
  $('#lbStatus').textContent='running';
  $('#lbSub').textContent=`${t.kind==='flow'?'FlowRun':'PointRun'} · ${t.target} · ${t.effect}`;
  $('#lbBar').style.width='0%';$('#lbPct').textContent='0%';
  let pct=0;
  state.launchTimer=setInterval(()=>{
    pct=Math.min(100,pct+Math.floor(Math.random()*8)+4);
    $('#lbBar').style.width=pct+'%';$('#lbPct').textContent=pct+'%';
    if(pct>=100){
      clearInterval(state.launchTimer);state.launchTimer=null;
      $('#lbStatus').textContent='ok';
      $('#lbSub').textContent=`${t.kind==='flow'?'FlowRun':'PointRun'} 完成 · ${t.effect} · 已写入运行记录`;
      state.bubbleTimer=setTimeout(()=>bubble.classList.remove('show'),1600);
    }
  },60);
}

function openCtx(e,t){
  if(!t)return;state.ctxTile=t.id;
  const ctx=$('#ctx');
  ctx.innerHTML=`<button data-act="run">启动 <span>Enter</span></button><button data-act="inspect">检查器 <span>⌕</span></button><button data-act="favorite">收藏 <span>☆</span></button><div class="sep"></div><button data-act="edit">编辑图标 <span>✎</span></button><button class="danger" data-act="remove">移除 <span>×</span></button>`;
  ctx.classList.add('show');
  const x=Math.min(e.clientX,innerWidth-180),y=Math.min(e.clientY,innerHeight-210);
  ctx.style.left=x+'px';ctx.style.top=y+'px';
  $$('#ctx [data-act]').forEach(b=>b.onclick=()=>{
    const act=b.dataset.act;ctx.classList.remove('show');
    if(act==='run')launch(t);
    else if(act==='remove'){const i=TILES.findIndex(x=>x.id===t.id);if(i>=0)TILES.splice(i,1);render();toast('已移除图标');}
    else toast(`模拟：${act} ${t.name}`);
  });
}

function toast(msg){
  const t=$('#toast');t.textContent=msg;t.classList.add('show');
  clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>t.classList.remove('show'),1600);
}
function showDock(){ $('#dockWrap').classList.remove('hidden');$('#showDock').classList.remove('visible'); }
function hideDock(){ if(state.pinned)return;$('#dockWrap').classList.add('hidden');$('#showDock').classList.add('visible'); }
function scheduleHide(){ if(state.pinned)return;clearTimeout(state.hideTimer);state.hideTimer=setTimeout(hideDock,850); }

function initTheme(){
  let saved=null;try{saved=localStorage.getItem('launch-dock-theme');}catch(e){}
  if(saved==='light')document.body.classList.add('light');
  updateThemeBtn();
  $('#themeBtn').onclick=()=>{document.body.classList.toggle('light');try{localStorage.setItem('launch-dock-theme',document.body.classList.contains('light')?'light':'dark');}catch(e){}updateThemeBtn();toast(document.body.classList.contains('light')?'浅色皮肤':'深色皮肤');};
}
function updateThemeBtn(){$('#themeBtn').textContent=document.body.classList.contains('light')?'☀':'☾';}

function init(){
  initTheme();render();showDock();
  $('#search').oninput=(e)=>{state.query=e.target.value;state.page=0;renderGrid();renderPages();};
  $('#pinBtn').classList.toggle('on',state.pinned);
  $('#pinBtn').onclick=()=>{state.pinned=!state.pinned;$('#pinBtn').classList.toggle('on',state.pinned);toast(state.pinned?'已固定启动坞':'已开启自动隐藏');if(state.pinned)showDock();};
  $('#size').oninput=(e)=>{state.size=Number(e.target.value);document.documentElement.style.setProperty('--tile',state.size+'px');};
  $('#addBtn').onclick=()=>toast('模拟：打开图标选择器（选择点实例/线实例）');
  $('#settingsBtn').onclick=()=>toast('模拟：打开 surface.settings.launch-dock');
  $('#showDock').onclick=showDock;
  $('#dockWrap').onmouseenter=()=>{clearTimeout(state.hideTimer);showDock();};
  $('#dockWrap').onmouseleave=scheduleHide;
  $('#desktop').ondblclick=(e)=>{if(!e.target.closest('#dockWrap'))showDock();};
  document.addEventListener('click',(e)=>{if(!e.target.closest('#ctx')&&!e.target.closest('[data-tile-id]'))$('#ctx').classList.remove('show');});
  document.addEventListener('mousemove',(e)=>{if(e.clientY>innerHeight-7&&$('#dockWrap').classList.contains('hidden'))showDock();});
  document.addEventListener('keydown',(e)=>{
    if(e.ctrlKey&&e.code==='Space'){e.preventDefault();$('#dockWrap').classList.contains('hidden')?showDock():hideDock();return;}
    if(e.key==='Escape'){if($('#ctx').classList.contains('show'))$('#ctx').classList.remove('show');else hideDock();return;}
    if(e.key==='/'&&document.activeElement!==$('#search')){e.preventDefault();$('#search').focus();return;}
    if(/^[0-9]$/.test(e.key)&&document.activeElement!==$('#search')){
      const idx=e.key==='0'?9:Number(e.key)-1;
      const t=pageTiles()[idx];if(t){e.preventDefault();launch(t);}
    }
  });

}
document.addEventListener('DOMContentLoaded',init);
