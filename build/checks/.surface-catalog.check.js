
const DATA = {
  "families": {
    "input": {
      "name": "Input / Edit",
      "short": "输入 / 编辑",
      "color": "#3b82f6",
      "desc": "收集、修改、逐步配置"
    },
    "browse": {
      "name": "Browse / Select",
      "short": "浏览 / 选择",
      "color": "#06b6d4",
      "desc": "浏览、筛选、选择、启动"
    },
    "visualize": {
      "name": "Visualize / Edit",
      "short": "可视化 / 编辑",
      "color": "#8b5cf6",
      "desc": "图、指标、追踪、差异"
    },
    "communicate": {
      "name": "Communicate",
      "short": "沟通 / 确认",
      "color": "#f59e0b",
      "desc": "确认、提示、快捷入口"
    }
  },
  "classes": [
    {
      "id": "surface.form",
      "name": "表单",
      "family": "input",
      "icon": "▤",
      "p0": true,
      "summary": "schema 驱动的表单；设置、参数、创建/编辑。",
      "regions": [
        "header",
        "body",
        "footer"
      ],
      "slots": [
        "fields[]",
        "sections[]",
        "actions[]"
      ],
      "actions": [
        "submit",
        "cancel",
        "reset",
        "test"
      ],
      "states": [
        "idle",
        "validating",
        "error",
        "success"
      ],
      "instances": [
        {
          "id": "surface.settings.vpn",
          "name": "VPN 设置",
          "desc": "默认 VPN / 自动打开 / 自动连接 / 超时",
          "placement": "settings",
          "revision": 3,
          "status": "active",
          "dataBindings": [
            {
              "slot": "defaultApp",
              "kind": "store",
              "target": "settings.vpn.defaultApp"
            },
            {
              "slot": "autoOpenApp",
              "kind": "store",
              "target": "settings.vpn.autoOpenApp"
            },
            {
              "slot": "autoConnect",
              "kind": "store",
              "target": "settings.vpn.autoConnect"
            },
            {
              "slot": "timeoutSec",
              "kind": "store",
              "target": "settings.vpn.timeoutSec"
            }
          ],
          "actionBindings": [
            {
              "slot": "save",
              "kind": "command",
              "target": "settings.saveVpn"
            },
            {
              "slot": "test",
              "kind": "runFlow",
              "target": "inst.ensure-vpn-ask@r2"
            }
          ]
        },
        {
          "id": "surface.settings.general",
          "name": "通用设置",
          "desc": "主题 / 语言 / 启动行为",
          "placement": "settings",
          "revision": 2,
          "status": "active",
          "dataBindings": [
            {
              "slot": "theme",
              "kind": "store",
              "target": "settings.general.theme"
            },
            {
              "slot": "locale",
              "kind": "store",
              "target": "settings.general.locale"
            }
          ],
          "actionBindings": [
            {
              "slot": "save",
              "kind": "command",
              "target": "settings.saveGeneral"
            }
          ]
        },
        {
          "id": "surface.point-params",
          "name": "点实例参数",
          "desc": "编辑 PointInstance 的参数与 revision",
          "placement": "sidebar",
          "revision": 1,
          "status": "active",
          "dataBindings": [
            {
              "slot": "params",
              "kind": "pointOutput",
              "target": "vpn.default.status@r1"
            }
          ],
          "actionBindings": [
            {
              "slot": "save",
              "kind": "command",
              "target": "pointInstance.save"
            }
          ]
        },
        {
          "id": "surface.settings.system-monitor",
          "name": "系统监控设置",
          "desc": "采样间隔 / 历史窗口 / 阈值 / 单位 / 悬浮窗",
          "placement": "settings",
          "revision": 2,
          "status": "active",
          "dataBindings": [
            {
              "slot": "sampleIntervalMs",
              "kind": "store",
              "target": "settings.system.sampleIntervalMs"
            },
            {
              "slot": "historySec",
              "kind": "store",
              "target": "settings.system.historySec"
            },
            {
              "slot": "cpuWarn",
              "kind": "store",
              "target": "settings.system.cpu.warn"
            },
            {
              "slot": "gpuTempWarn",
              "kind": "store",
              "target": "settings.system.gpu.tempWarn"
            },
            {
              "slot": "alwaysOnTop",
              "kind": "store",
              "target": "settings.system.alwaysOnTop"
            }
          ],
          "actionBindings": [
            {
              "slot": "save",
              "kind": "command",
              "target": "settings.saveSystem"
            },
            {
              "slot": "test",
              "kind": "command",
              "target": "metrics.test"
            }
          ]
        }
      ]
    },
    {
      "id": "surface.wizard",
      "name": "向导",
      "family": "input",
      "icon": "⇥",
      "p0": false,
      "summary": "多步引导；新建流程、绑定槽位、首次配置。",
      "regions": [
        "stepper",
        "body",
        "footer"
      ],
      "slots": [
        "steps[]",
        "summary",
        "actions[]"
      ],
      "actions": [
        "next",
        "back",
        "finish",
        "cancel"
      ],
      "states": [
        "editing",
        "validating",
        "review",
        "done"
      ],
      "instances": [
        {
          "id": "surface.wizard.new-flow",
          "name": "新建流程",
          "desc": "选模板 → 绑槽位 → 试运行",
          "placement": "modal",
          "revision": 1,
          "status": "active",
          "dataBindings": [
            {
              "slot": "templates",
              "kind": "query",
              "target": "FlowClass.list"
            },
            {
              "slot": "slots",
              "kind": "flowOutput",
              "target": "selectedFlow.slots"
            }
          ],
          "actionBindings": [
            {
              "slot": "next",
              "kind": "navigate",
              "target": "wizard.step2"
            },
            {
              "slot": "finish",
              "kind": "command",
              "target": "flowInstance.create"
            }
          ]
        },
        {
          "id": "surface.wizard.vpn-setup",
          "name": "VPN 首次配置",
          "desc": "选软件 → 测试 → 保存",
          "placement": "modal",
          "revision": 1,
          "status": "active",
          "dataBindings": [
            {
              "slot": "apps",
              "kind": "query",
              "target": "AppRegistry.vpnApps"
            }
          ],
          "actionBindings": [
            {
              "slot": "test",
              "kind": "runFlow",
              "target": "inst.ensure-vpn-ask@r2"
            },
            {
              "slot": "finish",
              "kind": "command",
              "target": "settings.saveVpn"
            }
          ]
        }
      ]
    },
    {
      "id": "surface.inspector",
      "name": "检查器",
      "family": "input",
      "icon": "⌕",
      "p0": true,
      "summary": "查看/编辑选中对象的属性；点类、点实例、槽位、运行节点。",
      "regions": [
        "header",
        "sections",
        "property editors",
        "footer"
      ],
      "slots": [
        "properties[]",
        "sections[]",
        "actions[]"
      ],
      "actions": [
        "edit",
        "bind",
        "unbind",
        "revert"
      ],
      "states": [
        "empty",
        "ready",
        "dirty",
        "error"
      ],
      "instances": [
        {
          "id": "surface.inspector.point",
          "name": "点检查器",
          "desc": "PointClass / PointInstance 契约与参数",
          "placement": "sidebar",
          "revision": 4,
          "status": "active",
          "dataBindings": [
            {
              "slot": "class",
              "kind": "query",
              "target": "PointRegistry.getClass"
            },
            {
              "slot": "instance",
              "kind": "query",
              "target": "PointRegistry.getInstance"
            }
          ],
          "actionBindings": [
            {
              "slot": "edit",
              "kind": "command",
              "target": "pointInstance.update"
            },
            {
              "slot": "bind",
              "kind": "navigate",
              "target": "surface.point-catalog"
            }
          ]
        },
        {
          "id": "surface.inspector.slot-vpn",
          "name": "VPN 槽位检查器",
          "desc": "slot.vpn 的 accepts / default / bound",
          "placement": "sidebar",
          "revision": 2,
          "status": "active",
          "dataBindings": [
            {
              "slot": "slot",
              "kind": "flowOutput",
              "target": "flow.open-external-site.slot.vpn"
            },
            {
              "slot": "bound",
              "kind": "flowOutput",
              "target": "inst.site-github.bindings.vpn"
            }
          ],
          "actionBindings": [
            {
              "slot": "replaceBinding",
              "kind": "command",
              "target": "flowInstance.replaceBinding"
            },
            {
              "slot": "openSubflow",
              "kind": "navigate",
              "target": "surface.canvas.flow-editor"
            }
          ]
        },
        {
          "id": "surface.inspector.run-node",
          "name": "运行节点检查器",
          "desc": "PointRun 输入/输出/耗时",
          "placement": "sidebar",
          "revision": 1,
          "status": "active",
          "dataBindings": [
            {
              "slot": "run",
              "kind": "flowOutput",
              "target": "FlowRun.slotRuns.vpn"
            },
            {
              "slot": "pointRun",
              "kind": "pointOutput",
              "target": "vpn.default.status@r1"
            }
          ],
          "actionBindings": [
            {
              "slot": "replay",
              "kind": "runFlow",
              "target": "inst.site-github@r1"
            }
          ]
        }
      ]
    },
    {
      "id": "surface.table",
      "name": "表格",
      "family": "browse",
      "icon": "▦",
      "p0": true,
      "summary": "表格浏览、排序、筛选、批量操作。",
      "regions": [
        "toolbar",
        "header",
        "rows",
        "pagination",
        "bulk bar"
      ],
      "slots": [
        "columns[]",
        "filters[]",
        "rowActions[]",
        "bulkActions[]"
      ],
      "actions": [
        "sort",
        "filter",
        "select",
        "bulkRun",
        "open"
      ],
      "states": [
        "loading",
        "empty",
        "error",
        "ready"
      ],
      "instances": [
        {
          "id": "surface.point-catalog",
          "name": "点目录",
          "desc": "38 个点类 / 实例列表",
          "placement": "main",
          "revision": 5,
          "status": "active",
          "dataBindings": [
            {
              "slot": "rows",
              "kind": "query",
              "target": "PointRegistry.list"
            }
          ],
          "actionBindings": [
            {
              "slot": "inspect",
              "kind": "navigate",
              "target": "surface.inspector.point"
            },
            {
              "slot": "createInstance",
              "kind": "command",
              "target": "pointInstance.create"
            }
          ]
        },
        {
          "id": "surface.flow-instances",
          "name": "线实例列表",
          "desc": "FlowInstance 目录",
          "placement": "main",
          "revision": 3,
          "status": "active",
          "dataBindings": [
            {
              "slot": "rows",
              "kind": "query",
              "target": "FlowInstance.list"
            }
          ],
          "actionBindings": [
            {
              "slot": "run",
              "kind": "runFlow",
              "target": "selectedFlowInstance"
            },
            {
              "slot": "inspect",
              "kind": "navigate",
              "target": "surface.inspector.slot-vpn"
            }
          ]
        },
        {
          "id": "surface.run-history.table",
          "name": "运行列表",
          "desc": "FlowRun / PointRun 表格",
          "placement": "main",
          "revision": 2,
          "status": "active",
          "dataBindings": [
            {
              "slot": "rows",
              "kind": "query",
              "target": "FlowRun.list"
            }
          ],
          "actionBindings": [
            {
              "slot": "open",
              "kind": "navigate",
              "target": "surface.run-history.flow"
            }
          ]
        }
      ]
    },
    {
      "id": "surface.card-grid",
      "name": "卡片墙",
      "family": "browse",
      "icon": "▩",
      "p0": false,
      "summary": "卡片墙；站点启动、模板市场、Body 市场。",
      "regions": [
        "toolbar",
        "filters",
        "grid",
        "empty"
      ],
      "slots": [
        "cards[]",
        "filters[]",
        "cardActions[]"
      ],
      "actions": [
        "open",
        "run",
        "preview",
        "install"
      ],
      "states": [
        "loading",
        "empty",
        "error",
        "ready"
      ],
      "instances": [
        {
          "id": "surface.site-launcher",
          "name": "站点启动器",
          "desc": "YouTube / GitHub / Google / 内网",
          "placement": "main",
          "revision": 3,
          "status": "active",
          "dataBindings": [
            {
              "slot": "cards",
              "kind": "query",
              "target": "FlowInstance.listSites"
            }
          ],
          "actionBindings": [
            {
              "slot": "run",
              "kind": "runFlow",
              "target": "selectedSiteInstance"
            }
          ]
        },
        {
          "id": "surface.body-market",
          "name": "Body 市场",
          "desc": "安装 body / 模板",
          "placement": "main",
          "revision": 1,
          "status": "active",
          "dataBindings": [
            {
              "slot": "cards",
              "kind": "query",
              "target": "BodyRegistry.market"
            }
          ],
          "actionBindings": [
            {
              "slot": "install",
              "kind": "command",
              "target": "body.install"
            }
          ]
        },
        {
          "id": "surface.flow-gallery",
          "name": "流程模板",
          "desc": "FlowClass 模板库",
          "placement": "main",
          "revision": 2,
          "status": "active",
          "dataBindings": [
            {
              "slot": "cards",
              "kind": "query",
              "target": "FlowClass.listTemplates"
            }
          ],
          "actionBindings": [
            {
              "slot": "preview",
              "kind": "navigate",
              "target": "surface.canvas.flow-editor"
            }
          ]
        }
      ]
    },
    {
      "id": "surface.tree",
      "name": "树",
      "family": "browse",
      "icon": "⑂",
      "p0": false,
      "summary": "层级导航；Domain → PointClass、FlowClass → 节点。",
      "regions": [
        "search",
        "tree",
        "selection"
      ],
      "slots": [
        "nodes[]",
        "filters[]"
      ],
      "actions": [
        "expand",
        "collapse",
        "select",
        "drag"
      ],
      "states": [
        "loading",
        "empty",
        "ready"
      ],
      "instances": [
        {
          "id": "surface.point-domains",
          "name": "点 Domain 树",
          "desc": "15 domain → 38 类",
          "placement": "sidebar",
          "revision": 2,
          "status": "active",
          "dataBindings": [
            {
              "slot": "nodes",
              "kind": "query",
              "target": "PointRegistry.domains"
            }
          ],
          "actionBindings": [
            {
              "slot": "select",
              "kind": "navigate",
              "target": "surface.point-catalog"
            }
          ]
        },
        {
          "id": "surface.flow-outline",
          "name": "流程大纲",
          "desc": "FlowClass 节点树",
          "placement": "sidebar",
          "revision": 1,
          "status": "active",
          "dataBindings": [
            {
              "slot": "nodes",
              "kind": "flowOutput",
              "target": "selectedFlow.nodes"
            }
          ],
          "actionBindings": [
            {
              "slot": "select",
              "kind": "navigate",
              "target": "surface.inspector.run-node"
            }
          ]
        }
      ]
    },
    {
      "id": "surface.command-palette",
      "name": "命令面板",
      "family": "browse",
      "icon": "⌘",
      "p0": true,
      "summary": "全局搜索与动作启动；键盘优先。",
      "regions": [
        "query",
        "results",
        "groups",
        "footer"
      ],
      "slots": [
        "groups[]",
        "results[]",
        "shortcuts[]"
      ],
      "actions": [
        "run",
        "navigate",
        "preview"
      ],
      "states": [
        "idle",
        "searching",
        "empty",
        "error"
      ],
      "instances": [
        {
          "id": "surface.command-palette.global",
          "name": "全局命令面板",
          "desc": "搜索 Flow / Point / 设置",
          "placement": "overlay",
          "revision": 4,
          "status": "active",
          "dataBindings": [
            {
              "slot": "results",
              "kind": "query",
              "target": "SearchIndex.global"
            }
          ],
          "actionBindings": [
            {
              "slot": "run",
              "kind": "command",
              "target": "selectedCommand"
            },
            {
              "slot": "navigate",
              "kind": "navigate",
              "target": "selectedSurface"
            }
          ]
        },
        {
          "id": "surface.command-palette.points",
          "name": "点实例面板",
          "desc": "搜索并运行点实例",
          "placement": "overlay",
          "revision": 2,
          "status": "active",
          "dataBindings": [
            {
              "slot": "results",
              "kind": "query",
              "target": "PointRegistry.search"
            }
          ],
          "actionBindings": [
            {
              "slot": "run",
              "kind": "runPoint",
              "target": "selectedPointInstance"
            }
          ]
        }
      ]
    },
    {
      "id": "surface.canvas",
      "name": "画布",
      "family": "visualize",
      "icon": "⌗",
      "p0": false,
      "summary": "节点图编辑；线层编辑器、Body 组合器。",
      "regions": [
        "toolbar",
        "palette",
        "canvas",
        "minimap",
        "inspector"
      ],
      "slots": [
        "nodes[]",
        "edges[]",
        "groups[]",
        "notes[]"
      ],
      "actions": [
        "addNode",
        "connect",
        "move",
        "delete",
        "run",
        "save"
      ],
      "states": [
        "empty",
        "editing",
        "validating",
        "running",
        "error"
      ],
      "instances": [
        {
          "id": "surface.canvas.flow-editor",
          "name": "线层编辑器",
          "desc": "FlowClass 图 / 槽位绑定",
          "placement": "main",
          "revision": 6,
          "status": "active",
          "dataBindings": [
            {
              "slot": "graph",
              "kind": "query",
              "target": "FlowClass.getGraph"
            },
            {
              "slot": "bindings",
              "kind": "flowOutput",
              "target": "selectedFlowInstance.bindings"
            }
          ],
          "actionBindings": [
            {
              "slot": "run",
              "kind": "runFlow",
              "target": "selectedFlowInstance"
            },
            {
              "slot": "save",
              "kind": "command",
              "target": "flowClass.saveDraft"
            }
          ]
        },
        {
          "id": "surface.canvas.body-composer",
          "name": "Body 组合器",
          "desc": "面 + 线 + 权限打包",
          "placement": "main",
          "revision": 1,
          "status": "active",
          "dataBindings": [
            {
              "slot": "surfaces",
              "kind": "query",
              "target": "SurfaceInstance.list"
            },
            {
              "slot": "flows",
              "kind": "query",
              "target": "FlowInstance.list"
            }
          ],
          "actionBindings": [
            {
              "slot": "save",
              "kind": "command",
              "target": "body.saveDraft"
            }
          ]
        }
      ]
    },
    {
      "id": "surface.dashboard",
      "name": "仪表盘",
      "family": "visualize",
      "icon": "◫",
      "p0": false,
      "summary": "指标、状态、健康度；系统总览、VPN 状态。",
      "regions": [
        "header",
        "metric cards",
        "charts",
        "alerts"
      ],
      "slots": [
        "metrics[]",
        "charts[]",
        "alerts[]",
        "actions[]"
      ],
      "actions": [
        "drilldown",
        "refresh",
        "openRun"
      ],
      "states": [
        "loading",
        "empty",
        "degraded",
        "error",
        "ready"
      ],
      "instances": [
        {
          "id": "surface.dashboard.system",
          "name": "系统总览",
          "desc": "运行数 / 成功率 / 成本",
          "placement": "main",
          "revision": 2,
          "status": "active",
          "dataBindings": [
            {
              "slot": "metrics",
              "kind": "query",
              "target": "Metrics.system"
            }
          ],
          "actionBindings": [
            {
              "slot": "drilldown",
              "kind": "navigate",
              "target": "surface.run-history.flow"
            }
          ]
        },
        {
          "id": "surface.dashboard.vpn",
          "name": "VPN 健康",
          "desc": "VPN 状态 / 连接耗时 / 失败",
          "placement": "main",
          "revision": 1,
          "status": "active",
          "dataBindings": [
            {
              "slot": "metrics",
              "kind": "query",
              "target": "Metrics.vpn"
            }
          ],
          "actionBindings": [
            {
              "slot": "openRun",
              "kind": "navigate",
              "target": "surface.run-history.vpn"
            }
          ]
        },
        {
          "id": "surface.system-monitor",
          "name": "系统状态总览",
          "desc": "CPU / GPU / 内存 / 网速 / 磁盘 / 温度；实时卡片与历史曲线",
          "placement": "main",
          "revision": 2,
          "status": "active",
          "dataBindings": [
            {
              "slot": "cards",
              "kind": "query",
              "target": "Metrics.system.cards"
            },
            {
              "slot": "streams",
              "kind": "query",
              "target": "MetricStream.system"
            }
          ],
          "actionBindings": [
            {
              "slot": "pause",
              "kind": "command",
              "target": "metrics.pause"
            },
            {
              "slot": "refresh",
              "kind": "command",
              "target": "metrics.refresh"
            },
            {
              "slot": "settings",
              "kind": "navigate",
              "target": "surface.settings.system-monitor"
            }
          ]
        }
      ]
    },
    {
      "id": "surface.run-history",
      "name": "运行历史",
      "family": "visualize",
      "icon": "◷",
      "p0": false,
      "summary": "运行历史、节点 trace、变量快照、回放。",
      "regions": [
        "filters",
        "run list",
        "trace",
        "detail",
        "actions"
      ],
      "slots": [
        "runs[]",
        "nodes[]",
        "variables[]",
        "errors[]"
      ],
      "actions": [
        "filter",
        "inspect",
        "replay",
        "export"
      ],
      "states": [
        "loading",
        "empty",
        "failed",
        "ready"
      ],
      "instances": [
        {
          "id": "surface.run-history.flow",
          "name": "流程运行历史",
          "desc": "FlowRun + PointRun trace",
          "placement": "main",
          "revision": 3,
          "status": "active",
          "dataBindings": [
            {
              "slot": "runs",
              "kind": "query",
              "target": "FlowRun.list"
            }
          ],
          "actionBindings": [
            {
              "slot": "replay",
              "kind": "runFlow",
              "target": "selectedFlowInstance"
            },
            {
              "slot": "inspect",
              "kind": "navigate",
              "target": "surface.inspector.run-node"
            }
          ]
        },
        {
          "id": "surface.run-history.vpn",
          "name": "VPN 运行历史",
          "desc": "GuardResult / 子 FlowRun",
          "placement": "main",
          "revision": 2,
          "status": "active",
          "dataBindings": [
            {
              "slot": "runs",
              "kind": "query",
              "target": "FlowRun.listVpn"
            }
          ],
          "actionBindings": [
            {
              "slot": "replay",
              "kind": "runFlow",
              "target": "inst.site-github@r1"
            },
            {
              "slot": "openSettings",
              "kind": "navigate",
              "target": "surface.settings.vpn"
            }
          ]
        }
      ]
    },
    {
      "id": "surface.diff",
      "name": "差异",
      "family": "visualize",
      "icon": "≠",
      "p0": false,
      "summary": "版本/实例差异；FlowClass 版本、SurfaceInstance revision。",
      "regions": [
        "summary",
        "change list",
        "side-by-side",
        "actions"
      ],
      "slots": [
        "changes[]",
        "left[]",
        "right[]"
      ],
      "actions": [
        "accept",
        "reject",
        "revert",
        "open"
      ],
      "states": [
        "loading",
        "empty",
        "conflict",
        "ready"
      ],
      "instances": [
        {
          "id": "surface.diff.flow-version",
          "name": "流程版本 diff",
          "desc": "FlowClass v1 vs v2",
          "placement": "main",
          "revision": 1,
          "status": "active",
          "dataBindings": [
            {
              "slot": "left",
              "kind": "query",
              "target": "FlowClass.getVersion"
            },
            {
              "slot": "right",
              "kind": "query",
              "target": "FlowClass.getVersion"
            }
          ],
          "actionBindings": [
            {
              "slot": "accept",
              "kind": "command",
              "target": "flowClass.acceptVersion"
            },
            {
              "slot": "reject",
              "kind": "command",
              "target": "flowClass.rejectVersion"
            }
          ]
        },
        {
          "id": "surface.diff.instance-revision",
          "name": "实例 revision diff",
          "desc": "绑定/参数变化",
          "placement": "main",
          "revision": 1,
          "status": "active",
          "dataBindings": [
            {
              "slot": "left",
              "kind": "query",
              "target": "FlowInstance.getRevision"
            },
            {
              "slot": "right",
              "kind": "query",
              "target": "FlowInstance.getRevision"
            }
          ],
          "actionBindings": [
            {
              "slot": "revert",
              "kind": "command",
              "target": "flowInstance.revert"
            }
          ]
        }
      ]
    },
    {
      "id": "surface.dialog",
      "name": "对话框",
      "family": "communicate",
      "icon": "▢",
      "p0": true,
      "summary": "确认、审批、危险操作；模态。",
      "regions": [
        "header",
        "body",
        "actions"
      ],
      "slots": [
        "title",
        "message",
        "fields[]",
        "actions[]"
      ],
      "actions": [
        "approve",
        "reject",
        "cancel",
        "open"
      ],
      "states": [
        "idle",
        "waiting",
        "approved",
        "rejected",
        "error"
      ],
      "instances": [
        {
          "id": "surface.dialog.vpn-approval",
          "name": "VPN 审批",
          "desc": "打开 VPN / 我已手动打开 / 取消",
          "placement": "modal",
          "revision": 2,
          "status": "active",
          "dataBindings": [
            {
              "slot": "context",
              "kind": "flowOutput",
              "target": "flow.ensure-vpn.approval"
            }
          ],
          "actionBindings": [
            {
              "slot": "approve",
              "kind": "approval",
              "target": "open"
            },
            {
              "slot": "reject",
              "kind": "approval",
              "target": "cancel"
            }
          ]
        },
        {
          "id": "surface.dialog.delete-confirm",
          "name": "删除确认",
          "desc": "危险操作确认",
          "placement": "modal",
          "revision": 1,
          "status": "active",
          "dataBindings": [
            {
              "slot": "context",
              "kind": "flowOutput",
              "target": "delete.action.context"
            }
          ],
          "actionBindings": [
            {
              "slot": "approve",
              "kind": "approval",
              "target": "confirm"
            },
            {
              "slot": "reject",
              "kind": "approval",
              "target": "cancel"
            }
          ]
        },
        {
          "id": "surface.dialog.deploy-approval",
          "name": "部署审批",
          "desc": "生产发布审批",
          "placement": "modal",
          "revision": 1,
          "status": "active",
          "dataBindings": [
            {
              "slot": "context",
              "kind": "flowOutput",
              "target": "deploy.action.context"
            }
          ],
          "actionBindings": [
            {
              "slot": "approve",
              "kind": "approval",
              "target": "confirm"
            },
            {
              "slot": "reject",
              "kind": "approval",
              "target": "cancel"
            }
          ]
        }
      ]
    },
    {
      "id": "surface.notification",
      "name": "通知",
      "family": "communicate",
      "icon": "◔",
      "p0": true,
      "summary": "Toast / Tray / Banner；显示结果与下一步。",
      "regions": [
        "icon",
        "title",
        "message",
        "actions",
        "close"
      ],
      "slots": [
        "level",
        "actions[]"
      ],
      "actions": [
        "open",
        "retry",
        "dismiss",
        "openSettings"
      ],
      "states": [
        "queued",
        "visible",
        "dismissed",
        "actioned"
      ],
      "instances": [
        {
          "id": "surface.notify.vpn",
          "name": "VPN 通知",
          "desc": "GuardResult → 下一步",
          "placement": "toast",
          "revision": 3,
          "status": "active",
          "dataBindings": [
            {
              "slot": "message",
              "kind": "flowOutput",
              "target": "GuardResult"
            }
          ],
          "actionBindings": [
            {
              "slot": "openSettings",
              "kind": "navigate",
              "target": "surface.settings.vpn"
            },
            {
              "slot": "retry",
              "kind": "runFlow",
              "target": "inst.ensure-vpn-ask@r2"
            },
            {
              "slot": "dismiss",
              "kind": "command",
              "target": "toast.dismiss"
            }
          ]
        },
        {
          "id": "surface.notify.run",
          "name": "运行通知",
          "desc": "成功/失败/耗时",
          "placement": "toast",
          "revision": 2,
          "status": "active",
          "dataBindings": [
            {
              "slot": "message",
              "kind": "flowOutput",
              "target": "FlowRun.summary"
            }
          ],
          "actionBindings": [
            {
              "slot": "openRun",
              "kind": "navigate",
              "target": "surface.run-history.flow"
            },
            {
              "slot": "dismiss",
              "kind": "command",
              "target": "toast.dismiss"
            }
          ]
        },
        {
          "id": "surface.notify.download",
          "name": "下载通知",
          "desc": "下载/校验结果",
          "placement": "tray",
          "revision": 1,
          "status": "active",
          "dataBindings": [
            {
              "slot": "message",
              "kind": "flowOutput",
              "target": "GuardResult"
            }
          ],
          "actionBindings": [
            {
              "slot": "open",
              "kind": "command",
              "target": "file.open"
            }
          ]
        },
        {
          "id": "surface.notify.system-threshold",
          "name": "系统阈值告警",
          "desc": "CPU/GPU 温度、内存、磁盘超阈值提示",
          "placement": "toast",
          "revision": 1,
          "status": "active",
          "dataBindings": [
            {
              "slot": "message",
              "kind": "flowOutput",
              "target": "MetricAlert.summary"
            }
          ],
          "actionBindings": [
            {
              "slot": "open",
              "kind": "navigate",
              "target": "surface.system-monitor"
            },
            {
              "slot": "dismiss",
              "kind": "command",
              "target": "toast.dismiss"
            }
          ]
        }
      ]
    },
    {
      "id": "surface.tray-menu",
      "name": "托盘菜单",
      "family": "communicate",
      "icon": "☰",
      "p0": false,
      "summary": "托盘/右键菜单；快速入口。",
      "regions": [
        "menu items",
        "submenus",
        "separators"
      ],
      "slots": [
        "items[]",
        "submenus[]",
        "shortcuts[]"
      ],
      "actions": [
        "run",
        "navigate",
        "toggle"
      ],
      "states": [
        "closed",
        "open",
        "disabled"
      ],
      "instances": [
        {
          "id": "surface.tray.quick-actions",
          "name": "快捷动作",
          "desc": "收藏的 FlowInstance",
          "placement": "tray",
          "revision": 2,
          "status": "active",
          "dataBindings": [
            {
              "slot": "items",
              "kind": "query",
              "target": "FlowInstance.favorites"
            }
          ],
          "actionBindings": [
            {
              "slot": "run",
              "kind": "runFlow",
              "target": "selectedFlowInstance"
            },
            {
              "slot": "navigate",
              "kind": "navigate",
              "target": "surface.settings.general"
            }
          ]
        },
        {
          "id": "surface.tray.vpn",
          "name": "VPN 托盘菜单",
          "desc": "打开 / 连接 / 状态",
          "placement": "tray",
          "revision": 1,
          "status": "active",
          "dataBindings": [
            {
              "slot": "items",
              "kind": "query",
              "target": "VpnTray.items"
            }
          ],
          "actionBindings": [
            {
              "slot": "run",
              "kind": "runFlow",
              "target": "inst.ensure-vpn-ask@r2"
            }
          ]
        },
        {
          "id": "surface.tray.system-status",
          "name": "系统状态托盘",
          "desc": "CPU/GPU/内存/网速文本摘要",
          "placement": "tray",
          "revision": 1,
          "status": "active",
          "dataBindings": [
            {
              "slot": "items",
              "kind": "query",
              "target": "Metrics.system.tray"
            }
          ],
          "actionBindings": [
            {
              "slot": "open",
              "kind": "navigate",
              "target": "surface.system-monitor"
            },
            {
              "slot": "run",
              "kind": "runFlow",
              "target": "inst.ensure-vpn-ask@r2"
            }
          ]
        }
      ]
    },
    {
      "id": "surface.hud",
      "name": "HUD 浮层",
      "family": "communicate",
      "icon": "◉",
      "p0": false,
      "summary": "屏幕浮层；翻译结果、VPN 状态、录屏提示。",
      "regions": [
        "anchor",
        "content",
        "actions",
        "auto-hide"
      ],
      "slots": [
        "content[]",
        "actions[]",
        "position"
      ],
      "actions": [
        "pin",
        "dismiss",
        "open"
      ],
      "states": [
        "hidden",
        "visible",
        "pinned",
        "error"
      ],
      "instances": [
        {
          "id": "surface.hud.translate",
          "name": "翻译浮层",
          "desc": "截图翻译结果",
          "placement": "overlay",
          "revision": 2,
          "status": "active",
          "dataBindings": [
            {
              "slot": "content",
              "kind": "flowOutput",
              "target": "flow.screenshot-translate.output"
            }
          ],
          "actionBindings": [
            {
              "slot": "pin",
              "kind": "command",
              "target": "hud.pin"
            },
            {
              "slot": "dismiss",
              "kind": "command",
              "target": "hud.dismiss"
            }
          ]
        },
        {
          "id": "surface.hud.vpn-status",
          "name": "VPN 状态浮层",
          "desc": "连接状态/耗时",
          "placement": "overlay",
          "revision": 1,
          "status": "active",
          "dataBindings": [
            {
              "slot": "content",
              "kind": "flowOutput",
              "target": "GuardResult"
            }
          ],
          "actionBindings": [
            {
              "slot": "open",
              "kind": "navigate",
              "target": "surface.settings.vpn"
            }
          ]
        },
        {
          "id": "surface.hud.system-status",
          "name": "系统状态浮层",
          "desc": "CPU/GPU/内存/网速紧凑显示，可置顶",
          "placement": "overlay",
          "revision": 1,
          "status": "active",
          "dataBindings": [
            {
              "slot": "content",
              "kind": "query",
              "target": "Metrics.system.compact"
            }
          ],
          "actionBindings": [
            {
              "slot": "open",
              "kind": "navigate",
              "target": "surface.system-monitor"
            },
            {
              "slot": "pin",
              "kind": "command",
              "target": "hud.pin"
            },
            {
              "slot": "dismiss",
              "kind": "command",
              "target": "hud.dismiss"
            }
          ]
        }
      ]
    },
    {
      "id": "surface.metric-card",
      "name": "指标卡",
      "family": "visualize",
      "icon": "◉",
      "p0": false,
      "summary": "单个系统指标：数值、单位、阈值、状态、历史 sparkline；CPU/GPU/内存/网络/磁盘都是实例。",
      "regions": [
        "label",
        "value",
        "unit",
        "status",
        "history"
      ],
      "slots": [
        "metricSpec",
        "stream",
        "actions[]"
      ],
      "actions": [
        "open",
        "settings",
        "pause"
      ],
      "states": [
        "ok",
        "warn",
        "critical",
        "unknown"
      ],
      "instances": [
        {
          "id": "metric.cpu",
          "name": "CPU",
          "desc": "使用率 / 温度 / 频率 / 每核负载",
          "placement": "main",
          "revision": 1,
          "status": "active",
          "dataBindings": [
            {
              "slot": "spec",
              "kind": "store",
              "target": "Metrics.cpu.spec"
            },
            {
              "slot": "stream",
              "kind": "query",
              "target": "MetricStream.cpu"
            }
          ],
          "actionBindings": [
            {
              "slot": "open",
              "kind": "navigate",
              "target": "surface.system-monitor"
            },
            {
              "slot": "settings",
              "kind": "navigate",
              "target": "surface.settings.system-monitor"
            }
          ]
        },
        {
          "id": "metric.gpu",
          "name": "GPU",
          "desc": "使用率 / 温度 / VRAM / 风扇",
          "placement": "main",
          "revision": 1,
          "status": "active",
          "dataBindings": [
            {
              "slot": "spec",
              "kind": "store",
              "target": "Metrics.gpu.spec"
            },
            {
              "slot": "stream",
              "kind": "query",
              "target": "MetricStream.gpu"
            }
          ],
          "actionBindings": [
            {
              "slot": "open",
              "kind": "navigate",
              "target": "surface.system-monitor"
            },
            {
              "slot": "settings",
              "kind": "navigate",
              "target": "surface.settings.system-monitor"
            }
          ]
        },
        {
          "id": "metric.memory",
          "name": "内存",
          "desc": "已用 / 总量 / 百分比 / Swap",
          "placement": "main",
          "revision": 1,
          "status": "active",
          "dataBindings": [
            {
              "slot": "spec",
              "kind": "store",
              "target": "Metrics.memory.spec"
            },
            {
              "slot": "stream",
              "kind": "query",
              "target": "MetricStream.memory"
            }
          ],
          "actionBindings": [
            {
              "slot": "open",
              "kind": "navigate",
              "target": "surface.system-monitor"
            },
            {
              "slot": "settings",
              "kind": "navigate",
              "target": "surface.settings.system-monitor"
            }
          ]
        },
        {
          "id": "metric.network",
          "name": "网速",
          "desc": "下行 / 上行 / 总流量 / 延迟",
          "placement": "main",
          "revision": 1,
          "status": "active",
          "dataBindings": [
            {
              "slot": "spec",
              "kind": "store",
              "target": "Metrics.network.spec"
            },
            {
              "slot": "stream",
              "kind": "query",
              "target": "MetricStream.network"
            }
          ],
          "actionBindings": [
            {
              "slot": "open",
              "kind": "navigate",
              "target": "surface.system-monitor"
            },
            {
              "slot": "settings",
              "kind": "navigate",
              "target": "surface.settings.system-monitor"
            }
          ]
        },
        {
          "id": "metric.disk",
          "name": "磁盘",
          "desc": "已用 / 剩余 / 读写 / 温度",
          "placement": "main",
          "revision": 1,
          "status": "active",
          "dataBindings": [
            {
              "slot": "spec",
              "kind": "store",
              "target": "Metrics.disk.spec"
            },
            {
              "slot": "stream",
              "kind": "query",
              "target": "MetricStream.disk"
            }
          ],
          "actionBindings": [
            {
              "slot": "open",
              "kind": "navigate",
              "target": "surface.system-monitor"
            },
            {
              "slot": "settings",
              "kind": "navigate",
              "target": "surface.settings.system-monitor"
            }
          ]
        }
      ]
    }
  ],
  "stats": {
    "classes": 16,
    "instances": 46,
    "families": 4,
    "p0": 6
  }
};
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

