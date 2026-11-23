import type { InfoCard, SettingSection, SettingSpec } from './settingsData'

export type SettingsLanguage = 'zh' | 'en'

type Text = { zh: string; en: string }

const text = (zh: string, en: string): Text => ({ zh, en })

export const settingsUi = {
  zh: {
    eyebrow: '工作区 / 设置',
    title: '设置',
    desc: '应用级、五层策略与运行默认值。设置回答“允许什么”，管理页回答“有什么、是否健康、是否加载”。',
    undo: '撤销',
    apply: '应用',
    applied: '设置已应用',
    resetSection: '重置本节',
    resetSectionToast: '已重置本节',
    discard: '未保存变更已撤销',
    scope: '作用域',
    scopeSuffix: '作用域',
    scopes: { User: '用户', Workspace: '工作区', Machine: '机器', Policy: '策略' },
    readOnly: '只读',
    search: '搜索 {count} 项设置：标签、描述、枚举…',
    synced: '已同步',
    dirty: '{count} 项未应用',
    searchEyebrow: '搜索 / {count} 项结果',
    searchTitle: '搜索设置',
    noResults: '没有匹配的设置',
    settings: '项设置',
    groups: '组',
    managePage: '管理页',
    manageDesc: '类与实例的 CRUD、运行、批量操作与资源加载在独立管理页完成。设置页只保留策略与默认值。',
    openManage: '打开{name}管理页',
    effect: '效果',
    restart: '重启应用',
    policy: '策略锁定',
    advanced: '高级',
    footer: 'Secret 类设置只保存引用（secretRef），不保存明文。当前设置先落 localStorage，后续换成主进程 settings store。',
    infoReadOnly: '只读',
    language: '语言',
    languageZh: '简体中文',
    languageEn: 'English',
  },
  en: {
    eyebrow: 'WORKSPACE / SETTINGS',
    title: 'Settings',
    desc: 'App-level defaults and policies for all five layers. Settings define what is allowed; management pages define what exists and whether it is healthy.',
    undo: 'Undo',
    apply: 'Apply',
    applied: 'Settings applied',
    resetSection: 'Reset section',
    resetSectionToast: 'Section reset',
    discard: 'Unsaved changes discarded',
    scope: 'Scope',
    scopeSuffix: 'scope',
    scopes: { User: 'User', Workspace: 'Workspace', Machine: 'Machine', Policy: 'Policy' },
    readOnly: 'read only',
    search: 'Search {count} settings: label, description, enum…',
    synced: 'Synced',
    dirty: '{count} pending',
    searchEyebrow: 'SEARCH / {count} RESULTS',
    searchTitle: 'Search settings',
    noResults: 'No matching settings',
    settings: 'settings',
    groups: 'groups',
    managePage: 'Management page',
    manageDesc: 'Class and instance CRUD, runs, batch actions and resource loading live on dedicated management pages. Settings keep only policies and defaults.',
    openManage: 'Open {name} management',
    effect: 'effect',
    restart: 'restart app',
    policy: 'policy',
    advanced: 'advanced',
    footer: 'Secret settings store only secretRef references, never plaintext. Settings currently persist to localStorage; a main-process settings store is next.',
    infoReadOnly: 'read only',
    language: 'Language',
    languageZh: 'Chinese (Simplified)',
    languageEn: 'English',
  }
} as const

export const sectionText: Record<string, Record<SettingsLanguage, { title: string; desc: string; group: string }>> = {
  general: {
    zh: { title: '通用设置', desc: '应用级外观、语言、启动、通知、隐私、网络/更新、可访问性与高级选项。', group: '通用' },
    en: { title: 'General', desc: 'App-wide appearance, language, startup, notifications, privacy, network/update, accessibility and advanced options.', group: 'General' },
  },
  point: {
    zh: { title: '点层设置', desc: '点运行时、效果与权限、注册表与凭据。流程重试与审批不在这里。', group: '层' },
    en: { title: 'Point settings', desc: 'Point runtime, effects and permissions, registry and secrets. Flow retry and approval do not belong here.', group: 'Layers' },
  },
  line: {
    zh: { title: '线层设置', desc: '流程执行、重试与错误策略、审批闸门、追踪与保留、调度器。', group: '层' },
    en: { title: 'Line settings', desc: 'Flow execution, retry and error policy, approval gates, tracing and retention, scheduler.', group: 'Layers' },
  },
  surface: {
    zh: { title: '面层设置', desc: '布局、面板、交互、动效、可访问性与显示格式。只影响呈现与交互。', group: '层' },
    en: { title: 'Surface settings', desc: 'Layout, panels, interactions, motion, accessibility and display formats. Presentation and interaction only.', group: 'Layers' },
  },
  body: {
    zh: { title: '体层设置', desc: '已安装体、更新通道、信任与签名、权限、数据保留与隔离。', group: '层' },
    en: { title: 'Body settings', desc: 'Installed bodies, update channels, trust and signatures, permissions, retention and isolation.', group: 'Layers' },
  },
  field: {
    zh: { title: '场层设置', desc: '模型提供商、上下文与记忆、路由、自主性、安全、成本与评估。', group: '层' },
    en: { title: 'Field settings', desc: 'Model providers, context and memory, routing, autonomy, safety, cost and evaluation.', group: 'Layers' },
  },
  info: {
    zh: { title: '信息', desc: '只读版本、运行时、数据位置、诊断、许可证、更新历史与支持动作。', group: '信息' },
    en: { title: 'Info', desc: 'Read-only version, runtime, data locations, diagnostics, licenses, update history and support actions.', group: 'Info' },
  }
}

const groupLabels: Record<string, Text[]> = {
  general: [
    text('外观', 'Appearance'), text('语言与地区', 'Language & Region'), text('启动', 'Startup'), text('通知', 'Notifications'),
    text('隐私与遥测', 'Privacy & Telemetry'), text('网络与更新', 'Network & Updates'), text('可访问性', 'Accessibility'), text('高级', 'Advanced')
  ],
  point: [text('运行时', 'Runtime'), text('效果与权限', 'Effects & Permissions'), text('注册表与来源', 'Registry & Sources'), text('凭据', 'Secrets')],
  line: [text('执行', 'Execution'), text('审批闸门', 'Gates & Approvals'), text('追踪与保留', 'Tracing & Retention'), text('调度器', 'Scheduler')],
  surface: [text('布局与面板', 'Layout & Panels'), text('交互', 'Interaction'), text('动效', 'Motion'), text('可访问性', 'Accessibility'), text('语言与格式', 'Locale & Format')],
  body: [text('更新与通道', 'Updates & Channels'), text('信任与签名', 'Trust & Signatures'), text('权限', 'Permissions'), text('数据与保留', 'Data & Retention'), text('隔离', 'Isolation')],
  field: [text('提供商与模型', 'Providers & Models'), text('上下文与记忆', 'Context & Memory'), text('路由', 'Routing'), text('自主性', 'Autonomy'), text('安全与引用', 'Safety & Citations'), text('成本与限制', 'Cost & Limits'), text('评估', 'Evaluation')]
}

const zhLabels: Record<string, string> = {
  'general.theme': '主题', 'general.accent': '强调色', 'general.fontScale': '字体缩放', 'general.density': '界面密度',
  'general.language': '语言', 'general.dateFormat': '日期格式', 'general.numberFormat': '数字格式', 'general.launchAtLogin': '登录时启动',
  'general.startMinimized': '最小化启动', 'general.restoreLastWorkspace': '恢复上次工作区', 'general.toastDuration': '提示停留时长',
  'general.doNotDisturb': '勿扰模式', 'general.sound': '通知声音', 'general.telemetry': '遥测', 'general.crashReports': '崩溃报告',
  'general.usageData': '使用数据', 'general.proxy': '代理', 'general.updateChannel': '更新通道', 'general.autoCheckUpdates': '自动检查更新',
  'general.highContrast': '高对比度', 'general.reduceMotion': '减少动效', 'general.keyboardHints': '键盘提示', 'general.developerMode': '开发者模式',
  'general.experimentalFeatures': '实验性功能', 'general.logLevel': '日志级别',
  'point.defaultTimeoutMs': '默认超时', 'point.maxConcurrency': '最大并发', 'point.sandbox': '沙箱', 'point.maxEffect': '最高效果等级',
  'point.requireApprovalForL2': 'L2 需要审批', 'point.logInputs': '记录点输入', 'point.registryUrl': '注册表地址',
  'point.allowUnsignedPoints': '允许未签名点', 'point.cacheTtl': '缓存时长', 'point.secretStore': '凭据存储', 'point.revealPolicy': '凭据显示策略',
  'line.defaultTimeoutMs': '默认超时', 'line.maxParallelFlows': '最大并行流程数', 'line.retryPolicy': '重试策略', 'line.maxRetries': '最大重试次数',
  'line.requireApprovalForL2': 'L2 需要审批', 'line.approvalTimeoutS': '审批超时', 'line.autoDenyOnTimeout': '超时自动拒绝',
  'line.traceSampling': '追踪采样率', 'line.runRetentionDays': '运行记录保留天数', 'line.logLevel': '日志级别', 'line.missedRunPolicy': '错过运行策略', 'line.timezone': '时区',
  'surface.defaultPanelSide': '默认面板侧', 'surface.panelWidth': '默认面板宽度', 'surface.rememberPanelSize': '记住面板尺寸',
  'surface.tableDensity': '表格密度', 'surface.doubleClickAction': '双击动作', 'surface.middleClickAction': '中键动作',
  'surface.wheelBehavior': '滚轮行为', 'surface.animationSpeed': '动效速度', 'surface.focusRing': '焦点环',
  'surface.screenReaderHints': '读屏提示', 'surface.panelFocusReturn': '关闭后返回焦点', 'surface.timeFormat': '时间格式',
  'surface.firstDayOfWeek': '每周起始日', 'surface.measurementSystem': '度量系统',
  'body.autoUpdate': '自动更新体', 'body.updateChannel': '体更新通道', 'body.allowPrerelease': '允许预发布',
  'body.requireSignature': '要求签名', 'body.allowUnknownPublisher': '允许未知发布者', 'body.verifyOnLaunch': '启动时校验',
  'body.permissionReview': '权限审查', 'body.requestLog': '权限请求日志', 'body.retentionDays': '数据保留天数',
  'body.backupBeforeUpdate': '更新前备份', 'body.rollbackKeepVersions': '保留回滚版本', 'body.sandbox': '沙箱',
  'body.networkAccess': '网络访问', 'body.filesystemScope': '文件系统范围', 'body.installDir': '安装目录',
  'field.provider': '提供商', 'field.baseUrl': '基础地址', 'field.apiKeyRef': 'API 密钥', 'field.defaultModel': '默认模型',
  'field.contextBudget': '上下文预算', 'field.memoryScope': '记忆范围', 'field.citationPolicy': '引用策略', 'field.routingMode': '路由模式',
  'field.fallbackModel': '回退模型', 'field.latencyBudget': '延迟预算', 'field.autonomyLevel': '自主等级',
  'field.requireApprovalForL2': 'L2 需要审批', 'field.maxCostPerRun': '单次运行成本上限', 'field.contentFilter': '内容过滤',
  'field.redactSecrets': '敏感信息脱敏', 'field.logPrompts': '记录提示词', 'field.monthlyBudget': '月度预算',
  'field.perRunCap': '单次运行上限', 'field.alertThreshold': '告警阈值', 'field.evalOnSave': '保存时评估', 'field.regressionSuite': '回归测试集'
}

const optionLabels: Record<string, Text> = {
  dark: text('深色', 'Dark'), light: text('浅色', 'Light'), system: text('跟随系统', 'System'),
  cyan: text('青色', 'Cyan'), blue: text('蓝色', 'Blue'), violet: text('紫色', 'Violet'), amber: text('琥珀色', 'Amber'),
  comfortable: text('舒适', 'Comfortable'), compact: text('紧凑', 'Compact'),
  'zh-CN': text('简体中文', 'Chinese (Simplified)'), 'en-US': text('英语', 'English'), 'ja-JP': text('日语', 'Japanese'),
  short: text('短', 'Short'), normal: text('标准', 'Normal'), long: text('长', 'Long'),
  off: text('关闭', 'Off'), basic: text('基础', 'Basic'), full: text('完整', 'Full'),
  stable: text('稳定版', 'Stable'), beta: text('测试版', 'Beta'), dev: text('开发版', 'Dev'),
  info: text('信息', 'Info'), debug: text('调试', 'Debug'), warn: text('警告', 'Warn'), error: text('错误', 'Error'),
  strict: text('严格', 'Strict'), balanced: text('平衡', 'Balanced'),
  L0: text('等级 0', 'Level 0'), L1: text('等级 1', 'Level 1'), L2: text('等级 2', 'Level 2'), L3: text('等级 3', 'Level 3'),
  os: text('系统凭据库', 'OS keychain'), keychain: text('钥匙串', 'Keychain'), file: text('文件', 'File'),
  never: text('从不', 'Never'), once: text('一次', 'Once'), session: text('会话内', 'Session'),
  none: text('无', 'None'), linear: text('线性', 'Linear'), exponential: text('指数', 'Exponential'),
  skip: text('跳过', 'Skip'), runOnce: text('补跑一次', 'Run once'), ask: text('询问', 'Ask'),
  right: text('右侧', 'Right'), left: text('左侧', 'Left'), open: text('打开', 'Open'), run: text('运行', 'Run'),
  scroll: text('滚动', 'Scroll'), zoom: text('缩放', 'Zoom'), slow: text('慢', 'Slow'), fast: text('快', 'Fast'),
  auto: text('自动', 'Auto'), always: text('始终', 'Always'), '24h': text('24 小时', '24h'), '12h': text('12 小时', '12h'),
  monday: text('周一', 'Monday'), sunday: text('周日', 'Sunday'), metric: text('公制', 'Metric'), imperial: text('英制', 'Imperial'),
  firstRun: text('首次运行', 'First run'), allow: text('允许', 'Allow'), deny: text('拒绝', 'Deny'),
  body: text('体', 'Body'), workspace: text('工作区', 'Workspace'), user: text('用户', 'User'),
  openai: text('OpenAI', 'OpenAI'), azure: text('微软云', 'Azure'), 'openai-compatible': text('兼容接口', 'OpenAI-compatible'), local: text('本地', 'Local'),
  global: text('全局', 'Global'), whenAvailable: text('有引用时', 'When available'), manual: text('手动', 'Manual'), fallback: text('回退', 'Fallback'),
  A0: text('自主 0', 'Autonomy 0'), A1: text('自主 1', 'Autonomy 1'), A2: text('自主 2', 'Autonomy 2'), A3: text('自主 3', 'Autonomy 3'),
  standard: text('标准', 'Standard')
}

const zhDescOverrides: Record<string, string> = {
  'general.launchAtLogin': '登录操作系统后自动启动应用。',
  'general.telemetry': '“关闭”完全关闭；“基础”只发送匿名性能指标。',
  'general.proxy': '“跟随系统”使用系统代理；也可填写代理地址。',
  'general.updateChannel': '应用自身的更新通道，不影响体更新。',
  'point.defaultTimeoutMs': '点执行的默认超时；单个点实例可覆盖。',
  'point.sandbox': '“严格”最安全；“关闭”仅用于开发机。',
  'point.requireApprovalForL2': '等级 2 的点默认需要审批。',
  'point.allowUnsignedPoints': '关闭时只加载已签名点；开启需要等级 3 确认。',
  'point.secretStore': '“系统凭据库”使用系统凭据库；“文件”仅用于开发。',
  'point.revealPolicy': '“从不”最安全；“一次”仅显示一次。',
  'line.retryPolicy': '重试策略；点只声明可重试性，不拥有重试逻辑。',
  'line.requireApprovalForL2': '等级 2 的流程默认需要审批。',
  'surface.panelWidth': '默认宽度；面板实例可覆盖，用户调整后记住。',
  'surface.tableDensity': '表格、树、列表的默认密度。',
  'surface.animationSpeed': '慢、标准、快；受“减少动效”约束。',
  'surface.focusRing': '“自动”跟随系统；“始终”始终显示。',
  'surface.timeFormat': '24 小时制或 12 小时制。',
  'surface.measurementSystem': '公制或英制。',
  'body.requireSignature': '关闭时需要等级 3 确认。',
  'body.permissionReview': '“始终”最安全；“从不”不建议。',
  'body.sandbox': '严格、平衡或关闭。',
  'body.networkAccess': '询问、允许或拒绝。',
  'body.filesystemScope': '体、工作区或用户范围。',
  'field.provider': '选择模型提供商接入方式。',
  'field.baseUrl': '兼容模型接口的基础地址。',
  'field.defaultModel': '“自动”由路由器选择模型。',
  'field.contextBudget': '每次请求的上下文令牌预算。',
  'field.citationPolicy': '高风险场景强制始终引用。',
  'field.routingMode': '自动、手动或回退。',
  'field.autonomyLevel': '等级 0 仅建议；等级 1 生成草稿；等级 2 自动可撤销；等级 3 禁止。',
  'field.requireApprovalForL2': '不可被单次运行绕过。',
  'field.contentFilter': '标准、严格或关闭。'
}

const commonZhTerms: [RegExp, string][] = [
  [/\bflow\b/gi, '流程'], [/\bpolicy\b/gi, '策略'], [/\bregistry\b/gi, '注册表'], [/\bsecretRef\b/gi, '密钥引用'],
  [/\bOS\b/g, '操作系统'], [/\bAPI key\b/gi, 'API 密钥'], [/\bprovider\b/gi, '提供商'], [/\bfallback\b/gi, '回退'],
  [/\brouter\b/gi, '路由'], [/\btrace\b/gi, '追踪'], [/\bprompt\b/gi, '提示词'], [/\bsession\b/gi, '会话'],
  [/\bworkspace\b/gi, '工作区'], [/\bglobal\b/gi, '全局'], [/\bstrict\b/gi, '严格'], [/\bbalanced\b/gi, '平衡'],
  [/\bcompact\b/gi, '紧凑'], [/\bcomfortable\b/gi, '舒适'], [/\bdigest\/signature\b/gi, '摘要/签名'],
  [/\bL2\b/g, 'L2'], [/\bL3\b/g, 'L3']
]

export function ui(lang: SettingsLanguage) { return settingsUi[lang] }
export function sectionCopy(section: SettingSection, lang: SettingsLanguage) { return sectionText[section.id]?.[lang] ?? { title: section.title, desc: section.desc, group: section.group } }
export function groupCopy(sectionId: string, index: number, lang: SettingsLanguage) { return groupLabels[sectionId]?.[index]?.[lang] ?? (lang === 'zh' ? '分组' : 'Group') }
export function groupDescCopy(sectionId: string, index: number, desc: string, lang: SettingsLanguage) { return lang === 'zh' ? cleanZh(desc).replace(/Surface/gi, '面层') : `Settings for ${groupCopy(sectionId, index, lang)}.` }
export function optionCopy(value: string, lang: SettingsLanguage) { return optionLabels[value]?.[lang] ?? value }

function cleanZh(value: string): string {
  return commonZhTerms.reduce((result, [pattern, replacement]) => result.replace(pattern, replacement), value)
}

export function settingCopy(setting: SettingSpec, lang: SettingsLanguage): { label: string; desc: string } {
  if (lang === 'zh') return { label: zhLabels[setting.key] ?? setting.label, desc: zhDescOverrides[setting.key] ?? cleanZh(setting.desc) }
  const label = setting.label
  return { label, desc: `${label}: configure the default policy and behavior for this workspace.` }
}

const infoTitles: Record<string, Text> = {
  'About': text('关于', 'About'),
  'Runtime & Platform': text('运行时与平台', 'Runtime & Platform'),
  'Data Locations': text('数据位置', 'Data Locations'),
  'Diagnostics & Logs': text('诊断与日志', 'Diagnostics & Logs'),
  'Licenses & Credits': text('许可证与致谢', 'Licenses & Credits'),
  'Updates': text('更新', 'Updates'),
  'Support / Reset': text('支持 / 重置', 'Support / Reset')
}

const infoLabels: Record<string, Text> = {
  Version: text('版本', 'Version'), Build: text('构建', 'Build'), Channel: text('通道', 'Channel'), Commit: text('提交', 'Commit'),
  OS: text('操作系统', 'OS'), Arch: text('架构', 'Arch'), Runtime: text('运行时', 'Runtime'), WebView: text('网页视图', 'WebView'),
  Config: text('配置', 'Config'), Data: text('数据', 'Data'), Cache: text('缓存', 'Cache'), Logs: text('日志', 'Logs'),
  'Log level': text('日志级别', 'Log level'), 'Last error': text('最近错误', 'Last error'), 'Trace sampling': text('追踪采样', 'Trace sampling'),
  'Support bundle': text('支持包', 'Support bundle'), 'App license': text('应用许可', 'App license'), OSS: text('开源组件', 'OSS'),
  Fonts: text('字体', 'Fonts'), Assets: text('资源', 'Assets'), 'Last check': text('上次检查', 'Last check'),
  Current: text('当前', 'Current'), Available: text('可用', 'Available'), History: text('历史', 'History'),
  'Reset settings': text('重置设置', 'Reset settings'), 'Reset app': text('重置应用', 'Reset app'), 'Safe mode': text('安全模式', 'Safe mode'),
  Backup: text('备份', 'Backup')
}

const infoValues: Record<string, Text> = {
  stable: text('稳定版', 'Stable'), none: text('无', 'None'), info: text('信息', 'Info'), Proprietary: text('专有', 'Proprietary'),
  redacted: text('已脱敏', 'Redacted'), 'keeps data': text('保留数据', 'Keeps data'), 'deletes local data': text('删除本地数据', 'Deletes local data'),
  'starts clean': text('干净启动', 'Starts clean'), recommended: text('建议', 'Recommended'), '2 min ago': text('2 分钟前', '2 min ago'),
  '42 packages': text('42 个包', '42 packages'), '3rd-party credits': text('第三方致谢', 'Third-party credits')
}

const infoActions: Record<string, Text> = {
  'Copy version': text('复制版本', 'Copy version'), 'Version copied': text('版本已复制', 'Version copied'),
  'Copy diagnostics': text('复制诊断', 'Copy diagnostics'), 'Diagnostics copied': text('诊断已复制', 'Diagnostics copied'),
  'Open data folder': text('打开数据目录', 'Open data folder'), 'Opening data folder…': text('正在打开数据目录…', 'Opening data folder…'),
  'Open logs': text('打开日志', 'Open logs'), 'Opening logs…': text('正在打开日志…', 'Opening logs…'),
  'Export support bundle': text('导出支持包', 'Export support bundle'), 'Support bundle queued': text('支持包已排队', 'Support bundle queued'),
  'View licenses': text('查看许可', 'View licenses'), 'Opening licenses…': text('正在打开许可…', 'Opening licenses…'),
  'Check updates': text('检查更新', 'Check updates'), 'Checking updates…': text('正在检查更新…', 'Checking updates…'),
  'Release notes': text('发行说明', 'Release notes'), 'Opening release notes…': text('正在打开发行说明…', 'Opening release notes…'),
  'Reset settings': text('重置设置', 'Reset settings'), 'Reset settings requires confirmation': text('重置设置需要确认', 'Reset settings requires confirmation'),
  'Reset app': text('重置应用', 'Reset app'), 'Reset app requires confirmation': text('重置应用需要确认', 'Reset app requires confirmation')
}

export function infoCopy(card: InfoCard, lang: SettingsLanguage) {
  return {
    title: infoTitles[card.title]?.[lang] ?? card.title,
    rows: card.rows.map(([key, value]) => [infoLabels[key]?.[lang] ?? key, infoValues[value]?.[lang] ?? value] as [string, string]),
    actions: card.actions.map(([label, toast]) => [infoActions[label]?.[lang] ?? label, infoActions[toast]?.[lang] ?? toast] as [string, string])
  }
}

export function languageOptionCopy(option: string, lang: SettingsLanguage): string {
  if (option === 'zh-CN') return lang === 'zh' ? settingsUi.zh.languageZh : settingsUi.zh.languageZh
  if (option === 'en-US') return settingsUi.en.languageEn
  return optionCopy(option, lang)
}
