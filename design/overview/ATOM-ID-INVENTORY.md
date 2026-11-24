# Atom 命名全量清单

> 由 `scripts/gen-atom-inventory.py` 生成。规则见 `design/overview/NAMING-CONVENTIONS.md` 与 `atomId.ts`。
> 格式：`层名.类名.实例名@rN`（3 段定长，全小写，段内不许有点）

共 **5 层 / 102 类 / 287 实例**，新 id 冲突 **0**。

## 点层 `point`（21 类 / 48 实例）

| 现在类 id | 统一后 | family | 实例（统一后） |
|---|---|---|---|
| `win.key.send` | `point.key_send` | hotkey | copy · paste · cut · undo · select_all |
| `win.key.trigger` | `point.key_trigger` | hotkey | panel · shot |
| `win.window.control` | `point.window_control` | window | focus_notepad · move_chrome · topmost · close_explorer |
| `win.window.query` | `point.window_query` | window | list_windows · foreground |
| `win.open` | `point.open` | open | downloads · github · project |
| `win.audio.volume` | `point.audio_volume` | settings | vol_up · vol_toggle · vol_30 |
| `win.display.brightness` | `point.display_brightness` | settings | bright_60 · bright_up |
| `win.theme.mode` | `point.theme_mode` | settings | dark · light_apps |
| `win.ocr.read` | `point.ocr_read` | capture | auto · ocr_en |
| `win.clipboard.get` | `point.clipboard_get` | file | clip_text · clip_image |
| `win.http.request` | `point.http_request` | network | github · webhook |
| `ui.form` | `point.ui_form` | human | confirm |
| `win.screen.capture` | `point.screen_capture` | capture | full · region |
| `text.template` | `point.text_template` | transform | markdown · plain |
| `file.write` | `point.file_write` | file | append · overwrite |
| `file.move` | `point.file_move` | file | rename · move · archive |
| `file.read` | `point.file_read` | file | text · preview |
| `notify.toast` | `point.notify_toast` | notify | system |
| `file.scan` | `point.file_scan` | file | recursive · flat |
| `clipboard.write` | `point.clipboard_write` | file | text · uppercase |
| `translate.text` | `point.translate_text` | text | en2zh · auto |

## 线层 `line`（13 类 / 32 实例）

| 现在类 id | 统一后 | family | 实例（统一后） |
|---|---|---|---|
| `flow.ensure-vpn` | `line.ensure_vpn` | Guard | ask · auto · auto_connect · manual |
| `flow.ensure-app` | `line.ensure_app` | Guard | vscode · notepad |
| `flow.ensure-service` | `line.ensure_service` | Guard | docker · local_api |
| `flow.ensure-download` | `line.ensure_download` | Guard | vscode · driver |
| `flow.open-external-site` | `line.open_external_site` | Action | youtube · github · google · intranet |
| `flow.open-app` | `line.open_app` | Action | vscode_project · notepad_file |
| `flow.open-workspace` | `line.open_workspace` | Action | dev · meeting |
| `flow.clipboard-to-file` | `line.clipboard_to_file` | Action | inbox · daily |
| `flow.screenshot-translate` | `line.screenshot_translate` | Action | en_zh · ja_zh |
| `flow.http-extract` | `line.http_extract` | Action | github_status · weather |
| `flow.ai-rewrite` | `line.ai_rewrite` | Action | formal · shorten · translate |
| `flow.batch-archive` | `line.batch_archive` | Action | invoice_company · invoice_personal |
| `flow.approval-action` | `line.approval_action` | Action | publish · delete · deploy |

## 面层 `surface`（16 类 / 46 实例）

| 现在类 id | 统一后 | family | 实例（统一后） |
|---|---|---|---|
| `surface.form` | `surface.form` | input | settings_vpn · settings_general · point_params · settings_system_monitor |
| `surface.wizard` | `surface.wizard` | input | new_flow · vpn_setup |
| `surface.inspector` | `surface.inspector` | input | point · slot_vpn · run_node |
| `surface.table` | `surface.table` | browse | point_catalog · flow_instances · run_history_table |
| `surface.card-grid` | `surface.card_grid` | browse | site_launcher · body_market · flow_gallery |
| `surface.tree` | `surface.tree` | browse | point_domains · flow_outline |
| `surface.command-palette` | `surface.command_palette` | browse | global · points |
| `surface.canvas` | `surface.canvas` | visualize | flow_editor · body_composer |
| `surface.dashboard` | `surface.dashboard` | visualize | system · vpn · system_monitor |
| `surface.run-history` | `surface.run_history` | visualize | flow · vpn |
| `surface.diff` | `surface.diff` | visualize | flow_version · instance_revision |
| `surface.dialog` | `surface.dialog` | communicate | vpn_approval · delete_confirm · deploy_approval |
| `surface.notification` | `surface.notification` | communicate | vpn · run · download · system_threshold |
| `surface.tray-menu` | `surface.tray_menu` | communicate | quick_actions · vpn · system_status |
| `surface.hud` | `surface.hud` | communicate | translate · vpn_status · system_status |
| `surface.metric-card` | `surface.metric_card` | visualize | cpu · gpu · memory · network · disk |

## 体层 `body`（29 类 / 82 实例）

| 现在类 id | 统一后 | family | 实例（统一后） |
|---|---|---|---|
| `body.file-preview` | `body.file_preview` | content | text · markdown · image · pdf · video · audio |
| `body.ocr` | `body.ocr` | content | text · math · qr · table · handwriting |
| `body.image-resizer` | `body.image_resizer` | content | web · thumbnail · avatar · email |
| `body.batch-rename` | `body.batch_rename` | content | regex · sequence · date_prefix · extension_normalize |
| `body.pdf-toolkit` | `body.pdf_toolkit` | content | merge · split · compress · rotate |
| `body.media-converter` | `body.media_converter` | content | image · video · audio |
| `body.file-organizer` | `body.file_organizer` | content | downloads · screenshots · duplicates |
| `body.advanced-paste` | `body.advanced_paste` | clipboard | plain · markdown · json · ai |
| `body.clipboard-history` | `body.clipboard_history` | clipboard | recent · pinned |
| `body.color-picker` | `body.color_picker` | clipboard | hex · palette |
| `body.screen-ruler` | `body.screen_ruler` | clipboard | px · inches · angle |
| `body.window-layout` | `body.window_layout` | window | dev · meeting · ultrawide |
| `body.always-on-top` | `body.always_on_top` | window | window · region |
| `body.awake` | `body.awake` | system | 30m · until · while_app |
| `body.workspace` | `body.workspace` | window | dev · meeting · writing |
| `body.quick-launch` | `body.quick_launch` | window | dock · palette |
| `body.system-monitor` | `body.system_monitor` | system | desktop · minimal |
| `body.service-health` | `body.service_health` | system | docker · local_api · vpn |
| `body.file-locksmith` | `body.file_locksmith` | system | process · handle |
| `body.hosts-editor` | `body.hosts_editor` | system | local · blocklist |
| `body.env-vars` | `body.env_vars` | system | user · path |
| `body.external-access` | `body.external_access` | web | work · personal |
| `body.screenshot-translate` | `body.screenshot_translate` | ai | en_zh · ja_zh |
| `body.ai-rewrite` | `body.ai_rewrite` | ai | formal · shorten · translate |
| `body.meeting-notes` | `body.meeting_notes` | ai | local · cloud |
| `body.invoice-archive` | `body.invoice_archive` | content | company · personal |
| `body.suite` | `body.suite` | suite | office · dev |
| `body.web-clipper` | `body.web_clipper` | web | selection · page · readability |
| `body.backup-sync` | `body.backup_sync` | system | folder · daily |

## 场层 `field`（23 类 / 79 实例）

| 现在类 id | 统一后 | family | 实例（统一后） |
|---|---|---|---|
| `field.observe` | `field.observe` | perceive | desktop · selection · run_history |
| `field.classify` | `field.classify` | understand | intent · file_type · ocr_mode · error_kind |
| `field.prefill` | `field.prefill` | perceive | point_params · vpn_profile · ocr_language · rename_pattern · search_query · landing_demo |
| `field.rank` | `field.rank` | perceive | scene_grid · command_palette · body_market · ocr_mode |
| `field.recommend` | `field.recommend` | perceive | next_action · body · template |
| `field.detect` | `field.detect` | perceive | repetition · anomaly · opportunity |
| `field.generate` | `field.generate` | generate | point_action · flow · surface_layout · body_manifest |
| `field.compose` | `field.compose` | generate | flow_from_points · surface_from_data · body_from_flows |
| `field.plan` | `field.plan` | generate | single_app · cross_app · batch |
| `field.translate` | `field.translate` | generate | nl_to_dsl · dsl_to_nl · error_to_human |
| `field.summarize` | `field.summarize` | generate | run_history · context · document |
| `field.diagnose` | `field.diagnose` | evolve | flow_failure · uia_timeout · vpn_unreachable · ocr_low_confidence |
| `field.repair` | `field.repair` | evolve | flow_patch · selector_patch · settings_patch · permission_fix |
| `field.mine` | `field.mine` | evolve | action_sequence · flow_template · body_candidate |
| `field.learn` | `field.learn` | evolve | ranking · prefill · threshold |
| `field.personalize` | `field.personalize` | evolve | shortcut · layout · defaults |
| `field.critique` | `field.critique` | evolve | flow · body · permission |
| `field.route` | `field.route` | govern | model · tool · body |
| `field.guard` | `field.guard` | govern | risk · permission · confidence · privacy |
| `field.ask` | `field.ask` | govern | clarify · confirm · choose |
| `field.explain` | `field.explain` | govern | suggestion · point_run · flow_run · permission |
| `field.simulate` | `field.simulate` | govern | dry_run · impact · rollback |
| `field.memory` | `field.memory` | govern | preference · episodic · knowledge |

## 完整实例清单

| 现在 | 统一后 | 名称 |
|---|---|---|
| `win.key.send.i-copy@r1` | `point.key_send.copy@r1` | 复制 |
| `win.key.send.i-paste@r1` | `point.key_send.paste@r1` | 粘贴 |
| `win.key.send.i-cut@r1` | `point.key_send.cut@r1` | 剪切 |
| `win.key.send.i-undo@r1` | `point.key_send.undo@r1` | 撤销 |
| `win.key.send.i-select-all@r1` | `point.key_send.select_all@r1` | 全选 |
| `win.key.trigger.i-trigger-panel@r1` | `point.key_trigger.panel@r1` | 打开面板 |
| `win.key.trigger.i-trigger-shot@r1` | `point.key_trigger.shot@r1` | 截图翻译 |
| `win.window.control.i-focus-notepad@r1` | `point.window_control.focus_notepad@r1` | 聚焦记事本 |
| `win.window.control.i-move-chrome@r1` | `point.window_control.move_chrome@r1` | Chrome 移到副屏左半 |
| `win.window.control.i-topmost@r1` | `point.window_control.topmost@r1` | 当前窗口置顶切换 |
| `win.window.control.i-close-explorer@r1` | `point.window_control.close_explorer@r1` | 关闭所有资源管理器 |
| `win.window.query.i-list-windows@r1` | `point.window_query.list_windows@r1` | 列出可见窗口 |
| `win.window.query.i-foreground@r1` | `point.window_query.foreground@r1` | 当前前台窗口 |
| `win.open.i-open-downloads@r1` | `point.open.downloads@r1` | 打开下载文件夹 |
| `win.open.i-open-github@r1` | `point.open.github@r1` | 打开 GitHub |
| `win.open.i-open-project@r1` | `point.open.project@r1` | 用 VS Code 打开项目 |
| `win.audio.volume.i-vol-up@r1` | `point.audio_volume.vol_up@r1` | 音量 +5 |
| `win.audio.volume.i-vol-toggle@r1` | `point.audio_volume.vol_toggle@r1` | 静音切换 |
| `win.audio.volume.i-vol-30@r1` | `point.audio_volume.vol_30@r1` | 设 30% |
| `win.display.brightness.i-bright-60@r1` | `point.display_brightness.bright_60@r1` | 内屏亮度 60% |
| `win.display.brightness.i-bright-up@r1` | `point.display_brightness.bright_up@r1` | 亮度 +10 |
| `win.theme.mode.i-dark@r1` | `point.theme_mode.dark@r1` | 深色模式 |
| `win.theme.mode.i-light-apps@r1` | `point.theme_mode.light_apps@r1` | 应用浅色 |
| `win.ocr.read.i-ocr-auto@r1` | `point.ocr_read.auto@r1` | 截图转文字 |
| `win.ocr.read.i-ocr-en@r1` | `point.ocr_read.ocr_en@r1` | 英文截图 |
| `win.clipboard.get.i-clip-text@r1` | `point.clipboard_get.clip_text@r1` | 取文本 |
| `win.clipboard.get.i-clip-image@r1` | `point.clipboard_get.clip_image@r1` | 取图片 |
| `win.http.request.i-http-github@r1` | `point.http_request.github@r1` | GET GitHub API |
| `win.http.request.i-http-webhook@r1` | `point.http_request.webhook@r1` | POST Webhook |
| `ui.form.i-form-confirm@r1` | `point.ui_form.confirm@r1` | 发布确认 |
| `win.screen.capture.i-full@r1` | `point.screen_capture.full@r1` | 全屏截图 |
| `win.screen.capture.i-region@r1` | `point.screen_capture.region@r1` | 区域截图 |
| `text.template.i-markdown@r1` | `point.text_template.markdown@r1` | Markdown 代码块 |
| `text.template.i-plain@r1` | `point.text_template.plain@r1` | 纯文本 |
| `file.write.i-append@r1` | `point.file_write.append@r1` | 追加写入 |
| `file.write.i-overwrite@r1` | `point.file_write.overwrite@r1` | 覆盖写入 |
| `file.move.i-rename@r1` | `point.file_move.rename@r1` | i-rename |
| `file.move.i-move@r1` | `point.file_move.move@r1` | i-move |
| `file.move.i-archive@r1` | `point.file_move.archive@r1` | i-archive |
| `file.read.i-text@r1` | `point.file_read.text@r1` | i-text |
| `file.read.i-preview@r1` | `point.file_read.preview@r1` | i-preview |
| `notify.toast.i-system@r1` | `point.notify_toast.system@r1` | 系统通知 |
| `file.scan.i-recursive@r1` | `point.file_scan.recursive@r1` | i-recursive |
| `file.scan.i-flat@r1` | `point.file_scan.flat@r1` | i-flat |
| `clipboard.write.i-text@r1` | `point.clipboard_write.text@r1` | i-text |
| `clipboard.write.i-uppercase@r1` | `point.clipboard_write.uppercase@r1` | i-uppercase |
| `translate.text.i-en2zh@r1` | `point.translate_text.en2zh@r1` | i-en2zh |
| `translate.text.i-auto@r1` | `point.translate_text.auto@r1` | i-auto |
| `inst.ensure-vpn-ask@r2` | `line.ensure_vpn.ask@r2` | ensure-vpn-ask |
| `inst.ensure-vpn-auto@r1` | `line.ensure_vpn.auto@r1` | ensure-vpn-auto |
| `inst.ensure-vpn-auto-connect@r1` | `line.ensure_vpn.auto_connect@r1` | ensure-vpn-auto-connect |
| `inst.ensure-vpn-manual@r1` | `line.ensure_vpn.manual@r1` | ensure-vpn-manual |
| `inst.ensure-app-vscode@r2` | `line.ensure_app.vscode@r2` | ensure-app-vscode |
| `inst.ensure-app-notepad@r1` | `line.ensure_app.notepad@r1` | ensure-app-notepad |
| `inst.ensure-service-docker@r1` | `line.ensure_service.docker@r1` | ensure-service-docker |
| `inst.ensure-service-local-api@r1` | `line.ensure_service.local_api@r1` | ensure-service-local-api |
| `inst.ensure-download-vscode@r2` | `line.ensure_download.vscode@r2` | ensure-download-vscode |
| `inst.ensure-download-driver@r1` | `line.ensure_download.driver@r1` | ensure-download-driver |
| `inst.site-youtube@r3` | `line.open_external_site.youtube@r3` | site-youtube |
| `inst.site-github@r1` | `line.open_external_site.github@r1` | site-github |
| `inst.site-google@r1` | `line.open_external_site.google@r1` | site-google |
| `inst.site-intranet@r1` | `line.open_external_site.intranet@r1` | site-intranet |
| `inst.open-app-vscode-project@r2` | `line.open_app.vscode_project@r2` | open-app-vscode-project |
| `inst.open-app-notepad-file@r1` | `line.open_app.notepad_file@r1` | open-app-notepad-file |
| `inst.workspace-dev@r3` | `line.open_workspace.dev@r3` | workspace-dev |
| `inst.workspace-meeting@r1` | `line.open_workspace.meeting@r1` | workspace-meeting |
| `inst.clipboard-inbox@r3` | `line.clipboard_to_file.inbox@r3` | clipboard-inbox |
| `inst.clipboard-daily@r2` | `line.clipboard_to_file.daily@r2` | clipboard-daily |
| `inst.screenshot-en-zh@r4` | `line.screenshot_translate.en_zh@r4` | screenshot-en-zh |
| `inst.screenshot-ja-zh@r2` | `line.screenshot_translate.ja_zh@r2` | screenshot-ja-zh |
| `inst.http-github-status@r2` | `line.http_extract.github_status@r2` | http-github-status |
| `inst.http-weather@r1` | `line.http_extract.weather@r1` | http-weather |
| `inst.ai-rewrite-formal@r2` | `line.ai_rewrite.formal@r2` | ai-rewrite-formal |
| `inst.ai-rewrite-shorten@r1` | `line.ai_rewrite.shorten@r1` | ai-rewrite-shorten |
| `inst.ai-rewrite-translate@r1` | `line.ai_rewrite.translate@r1` | ai-rewrite-translate |
| `inst.invoice-company@r6` | `line.batch_archive.invoice_company@r6` | invoice-company |
| `inst.invoice-personal@r2` | `line.batch_archive.invoice_personal@r2` | invoice-personal |
| `inst.approval-publish@r1` | `line.approval_action.publish@r1` | approval-publish |
| `inst.approval-delete@r1` | `line.approval_action.delete@r1` | approval-delete |
| `inst.approval-deploy@r1` | `line.approval_action.deploy@r1` | approval-deploy |
| `surface.settings.vpn` | `surface.form.settings_vpn@r3` | VPN 设置 |
| `surface.settings.general` | `surface.form.settings_general@r2` | 通用设置 |
| `surface.point-params` | `surface.form.point_params@r1` | 点实例参数 |
| `surface.settings.system-monitor` | `surface.form.settings_system_monitor@r2` | 系统监控设置 |
| `surface.wizard.new-flow` | `surface.wizard.new_flow@r1` | 新建流程 |
| `surface.wizard.vpn-setup` | `surface.wizard.vpn_setup@r1` | VPN 首次配置 |
| `surface.inspector.point` | `surface.inspector.point@r4` | 点检查器 |
| `surface.inspector.slot-vpn` | `surface.inspector.slot_vpn@r2` | VPN 槽位检查器 |
| `surface.inspector.run-node` | `surface.inspector.run_node@r1` | 运行节点检查器 |
| `surface.point-catalog` | `surface.table.point_catalog@r5` | 点目录 |
| `surface.flow-instances` | `surface.table.flow_instances@r3` | 线实例列表 |
| `surface.run-history.table` | `surface.table.run_history_table@r2` | 运行列表 |
| `surface.site-launcher` | `surface.card_grid.site_launcher@r3` | 站点启动器 |
| `surface.body-market` | `surface.card_grid.body_market@r1` | Body 市场 |
| `surface.flow-gallery` | `surface.card_grid.flow_gallery@r2` | 流程模板 |
| `surface.point-domains` | `surface.tree.point_domains@r2` | 点 Domain 树 |
| `surface.flow-outline` | `surface.tree.flow_outline@r1` | 流程大纲 |
| `surface.command-palette.global` | `surface.command_palette.global@r4` | 全局命令面板 |
| `surface.command-palette.points` | `surface.command_palette.points@r2` | 点实例面板 |
| `surface.canvas.flow-editor` | `surface.canvas.flow_editor@r6` | 线层编辑器 |
| `surface.canvas.body-composer` | `surface.canvas.body_composer@r1` | Body 组合器 |
| `surface.dashboard.system` | `surface.dashboard.system@r2` | 系统总览 |
| `surface.dashboard.vpn` | `surface.dashboard.vpn@r1` | VPN 健康 |
| `surface.system-monitor` | `surface.dashboard.system_monitor@r2` | 系统状态总览 |
| `surface.run-history.flow` | `surface.run_history.flow@r3` | 流程运行历史 |
| `surface.run-history.vpn` | `surface.run_history.vpn@r2` | VPN 运行历史 |
| `surface.diff.flow-version` | `surface.diff.flow_version@r1` | 流程版本 diff |
| `surface.diff.instance-revision` | `surface.diff.instance_revision@r1` | 实例 revision diff |
| `surface.dialog.vpn-approval` | `surface.dialog.vpn_approval@r2` | VPN 审批 |
| `surface.dialog.delete-confirm` | `surface.dialog.delete_confirm@r1` | 删除确认 |
| `surface.dialog.deploy-approval` | `surface.dialog.deploy_approval@r1` | 部署审批 |
| `surface.notify.vpn` | `surface.notification.vpn@r3` | VPN 通知 |
| `surface.notify.run` | `surface.notification.run@r2` | 运行通知 |
| `surface.notify.download` | `surface.notification.download@r1` | 下载通知 |
| `surface.notify.system-threshold` | `surface.notification.system_threshold@r1` | 系统阈值告警 |
| `surface.tray.quick-actions` | `surface.tray_menu.quick_actions@r2` | 快捷动作 |
| `surface.tray.vpn` | `surface.tray_menu.vpn@r1` | VPN 托盘菜单 |
| `surface.tray.system-status` | `surface.tray_menu.system_status@r1` | 系统状态托盘 |
| `surface.hud.translate` | `surface.hud.translate@r2` | 翻译浮层 |
| `surface.hud.vpn-status` | `surface.hud.vpn_status@r1` | VPN 状态浮层 |
| `surface.hud.system-status` | `surface.hud.system_status@r1` | 系统状态浮层 |
| `metric.cpu` | `surface.metric_card.cpu@r1` | CPU |
| `metric.gpu` | `surface.metric_card.gpu@r1` | GPU |
| `metric.memory` | `surface.metric_card.memory@r1` | 内存 |
| `metric.network` | `surface.metric_card.network@r1` | 网速 |
| `metric.disk` | `surface.metric_card.disk@r1` | 磁盘 |
| `body.file-preview.text@r1` | `body.file_preview.text@r1` | text |
| `body.file-preview.markdown@r1` | `body.file_preview.markdown@r1` | markdown |
| `body.file-preview.image@r1` | `body.file_preview.image@r1` | image |
| `body.file-preview.pdf@r1` | `body.file_preview.pdf@r1` | pdf |
| `body.file-preview.video@r1` | `body.file_preview.video@r1` | video |
| `body.file-preview.audio@r1` | `body.file_preview.audio@r1` | audio |
| `body.ocr.text@r1` | `body.ocr.text@r1` | text |
| `body.ocr.math@r1` | `body.ocr.math@r1` | math |
| `body.ocr.qr@r1` | `body.ocr.qr@r1` | qr |
| `body.ocr.table@r1` | `body.ocr.table@r1` | table |
| `body.ocr.handwriting@r1` | `body.ocr.handwriting@r1` | handwriting |
| `body.image-resizer.web@r2` | `body.image_resizer.web@r2` | web |
| `body.image-resizer.thumbnail@r1` | `body.image_resizer.thumbnail@r1` | thumbnail |
| `body.image-resizer.avatar@r1` | `body.image_resizer.avatar@r1` | avatar |
| `body.image-resizer.email@r1` | `body.image_resizer.email@r1` | email |
| `body.batch-rename.regex@r1` | `body.batch_rename.regex@r1` | regex |
| `body.batch-rename.sequence@r1` | `body.batch_rename.sequence@r1` | sequence |
| `body.batch-rename.date-prefix@r1` | `body.batch_rename.date_prefix@r1` | date-prefix |
| `body.batch-rename.extension-normalize@r1` | `body.batch_rename.extension_normalize@r1` | extension-normalize |
| `body.pdf-toolkit.merge@r1` | `body.pdf_toolkit.merge@r1` | merge |
| `body.pdf-toolkit.split@r1` | `body.pdf_toolkit.split@r1` | split |
| `body.pdf-toolkit.compress@r1` | `body.pdf_toolkit.compress@r1` | compress |
| `body.pdf-toolkit.rotate@r1` | `body.pdf_toolkit.rotate@r1` | rotate |
| `body.media-converter.image@r1` | `body.media_converter.image@r1` | image |
| `body.media-converter.video@r1` | `body.media_converter.video@r1` | video |
| `body.media-converter.audio@r1` | `body.media_converter.audio@r1` | audio |
| `body.file-organizer.downloads@r1` | `body.file_organizer.downloads@r1` | downloads |
| `body.file-organizer.screenshots@r1` | `body.file_organizer.screenshots@r1` | screenshots |
| `body.file-organizer.duplicates@r1` | `body.file_organizer.duplicates@r1` | duplicates |
| `body.advanced-paste.plain@r1` | `body.advanced_paste.plain@r1` | plain |
| `body.advanced-paste.markdown@r1` | `body.advanced_paste.markdown@r1` | markdown |
| `body.advanced-paste.json@r1` | `body.advanced_paste.json@r1` | json |
| `body.advanced-paste.ai@r1` | `body.advanced_paste.ai@r1` | ai |
| `body.clipboard-history.recent@r1` | `body.clipboard_history.recent@r1` | recent |
| `body.clipboard-history.pinned@r1` | `body.clipboard_history.pinned@r1` | pinned |
| `body.color-picker.hex@r1` | `body.color_picker.hex@r1` | hex |
| `body.color-picker.palette@r1` | `body.color_picker.palette@r1` | palette |
| `body.screen-ruler.px@r1` | `body.screen_ruler.px@r1` | px |
| `body.screen-ruler.inches@r1` | `body.screen_ruler.inches@r1` | inches |
| `body.screen-ruler.angle@r1` | `body.screen_ruler.angle@r1` | angle |
| `body.window-layout.dev@r1` | `body.window_layout.dev@r1` | dev |
| `body.window-layout.meeting@r1` | `body.window_layout.meeting@r1` | meeting |
| `body.window-layout.ultrawide@r1` | `body.window_layout.ultrawide@r1` | ultrawide |
| `body.always-on-top.window@r1` | `body.always_on_top.window@r1` | window |
| `body.always-on-top.region@r1` | `body.always_on_top.region@r1` | region |
| `body.awake.30m@r1` | `body.awake.30m@r1` | 30m |
| `body.awake.until@r1` | `body.awake.until@r1` | until |
| `body.awake.while-app@r1` | `body.awake.while_app@r1` | while-app |
| `body.workspace.dev@r3` | `body.workspace.dev@r3` | dev |
| `body.workspace.meeting@r1` | `body.workspace.meeting@r1` | meeting |
| `body.workspace.writing@r1` | `body.workspace.writing@r1` | writing |
| `body.quick-launch.dock@r1` | `body.quick_launch.dock@r1` | dock |
| `body.quick-launch.palette@r1` | `body.quick_launch.palette@r1` | palette |
| `body.system-monitor.desktop@r2` | `body.system_monitor.desktop@r2` | desktop |
| `body.system-monitor.minimal@r1` | `body.system_monitor.minimal@r1` | minimal |
| `body.service-health.docker@r1` | `body.service_health.docker@r1` | docker |
| `body.service-health.local-api@r1` | `body.service_health.local_api@r1` | local-api |
| `body.service-health.vpn@r1` | `body.service_health.vpn@r1` | vpn |
| `body.file-locksmith.process@r1` | `body.file_locksmith.process@r1` | process |
| `body.file-locksmith.handle@r1` | `body.file_locksmith.handle@r1` | handle |
| `body.hosts-editor.local@r1` | `body.hosts_editor.local@r1` | local |
| `body.hosts-editor.blocklist@r1` | `body.hosts_editor.blocklist@r1` | blocklist |
| `body.env-vars.user@r1` | `body.env_vars.user@r1` | user |
| `body.env-vars.path@r1` | `body.env_vars.path@r1` | path |
| `body.external-access.work@r3` | `body.external_access.work@r3` | work |
| `body.external-access.personal@r2` | `body.external_access.personal@r2` | personal |
| `body.screenshot-translate.en-zh@r4` | `body.screenshot_translate.en_zh@r4` | en-zh |
| `body.screenshot-translate.ja-zh@r2` | `body.screenshot_translate.ja_zh@r2` | ja-zh |
| `body.ai-rewrite.formal@r2` | `body.ai_rewrite.formal@r2` | formal |
| `body.ai-rewrite.shorten@r1` | `body.ai_rewrite.shorten@r1` | shorten |
| `body.ai-rewrite.translate@r1` | `body.ai_rewrite.translate@r1` | translate |
| `body.meeting-notes.local@r1` | `body.meeting_notes.local@r1` | local |
| `body.meeting-notes.cloud@r1` | `body.meeting_notes.cloud@r1` | cloud |
| `body.invoice-archive.company@r6` | `body.invoice_archive.company@r6` | company |
| `body.invoice-archive.personal@r2` | `body.invoice_archive.personal@r2` | personal |
| `body.suite.office@r1` | `body.suite.office@r1` | office |
| `body.suite.dev@r1` | `body.suite.dev@r1` | dev |
| `body.web-clipper.selection@r1` | `body.web_clipper.selection@r1` | selection |
| `body.web-clipper.page@r1` | `body.web_clipper.page@r1` | page |
| `body.web-clipper.readability@r1` | `body.web_clipper.readability@r1` | readability |
| `body.backup-sync.folder@r1` | `body.backup_sync.folder@r1` | folder |
| `body.backup-sync.daily@r1` | `body.backup_sync.daily@r1` | daily |
| `field.observe.desktop@r1` | `field.observe.desktop@r1` | observe.desktop |
| `field.observe.selection@r1` | `field.observe.selection@r1` | observe.selection |
| `field.observe.run-history@r1` | `field.observe.run_history@r1` | observe.run-history |
| `field.classify.intent@r1` | `field.classify.intent@r1` | classify.intent |
| `field.classify.file-type@r1` | `field.classify.file_type@r1` | classify.file-type |
| `field.classify.ocr-mode@r1` | `field.classify.ocr_mode@r1` | classify.ocr-mode |
| `field.classify.error-kind@r1` | `field.classify.error_kind@r1` | classify.error-kind |
| `field.prefill.point-params@r1` | `field.prefill.point_params@r1` | prefill.point-params |
| `field.prefill.vpn-profile@r1` | `field.prefill.vpn_profile@r1` | prefill.vpn-profile |
| `field.prefill.ocr-language@r1` | `field.prefill.ocr_language@r1` | prefill.ocr-language |
| `field.prefill.rename-pattern@r1` | `field.prefill.rename_pattern@r1` | prefill.rename-pattern |
| `field.prefill.search-query@r1` | `field.prefill.search_query@r1` | prefill.search-query |
| `field.prefill.landing-demo@r1` | `field.prefill.landing_demo@r1` | prefill.landing-demo |
| `field.rank.scene-grid@r1` | `field.rank.scene_grid@r1` | rank.scene-grid |
| `field.rank.command-palette@r1` | `field.rank.command_palette@r1` | rank.command-palette |
| `field.rank.body-market@r1` | `field.rank.body_market@r1` | rank.body-market |
| `field.rank.ocr-mode@r1` | `field.rank.ocr_mode@r1` | rank.ocr-mode |
| `field.recommend.next-action@r1` | `field.recommend.next_action@r1` | recommend.next-action |
| `field.recommend.body@r1` | `field.recommend.body@r1` | recommend.body |
| `field.recommend.template@r1` | `field.recommend.template@r1` | recommend.template |
| `field.detect.repetition@r1` | `field.detect.repetition@r1` | detect.repetition |
| `field.detect.anomaly@r1` | `field.detect.anomaly@r1` | detect.anomaly |
| `field.detect.opportunity@r1` | `field.detect.opportunity@r1` | detect.opportunity |
| `field.generate.point-action@r1` | `field.generate.point_action@r1` | generate.point-action |
| `field.generate.flow@r1` | `field.generate.flow@r1` | generate.flow |
| `field.generate.surface-layout@r1` | `field.generate.surface_layout@r1` | generate.surface-layout |
| `field.generate.body-manifest@r1` | `field.generate.body_manifest@r1` | generate.body-manifest |
| `field.compose.flow-from-points@r1` | `field.compose.flow_from_points@r1` | compose.flow-from-points |
| `field.compose.surface-from-data@r1` | `field.compose.surface_from_data@r1` | compose.surface-from-data |
| `field.compose.body-from-flows@r1` | `field.compose.body_from_flows@r1` | compose.body-from-flows |
| `field.plan.single-app@r1` | `field.plan.single_app@r1` | plan.single-app |
| `field.plan.cross-app@r1` | `field.plan.cross_app@r1` | plan.cross-app |
| `field.plan.batch@r1` | `field.plan.batch@r1` | plan.batch |
| `field.translate.nl-to-dsl@r1` | `field.translate.nl_to_dsl@r1` | translate.nl-to-dsl |
| `field.translate.dsl-to-nl@r1` | `field.translate.dsl_to_nl@r1` | translate.dsl-to-nl |
| `field.translate.error-to-human@r1` | `field.translate.error_to_human@r1` | translate.error-to-human |
| `field.summarize.run-history@r1` | `field.summarize.run_history@r1` | summarize.run-history |
| `field.summarize.context@r1` | `field.summarize.context@r1` | summarize.context |
| `field.summarize.document@r1` | `field.summarize.document@r1` | summarize.document |
| `field.diagnose.flow-failure@r1` | `field.diagnose.flow_failure@r1` | diagnose.flow-failure |
| `field.diagnose.uia-timeout@r1` | `field.diagnose.uia_timeout@r1` | diagnose.uia-timeout |
| `field.diagnose.vpn-unreachable@r1` | `field.diagnose.vpn_unreachable@r1` | diagnose.vpn-unreachable |
| `field.diagnose.ocr-low-confidence@r1` | `field.diagnose.ocr_low_confidence@r1` | diagnose.ocr-low-confidence |
| `field.repair.flow-patch@r1` | `field.repair.flow_patch@r1` | repair.flow-patch |
| `field.repair.selector-patch@r1` | `field.repair.selector_patch@r1` | repair.selector-patch |
| `field.repair.settings-patch@r1` | `field.repair.settings_patch@r1` | repair.settings-patch |
| `field.repair.permission-fix@r1` | `field.repair.permission_fix@r1` | repair.permission-fix |
| `field.mine.action-sequence@r1` | `field.mine.action_sequence@r1` | mine.action-sequence |
| `field.mine.flow-template@r1` | `field.mine.flow_template@r1` | mine.flow-template |
| `field.mine.body-candidate@r1` | `field.mine.body_candidate@r1` | mine.body-candidate |
| `field.learn.ranking@r1` | `field.learn.ranking@r1` | learn.ranking |
| `field.learn.prefill@r1` | `field.learn.prefill@r1` | learn.prefill |
| `field.learn.threshold@r1` | `field.learn.threshold@r1` | learn.threshold |
| `field.personalize.shortcut@r1` | `field.personalize.shortcut@r1` | personalize.shortcut |
| `field.personalize.layout@r1` | `field.personalize.layout@r1` | personalize.layout |
| `field.personalize.defaults@r1` | `field.personalize.defaults@r1` | personalize.defaults |
| `field.critique.flow@r1` | `field.critique.flow@r1` | critique.flow |
| `field.critique.body@r1` | `field.critique.body@r1` | critique.body |
| `field.critique.permission@r1` | `field.critique.permission@r1` | critique.permission |
| `field.route.model@r1` | `field.route.model@r1` | route.model |
| `field.route.tool@r1` | `field.route.tool@r1` | route.tool |
| `field.route.body@r1` | `field.route.body@r1` | route.body |
| `field.guard.risk@r1` | `field.guard.risk@r1` | guard.risk |
| `field.guard.permission@r1` | `field.guard.permission@r1` | guard.permission |
| `field.guard.confidence@r1` | `field.guard.confidence@r1` | guard.confidence |
| `field.guard.privacy@r1` | `field.guard.privacy@r1` | guard.privacy |
| `field.ask.clarify@r1` | `field.ask.clarify@r1` | ask.clarify |
| `field.ask.confirm@r1` | `field.ask.confirm@r1` | ask.confirm |
| `field.ask.choose@r1` | `field.ask.choose@r1` | ask.choose |
| `field.explain.suggestion@r1` | `field.explain.suggestion@r1` | explain.suggestion |
| `field.explain.point-run@r1` | `field.explain.point_run@r1` | explain.point-run |
| `field.explain.flow-run@r1` | `field.explain.flow_run@r1` | explain.flow-run |
| `field.explain.permission@r1` | `field.explain.permission@r1` | explain.permission |
| `field.simulate.dry-run@r1` | `field.simulate.dry_run@r1` | simulate.dry-run |
| `field.simulate.impact@r1` | `field.simulate.impact@r1` | simulate.impact |
| `field.simulate.rollback@r1` | `field.simulate.rollback@r1` | simulate.rollback |
| `field.memory.preference@r1` | `field.memory.preference@r1` | memory.preference |
| `field.memory.episodic@r1` | `field.memory.episodic@r1` | memory.episodic |
| `field.memory.knowledge@r1` | `field.memory.knowledge@r1` | memory.knowledge |
