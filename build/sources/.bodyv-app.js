(() => {
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CATS = {
  content:  { label: '内容', color: '#22d3ee' },
  clipboard:{ label: '剪贴板', color: '#f59e0b' },
  window:   { label: '窗口', color: '#3b82f6' },
  system:   { label: '系统', color: '#22c55e' },
  web:      { label: 'Web', color: '#ec4899' },
  ai:       { label: 'AI', color: '#8b5cf6' },
  suite:    { label: '套件', color: '#f97316' }
};

function I(label, desc, rev = 1, acts = [], settings = '') {
  return { label, desc, rev, acts, settings, status: 'active' };
}

function C(id, name, icon, cat, prio, desc, flows, surfaces, points, settings, perms, instances, tests = []) {
  return { id, name, icon, cat, prio, desc, flows, surfaces, points, settings, perms, instances, tests, version: '1.0.0' };
}

const CLASSES = [
  C('body.file-preview', '文件预览', '◈', 'content', 'P0', '任意文件预览：文本、图片、PDF、视频、音频统一窗口。',
    ['flow.preview-file'], ['surface.preview-window'], ['file.read', 'render.text', 'render.image'],
    ['preview.maxBytes', 'preview.encoding', 'preview.zoom'], ['fs.read', 'window.open'], [
      I('text', '文本预览，支持编码/换行识别', 1, ['.txt', '.log', '.json'], 'renderer=text · UTF-8'),
      I('markdown', 'Markdown 渲染与代码块', 1, ['.md', '.markdown'], 'renderer=markdown · sanitize=true'),
      I('image', '图片预览，fit/zoom', 1, ['.png', '.jpg', '.jpeg', '.webp', '.gif'], 'renderer=image · fit=contain'),
      I('pdf', 'PDF 分页/缩放', 1, ['.pdf'], 'renderer=pdf · page=1 · zoom=fit'),
      I('video', '视频播放器，流式读取', 1, ['.mp4', '.webm', '.mkv'], 'renderer=video · stream=true'),
      I('audio', '音频波形与播放', 1, ['.mp3', '.wav', '.flac'], 'renderer=audio · waveform=true')
    ], ['smoke.text', 'smoke.image', 'smoke.pdf', 'contract.renderer']),
  C('body.ocr', 'OCR 识别', '⌘', 'content', 'P0', '识别文字、数学公式、二维码、表格与手写内容。',
    ['flow.ocr.recognize'], ['surface.ocr-result'], ['image.preprocess', 'ocr.text', 'ocr.table'],
    ['ocr.language', 'ocr.confidenceThreshold', 'ocr.outputFormat'], ['screen.capture', 'fs.read', 'clipboard.write'], [
      I('text', '普通文字识别', 1, ['Ctrl+Alt+O', 'screenshot'], 'mode=text · language=auto'),
      I('math', '数学公式 → LaTeX', 1, ['Ctrl+Alt+M', 'screenshot'], 'mode=math · output=latex'),
      I('qr', '二维码/条码解码', 1, ['Ctrl+Alt+Q', 'screenshot'], 'mode=qr · formats=qr,code128'),
      I('table', '表格结构 → CSV', 1, ['Ctrl+Alt+T', 'screenshot'], 'mode=table · output=markdown'),
      I('handwriting', '手写内容识别', 1, ['Ctrl+Alt+H'], 'mode=handwriting · threshold=0.4')
    ], ['smoke.text', 'smoke.qr', 'smoke.table', 'contract.recognizer']),
  C('body.image-resizer', '图片尺寸', '▦', 'content', 'P0', '批量图片尺寸调整，预设化输出。',
    ['flow.resize-image'], ['surface.resize-dialog'], ['file.read.image', 'image.resize', 'file.write.image'],
    ['resize.width', 'resize.height', 'resize.format', 'resize.quality'], ['fs.read', 'fs.write'], [
      I('web', '1920px 长边 / JPEG 85%', 2, ['.jpg', '.png', '.webp'], 'suffix=-web · quality=85'),
      I('thumbnail', '256×256 cover / WebP 80%', 1, ['.jpg', '.png'], 'fit=cover · quality=80'),
      I('avatar', '512×512 cover / PNG', 1, ['.jpg', '.png'], 'fit=cover · format=png'),
      I('email', '1280px 长边 / ≤500KB', 1, ['.jpg', '.png'], 'maxBytes=512000 · quality=75')
    ], ['smoke.web', 'smoke.avatar', 'contract.resize']),
  C('body.batch-rename', '批量重命名', '⌁', 'content', 'P0', '批量重命名：预览、冲突检测、撤销。',
    ['flow.rename-files'], ['surface.rename-dialog', 'surface.diff'], ['file.list', 'rename.plan', 'file.move'],
    ['rename.pattern', 'rename.sequenceStart', 'rename.dryRun'], ['fs.read', 'fs.write'], [
      I('regex', '正则替换', 1, ['context-menu'], 'mode=regex · dryRun=true'),
      I('sequence', 'IMG_0001 序列', 1, ['context-menu'], 'mode=sequence · start=1'),
      I('date-prefix', '日期前缀', 1, ['context-menu'], 'mode=date · format=YYYY-MM-DD'),
      I('extension-normalize', '扩展名统一', 1, ['context-menu'], 'mode=extension · .jpeg→.jpg')
    ], ['smoke.regex', 'smoke.sequence', 'contract.preview']),
  C('body.pdf-toolkit', 'PDF 工具', '▤', 'content', 'P1', 'PDF 合并、拆分、压缩、旋转。',
    ['flow.pdf-op'], ['surface.pdf-workspace'], ['pdf.read', 'pdf.merge', 'pdf.write'],
    ['pdf.output', 'pdf.quality', 'pdf.pageRange'], ['fs.read', 'fs.write'], [
      I('merge', '合并多个 PDF', 1, ['.pdf'], 'op=merge · sort=name'),
      I('split', '按页拆分', 1, ['.pdf'], 'op=split · range=1-3'),
      I('compress', '压缩 PDF', 1, ['.pdf'], 'op=compress · quality=ebook'),
      I('rotate', '旋转/整理页面', 1, ['.pdf'], 'op=rotate · angle=90')
    ], ['smoke.merge', 'smoke.split', 'contract.pdf']),
  C('body.media-converter', '媒体转换', '▷', 'content', 'P1', '图片、视频、音频格式转换。',
    ['flow.convert-media'], ['surface.convert-dialog'], ['media.probe', 'media.transcode', 'file.write'],
    ['media.format', 'media.bitrate', 'media.preset'], ['fs.read', 'fs.write'], [
      I('image', 'PNG / JPG / WebP', 1, ['.png', '.jpg', '.webp'], 'preset=image · quality=85'),
      I('video', 'MP4 / WebM', 1, ['.mp4', '.webm', '.mkv'], 'preset=video · h264'),
      I('audio', 'MP3 / WAV', 1, ['.mp3', '.wav', '.flac'], 'preset=audio · 192k')
    ], ['smoke.image', 'smoke.video', 'contract.transcode']),
  C('body.file-organizer', '文件整理', '⌸', 'content', 'P1', '按类型/日期整理下载、截图与重复文件。',
    ['flow.organize-files'], ['surface.organize-preview'], ['file.scan', 'file.classify', 'file.move'],
    ['organize.rule', 'organize.dryRun', 'organize.conflict'], ['fs.read', 'fs.write'], [
      I('downloads', '按类型/日期整理下载', 1, ['context-menu'], 'rule=type-date · dryRun=true'),
      I('screenshots', '截图归档', 1, ['context-menu'], 'rule=screenshot · month=true'),
      I('duplicates', '重复文件检测', 1, ['context-menu'], 'rule=hash · action=report')
    ], ['smoke.downloads', 'smoke.duplicates', 'contract.preview']),
  C('body.advanced-paste', '高级粘贴', '⌫', 'clipboard', 'P0', '剪贴板内容 → 目标格式。',
    ['flow.paste-transform'], ['surface.paste-preview'], ['clipboard.read', 'text.transform', 'clipboard.write'],
    ['paste.format', 'paste.aiModel', 'paste.preview'], ['clipboard.read', 'clipboard.write'], [
      I('plain', '去格式纯文本', 1, ['Ctrl+Shift+V'], 'format=plain · preview=false'),
      I('markdown', 'HTML → Markdown', 1, ['Ctrl+Shift+M'], 'format=markdown · preview=true'),
      I('json', 'JSON 格式化/压缩', 1, ['Ctrl+Shift+J'], 'format=json · indent=2'),
      I('ai', 'AI 改写/摘要', 1, ['Ctrl+Shift+A'], 'format=ai · model=local')
    ], ['smoke.plain', 'smoke.markdown', 'contract.transform']),
  C('body.clipboard-history', '剪贴板历史', '▣', 'clipboard', 'P1', '最近复制内容、固定片段与搜索。',
    ['flow.clipboard-history'], ['surface.clipboard-list'], ['clipboard.watch', 'store.query', 'clipboard.write'],
    ['clipboard.maxItems', 'clipboard.retention', 'clipboard.excludeSecrets'], ['clipboard.read', 'clipboard.write'], [
      I('recent', '最近 100 条', 1, ['Ctrl+Alt+V'], 'maxItems=100 · retention=7d'),
      I('pinned', '固定片段', 1, ['Ctrl+Alt+P'], 'maxItems=20 · pinned=true')
    ], ['smoke.recent', 'contract.secrets']),
  C('body.color-picker', '取色器', '◉', 'clipboard', 'P0', '屏幕取色，HEX/RGB/HSL 与调色板。',
    ['flow.pick-color'], ['surface.color-inspector'], ['screen.pick', 'color.convert', 'clipboard.write'],
    ['color.format', 'color.copyOnPick', 'color.history'], ['screen.capture', 'clipboard.write'], [
      I('hex', 'HEX/RGB/HSL 取色', 1, ['Win+Shift+C'], 'format=hex · copy=true'),
      I('palette', '屏幕取色板', 1, ['Win+Shift+P'], 'palette=12 · history=true')
    ], ['smoke.hex', 'smoke.palette']),
  C('body.screen-ruler', '屏幕标尺', '⌗', 'clipboard', 'P1', '像素、英寸、角度测量。',
    ['flow.measure-screen'], ['surface.hud.ruler'], ['screen.region', 'measure.length', 'measure.angle'],
    ['ruler.unit', 'ruler.snap', 'ruler.theme'], ['screen.capture'], [
      I('px', '像素测量', 1, ['Ctrl+Alt+R'], 'unit=px · snap=4'),
      I('inches', '英寸/厘米', 1, ['Ctrl+Alt+I'], 'unit=inch · dpi=96'),
      I('angle', '角度测量', 1, ['Ctrl+Alt+G'], 'unit=deg · snap=1')
    ], ['smoke.px', 'smoke.angle']),
  C('body.window-layout', '窗口布局', '▥', 'window', 'P0', '把窗口摆成开发/会议/超宽布局。',
    ['flow.layout-windows'], ['surface.layout-editor'], ['window.list', 'window.move', 'window.resize'],
    ['layout.preset', 'layout.monitor', 'layout.gap'], ['process', 'window'], [
      I('dev', 'VS Code + 终端 + 浏览器', 1, ['Ctrl+Alt+1'], 'preset=dev · monitor=main'),
      I('meeting', '会议 + 笔记', 1, ['Ctrl+Alt+2'], 'preset=meeting · monitor=main'),
      I('ultrawide', '超宽三栏', 1, ['Ctrl+Alt+3'], 'preset=ultrawide · gap=8')
    ], ['smoke.dev', 'smoke.ultrawide']),
  C('body.always-on-top', '窗口置顶', '⌃', 'window', 'P1', '钉住窗口或屏幕区域。',
    ['flow.pin-window'], ['surface.pin-indicator'], ['window.find', 'window.pin', 'window.restore'],
    ['pin.mode', 'pin.opacity', 'pin.hotkey'], ['window', 'process'], [
      I('window', '钉住当前窗口', 1, ['Ctrl+Alt+T'], 'mode=window · opacity=0.92'),
      I('region', '钉住屏幕区域', 1, ['Ctrl+Alt+Shift+T'], 'mode=region · crop=true')
    ], ['smoke.window', 'smoke.region']),
  C('body.awake', '保持唤醒', '◷', 'system', 'P1', '一段时间/到指定时间/应用运行期间保持唤醒。',
    ['flow.keep-awake'], ['surface.awake-status'], ['power.state', 'power.keepAwake', 'timer.wait'],
    ['awake.duration', 'awake.until', 'awake.whileApp'], ['power'], [
      I('30m', '保持 30 分钟', 1, ['tray'], 'duration=30m · display=on'),
      I('until', '保持到指定时间', 1, ['tray'], 'until=18:00 · display=on'),
      I('while-app', '应用运行期间', 1, ['tray'], 'whileApp=build.exe')
    ], ['smoke.duration', 'smoke.while-app']),
  C('body.workspace', '工作区', '◫', 'window', 'P1', '一键打开开发/会议/写作工作区。',
    ['flow.open-workspace'], ['surface.workspace-launcher'], ['process.launch', 'window.layout', 'workspace.restore'],
    ['workspace.preset', 'workspace.monitor', 'workspace.startup'], ['process', 'window'], [
      I('dev', '开发工作区', 3, ['Ctrl+Alt+W'], 'preset=dev · monitor=dual'),
      I('meeting', '会议工作区', 1, ['Ctrl+Alt+M'], 'preset=meeting · monitor=main'),
      I('writing', '写作工作区', 1, ['Ctrl+Alt+K'], 'preset=writing · monitor=main')
    ], ['smoke.dev', 'smoke.meeting']),
  C('body.quick-launch', '快速启动', '⌘', 'window', 'P0', 'CLaunch 式启动坞 / 命令面板。',
    ['flow.launch-target'], ['surface.launch-dock', 'surface.quick-launch'], ['launch.search', 'launch.run', 'usage.rank'],
    ['launch.hotkey', 'launch.autoHide', 'launch.pageSize'], ['process', 'fs.read'], [
      I('dock', '5×2 分页启动坞', 1, ['Ctrl+Space'], 'tabs=5 · pageSize=10'),
      I('palette', '键盘优先命令面板', 1, ['Ctrl+Shift+Space'], 'mode=palette · fuzzy=true')
    ], ['smoke.dock', 'smoke.palette']),
  C('body.system-monitor', '系统监控', '◴', 'system', 'P1', 'CPU/GPU/内存/网络/磁盘状态。',
    ['flow.metric-stream'], ['surface.system-monitor', 'surface.hud.system-status'], ['sys.cpu.stats', 'sys.gpu.stats', 'sys.memory.stats'],
    ['monitor.refreshMs', 'monitor.history', 'monitor.hud'], ['process', 'sensor'], [
      I('desktop', 'Dashboard + HUD', 2, ['tray'], 'refreshMs=1000 · history=60s'),
      I('minimal', '托盘 + 2×2 HUD', 1, ['tray'], 'refreshMs=2000 · hud=2x2')
    ], ['smoke.desktop', 'contract.metrics']),
  C('body.service-health', '服务健康', '◍', 'system', 'P1', '检查 Docker / 本地 API / VPN 健康状态。',
    ['flow.ensure-service'], ['surface.service-dashboard'], ['service.status', 'service.start', 'net.reachable'],
    ['service.target', 'service.timeout', 'service.retry'], ['process', 'network'], [
      I('docker', 'Docker Desktop 健康', 1, ['tray'], 'target=docker · timeout=5s'),
      I('local-api', 'localhost:3000', 1, ['tray'], 'target=http://localhost:3000'),
      I('vpn', 'VPN 隧道健康', 1, ['tray'], 'target=vpn · retry=3')
    ], ['smoke.docker', 'smoke.local-api']),
  C('body.file-locksmith', '文件占用', '⌕', 'system', 'P2', '查找占用文件的进程/句柄。',
    ['flow.find-file-lock'], ['surface.lock-list'], ['file.handle', 'process.open', 'process.kill'],
    ['lock.scope', 'lock.showSystem', 'lock.confirmKill'], ['process', 'fs.read'], [
      I('process', '按文件找进程', 1, ['context-menu'], 'scope=user · confirmKill=true'),
      I('handle', '句柄搜索', 1, ['context-menu'], 'scope=system · showSystem=true')
    ], ['smoke.process', 'smoke.handle']),
  C('body.hosts-editor', 'Hosts 编辑', '⌸', 'system', 'P2', '本地 hosts 编辑、备份、diff。',
    ['flow.edit-hosts'], ['surface.text-editor', 'surface.diff'], ['hosts.read', 'hosts.validate', 'hosts.write'],
    ['hosts.backup', 'hosts.encoding', 'hosts.requireAdmin'], ['fs.read', 'fs.write', 'admin'], [
      I('local', '本地 hosts 管理', 1, ['settings'], 'backup=true · encoding=utf-8'),
      I('blocklist', '广告/域名 blocklist', 1, ['settings'], 'blocklist=true · backup=true')
    ], ['smoke.local', 'contract.admin']),
  C('body.env-vars', '环境变量', '⌁', 'system', 'P2', '用户/系统环境变量与 PATH 编辑。',
    ['flow.edit-env'], ['surface.key-value-editor'], ['env.read', 'env.validate', 'env.write'],
    ['env.scope', 'env.backup', 'env.pathMode'], ['env.read', 'env.write'], [
      I('user', '用户变量', 1, ['settings'], 'scope=user · backup=true'),
      I('path', 'PATH 编辑器', 1, ['settings'], 'scope=user · pathMode=list')
    ], ['smoke.user', 'smoke.path']),
  C('body.external-access', '外网访问', '+', 'web', 'P0', '外网站点 + VPN 保障 + 站点启动器。',
    ['flow.open-external-site', 'flow.ensure-vpn'], ['surface.site-launcher', 'surface.settings.vpn'], ['vpn.status', 'net.reachable', 'browser.open'],
    ['vpn.profile', 'site.policy', 'browser.target'], ['network', 'process', 'uia'], [
      I('work', '工作外网：GitHub/YouTube/内网', 3, ['Ctrl+Alt+E', 'gesture LDR'], 'vpn=work · policy=required'),
      I('personal', '个人外网：YouTube/Google', 2, ['gesture LDR'], 'vpn=personal · policy=preferred')
    ], ['smoke.work', 'smoke.personal', 'contract.vpn']),
  C('body.screenshot-translate', '截图翻译', '文', 'ai', 'P1', '截屏 → OCR → 翻译 → 浮层显示。',
    ['flow.screenshot-translate'], ['surface.hud.translate', 'surface.settings.translate'], ['screen.capture', 'ocr.text', 'translate.text'],
    ['translate.from', 'translate.to', 'translate.overlay'], ['screen.capture', 'clipboard.write', 'network'], [
      I('en-zh', '英文截图 → 中文', 4, ['Ctrl+Alt+S'], 'from=en · to=zh · overlay=true'),
      I('ja-zh', '日文截图 → 中文', 2, ['Ctrl+Alt+J'], 'from=ja · to=zh · overlay=false')
    ], ['smoke.en-zh', 'smoke.ja-zh', 'contract.overlay']),
  C('body.ai-rewrite', 'AI 改写', '✦', 'ai', 'P1', '选中文本/剪贴板 → 改写、缩短、翻译。',
    ['flow.ai-rewrite'], ['surface.diff', 'surface.prompt-preview'], ['text.read', 'ai.rewrite', 'text.diff'],
    ['ai.model', 'ai.tone', 'ai.maxTokens'], ['network', 'clipboard.read', 'clipboard.write'], [
      I('formal', '正式化改写', 2, ['Ctrl+Alt+F'], 'tone=formal · preview=true'),
      I('shorten', '压缩到 50%', 1, ['Ctrl+Alt+S'], 'ratio=0.5 · preview=true'),
      I('translate', '翻译为英文', 1, ['Ctrl+Alt+E'], 'to=en · preview=true')
    ], ['smoke.formal', 'contract.diff']),
  C('body.meeting-notes', '会议纪要', '◫', 'ai', 'P2', '录音 → 转录 → 摘要 → 待办。',
    ['flow.transcribe', 'flow.summarize'], ['surface.notes'], ['audio.capture', 'speech.transcribe', 'ai.summarize'],
    ['meeting.language', 'meeting.speakerDiarization', 'meeting.retention'], ['microphone', 'network', 'fs.write'], [
      I('local', '本地转录', 1, ['Ctrl+Alt+N'], 'engine=local · retention=30d'),
      I('cloud', '云端转录', 1, ['Ctrl+Alt+Shift+N'], 'engine=cloud · consent=true')
    ], ['smoke.local', 'smoke.cloud', 'contract.privacy']),
  C('body.invoice-archive', '发票归档', '▤', 'content', 'P1', 'OCR → 解析 → 规则 → 归档。',
    ['flow.batch-archive'], ['surface.table', 'surface.settings.invoice'], ['ocr.table', 'invoice.parse', 'file.move'],
    ['invoice.archiveRoot', 'invoice.rules', 'invoice.ocrLanguage'], ['fs.read', 'fs.write', 'ocr'], [
      I('company', '公司发票归档', 6, ['context-menu'], 'ocr=zh · rules=company'),
      I('personal', '个人发票归档', 2, ['context-menu'], 'ocr=en · rules=personal')
    ], ['smoke.company', 'smoke.personal', 'contract.rules']),
  C('body.suite', '套件', '❖', 'suite', 'P2', '把多个体打包成一个套件。',
    ['flow.suite.launch'], ['surface.card-grid', 'surface.settings.suite'], ['body.activate', 'permission.check', 'surface.show'],
    ['suite.members', 'suite.startup', 'suite.theme'], ['process', 'network', 'fs.read'], [
      I('office', '办公套件', 1, ['tray'], 'members=external-access,invoice-archive,screenshot-translate'),
      I('dev', '开发套件', 1, ['tray'], 'members=external-access,workspace,ocr,quick-launch')
    ], ['smoke.office', 'smoke.dev', 'contract.permissions']),
  C('body.web-clipper', '网页剪藏', '✂', 'web', 'P2', '选中内容/整页 → Markdown。',
    ['flow.clip-page'], ['surface.clipper-preview'], ['browser.read', 'html.toMarkdown', 'file.write'],
    ['clip.mode', 'clip.assets', 'clip.frontmatter'], ['browser', 'fs.write', 'network'], [
      I('selection', '选中内容 → Markdown', 1, ['Ctrl+Alt+C'], 'mode=selection · frontmatter=true'),
      I('page', '整页 → Markdown', 1, ['Ctrl+Alt+Shift+C'], 'mode=page · assets=true'),
      I('readability', '正文提取', 1, ['Ctrl+Alt+R'], 'mode=readability · images=local')
    ], ['smoke.selection', 'smoke.page', 'contract.markdown']),
  C('body.backup-sync', '备份同步', '⇄', 'system', 'P2', '文件夹快照、每日增量、校验。',
    ['flow.backup-folder'], ['surface.backup-status'], ['file.scan', 'file.copy', 'hash.verify'],
    ['backup.source', 'backup.target', 'backup.retention'], ['fs.read', 'fs.write'], [
      I('folder', '文件夹快照', 1, ['tray'], 'mode=snapshot · verify=true'),
      I('daily', '每日增量', 1, ['schedule'], 'mode=incremental · retention=30d')
    ], ['smoke.folder', 'smoke.daily', 'contract.verify'])
];

CLASSES.forEach(c => {
  c.tests = c.tests.length ? c.tests : ['smoke.' + c.id.split('.').pop()];
  c.instances.forEach(ins => {
    ins.id = `${c.id}.${ins.label}@r${ins.rev}`;
    ins.classId = c.id;
    ins.status = ins.status || 'active';
  });
});

const state = {
  selectedId: 'body.file-preview',
  tab: 'composition',
  query: '',
  cat: 'all',
  prio: 'all',
  selInstance: null,
  bubbleTimer: null,
  progressTimer: null,
  toastTimer: null
};

const selectedClass = () => CLASSES.find(c => c.id === state.selectedId) || CLASSES[0];
const totalInstances = () => CLASSES.reduce((n, c) => n + c.instances.length, 0);
const p0Count = () => CLASSES.filter(c => c.prio === 'P0').length;

/* ============================================================
   1. 列表与顶部
   ============================================================ */
function renderStats() {
  $('#statClasses').textContent = CLASSES.length;
  $('#statInstances').textContent = totalInstances();
  $('#statP0').textContent = p0Count();
}

function renderFilters() {
  const cats = [{ id: 'all', label: '全部' }, ...Object.entries(CATS).map(([id, v]) => ({ id, label: v.label }))];
  $('#filters').innerHTML = cats.map(c => {
    const n = c.id === 'all' ? CLASSES.length : CLASSES.filter(x => x.cat === c.id).length;
    return `<button class="chip-btn ${state.cat === c.id ? 'on' : ''}" data-cat="${c.id}">${c.label} ${n}</button>`;
  }).join('');
  $$('#filters [data-cat]').forEach(b => b.onclick = () => { state.cat = b.dataset.cat; renderFilters(); renderList(); });
  $$('#prioRow [data-prio]').forEach(b => b.classList.toggle('on', b.dataset.prio === state.prio));
}

function filteredClasses() {
  const q = state.query.trim().toLowerCase();
  return CLASSES.filter(c => {
    if (state.cat !== 'all' && c.cat !== state.cat) return false;
    if (state.prio !== 'all' && c.prio !== state.prio) return false;
    if (!q) return true;
    const hay = [c.id, c.name, c.desc, ...c.instances.map(i => i.id + ' ' + i.desc)].join(' ').toLowerCase();
    return hay.includes(q);
  }).sort((a, b) => {
    const rank = { P0: 0, P1: 1, P2: 2 };
    return rank[a.prio] - rank[b.prio] || a.name.localeCompare(b.name, 'zh');
  });
}

function renderList() {
  const list = filteredClasses();
  if (!list.length) {
    $('#classList').innerHTML = '<div style="padding:20px 10px;color:var(--faint);font-size:10.5px;text-align:center;line-height:1.7">没有匹配的 BodyClass。<br>换个关键词或清空筛选。</div>';
    return;
  }
  $('#classList').innerHTML = list.map(c => {
    const color = CATS[c.cat].color;
    return `<div class="class-item ${c.id === state.selectedId ? 'on' : ''}" data-class="${esc(c.id)}" style="--cat:${color}">
      <div class="class-icon">${esc(c.icon)}</div>
      <div class="class-main"><div class="class-name">${esc(c.name)}</div><div class="class-id">${esc(c.id)}</div></div>
      <div class="class-side"><div class="class-count">${c.instances.length}</div><div class="class-prio ${c.prio.toLowerCase()}">${c.prio}</div></div>
    </div>`;
  }).join('');
  $$('#classList [data-class]').forEach(el => el.onclick = () => selectClass(el.dataset.class));
}

function renderHero() {
  const c = selectedClass();
  const color = CATS[c.cat].color;
  $('#heroIcon').textContent = c.icon;
  $('#heroIcon').style.setProperty('--cat', color);
  $('#heroName').textContent = c.name;
  $('#heroId').textContent = `${c.id}@${c.version}`;
  $('#heroDesc').textContent = c.desc;
  $('#heroBadges').innerHTML = `
    <span class="badge ${c.prio.toLowerCase()}">${c.prio}</span>
    <span class="badge" style="color:${color}">${CATS[c.cat].label}</span>
    <span class="badge">${c.instances.length} instances</span>
    <span class="badge">BodyClass</span>`;
}

function renderTabs() {
  $$('#tabs .tab').forEach(b => b.classList.toggle('on', b.dataset.tab === state.tab));
}

/* ============================================================
   2. 组合 / 实例 / Manifest / 生命周期
   ============================================================ */
function shortHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function digestOf(c) { return 'sha256:' + shortHash(c.id + c.version + c.instances.length) + '…'; }

function chips(arr, cls) {
  return arr.map(x => `<span class="chip ${cls || ''}">${esc(x)}</span>`).join('');
}

function compositionHTML(c) {
  const color = CATS[c.cat].color;
  return `
  <div class="panel" style="border-color:${color}22">
    <div class="panel-head"><b>Body Composition</b><span class="mono" style="font-size:8px;color:var(--faint)">${esc(c.id)}@${esc(c.version)}</span></div>
    <div class="panel-body">
      <div class="layer-strip">
        <div class="layer-node" style="--lc:${color}"><b>BodyClass</b><span>${esc(c.id)}</span></div>
        <div class="layer-arrow">→</div>
        <div class="layer-node" style="--lc:#3b82f6"><b>SurfaceInstance</b><span>${c.surfaces.length} 个面</span></div>
        <div class="layer-arrow">→</div>
        <div class="layer-node" style="--lc:#8b5cf6"><b>FlowInstance</b><span>${c.flows.length} 条线</span></div>
        <div class="layer-arrow">→</div>
        <div class="layer-node" style="--lc:#22c55e"><b>PointInstance</b><span>${c.points.length} 个点</span></div>
      </div>

      <div class="pkg">
        <div class="pkg-head">
          <div>
            <div class="pkg-kicker">Body Package · installed</div>
            <div class="pkg-id">${esc(c.id)} <span>@${esc(c.version)} · r${c.instances.length}</span></div>
            <div class="pkg-sub">manifest + payload + blockmap + signature + digest</div>
          </div>
          <div class="pkg-badges">
            <span class="badge ${c.prio.toLowerCase()}">${c.prio}</span>
            <span class="badge" style="color:${color}">${CATS[c.cat].label}</span>
            <span class="badge">active</span>
          </div>
        </div>

        <div class="pkg-grid" style="margin-top:11px">
          <div class="layer-block">
            <div class="lh">Surfaces · ${c.surfaces.length}</div>
            <div class="chips">${chips(c.surfaces, 'surface')}</div>
          </div>
          <div class="layer-block">
            <div class="lh">Flows · ${c.flows.length}</div>
            <div class="chips">${chips(c.flows, 'flow')}</div>
          </div>
          <div class="layer-block">
            <div class="lh">Points · ${c.points.length}</div>
            <div class="chips">${chips(c.points, 'point')}</div>
          </div>
        </div>

        <div class="pkg-meta">
          <div class="meta-block">
            <div class="lh">Settings</div>
            <div class="chips">${chips(c.settings, 'setting')}</div>
          </div>
          <div class="meta-block">
            <div class="lh">Permissions</div>
            <div class="chips">${chips(c.perms, 'perm')}</div>
          </div>
          <div class="meta-block">
            <div class="lh">Tests</div>
            <div class="chips">${chips(c.tests)}</div>
          </div>
        </div>

        <div class="pkg-foot">
          <span>entrypoint <b>${esc(c.surfaces[0] || '—')}</b></span>
          <span>digest <b>${digestOf(c)}</b></span>
          <span>signature <b>example-key-1</b></span>
          <span>update <b>stable</b></span>
        </div>
      </div>

      <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">
        <span class="chip">BodyInstance: ${c.instances.length}</span>
        <span class="chip">BodyPackage: 1</span>
        <span class="chip">BodyInstallation: 1</span>
        <span class="chip">permissions: ${c.perms.length}</span>
        <span class="chip">tests: ${c.tests.length}</span>
      </div>
    </div>
  </div>`;
}

function instancesHTML(c) {
  return `
  <div class="panel">
    <div class="panel-head"><b>Body Instances</b><span class="mono" style="font-size:8px;color:var(--faint)">${c.instances.length} 个实例 · 点击卡片查看绑定</span></div>
    <div class="panel-body">
      <div class="instance-grid">
        ${c.instances.map(ins => `
          <div class="inst-card ${state.selInstance && state.selInstance.id === ins.id ? 'sel' : ''}" data-inst="${esc(ins.id)}">
            <div class="inst-top"><span class="inst-status"></span><span class="inst-name">${esc(ins.label)}</span><span class="inst-rev">r${ins.rev}</span></div>
            <div class="inst-id">${esc(ins.id)}</div>
            <div class="inst-desc">${esc(ins.desc)}</div>
            <div class="chips inst-chips">${ins.acts.slice(0, 3).map(a => `<span class="chip">${esc(a)}</span>`).join('')}${ins.acts.length > 3 ? `<span class="chip">+${ins.acts.length - 3}</span>` : ''}</div>
            <div class="mono" style="font-size:8px;color:var(--faint);margin-top:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(ins.settings)}</div>
            <button class="start" data-start="${esc(ins.id)}">▶ 启动</button>
          </div>`).join('')}
      </div>
    </div>
  </div>`;
}

function manifest(c) {
  return {
    schemaVersion: '1.0',
    id: c.id,
    version: c.version,
    name: c.name,
    description: c.desc,
    entrypoints: { main: c.surfaces[0] || null, onActivate: c.flows[0] || null },
    contributes: { flows: c.flows, surfaces: c.surfaces, settings: c.settings, triggers: ['hotkey', 'file', 'manual'] },
    permissions: c.perms,
    dependencies: [],
    assets: [],
    tests: c.tests,
    instances: c.instances.map(i => ({ id: i.id, revision: i.rev, status: i.status, activations: i.acts, settings: i.settings })),
    update: { channel: 'stable', autoUpdate: true },
    signature: { publisher: 'example', keyId: 'example-key-1' }
  };
}

function manifestHTML(c) {
  const text = JSON.stringify(manifest(c), null, 2);
  return `
  <div class="panel">
    <div class="panel-head"><b>body.json</b><button class="copy-btn" data-copy-manifest>复制 Manifest</button></div>
    <div class="panel-body"><pre class="manifest-pre">${esc(text)}</pre></div>
  </div>`;
}

const LIFE = [
  { n: '01', name: 'Package', desc: 'body.json + payload + blockmap + signature', gates: ['manifest', 'payload', 'blockmap'], state: 'done' },
  { n: '02', name: 'Verify', desc: '签名 / digest / 权限 / 依赖检查', gates: ['signature', 'digest', 'permissions'], state: 'done' },
  { n: '03', name: 'Install', desc: '写 BodyInstance + BodyInstallation', gates: ['install record', 'file hash'], state: 'done' },
  { n: '04', name: 'Activate', desc: '绑定 FlowInstance / SurfaceInstance / SettingValue', gates: ['bindings', 'health check', 'audit'], state: 'active' },
  { n: '05', name: 'Update', desc: 'migrations + 原子切换 + 回滚点', gates: ['migrations', 'atomic switch', 'rollback'], state: 'pending' },
  { n: '06', name: 'Rollback', desc: '回到上一个 packageDigest', gates: ['previous digest', 'health check'], state: 'pending' },
  { n: '07', name: 'Uninstall', desc: '只删体拥有的文件，保留用户数据', gates: ['hash match', 'keep user data'], state: 'pending' }
];

function lifecycleHTML(c) {
  return `
  <div class="panel">
    <div class="panel-head"><b>Body Lifecycle</b><span class="mono" style="font-size:8px;color:var(--faint)">active · ${digestOf(c)}</span></div>
    <div class="panel-body">
      <div class="life">
        ${LIFE.map(s => `<div class="life-step ${s.state}"><div class="life-num">${s.n}</div><div class="life-name">${s.name}</div><div class="life-desc">${s.desc}</div><div class="life-gates">${s.gates.map(g => `<span class="life-gate">${g}</span>`).join('')}</div></div>`).join('')}
      </div>
      <div class="pkg" style="margin-top:10px">
        <div class="pkg-head">
          <div><div class="pkg-kicker">Installation Record</div><div class="pkg-id">${esc(c.id)} <span>@${esc(c.version)}</span></div><div class="pkg-sub">source=file · channel=stable · status=active</div></div>
          <div class="pkg-badges"><span class="badge">verified</span><span class="badge">signed</span><span class="badge">active</span></div>
        </div>
        <div class="pkg-foot"><span>digest <b>${digestOf(c)}</b></span><span>rollback <b>none</b></span><span>lastVerified <b>2026-11-23</b></span><span>permissions <b>${c.perms.length}</b></span></div>
      </div>
    </div>
  </div>`;
}

function renderContent() {
  const c = selectedClass();
  if (state.tab === 'composition') $('#content').innerHTML = compositionHTML(c);
  else if (state.tab === 'instances') $('#content').innerHTML = instancesHTML(c);
  else if (state.tab === 'manifest') $('#content').innerHTML = manifestHTML(c);
  else $('#content').innerHTML = lifecycleHTML(c);
  bindContentEvents(c);
}

/* ============================================================
   3. Inspector
   ============================================================ */
function renderInspector() {
  const c = selectedClass();
  const ins = state.selInstance && state.selInstance.classId === c.id ? state.selInstance : null;
  if (ins) {
    $('#inspector').innerHTML = `
      <div class="insp-kicker">BodyInstance</div>
      <div class="insp-title">${esc(ins.label)}</div>
      <div class="insp-id">${esc(ins.id)}</div>
      <div class="insp-section"><div class="lh">Identity</div><div class="kv">
        <div class="k">class</div><div class="v">${esc(c.id)}@${esc(c.version)}</div>
        <div class="k">revision</div><div class="v">r${ins.rev}</div>
        <div class="k">status</div><div class="v" style="color:#86efac">${esc(ins.status)}</div>
        <div class="k">effect</div><div class="v">${esc(c.prio)}</div>
      </div></div>
      <div class="insp-section"><div class="lh">Activations</div><div class="chips">${ins.acts.map(a => `<span class="chip">${esc(a)}</span>`).join('')}</div></div>
      <div class="insp-section"><div class="lh">Settings</div><div class="mono" style="font-size:9px;color:#a9bbd0;line-height:1.6">${esc(ins.settings)}</div></div>
      <div class="insp-section"><div class="lh">Permissions</div><div class="chips">${c.perms.map(p => `<span class="chip perm">${esc(p)}</span>`).join('')}</div></div>
      <div class="insp-actions">
        <button class="insp-btn primary" data-launch="${esc(ins.id)}">▶ 启动实例</button>
        <button class="insp-btn" data-back-class>返回类</button>
      </div>
      <div class="insp-section" style="margin-top:8px"><div class="lh">Bindings</div><div class="mono" style="font-size:8.5px;color:var(--faint);line-height:1.7">flows: ${esc(c.flows.join(', '))}<br>surfaces: ${esc(c.surfaces.join(', '))}<br>points: ${esc(c.points.join(', '))}</div></div>`;
  } else {
    $('#inspector').innerHTML = `
      <div class="insp-kicker">BodyClass</div>
      <div class="insp-title">${esc(c.icon)} ${esc(c.name)}</div>
      <div class="insp-id">${esc(c.id)}@${esc(c.version)}</div>
      <div class="insp-section"><div class="lh">Class</div><div class="kv">
        <div class="k">category</div><div class="v" style="color:${CATS[c.cat].color}">${CATS[c.cat].label}</div>
        <div class="k">priority</div><div class="v">${esc(c.prio)}</div>
        <div class="k">instances</div><div class="v">${c.instances.length}</div>
        <div class="k">digest</div><div class="v mono">${digestOf(c)}</div>
      </div></div>
      <div class="insp-section"><div class="lh">Composition</div><div class="kv">
        <div class="k">surfaces</div><div class="v">${esc(c.surfaces.join(', '))}</div>
        <div class="k">flows</div><div class="v">${esc(c.flows.join(', '))}</div>
        <div class="k">points</div><div class="v">${esc(c.points.join(', '))}</div>
      </div></div>
      <div class="insp-section"><div class="lh">Permissions</div><div class="chips">${c.perms.map(p => `<span class="chip perm">${esc(p)}</span>`).join('')}</div></div>
      <div class="insp-section"><div class="lh">Tests</div><div class="chips">${c.tests.map(t => `<span class="chip">${esc(t)}</span>`).join('')}</div></div>
      <div class="insp-actions">
        <button class="insp-btn primary" data-insp-tab="instances">查看实例</button>
        <button class="insp-btn" data-copy-manifest>复制 Manifest</button>
      </div>`;
  }
  bindInspectorEvents(c);
}

function bindContentEvents(c) {
  $$('#content [data-inst]').forEach(el => el.onclick = (e) => {
    if (e.target.closest('[data-start]')) return;
    const ins = c.instances.find(i => i.id === el.dataset.inst);
    if (ins) selectInstance(ins);
  });
  $$('#content [data-start]').forEach(b => b.onclick = (e) => {
    e.stopPropagation();
    const ins = c.instances.find(i => i.id === b.dataset.start);
    if (ins) launchInstance(ins);
  });
  $$('#content [data-copy-manifest]').forEach(b => b.onclick = () => copyText(JSON.stringify(manifest(c), null, 2), 'Manifest 已复制'));
}

function bindInspectorEvents(c) {
  $$('#inspector [data-insp-tab]').forEach(b => b.onclick = () => { state.tab = b.dataset.inspTab; renderTabs(); renderContent(); });
  $$('#inspector [data-copy-manifest]').forEach(b => b.onclick = () => copyText(JSON.stringify(manifest(c), null, 2), 'Manifest 已复制'));
  $$('#inspector [data-back-class]').forEach(b => b.onclick = () => { state.selInstance = null; renderContent(); renderInspector(); });
  $$('#inspector [data-launch]').forEach(b => b.onclick = () => {
    const ins = c.instances.find(i => i.id === b.dataset.launch);
    if (ins) launchInstance(ins);
  });
}

function selectClass(id) {
  state.selectedId = id;
  state.selInstance = null;
  state.tab = 'composition';
  renderList(); renderHero(); renderTabs(); renderContent(); renderInspector();
  $('#content').scrollTop = 0;
}

function selectInstance(ins) {
  state.selInstance = ins;
  state.tab = 'instances';
  renderTabs(); renderContent(); renderInspector();
  $('#content').scrollTop = 0;
}

/* ============================================================
   4. 运行与复制
   ============================================================ */
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => t.classList.remove('show'), 1600);
}

function copyText(text, label) {
  const done = () => toast(label || '已复制');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else fallbackCopy(text, done);
}

function fallbackCopy(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (e) {}
  document.body.removeChild(ta);
  done();
}

function launchInstance(ins) {
  const bubble = $('#bubble');
  bubble.classList.add('show');
  $('#bubbleKind').textContent = 'BODY';
  $('#bubbleName').textContent = ins.id;
  $('#bubbleStatus').textContent = 'running';
  $('#bubbleSub').textContent = `BodyInstance · ${ins.classId} · ${ins.settings}`;
  $('#bubbleBar').style.width = '0%';
  $('#bubblePct').textContent = '0%';
  clearInterval(state.progressTimer);
  clearTimeout(state.bubbleTimer);
  let pct = 0;
  state.progressTimer = setInterval(() => {
    pct = Math.min(100, pct + Math.floor(Math.random() * 9) + 4);
    $('#bubbleBar').style.width = pct + '%';
    $('#bubblePct').textContent = pct + '%';
    if (pct >= 100) {
      clearInterval(state.progressTimer);
      $('#bubbleStatus').textContent = 'ok';
      $('#bubbleSub').textContent = `BodyRun complete · ${ins.acts.length} activations · audit recorded`;
      state.bubbleTimer = setTimeout(() => bubble.classList.remove('show'), 1600);
      toast('BodyRun 完成，已写入运行记录');
    }
  }, 70);
}

/* ============================================================
   5. 初始化
   ============================================================ */
function init() {
  renderStats();
  renderFilters();
  renderList();
  renderHero();
  renderTabs();
  renderContent();
  renderInspector();

  $('#search').addEventListener('input', e => { state.query = e.target.value; renderList(); });
  $$('#prioRow [data-prio]').forEach(b => b.onclick = () => {
    state.prio = b.dataset.prio; renderFilters(); renderList();
  });
  $$('#tabs .tab').forEach(b => b.onclick = () => {
    state.tab = b.dataset.tab; renderTabs(); renderContent();
  });
  document.addEventListener('keydown', e => {
    if (e.key === '/' && document.activeElement !== $('#search')) { e.preventDefault(); $('#search').focus(); }
    if (e.key === 'Escape') { state.query = ''; state.selInstance = null; $('#search').value = ''; renderList(); renderContent(); renderInspector(); }
  });
}

init();
})();
