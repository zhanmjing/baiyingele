(() => {
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = v => JSON.parse(JSON.stringify(v));

function S(key, label, desc, type, def, opts = {}) {
  return { key, label, desc, type, default: def, options: opts.options, unit: opts.unit, min: opts.min, max: opts.max, effect: opts.effect || 'L0', restart: opts.restart || null, secret: !!opts.secret, policy: !!opts.policy, initialSource: opts.initialSource || null, advanced: !!opts.advanced, alias: opts.alias || [], impact: opts.impact || [] };
}

const SECTIONS = [
  {
    id: 'general', group: 'General', icon: '⚙', color: '#22d3ee', title: '通用设置',
    desc: '应用级外观、语言、启动、通知、隐私、网络/更新、可访问性与高级选项。',
    groups: [
      { label: 'Appearance', desc: '全局视觉；Surface 只放布局与交互。', settings: [
        S('general.theme', 'Theme', '应用主题；跟随系统时由 OS 决定。', 'enum', 'dark', { options: ['dark', 'light', 'system'], effect: 'L0', initialSource: 'user' }),
        S('general.accent', 'Accent color', '强调色；用于选中、焦点与主操作。', 'enum', 'cyan', { options: ['cyan', 'blue', 'violet', 'amber'], effect: 'L0', initialSource: 'user' }),
        S('general.fontScale', 'Font scale', '全局字体缩放，100% 为默认。', 'number', 100, { min: 80, max: 140, unit: '%', effect: 'L0', initialSource: 'user' }),
        S('general.density', 'UI density', 'comfortable 更适合阅读，compact 更适合高信息密度。', 'enum', 'comfortable', { options: ['comfortable', 'compact'], effect: 'L0', initialSource: 'user' })
      ]},
      { label: 'Language & Region', desc: '应用语言与数字/日期格式。', settings: [
        S('general.language', 'Language', '界面语言；需要重启的文案会单独标注。', 'enum', 'zh-CN', { options: ['zh-CN', 'en-US', 'ja-JP'], effect: 'L0', initialSource: 'user', restart: 'app' }),
        S('general.dateFormat', 'Date format', '日期显示格式。', 'enum', 'YYYY-MM-DD', { options: ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY'], effect: 'L0' }),
        S('general.numberFormat', 'Number format', '数字千分位/小数格式。', 'enum', '1,234.56', { options: ['1,234.56', '1.234,56', '1 234,56'], effect: 'L0' })
      ]},
      { label: 'Startup', desc: '应用启动与工作区恢复。', settings: [
        S('general.launchAtLogin', 'Launch at login', '登录 Windows 后自动启动。', 'bool', false, { effect: 'L1' }),
        S('general.startMinimized', 'Start minimized', '启动后进入托盘/最小化。', 'bool', false, { effect: 'L1' }),
        S('general.restoreLastWorkspace', 'Restore last workspace', '恢复上次打开的工作区与面板布局。', 'bool', true, { effect: 'L0' })
      ]},
      { label: 'Notifications', desc: '通知与提示行为。', settings: [
        S('general.toastDuration', 'Toast duration', '轻提示停留时间。', 'enum', 'normal', { options: ['short', 'normal', 'long'], effect: 'L0' }),
        S('general.doNotDisturb', 'Do not disturb', '暂停非关键通知。', 'bool', false, { effect: 'L0' }),
        S('general.sound', 'Notification sound', '通知是否播放声音。', 'bool', true, { effect: 'L0' })
      ]},
      { label: 'Privacy & Telemetry', desc: '遥测、崩溃报告与使用数据。', settings: [
        S('general.telemetry', 'Telemetry', 'off 完全关闭；basic 只发匿名性能指标。', 'enum', 'basic', { options: ['off', 'basic', 'full'], effect: 'L1', policy: true }),
        S('general.crashReports', 'Crash reports', '崩溃时发送诊断包。', 'bool', true, { effect: 'L1' }),
        S('general.usageData', 'Usage data', '发送功能使用统计。', 'bool', false, { effect: 'L1' })
      ]},
      { label: 'Network & Updates', desc: '代理、应用更新通道与检查。', settings: [
        S('general.proxy', 'Proxy', 'system 使用系统代理；也可填 http://host:port。', 'string', 'system', { effect: 'L1' }),
        S('general.updateChannel', 'Update channel', '应用自身更新通道，不是 Body 更新。', 'enum', 'stable', { options: ['stable', 'beta', 'dev'], effect: 'L1', initialSource: 'user' }),
        S('general.autoCheckUpdates', 'Auto check updates', '启动时检查应用更新。', 'bool', true, { effect: 'L0' })
      ]},
      { label: 'Accessibility', desc: '对比度、动效与键盘提示。', settings: [
        S('general.highContrast', 'High contrast', '增强边框与文本对比度。', 'bool', false, { effect: 'L0' }),
        S('general.reduceMotion', 'Reduce motion', '减少动画；应用设置只能比系统更严格。', 'bool', false, { effect: 'L0' }),
        S('general.keyboardHints', 'Keyboard hints', '显示快捷键提示。', 'bool', true, { effect: 'L0' })
      ]},
      { label: 'Advanced', desc: '开发与实验选项。', settings: [
        S('general.developerMode', 'Developer mode', '显示调试工具与实验入口。', 'bool', false, { effect: 'L1', advanced: true }),
        S('general.experimentalFeatures', 'Experimental features', '启用未稳定的功能。', 'bool', false, { effect: 'L1', advanced: true }),
        S('general.logLevel', 'Log level', '应用日志级别。', 'enum', 'info', { options: ['info', 'debug', 'warn', 'error'], effect: 'L0', advanced: true })
      ]}
    ]
  },
  {
    id: 'point', group: 'Layers', icon: '◆', color: '#22d3ee', title: '点层设置',
    desc: '点运行时、效果/权限、registry 与 secrets。flow 重试/审批不在这里。',
    groups: [
      { label: 'Runtime', desc: '点执行的默认超时、并发与沙箱。', settings: [
        S('point.defaultTimeoutMs', 'Default timeout', '点执行默认超时；单个 PointInstance 可覆盖。', 'number', 12000, { min: 1000, max: 120000, unit: 'ms', effect: 'L1', initialSource: 'user' }),
        S('point.maxConcurrency', 'Max concurrency', '同时运行的点实例上限。', 'number', 4, { min: 1, max: 32, effect: 'L1' }),
        S('point.sandbox', 'Sandbox', 'strict 最安全；off 仅开发机。', 'enum', 'balanced', { options: ['strict', 'balanced', 'off'], effect: 'L2', restart: 'app' })
      ]},
      { label: 'Effects & Permissions', desc: '效果等级与权限默认策略。', settings: [
        S('point.maxEffect', 'Max effect', '单点允许的最高效果等级；policy 锁定。', 'enum', 'L2', { options: ['L0', 'L1', 'L2', 'L3'], effect: 'L2', policy: true }),
        S('point.requireApprovalForL2', 'Require approval for L2', 'L2 点默认需要审批。', 'bool', true, { effect: 'L2', policy: true }),
        S('point.logInputs', 'Log point inputs', '可能含敏感数据；默认关闭。', 'bool', false, { effect: 'L1', policy: true })
      ]},
      { label: 'Registry & Sources', desc: '点来源、签名与缓存。', settings: [
        S('point.registryUrl', 'Registry URL', '点 registry 地址。', 'string', 'https://registry.local', { effect: 'L1' }),
        S('point.allowUnsignedPoints', 'Allow unsigned points', '关闭时只加载签名点；开启需要 L3 确认。', 'bool', false, { effect: 'L3', policy: true }),
        S('point.cacheTtl', 'Cache TTL', 'registry 缓存时间。', 'number', 3600, { min: 0, max: 86400, unit: 's', effect: 'L0' })
      ]},
      { label: 'Secrets', desc: '凭据存储与显示策略。', settings: [
        S('point.secretStore', 'Secret store', 'os/keychain 使用系统凭据库；file 仅开发。', 'enum', 'os', { options: ['os', 'keychain', 'file'], effect: 'L2' }),
        S('point.revealPolicy', 'Reveal policy', 'never 最安全；once 仅显示一次。', 'enum', 'never', { options: ['never', 'once', 'session'], effect: 'L2', policy: true })
      ]}
    ]
  },
  {
    id: 'line', group: 'Layers', icon: '↝', color: '#3b82f6', title: '线层设置',
    desc: 'flow 执行、重试/错误策略、审批闸门、trace/retention 与 scheduler。',
    groups: [
      { label: 'Execution', desc: 'flow 超时、并发与重试。', settings: [
        S('line.defaultTimeoutMs', 'Default timeout', 'flow 默认超时。', 'number', 30000, { min: 1000, max: 600000, unit: 'ms', effect: 'L1' }),
        S('line.maxParallelFlows', 'Max parallel flows', '同时运行的 flow 上限。', 'number', 3, { min: 1, max: 16, effect: 'L1' }),
        S('line.retryPolicy', 'Retry policy', '重试策略；点只声明可重试性，不拥有 retry。', 'enum', 'exponential', { options: ['none', 'linear', 'exponential'], effect: 'L1' }),
        S('line.maxRetries', 'Max retries', '最大重试次数。', 'number', 2, { min: 0, max: 10, effect: 'L1' })
      ]},
      { label: 'Gates & Approvals', desc: '审批闸门与超时。', settings: [
        S('line.requireApprovalForL2', 'Require approval for L2', 'L2 flow 默认需要审批。', 'bool', true, { effect: 'L2', policy: true }),
        S('line.approvalTimeoutS', 'Approval timeout', '等待审批的秒数。', 'number', 60, { min: 5, max: 600, unit: 's', effect: 'L1' }),
        S('line.autoDenyOnTimeout', 'Auto deny on timeout', '超时自动拒绝；安全优先。', 'bool', true, { effect: 'L2', policy: true })
      ]},
      { label: 'Tracing & Retention', desc: 'trace 采样、运行保留与日志级别。', settings: [
        S('line.traceSampling', 'Trace sampling', '采样率越高越占性能/磁盘。', 'number', 10, { min: 0, max: 100, unit: '%', effect: 'L1' }),
        S('line.runRetentionDays', 'Run retention', '运行记录保留天数。', 'number', 30, { min: 1, max: 365, unit: 'days', effect: 'L1' }),
        S('line.logLevel', 'Log level', 'flow 日志级别。', 'enum', 'info', { options: ['info', 'debug', 'warn', 'error'], effect: 'L0' })
      ]},
      { label: 'Scheduler', desc: '错过的调度与 timezone。', settings: [
        S('line.missedRunPolicy', 'Missed run policy', '错过的定时 flow 如何处理。', 'enum', 'skip', { options: ['skip', 'runOnce', 'ask'], effect: 'L1' }),
        S('line.timezone', 'Timezone', '调度时区。', 'string', 'Asia/Shanghai', { effect: 'L0' })
      ]}
    ]
  },
  {
    id: 'surface', group: 'Layers', icon: '▦', color: '#8b5cf6', title: '面层设置',
    desc: '布局、面板、交互、动效、可访问性与显示格式。只影响呈现/交互。',
    groups: [
      { label: 'Layout & Panels', desc: '面板默认位置、宽度与表格密度。', settings: [
        S('surface.defaultPanelSide', 'Default panel side', '新开面板默认在右/左。', 'enum', 'right', { options: ['right', 'left'], effect: 'L0', initialSource: 'user' }),
        S('surface.panelWidth', 'Default panel width', '默认宽度；PanelInstance 可覆盖，用户调整后 remember。', 'number', 380, { min: 300, max: 620, unit: 'px', effect: 'L0', initialSource: 'user' }),
        S('surface.rememberPanelSize', 'Remember panel size', '记住用户拖拽后的面板尺寸。', 'bool', true, { effect: 'L0' }),
        S('surface.tableDensity', 'Table density', 'table/tree/list 的默认密度。', 'enum', 'comfortable', { options: ['comfortable', 'compact'], effect: 'L0' })
      ]},
      { label: 'Interaction', desc: '双击、中键与滚轮行为。', settings: [
        S('surface.doubleClickAction', 'Double-click action', '双击列表/卡片时的默认动作。', 'enum', 'open', { options: ['open', 'run', 'none'], effect: 'L0' }),
        S('surface.middleClickAction', 'Middle-click action', '中键默认动作。', 'enum', 'none', { options: ['none', 'open', 'run'], effect: 'L0' }),
        S('surface.wheelBehavior', 'Wheel behavior', '滚轮滚动或缩放。', 'enum', 'scroll', { options: ['scroll', 'zoom'], effect: 'L0' })
      ]},
      { label: 'Motion', desc: '动效速度；reduce motion 在 General。', settings: [
        S('surface.animationSpeed', 'Animation speed', 'slow/normal/fast；受 reduce motion 约束。', 'enum', 'normal', { options: ['slow', 'normal', 'fast'], effect: 'L0' })
      ]},
      { label: 'Accessibility', desc: '焦点环、读屏提示与焦点归还。', settings: [
        S('surface.focusRing', 'Focus ring', 'auto 跟随系统；always 始终显示。', 'enum', 'auto', { options: ['auto', 'always'], effect: 'L0' }),
        S('surface.screenReaderHints', 'Screen reader hints', '为复杂面板提供额外读屏提示。', 'bool', true, { effect: 'L0' }),
        S('surface.panelFocusReturn', 'Return focus on close', '关闭面板后回到触发元素。', 'bool', true, { effect: 'L0' })
      ]},
      { label: 'Locale & Format', desc: '时间、周起始与度量。', settings: [
        S('surface.timeFormat', 'Time format', '24h 或 12h。', 'enum', '24h', { options: ['24h', '12h'], effect: 'L0' }),
        S('surface.firstDayOfWeek', 'First day of week', '日历周起始。', 'enum', 'monday', { options: ['monday', 'sunday'], effect: 'L0' }),
        S('surface.measurementSystem', 'Measurement system', 'metric/imperial。', 'enum', 'metric', { options: ['metric', 'imperial'], effect: 'L0' })
      ]}
    ]
  },
  {
    id: 'body', group: 'Layers', icon: '▣', color: '#f59e0b', title: '体层设置',
    desc: '已安装体、更新通道、信任/签名、权限、数据保留与隔离。',
    groups: [
      { label: 'Updates & Channels', desc: '体更新与应用更新分开。', settings: [
        S('body.autoUpdate', 'Auto update bodies', '自动更新已安装体。', 'bool', true, { effect: 'L1', initialSource: 'user' }),
        S('body.updateChannel', 'Body update channel', '体更新通道。', 'enum', 'stable', { options: ['stable', 'beta', 'dev'], effect: 'L1' }),
        S('body.allowPrerelease', 'Allow prerelease', '允许预发布体；生产环境通常关闭。', 'bool', false, { effect: 'L2', policy: true })
      ]},
      { label: 'Trust & Signatures', desc: '签名与发布者信任。', settings: [
        S('body.requireSignature', 'Require signature', '关闭需要 L3 确认。', 'bool', true, { effect: 'L3', policy: true }),
        S('body.allowUnknownPublisher', 'Allow unknown publisher', '允许未知发布者；高风险。', 'bool', false, { effect: 'L3', policy: true }),
        S('body.verifyOnLaunch', 'Verify on launch', '启动时校验 digest/signature。', 'bool', true, { effect: 'L2' })
      ]},
      { label: 'Permissions', desc: '权限审查与请求日志。', settings: [
        S('body.permissionReview', 'Permission review', 'always 最安全；never 不建议。', 'enum', 'always', { options: ['always', 'firstRun', 'never'], effect: 'L2' }),
        S('body.requestLog', 'Permission request log', '记录权限请求。', 'bool', true, { effect: 'L1' })
      ]},
      { label: 'Data & Retention', desc: '保留、备份与回滚版本。', settings: [
        S('body.retentionDays', 'Data retention', '体数据保留天数。', 'number', 90, { min: 1, max: 3650, unit: 'days', effect: 'L1' }),
        S('body.backupBeforeUpdate', 'Backup before update', '更新前备份。', 'bool', true, { effect: 'L1' }),
        S('body.rollbackKeepVersions', 'Keep versions for rollback', '至少保留 2 个版本。', 'number', 2, { min: 1, max: 5, effect: 'L1' })
      ]},
      { label: 'Isolation', desc: '沙箱、网络与文件系统范围。', settings: [
        S('body.sandbox', 'Sandbox', 'strict/balanced/off。', 'enum', 'strict', { options: ['strict', 'balanced', 'off'], effect: 'L2', restart: 'body' }),
        S('body.networkAccess', 'Network access', 'ask/allow/deny。', 'enum', 'ask', { options: ['ask', 'allow', 'deny'], effect: 'L2' }),
        S('body.filesystemScope', 'Filesystem scope', 'body/workspace/user。', 'enum', 'body', { options: ['body', 'workspace', 'user'], effect: 'L2' }),
        S('body.installDir', 'Install directory', '体安装目录。', 'path', '%LOCALAPPDATA%\\Atom\\Bodies', { effect: 'L1', restart: 'app' })
      ]}
    ]
  },
  {
    id: 'field', group: 'Layers', icon: '✦', color: '#ec4899', title: '场层设置',
    desc: '模型 provider、上下文/记忆、routing、autonomy、safety、成本与评估。',
    groups: [
      { label: 'Providers & Models', desc: '模型接入；API key 只存 secretRef。', settings: [
        S('field.provider', 'Provider', 'openai/azure/openai-compatible/local。', 'enum', 'openai-compatible', { options: ['openai', 'azure', 'openai-compatible', 'local'], effect: 'L1', initialSource: 'user' }),
        S('field.baseUrl', 'Base URL', '兼容 OpenAI 的 API base URL。', 'string', 'https://api.openai.com/v1', { effect: 'L1', initialSource: 'user' }),
        S('field.apiKeyRef', 'API key', '只保存 secretRef；不回显明文。', 'secret', 'env:OPENAI_API_KEY', { effect: 'L2', secret: true, initialSource: 'user' }),
        S('field.defaultModel', 'Default model', 'auto 由 router 选择。', 'string', 'auto', { effect: 'L1', initialSource: 'user' })
      ]},
      { label: 'Context & Memory', desc: '上下文预算、记忆范围与引用。', settings: [
        S('field.contextBudget', 'Context budget', '每次请求的 context token 预算。', 'number', 32000, { min: 1000, max: 200000, unit: 'tokens', effect: 'L1' }),
        S('field.memoryScope', 'Memory scope', 'session/workspace/global。', 'enum', 'workspace', { options: ['session', 'workspace', 'global'], effect: 'L1' }),
        S('field.citationPolicy', 'Citation policy', '高风险场景强制 always。', 'enum', 'whenAvailable', { options: ['always', 'whenAvailable', 'off'], effect: 'L1' })
      ]},
      { label: 'Routing', desc: '模型路由与 fallback。', settings: [
        S('field.routingMode', 'Routing mode', 'auto/manual/fallback。', 'enum', 'auto', { options: ['auto', 'manual', 'fallback'], effect: 'L1' }),
        S('field.fallbackModel', 'Fallback model', '主模型失败时的 fallback。', 'string', 'auto', { effect: 'L1' }),
        S('field.latencyBudget', 'Latency budget', '路由延迟预算。', 'number', 8000, { min: 500, max: 120000, unit: 'ms', effect: 'L1' })
      ]},
      { label: 'Autonomy', desc: '自主等级、审批与单次成本上限。', settings: [
        S('field.autonomyLevel', 'Autonomy level', 'A0 建议/A1 草稿/A2 自动可撤销/A3 禁止。', 'enum', 'A1', { options: ['A0', 'A1', 'A2', 'A3'], effect: 'L2', initialSource: 'user' }),
        S('field.requireApprovalForL2', 'Require approval for L2', '不可被单次 run 绕过。', 'bool', true, { effect: 'L2', policy: true }),
        S('field.maxCostPerRun', 'Max cost per run', '单次运行成本上限。', 'number', 0.50, { min: 0, max: 100, unit: 'USD', effect: 'L1' })
      ]},
      { label: 'Safety & Citations', desc: '内容过滤、secret redaction 与 prompt 日志。', settings: [
        S('field.contentFilter', 'Content filter', 'standard/strict/off。', 'enum', 'standard', { options: ['standard', 'strict', 'off'], effect: 'L2' }),
        S('field.redactSecrets', 'Redact secrets', '日志/诊断自动脱敏。', 'bool', true, { effect: 'L2', policy: true }),
        S('field.logPrompts', 'Log prompts', '可能含敏感数据；默认关闭。', 'bool', false, { effect: 'L2', policy: true })
      ]},
      { label: 'Cost & Limits', desc: '预算、单次上限与告警。', settings: [
        S('field.monthlyBudget', 'Monthly budget', '月度预算。', 'number', 50, { min: 0, max: 10000, unit: 'USD', effect: 'L1' }),
        S('field.perRunCap', 'Per-run cap', '单次运行上限。', 'number', 0.50, { min: 0, max: 100, unit: 'USD', effect: 'L1' }),
        S('field.alertThreshold', 'Alert threshold', '预算告警阈值。', 'number', 80, { min: 1, max: 100, unit: '%', effect: 'L0' })
      ]},
      { label: 'Evaluation', desc: '保存时评估与回归集。', settings: [
        S('field.evalOnSave', 'Evaluate on save', '保存配置时跑评估。', 'bool', false, { effect: 'L1' }),
        S('field.regressionSuite', 'Regression suite', '评估使用的回归集。', 'string', 'default', { effect: 'L1' })
      ]}
    ]
  },
  { id: 'info', group: 'Info', icon: 'ⓘ', color: '#94a3b8', title: '信息', desc: '只读版本、运行时、数据位置、诊断、许可证、更新历史与支持动作。', info: true }
];

const INFO_CARDS = [
  { title: 'About', icon: 'ⓘ', rows: [['Version', '1.4.2'], ['Build', '2026.11.23'], ['Channel', 'stable'], ['Commit', '9f2c4e7']], actions: [['Copy version', 'Version copied']] },
  { title: 'Runtime & Platform', icon: '▤', rows: [['OS', 'Windows 11 24H2'], ['Arch', 'x64'], ['Runtime', '.NET 9'], ['WebView', '2.0']], actions: [['Copy diagnostics', 'Diagnostics copied']] },
  { title: 'Data Locations', icon: '⌂', rows: [['Config', '%APPDATA%/Atom/config'], ['Data', '%LOCALAPPDATA%/Atom/data'], ['Cache', '%LOCALAPPDATA%/Atom/cache'], ['Logs', '%LOCALAPPDATA%/Atom/logs']], actions: [['Open data folder', 'Opening data folder…'], ['Open logs', 'Opening logs…']] },
  { title: 'Diagnostics & Logs', icon: '⌁', rows: [['Log level', 'info'], ['Last error', 'none'], ['Trace sampling', '10%'], ['Support bundle', 'redacted']], actions: [['Export support bundle', 'Support bundle queued'], ['Copy diagnostics', 'Diagnostics copied']] },
  { title: 'Licenses & Credits', icon: '§', rows: [['App license', 'Proprietary'], ['OSS', '42 packages'], ['Fonts', 'IBM Plex / Inter'], ['Assets', '3rd-party credits']], actions: [['View licenses', 'Opening licenses…']] },
  { title: 'Updates', icon: '↻', rows: [['Last check', '2 min ago'], ['Current', '1.4.2'], ['Available', 'none'], ['History', '1.4.0 → 1.4.2']], actions: [['Check updates', 'Checking updates…'], ['Release notes', 'Opening release notes…']] },
  { title: 'Support / Reset', icon: '!', rows: [['Reset settings', 'keeps data'], ['Reset app', 'deletes local data'], ['Safe mode', 'starts clean'], ['Backup', 'recommended']], actions: [['Reset settings', 'Reset settings requires confirmation'], ['Reset app', 'Reset app requires confirmation']], danger: true }
];

const state = {
  sectionId: 'general',
  scope: 'User',
  query: '',
  values: {},
  saved: {},
  highlightKey: null,
  showAdvanced: false,
  restartPending: [],
  layerTab: 'settings',
  selectedClassId: null,
  selectedInstanceId: null,
  expandedClasses: new Set(),
  filterClass: 'all',
  toastTimer: null
};

const ALL_SETTINGS = SECTIONS.flatMap(s => (s.groups || []).flatMap(g => g.settings));
const settingById = key => ALL_SETTINGS.find(s => s.key === key);
const sectionById = id => SECTIONS.find(s => s.id === id);

function initValues() {
  state.values = {};
  for (const s of ALL_SETTINGS) {
    state.values[s.key] = { value: s.default, source: s.policy ? 'policy' : (s.initialSource || 'default') };
  }
  state.saved = clone(state.values);
}
initValues();

/* ============================================================
   状态 / 渲染
   ============================================================ */
function dirtyKeys() {
  return ALL_SETTINGS.filter(s => JSON.stringify(state.values[s.key]?.value) !== JSON.stringify(state.saved[s.key]?.value)).map(s => s.key);
}
function isDirty(key) { return dirtyKeys().includes(key); }
function sectionSettings(id) {
  const sec = sectionById(id);
  return sec && sec.groups ? sec.groups.flatMap(g => g.settings) : [];
}
function sectionDirty(id) { return sectionSettings(id).some(s => isDirty(s.key)); }
function sectionLocks(id) { return sectionSettings(id).filter(s => state.values[s.key]?.source === 'policy').length; }

const LAYER_IDS = ['point', 'line', 'surface', 'body', 'field'];
function isLayerSection(id) { return LAYER_IDS.includes(id); }
function catalogFor(id) { return (typeof LAYER_CATALOGS !== 'undefined' && LAYER_CATALOGS[id]) || null; }
function catalogInstances(cat) { return cat ? cat.classes.reduce((n, c) => n + c.instances.length, 0) : 0; }
function currentClass() {
  const cat = catalogFor(state.sectionId);
  if (!cat) return null;
  return cat.classes.find(c => c.id === state.selectedClassId) || cat.classes[0] || null;
}
function currentInstance() {
  const c = currentClass();
  if (!c) return null;
  return c.instances.find(i => i.id === state.selectedInstanceId) || c.instances[0] || null;
}
function ensureLayerSelection(id) {
  const cat = catalogFor(id);
  if (!cat) return;
  if (!cat.classes.some(c => c.id === state.selectedClassId)) {
    state.selectedClassId = cat.classes[0]?.id || null;
    state.selectedInstanceId = cat.classes[0]?.instances[0]?.id || null;
  }
  const c = currentClass();
  if (c && !c.instances.some(i => i.id === state.selectedInstanceId)) state.selectedInstanceId = c.instances[0]?.id || null;
  if (c && state.expandedClasses) state.expandedClasses.add(c.id);
}
function formatVal(spec, v) {
  if (spec.secret) return v ? '••••••••' : 'not configured';
  if (typeof v === 'boolean') return v ? 'on' : 'off';
  if (v === '' || v === null || v === undefined) return '—';
  return String(v);
}

function renderHeader() {
  const n = dirtyKeys().length;
  $('#scopeSel').value = state.scope;
  if ($('#sectionSel')) $('#sectionSel').value = state.sectionId;
  const apply = $('#applyBtn');
  apply.disabled = n === 0 || state.scope === 'Policy' || (isLayerSection(state.sectionId) && state.layerTab !== 'settings');
  apply.textContent = n ? `Apply (${n})` : 'Apply';
}

function renderNav() {
  const groups = [
    { label: 'General', ids: ['general'] },
    { label: 'Layers', ids: LAYER_IDS },
    { label: 'Info', ids: ['info'] }
  ];
  $('#nav').innerHTML = groups.map(g => `<div class="nav-group"><div class="nav-label">${esc(g.label)}</div>${g.ids.map(id => {
    const s = sectionById(id);
    const cat = catalogFor(id);
    const dirty = sectionDirty(id);
    const locks = sectionLocks(id);
    const sub = cat ? `${cat.classes.length} 类 / ${catalogInstances(cat)} 实例` : (id === 'general' ? 'app settings' : 'read only');
    return `<div class="nav-item ${s.id === state.sectionId ? 'on' : ''}" data-section="${esc(s.id)}" style="--cat:${s.color}">
      <div class="nav-icon">${esc(s.icon)}</div>
      <div class="nav-main"><div class="nav-name">${esc(s.title)}</div><div class="nav-sub">${esc(sub)}${locks ? ' · ' + locks + ' locked' : ''}</div></div>
      ${dirty ? '<span class="nav-dot"></span>' : ''}${locks ? '<span class="nav-lock">🔒</span>' : ''}
    </div>`;
  }).join('')}</div>`).join('');
  $$('#nav [data-section]').forEach(el => el.onclick = () => {
    state.sectionId = el.dataset.section;
    state.layerTab = 'settings';
    state.filterClass = 'all';
    state.query = '';
    $('#search').value = '';
    if (isLayerSection(state.sectionId)) ensureLayerSelection(state.sectionId);
    renderAll();
  });
}

function sourceBadge(src) { return `<span class="src ${esc(src)}">${esc(src)}</span>`; }

function controlHTML(spec, v, locked) {
  if (spec.type === 'secret') {
    return `<div class="secret-box"><span class="secret-dot">${v ? 'Configured' : 'Not configured'}</span><span style="font:7px var(--mono);color:var(--faint)">${v ? esc(v) : 'no secretRef'}</span><button class="secret-btn" data-secret="${esc(spec.key)}" ${locked ? 'disabled' : ''}>${v ? 'Replace' : 'Set'}</button></div>`;
  }
  if (spec.type === 'bool') {
    return `<label class="switch"><input type="checkbox" data-key="${esc(spec.key)}" ${v ? 'checked' : ''} ${locked ? 'disabled' : ''}><span></span></label>`;
  }
  if (spec.type === 'enum') {
    return `<select data-key="${esc(spec.key)}" ${locked ? 'disabled' : ''}>${(spec.options || []).map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  }
  if (spec.type === 'number') {
    return `<input type="number" data-key="${esc(spec.key)}" value="${esc(v)}" min="${spec.min ?? ''}" max="${spec.max ?? ''}" ${locked ? 'disabled' : ''}>`;
  }
  return `<input type="text" data-key="${esc(spec.key)}" value="${esc(v)}" ${locked ? 'disabled' : ''}>`;
}

function rowHTML(spec, section) {
  const cur = state.values[spec.key] || { value: spec.default, source: 'default' };
  const locked = cur.source === 'policy' || state.scope === 'Policy';
  const dirty = isDirty(spec.key);
  const highlight = state.highlightKey === spec.key;
  const badges = [`<span class="mini l${String(spec.effect).slice(1)}">${esc(spec.effect)}</span>`];
  if (spec.restart) badges.push(`<span class="mini restart">restart ${esc(spec.restart)}</span>`);
  if (spec.secret) badges.push('<span class="mini secret">secretRef</span>');
  if (cur.source === 'policy') badges.push('<span class="mini restart">policy locked</span>');
  if (spec.unit) badges.push(`<span class="mini">${esc(spec.unit)}</span>`);
  const showReset = !locked && (dirty || cur.source !== 'default');
  return `<div class="setting-row ${dirty ? 'dirty' : ''} ${highlight ? 'highlight' : ''}" data-row="${esc(spec.key)}">
    <div class="row-main">
      <div class="row-label">${esc(spec.label)} ${badges.join('')}</div>
      <div class="row-desc">${esc(spec.desc)}</div>
    </div>
    <div class="row-control">${controlHTML(spec, cur.value, locked)}</div>
    <div class="row-side">${sourceBadge(cur.source)}${showReset ? `<button class="reset" data-reset="${esc(spec.key)}">reset</button>` : ''}</div>
  </div>`;
}

const MANAGER_ROUTES = {
  point: 'atom-catalog-management.html',
  line: 'line-management.html',
  surface: 'surface-management.html',
  body: 'body-management.html',
  field: 'field-management.html'
};
function managerUrlFor(id) { return MANAGER_ROUTES[id] || `layer-management.html#${id}`; }

function managementJumpHTML(sec) {
  return `<div class="manage-jump">
    <div class="mj-icon">↗</div>
    <div class="mj-main"><b>管理页</b><span>类与实例的 CRUD、运行、批量操作与资源加载在独立管理页完成；设置页只保留策略与默认值。</span></div>
    <button class="btn" data-jump-manager>打开管理页 ↗</button>
  </div>`;
}

function layerTabsHTML(sec) {
  const cat = catalogFor(sec.id);
  if (!cat) return '';
  const total = catalogInstances(cat);
  const t = state.layerTab;
  return `<div class="layer-tabs">
    <button class="layer-tab ${t === 'settings' ? 'on' : ''}" data-layer-tab="settings">设置</button>
    <button class="layer-tab ${t === 'manage' ? 'on' : ''}" data-layer-tab="manage">管理 <span>${cat.classes.length} 类 · ${total} 实例</span></button>
  </div>`;
}

function renderSection() {
  const sec = sectionById(state.sectionId) || SECTIONS[0];
  if (sec.info) return renderInfo(sec);
  const dirty = sectionDirty(sec.id);
  const locks = sectionLocks(sec.id);
  $('#main').innerHTML = `
    <div class="section-head">
      <div class="section-icon" style="--cat:${sec.color}">${esc(sec.icon)}</div>
      <div class="section-text"><div class="section-kicker">${esc(sec.group)} / ${esc(sec.id)}</div><h1>${esc(sec.title)}</h1><p>${esc(sec.desc)}</p></div>
      <div class="section-actions"><span class="mini l${locks ? '2' : '1'}">${esc(state.scope)} scope</span>${dirty ? '<span class="mini restart">unsaved</span>' : ''}${locks ? `<span class="mini restart">${locks} locked</span>` : ''}</div>
    </div>
    ${isLayerSection(sec.id) ? managementJumpHTML(sec) : ''}
    ${state.scope === 'Policy' ? '<div class="policy-banner">Policy view · 只读。组织策略优先级最高；修改请切换到 User / Workspace / Machine scope，或联系管理员。</div>' : ''}
    ${sec.groups.map(g => {
      const visible = g.settings.filter(s => state.showAdvanced || !s.advanced);
      if (!visible.length) return '';
      return `<div class="group"><div class="group-head"><b>${esc(g.label)}</b><span>${esc(g.desc || '')}</span></div><div class="group-body">${visible.map(s => rowHTML(s, sec)).join('')}</div></div>`;
    }).join('')}
    <div class="section-foot">
      <label style="display:flex;align-items:center;gap:5px;font-size:8px;color:#8fa2bb;cursor:pointer"><input type="checkbox" data-show-advanced ${state.showAdvanced ? 'checked' : ''} style="accent-color:var(--cyan);width:12px;height:12px;margin:0"> Show advanced</label>
      <button class="btn" data-reset-section>Reset section</button>
      <span class="foot-note">effective value + source badge · policy 锁定项不可编辑</span>
    </div>`;
}

function renderInfo(sec) {
  $('#main').innerHTML = `
    <div class="section-head">
      <div class="section-icon" style="--cat:${sec.color}">${esc(sec.icon)}</div>
      <div class="section-text"><div class="section-kicker">Info / read only</div><h1>${esc(sec.title)}</h1><p>${esc(sec.desc)}</p></div>
      <div class="section-actions"><span class="mini l1">read only</span><span class="mini">v1.4.2</span></div>
    </div>
    <div class="info-grid">${INFO_CARDS.map(c => `<div class="info-card"><h3>${esc(c.icon)} ${esc(c.title)}</h3><div class="info-kv">${c.rows.map(([k, v]) => `<div class="k">${esc(k)}</div><div class="v">${esc(v)}</div>`).join('')}</div><div class="info-actions">${(c.actions || []).map(([label]) => `<button class="info-btn ${c.danger ? 'danger' : ''}" data-info-action="${esc(label)}">${esc(label)}</button>`).join('')}</div></div>`).join('')}</div>`;
}

function renderSearch() {
  const q = state.query.trim().toLowerCase();
  const matches = ALL_SETTINGS.filter(s => {
    const hay = [s.key, s.label, s.desc, ...(s.alias || []), ...(s.options || [])].join(' ').toLowerCase();
    return hay.includes(q);
  });
  const grouped = {};
  for (const s of matches) {
    const sec = SECTIONS.find(x => (x.groups || []).some(g => g.settings.includes(s)));
    if (!sec) continue;
    (grouped[sec.id] ||= []).push(s);
  }
  const catMatches = [];
  for (const layer of LAYER_IDS) {
    const cat = catalogFor(layer);
    if (!cat) continue;
    for (const c of cat.classes) {
      if ([c.id, c.name, c.group, c.summary, c.effect, c.status].join(' ').toLowerCase().includes(q)) {
        catMatches.push({ kind: 'class', layer, classId: c.id, label: c.name, sub: c.id, desc: c.summary, count: c.instances.length });
      }
      for (const ins of c.instances) {
        if ([ins.id, ins.name, ins.detail, c.id, c.name].join(' ').toLowerCase().includes(q)) {
          catMatches.push({ kind: 'instance', layer, classId: c.id, instanceId: ins.id, label: ins.name, sub: ins.id, desc: ins.detail, rev: ins.rev });
        }
      }
    }
  }
  const shownCat = catMatches.slice(0, 60);
  $('#main').innerHTML = `
    <div class="section-head"><div class="section-icon" style="--cat:#22d3ee">⌕</div><div class="section-text"><div class="section-kicker">Search / ${matches.length + catMatches.length} results</div><h1>搜索设置与层目录</h1><p>匹配 key、label、描述、alias、enum 选项，以及 PointClass / FlowClass / SurfaceClass / BodyClass / AIClass 与其实例。</p></div><div class="section-actions"><span class="mini">${esc(state.query)}</span></div></div>
    <div class="search-results">
      ${Object.entries(grouped).map(([id, list]) => {
        const sec = sectionById(id);
        if (!sec) return '';
        return `<div class="group"><div class="group-head"><b>${esc(sec.icon)} ${esc(sec.title)} · settings</b><span>${list.length} matches</span></div><div class="group-body">${list.map(s => {
          const cur = state.values[s.key];
          return `<div class="result" data-result="${esc(s.key)}"><div class="result-top"><span class="result-label">${esc(s.label)}</span><span class="result-key">${esc(s.key)}</span></div><div class="result-desc">${esc(s.desc)}</div><div style="margin-top:3px"><span class="src ${esc(cur.source)}">${esc(cur.source)}</span> <span class="mini">${esc(formatVal(s, cur.value))}</span></div></div>`;
        }).join('')}</div></div>`;
      }).join('')}
      ${shownCat.length ? `<div class="group"><div class="group-head"><b>Layer Catalog</b><span>${catMatches.length} matches${catMatches.length > 60 ? ' · showing 60' : ''}</span></div><div class="group-body">${shownCat.map(x => `<div class="result" data-cat-kind="${x.kind}" data-layer="${x.layer}" data-class="${esc(x.classId)}" data-instance="${esc(x.instanceId || '')}"><div class="result-top"><span class="result-label">${x.kind === 'class' ? '◆' : '·'} ${esc(x.label)}</span><span class="result-key">${esc(x.sub)}</span></div><div class="result-desc">${esc(x.desc || '')}</div><div style="margin-top:3px"><span class="mini l1">${x.kind === 'class' ? 'class' : 'instance'}</span> <span class="mini">${esc(LAYER_CATALOGS[x.layer].label)}</span>${x.count !== undefined ? `<span class="mini">${x.count} instances</span>` : `<span class="mini">r${x.rev}</span>`}</div></div>`).join('')}</div></div>` : ''}
      ${matches.length + catMatches.length ? '' : '<div class="empty">没有匹配的设置或层目录项。试试 “theme”、“timeout”、“vpn”、“ocr”、“agent” 或 “body”。</div>'}
    </div>`;
  $$('#main [data-result]').forEach(el => el.onclick = () => {
    const spec = settingById(el.dataset.result);
    const sec = SECTIONS.find(x => (x.groups || []).some(g => g.settings.includes(spec)));
    state.sectionId = sec.id;
    state.layerTab = 'settings';
    state.query = '';
    $('#search').value = '';
    state.highlightKey = spec.key;
    renderAll();
    setTimeout(() => { state.highlightKey = null; if (!state.query) renderSection(); }, 1600);
  });
  $$('#main [data-cat-kind]').forEach(el => el.onclick = () => {
    const layer = el.dataset.layer;
    const c = catalogFor(layer);
    const cls = c.classes.find(x => x.id === el.dataset.class);
    const inst = el.dataset.instance || cls?.instances[0]?.id || '';
    const hash = `#${layer}/${encodeURIComponent(el.dataset.class)}${inst ? '/' + encodeURIComponent(inst) : ''}`;
    window.location.href = `layer-management.html${hash}`;
  });
}

function renderMain() {
  if (state.query.trim()) return renderSearch();
  renderSection();
}

function catalogHeader(sec, cat, title, desc) {
  return `<div class="section-head">
    <div class="section-icon" style="--cat:${sec.color}">${esc(sec.icon)}</div>
    <div class="section-text"><div class="section-kicker">${esc(sec.group)} / ${esc(sec.id)} / ${esc(state.layerTab)}</div><h1>${esc(title)}</h1><p>${esc(desc)}</p></div>
    <div class="section-actions"><span class="mini l1">${cat.classes.length} classes</span><span class="mini">${catalogInstances(cat)} instances</span></div>
  </div>${layerTabsHTML(sec)}`;
}

function renderClassCatalog() {
  const sec = sectionById(state.sectionId);
  const cat = catalogFor(state.sectionId);
  if (!sec || !cat) return renderSection();
  ensureLayerSelection(state.sectionId);
  const groups = [...new Set(cat.classes.map(c => c.group))];
  $('#main').innerHTML = `${catalogHeader(sec, cat, `${sec.title} · 功能类`, `按 group 浏览 ${cat.classes.length} 个类；点击类查看实例与元数据。`)}
    <div class="cat-stats"><span class="mini l1">${cat.classes.length} classes</span><span class="mini">${catalogInstances(cat)} instances</span><span class="mini">${groups.length} groups</span><span class="foot-note" style="margin-left:auto">class = 契约 · instance = 绑定/参数</span></div>
    ${groups.map(g => {
      const list = cat.classes.filter(c => c.group === g);
      return `<div class="cat-group"><div class="cat-group-head">${esc(g)} <span>${list.length}</span></div><div class="cat-grid">${list.map(c => `<div class="cat-class ${c.id === state.selectedClassId ? 'on' : ''}" data-cat-class="${esc(c.id)}">
        <div class="cc-top"><span class="cc-id">${esc(c.id)}</span><span class="cc-status ${esc(c.status)}">${esc(c.status)}</span></div>
        <div class="cc-name">${esc(c.name)}</div>
        <div class="cc-desc">${esc(c.summary || '')}</div>
        <div class="cc-meta"><span class="cat-badge">${esc(c.group)}</span><span class="cat-badge">${esc(c.effect || 'L0')}</span><span class="cat-badge">${c.instances.length} inst</span><span class="cat-badge">v${esc(c.version || '1.0.0')}</span></div>
      </div>`).join('')}</div></div>`;
    }).join('')}`;
  $$('#main [data-cat-class]').forEach(el => el.onclick = () => {
    const c = cat.classes.find(x => x.id === el.dataset.catClass);
    state.selectedClassId = c.id;
    state.selectedInstanceId = c.instances[0]?.id || null;
    renderClassCatalog();
    renderLayerInspector();
  });
}

function renderInstanceCatalog() {
  const sec = sectionById(state.sectionId);
  const cat = catalogFor(state.sectionId);
  if (!sec || !cat) return renderSection();
  ensureLayerSelection(state.sectionId);
  if (state.filterClass !== 'all' && !cat.classes.some(c => c.id === state.filterClass)) state.filterClass = 'all';
  const classes = state.filterClass === 'all' ? cat.classes : cat.classes.filter(c => c.id === state.filterClass);
  const list = classes.flatMap(c => c.instances.map(ins => ({ ...ins, classId: c.id, className: c.name, group: c.group })));
  $('#main').innerHTML = `${catalogHeader(sec, cat, `${sec.title} · 实例`, `按类筛选实例；点击行查看 revision、状态与绑定。`)}
    <div class="cat-toolbar"><span class="mini l1">${list.length} shown</span><select data-class-filter><option value="all">All classes</option>${cat.classes.map(c => `<option value="${esc(c.id)}" ${state.filterClass === c.id ? 'selected' : ''}>${esc(c.id)}</option>`).join('')}</select><span class="foot-note">instance id · class · revision · status</span></div>
    <div class="cat-table-wrap"><table class="cat-table"><thead><tr><th>Instance</th><th>Class</th><th>Rev</th><th>Status</th><th>Detail</th></tr></thead><tbody>${list.map(ins => `<tr data-cat-instance="${esc(ins.id)}" data-cat-class="${esc(ins.classId)}" class="${ins.id === state.selectedInstanceId ? 'on' : ''}"><td class="mono">${esc(ins.id)}</td><td class="mono">${esc(ins.classId)}</td><td>r${ins.rev}</td><td><span class="status ${esc(ins.status)}">${esc(ins.status)}</span></td><td class="muted">${esc(ins.detail || '')}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">No instances.</td></tr>'}</tbody></table></div>`;
  $$('#main [data-cat-instance]').forEach(el => el.onclick = () => {
    state.selectedClassId = el.dataset.catClass;
    state.selectedInstanceId = el.dataset.catInstance;
    renderInstanceCatalog();
    renderLayerInspector();
  });
}

function renderLayerManagement() {
  const sec = sectionById(state.sectionId);
  const cat = catalogFor(state.sectionId);
  if (!sec || !cat) return renderSection();
  ensureLayerSelection(state.sectionId);
  const stable = cat.classes.filter(c => c.status === 'stable').length;
  const draft = cat.classes.filter(c => c.status === 'draft').length;
  const archived = cat.classes.filter(c => c.status === 'archived').length;
  const total = catalogInstances(cat);
  const expanded = state.expandedClasses || (state.expandedClasses = new Set());
  const rows = cat.classes.map(c => {
    const open = expanded.has(c.id);
    const selected = c.id === state.selectedClassId;
    const instRows = open ? c.instances.map(i => `<tr class="mgmt-inst-row ${i.id === state.selectedInstanceId ? 'on' : ''}" data-mgmt-inst="${esc(i.id)}" data-mgmt-class="${esc(c.id)}">
      <td><span class="mgmt-indent">└</span><span class="mgmt-inst-name">${esc(i.name)}</span><span class="mono mgmt-inst-id">${esc(i.id)}</span></td>
      <td>${esc(c.group)}</td><td><span class="mgmt-status ${esc(i.status)}">${esc(i.status)}</span></td><td>${esc(c.effect || 'L0')}</td><td>r${i.rev}</td><td class="mgmt-detail">${esc(i.detail || '')}</td>
    </tr>`).join('') : '';
    return `<tr class="mgmt-cls-row ${selected ? 'on' : ''}" data-mgmt-class="${esc(c.id)}">
      <td><span class="mgmt-chev">${open ? '▾' : '▸'}</span><b>${esc(c.name)}</b><div class="mono mgmt-cls-id">${esc(c.id)}</div></td>
      <td>${esc(c.group)}</td><td><span class="mgmt-status ${esc(c.status)}">${esc(c.status)}</span></td><td>${esc(c.effect || 'L0')}</td><td>${c.instances.length}</td><td class="mgmt-detail">${esc(c.summary || '')}</td>
    </tr>${instRows}`;
  }).join('');
  $('#main').innerHTML = `${catalogHeader(sec, cat, `${sec.title} · 管理`, '类与实例合并在一张表；展开类查看实例，点击行打开右侧 Inspector。')}
    <div class="mgmt-summary"><span class="mini l1">${cat.classes.length} classes</span><span class="mini">${total} instances</span><span class="mini">${stable} stable</span><span class="mini">${draft} draft</span><span class="mini">${archived} archived</span><span class="foot-note" style="margin-left:auto">设置与管理两个 tab；不再拆功能类/实例 tab</span></div>
    <div class="mgmt-toolbar"><button class="btn" data-expand-all>展开全部类</button><button class="btn" data-collapse-all>收起全部</button><button class="btn" data-open-manager>打开完整管理页</button><span class="foot-note" style="margin-left:auto">类行 → 选中类；实例行 → 选中实例</span></div>
    <div class="mgmt-table-wrap"><table class="mgmt-combined"><thead><tr><th>类 / 实例</th><th>Group</th><th>Status</th><th>Effect</th><th>Inst</th><th>Summary / Detail</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="empty">No classes.</td></tr>'}</tbody></table></div>`;
  $$('#main [data-mgmt-class]').forEach(el => el.onclick = (e) => {
    if (el.dataset.mgmtInst) {
      state.selectedClassId = el.dataset.mgmtClass;
      state.selectedInstanceId = el.dataset.mgmtInst;
      state.expandedClasses.add(state.selectedClassId);
    } else {
      state.selectedClassId = el.dataset.mgmtClass;
      const c = cat.classes.find(x => x.id === state.selectedClassId);
      state.selectedInstanceId = c?.instances[0]?.id || null;
      if (state.expandedClasses.has(state.selectedClassId)) state.expandedClasses.delete(state.selectedClassId); else state.expandedClasses.add(state.selectedClassId);
    }
    renderLayerManagement();
    renderLayerInspector();
  });
  $$('#main [data-expand-all]').forEach(b => b.onclick = () => { cat.classes.forEach(c => state.expandedClasses.add(c.id)); renderLayerManagement(); });
  $$('#main [data-collapse-all]').forEach(b => b.onclick = () => { state.expandedClasses.clear(); renderLayerManagement(); });
  $$('#main [data-open-manager]').forEach(b => b.onclick = () => openManager());
}

function openManager() {
  if (state.sectionId === 'point') {
    try { window.open('atom-catalog-management.html', '_blank', 'noopener'); } catch (_) { toast('打开点层管理页'); }
    toast('打开点层管理页：atom-catalog-management.html');
  } else {
    toast(`${catalogFor(state.sectionId)?.label || state.sectionId} 管理页 · registry / body manager（模拟）`);
  }
}

function renderLayerInspector() {
  const cat = catalogFor(state.sectionId);
  if (!cat) return renderChanges();
  ensureLayerSelection(state.sectionId);
  const c = currentClass();
  const ins = currentInstance();
  if (!c) { $('#changes').innerHTML = '<div class="empty">No class selected.</div>'; return; }
  const instances = c.instances.slice(0, 14);
  $('#changes').innerHTML = `
    <div class="ch-head"><b>Layer Inspector</b><span class="ch-count">${esc(cat.label)}</span></div>
    <div class="cat-insp">
      <div class="cat-insp-kicker">${esc(c.group)} · ${esc(c.status || 'active')}</div>
      <div class="cat-insp-id">${esc(c.id)}</div>
      <div class="cat-insp-name">${esc(c.name)}</div>
      <div class="cat-insp-desc">${esc(c.summary || '')}</div>
      <div class="cat-stats" style="margin-top:7px"><span class="mini">${esc(c.effect || 'L0')}</span><span class="mini">${esc(c.priority || 'P1')}</span><span class="mini">${c.instances.length} inst</span><span class="mini">v${esc(c.version || '1.0.0')}</span></div>
      <div class="ch-actions"><button class="btn" data-open-layer-settings>设置</button><button class="btn" data-open-manager>管理页</button></div>
      <div class="lh" style="margin-top:11px">Instances · ${c.instances.length}</div>
      <div class="cat-instance-list">${instances.map(i => `<button class="cat-inst-btn ${i.id === ins?.id ? 'on' : ''}" data-insp-inst="${esc(i.id)}"><span>${esc(i.id)}</span><span>r${i.rev}</span></button>`).join('') || '<div class="empty">No instances.</div>'}${c.instances.length > instances.length ? `<div class="foot-note">+${c.instances.length - instances.length} more</div>` : ''}</div>
      ${ins ? `<div class="cat-inst-detail"><div class="lh">Selected instance</div><div class="mono" style="font-size:7.5px;color:#a5f3fc;word-break:break-all">${esc(ins.id)}</div><div class="foot-note" style="margin-top:4px">r${ins.rev} · ${esc(ins.status)}</div><div class="cat-detail-text">${esc(ins.detail || '')}</div></div>` : ''}
    </div>`;
  $$('#changes [data-open-layer-settings]').forEach(b => b.onclick = () => { state.layerTab = 'settings'; renderAll(); });
  $$('#changes [data-open-manager]').forEach(b => b.onclick = openManager);
  $$('#changes [data-insp-inst]').forEach(b => b.onclick = () => {
    state.selectedInstanceId = b.dataset.inspInst;
    if (state.layerTab === 'manage') renderLayerManagement();
    renderLayerInspector();
  });
}

function renderChanges() {
  const keys = dirtyKeys();
  const restart = [...new Set(keys.map(k => settingById(k)?.restart).filter(Boolean))];
  const rows = keys.map(k => {
    const s = settingById(k);
    const from = state.saved[k]?.value;
    const to = state.values[k]?.value;
    return `<div class="ch-row"><span class="ch-label">${esc(s.label)}</span><span class="ch-diff"><span class="from">${esc(formatVal(s, from))}</span> → <span class="to">${esc(formatVal(s, to))}</span></span></div>`;
  }).join('');
  $('#changes').innerHTML = `
    <div class="ch-head"><b>Changes</b><span class="ch-count">${keys.length} unsaved</span></div>
    ${keys.length ? `<div class="ch-list">${rows}</div>` : '<div class="empty">No unsaved changes.</div>'}
    <div class="ch-actions"><button class="btn primary" data-apply ${keys.length ? '' : 'disabled'}>Apply</button><button class="btn" data-discard ${keys.length ? '' : 'disabled'}>Discard</button></div>
    ${restart.length || state.restartPending.length ? `<div class="restart-box">Restart required: ${esc([...new Set([...restart, ...state.restartPending])].join(' / '))}${state.restartPending.length ? ' · applied, pending restart' : ''}</div>` : ''}`;
  $$('#changes [data-apply]').forEach(b => b.onclick = applyChanges);
  $$('#changes [data-discard]').forEach(b => b.onclick = discardChanges);
}

function renderStatus() {
  const n = dirtyKeys().length;
  const errs = 0;
  $('#statusLeft').textContent = `Settings · ${state.scope} scope · ${n ? n + ' unsaved' : 'clean'} · ${errs} errors`;
  $('#statusRight').textContent = state.restartPending.length ? `restart required: ${state.restartPending.join('/')}` : 'v1.4.2 · build 2026.11.23';
  $('#changes').classList.toggle('dirty', n > 0);
}

function renderAll() {
  renderHeader(); renderNav(); renderMain(); renderChanges(); renderStatus();
}

/* ============================================================
   变更
   ============================================================ */
function setValue(key, value) {
  if (state.scope === 'Policy') return;
  const spec = settingById(key);
  if (!spec || state.values[key]?.source === 'policy') return;
  state.values[key] = { value, source: state.scope.toLowerCase() };
  state.highlightKey = null;
  renderAll();
}

function resetKey(key) {
  const spec = settingById(key);
  if (!spec || state.values[key]?.source === 'policy' || state.scope === 'Policy') return;
  state.values[key] = { value: spec.default, source: 'default' };
  renderAll();
}

function resetSection() {
  if (state.scope === 'Policy') return;
  const sec = sectionById(state.sectionId);
  for (const s of sectionSettings(sec.id)) {
    if (state.values[s.key]?.source !== 'policy') state.values[s.key] = { value: s.default, source: 'default' };
  }
  renderAll();
  toast('Section reset to defaults');
}

function applyChanges() {
  if (state.scope === 'Policy') return;
  const restart = [...new Set(dirtyKeys().map(k => settingById(k)?.restart).filter(Boolean))];
  state.restartPending = [...new Set([...state.restartPending, ...restart])];
  state.saved = clone(state.values);
  renderAll();
  toast(restart.length ? `Applied · restart ${restart.join('/')} required` : 'Settings applied');
}

function discardChanges() {
  state.values = clone(state.saved);
  state.restartPending = [];
  renderAll();
  toast('Changes discarded');
}

function exportSettings() {
  const out = { schema: 1, scope: state.scope, values: {}, secrets: {} };
  for (const s of ALL_SETTINGS) {
    const v = state.values[s.key];
    if (s.secret) out.secrets[s.key] = v.value ? 'secretRef' : null;
    else out.values[s.key] = v.value;
  }
  copyText(JSON.stringify(out, null, 2), 'Settings exported (secrets as refs only)');
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => t.classList.remove('show'), 1700);
}

function copyText(text, label) {
  const done = () => toast(label || '已复制');
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  else fallbackCopy(text, done);
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

/* ============================================================
   事件
   ============================================================ */
function init() {
  try {
    const hash = decodeURIComponent((location.hash || '').replace(/^#/, ''));
    if (hash && SECTIONS.some(s => s.id === hash)) state.sectionId = hash;
  } catch (_) {}
  $('#sectionSel').innerHTML = SECTIONS.map(s => `<option value="${esc(s.id)}">${esc(s.title)}</option>`).join('');
  $('#sectionSel').addEventListener('change', e => { state.sectionId = e.target.value; state.layerTab = 'settings'; state.filterClass = 'all'; state.query = ''; $('#search').value = ''; if (isLayerSection(state.sectionId)) ensureLayerSelection(state.sectionId); renderAll(); });

  $('#scopeSel').addEventListener('change', e => {
    state.scope = e.target.value;
    renderAll();
    toast(`Scope: ${state.scope}${state.scope === 'Policy' ? ' · read only' : ''}`);
  });
  $('#search').addEventListener('input', e => {
    state.query = e.target.value;
    renderMain();
  });
  $('#applyBtn').addEventListener('click', applyChanges);
  $('#moreBtn').addEventListener('click', e => { e.stopPropagation(); $('#moreMenu').classList.toggle('on'); });
  document.addEventListener('click', e => { if (!e.target.closest('#moreMenu') && !e.target.closest('#moreBtn')) $('#moreMenu').classList.remove('on'); });
  $('#moreMenu').addEventListener('click', e => {
    const b = e.target.closest('[data-more]');
    if (!b) return;
    $('#moreMenu').classList.remove('on');
    if (b.dataset.more === 'import') toast('Import: schema validation → diff preview → apply');
    if (b.dataset.more === 'export') exportSettings();
    if (b.dataset.more === 'close') toast(dirtyKeys().length ? 'Unsaved changes · Apply or Discard first' : 'Close settings');
  });

  $('#main').addEventListener('change', e => {
    const cf = e.target.closest('[data-class-filter]');
    if (cf) { state.filterClass = cf.value; renderInstanceCatalog(); return; }
    const adv = e.target.closest('[data-show-advanced]');
    if (adv) { state.showAdvanced = adv.checked; renderMain(); return; }
    const el = e.target.closest('[data-key]');
    if (!el) return;
    const spec = settingById(el.dataset.key);
    let val = el.type === 'checkbox' ? el.checked : el.value;
    if (spec.type === 'number') val = Number(val);
    setValue(el.dataset.key, val);
  });
  $('#main').addEventListener('click', e => {
    const jump = e.target.closest('[data-jump-manager]');
    if (jump) { window.location.href = managerUrlFor(state.sectionId); return; }
    const lt = e.target.closest('[data-layer-tab]');
    if (lt) {
      state.layerTab = lt.dataset.layerTab;
      state.filterClass = 'all';
      state.query = '';
      $('#search').value = '';
      ensureLayerSelection(state.sectionId);
      renderAll();
      return;
    }
    const reset = e.target.closest('[data-reset]');
    if (reset) { resetKey(reset.dataset.reset); return; }
    const resetSec = e.target.closest('[data-reset-section]');
    if (resetSec) { resetSection(); return; }
    const secret = e.target.closest('[data-secret]');
    if (secret) { toast('Credential dialog: value stored in OS credential vault, never shown'); return; }
    const info = e.target.closest('[data-info-action]');
    if (info) { toast(`${info.textContent.trim()} · simulated`); return; }
  });
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      $('#search').focus();
    }
    if (e.key === 'Escape') {
      if (document.activeElement === $('#search')) {
        state.query = '';
        $('#search').value = '';
        $('#search').blur();
        renderMain();
      } else {
        toast(dirtyKeys().length ? 'Unsaved changes · Apply or Discard first' : 'Close settings');
      }
    }
  });

  renderAll();
}

init();
})();
