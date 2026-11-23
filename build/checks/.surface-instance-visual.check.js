
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
const ALL = DATA.classes.flatMap(c=>c.instances.map(i=>({...i,classId:c.id,className:c.name,classIcon:c.icon,family:c.family,surfaceClass:c})));
const byId = (id)=>ALL.find(i=>i.id===id);
const classById = (id)=>DATA.classes.find(c=>c.id===id);
const familyColor = (fam)=>({input:'#3b82f6',browse:'#06b6d4',visualize:'#8b5cf6',communicate:'#f59e0b'}[fam]||'#3b82f6');
const placementLabel = (p)=>({main:'主面板',settings:'设置页',sidebar:'侧栏',modal:'模态对话框',toast:'Toast',tray:'托盘',overlay:'浮层',hotkey:'快捷键'} [p]||p);
const placementDesc = (p)=>({
  main:'作为主窗口中的一个页面/面板使用。',
  settings:'嵌入设置页，通常由表单类实例组成。',
  sidebar:'作为主窗口侧栏，适合检查器/大纲。',
  modal:'覆盖在当前页面上，阻塞并等待用户决策。',
  toast:'右下角短暂提示，不阻塞流程。',
  tray:'系统托盘/右键菜单中的快捷入口。',
  overlay:'屏幕浮层/HUD，通常置顶显示。',
  hotkey:'通过快捷键触发，通常打开一个浮层或命令面板。'
}[p]||'未知放置位置。');
const DEFAULT_STATE={'surface.dialog':'waiting','surface.form':'ready','surface.card-grid':'ready','surface.table':'ready','surface.inspector':'ready','surface.notification':'visible','surface.command-palette':'searching','surface.run-history':'ready','surface.canvas':'editing','surface.wizard':'editing','surface.dashboard':'ready','surface.metric-card':'ok','surface.diff':'ready','surface.tray-menu':'open','surface.hud':'visible','surface.tree':'ready'};
const ACTION_LABELS={submit:'提交',cancel:'取消',reset:'重置',test:'测试',next:'下一步',back:'上一步',finish:'完成',approve:'批准',reject:'拒绝',save:'保存',run:'运行',open:'打开',dismiss:'关闭',retry:'重试',openSettings:'打开设置',replaceBinding:'更换绑定',openSubflow:'打开子流程',inspect:'查看',createInstance:'新建实例',replay:'回放',export:'导出',accept:'接受',revert:'回滚',pin:'固定',drilldown:'下钻',openRun:'打开运行',chooseTemplate:'选模板',bindSlots:'绑定槽位'};
const FIELD_LABELS={defaultApp:'默认 VPN',autoOpenApp:'自动打开 VPN',autoConnect:'自动连接 VPN',timeoutSec:'等待超时（秒）',rememberChoice:'记住选择',url:'目标 URL',vpnRequirement:'VPN 策略',checkReachability:'检查可达性',path:'目标文件',append:'追加写入',sourceLang:'源语言',targetLang:'目标语言',overlay:'显示浮层',sampleIntervalMs:'采样间隔（ms）',historySec:'历史窗口（秒）',cpuWarn:'CPU 警戒线（%）',gpuTempWarn:'GPU 温度警戒线（°C）',alwaysOnTop:'悬浮窗置顶'};

const KIND_LABELS={flowOutput:'FLOW OUTPUT',pointOutput:'POINT OUTPUT',store:'STORE',query:'QUERY',static:'STATIC',runFlow:'RUN FLOW',runPoint:'RUN POINT',command:'COMMAND',navigate:'NAVIGATE',approval:'APPROVAL',setState:'SET STATE'};
const CANDIDATES={
  data:[
    {kind:'flowOutput',target:'flow.ensure-vpn.approval',label:'VPN 审批上下文'},
    {kind:'flowOutput',target:'FlowRun.summary',label:'运行摘要'},
    {kind:'flowOutput',target:'selectedFlow.slots',label:'选中流程槽位'},
    {kind:'flowOutput',target:'inst.site-github.bindings.vpn',label:'站点实例的 VPN 绑定'},
    {kind:'flowOutput',target:'delete.action.context',label:'删除动作上下文'},
    {kind:'flowOutput',target:'deploy.action.context',label:'部署动作上下文'},
    {kind:'flowOutput',target:'flow.screenshot-translate.output',label:'截图翻译输出'},
    {kind:'pointOutput',target:'vpn.default.status@r1',label:'VPN 状态'},
    {kind:'pointOutput',target:'vpn.default.launch@r1',label:'VPN 启动'},
    {kind:'pointOutput',target:'vpn.default.connect@r1',label:'VPN 连接'},
    {kind:'pointOutput',target:'open.browser.github@r1',label:'打开 GitHub'},
    {kind:'pointOutput',target:'notify.system@r1',label:'系统通知'},
    {kind:'pointOutput',target:'net.reachable.github@r1',label:'GitHub 可达性'},
    {kind:'store',target:'settings.vpn.defaultApp',label:'默认 VPN'},
    {kind:'store',target:'settings.vpn.autoOpenApp',label:'自动打开 VPN'},
    {kind:'store',target:'settings.vpn.autoConnect',label:'自动连接 VPN'},
    {kind:'store',target:'settings.vpn.timeoutSec',label:'等待超时'},
    {kind:'store',target:'settings.general.theme',label:'主题'},
    {kind:'store',target:'settings.general.locale',label:'语言'},
    {kind:'query',target:'PointRegistry.list',label:'点目录'},
    {kind:'query',target:'PointRegistry.search',label:'点搜索'},
    {kind:'query',target:'FlowInstance.list',label:'线实例列表'},
    {kind:'query',target:'FlowInstance.listSites',label:'站点实例列表'},
    {kind:'query',target:'FlowRun.list',label:'运行列表'},
    {kind:'query',target:'FlowRun.listVpn',label:'VPN 运行列表'},
    {kind:'query',target:'SearchIndex.global',label:'全局搜索索引'},
    {kind:'query',target:'Metrics.vpn',label:'VPN 指标'},
    {kind:'query',target:'FlowClass.listTemplates',label:'流程模板'},
    {kind:'query',target:'Metrics.system.cards',label:'系统指标卡'},
    {kind:'query',target:'MetricStream.system',label:'系统指标流'},
    {kind:'query',target:'Metrics.system.compact',label:'系统紧凑摘要'},
    {kind:'query',target:'Metrics.system.tray',label:'系统托盘摘要'},
    {kind:'flowOutput',target:'MetricAlert.summary',label:'系统阈值告警'},
    {kind:'store',target:'Metrics.cpu.spec',label:'CPU 指标契约'},
    {kind:'store',target:'Metrics.gpu.spec',label:'GPU 指标契约'},
    {kind:'store',target:'Metrics.memory.spec',label:'内存指标契约'},
    {kind:'store',target:'Metrics.network.spec',label:'网速指标契约'},
    {kind:'store',target:'Metrics.disk.spec',label:'磁盘指标契约'},
    {kind:'store',target:'settings.system.sampleIntervalMs',label:'采样间隔'},
    {kind:'store',target:'settings.system.historySec',label:'历史窗口'},
    {kind:'store',target:'settings.system.cpu.warn',label:'CPU 警戒线'},
    {kind:'store',target:'settings.system.gpu.tempWarn',label:'GPU 温度警戒线'},
    {kind:'store',target:'settings.system.alwaysOnTop',label:'悬浮窗置顶'},
  ],
  action:[
    {kind:'runFlow',target:'inst.site-github@r1',label:'打开 GitHub'},
    {kind:'runFlow',target:'inst.site-youtube@r3',label:'打开 YouTube'},
    {kind:'runFlow',target:'inst.ensure-vpn-ask@r2',label:'VPN 保障（询问）'},
    {kind:'runFlow',target:'inst.ensure-vpn-auto@r1',label:'VPN 保障（自动打开）'},
    {kind:'runFlow',target:'inst.ensure-vpn-auto-connect@r1',label:'VPN 保障（自动连接）'},
    {kind:'runFlow',target:'inst.publish-site@r3',label:'发布站点'},
    {kind:'runFlow',target:'inst.cleanup-old-files@r2',label:'清理旧文件'},
    {kind:'runFlow',target:'inst.deploy-prod@r4',label:'部署生产'},
    {kind:'runPoint',target:'vpn.default.status@r1',label:'检测 VPN'},
    {kind:'runPoint',target:'vpn.default.launch@r1',label:'启动 VPN'},
    {kind:'runPoint',target:'vpn.default.connect@r1',label:'连接 VPN'},
    {kind:'runPoint',target:'open.browser.github@r1',label:'打开 GitHub'},
    {kind:'runPoint',target:'notify.system@r1',label:'系统通知'},
    {kind:'command',target:'settings.saveVpn',label:'保存 VPN 设置'},
    {kind:'command',target:'settings.saveGeneral',label:'保存通用设置'},
    {kind:'command',target:'pointInstance.update',label:'更新点实例'},
    {kind:'command',target:'pointInstance.create',label:'新建点实例'},
    {kind:'command',target:'flowInstance.replaceBinding',label:'更换槽位绑定'},
    {kind:'command',target:'flowClass.saveDraft',label:'保存流程草稿'},
    {kind:'command',target:'body.install',label:'安装 Body'},
    {kind:'command',target:'toast.dismiss',label:'关闭通知'},
    {kind:'command',target:'hud.pin',label:'固定 HUD'},
    {kind:'command',target:'hud.dismiss',label:'关闭 HUD'},
    {kind:'navigate',target:'surface.settings.vpn',label:'VPN 设置'},
    {kind:'navigate',target:'surface.settings.general',label:'通用设置'},
    {kind:'navigate',target:'surface.run-history.vpn',label:'VPN 运行历史'},
    {kind:'navigate',target:'surface.run-history.flow',label:'流程运行历史'},
    {kind:'navigate',target:'surface.inspector.point',label:'点检查器'},
    {kind:'navigate',target:'surface.inspector.slot-vpn',label:'VPN 槽位检查器'},
    {kind:'navigate',target:'surface.canvas.flow-editor',label:'线层编辑器'},
    {kind:'navigate',target:'surface.point-catalog',label:'点目录'},
    {kind:'navigate',target:'surface.command-palette.global',label:'全局命令面板'},
    {kind:'approval',target:'approval.open',label:'批准：打开'},
    {kind:'approval',target:'approval.cancel',label:'拒绝：取消'},
    {kind:'approval',target:'approval.confirm',label:'批准：确认'},
    {kind:'setState',target:'state.dirty',label:'设为 dirty'},
    {kind:'setState',target:'state.saved',label:'设为 saved'},
    {kind:'setState',target:'state.error',label:'设为 error'},
    {kind:'command',target:'metrics.pause',label:'暂停采样'},
    {kind:'command',target:'metrics.refresh',label:'立即刷新'},
    {kind:'command',target:'metrics.test',label:'测试指标流'},
    {kind:'command',target:'settings.saveSystem',label:'保存系统监控设置'},
  ]
};

const state={instanceId:'surface.system-monitor',query:'',uiState:'ready',picker:null,toastTimer:null};
const current=()=>byId(state.instanceId)||ALL[0];

function setInstance(id){
  closePicker();
  state.instanceId=id;
  const i=current();
  state.uiState=DEFAULT_STATE[i.classId]||(i.surfaceClass.states[0]||'ready');
  renderAll();
}

function renderInstanceList(){
  const q=state.query.trim().toLowerCase();
  const groups=[];
  DATA.classes.forEach(c=>{
    const list=c.instances.filter(i=>!q || [i.id,i.name,i.desc,c.id,c.name,...(i.dataBindings||[]).flatMap(b=>[b.slot,b.kind,b.target]),...(i.actionBindings||[]).flatMap(b=>[b.slot,b.kind,b.target])].join(' ').toLowerCase().includes(q));
    if(list.length) groups.push({c,list});
  });
  $('#instCount').textContent=`${groups.reduce((n,g)=>n+g.list.length,0)} / ${ALL.length}`;
  $('#instanceList').innerHTML=groups.length?groups.map(g=>`
    <div class="group-label" style="--c:${familyColor(g.c.family)}">${esc(g.c.icon)} ${esc(g.c.name)}</div>
    ${g.list.map(i=>`<button class="inst-row ${i.id===state.instanceId?'active':''}" data-inst="${esc(i.id)}"><span class="dot"></span><span>${esc(i.name)}</span><code>${esc(i.id)}</code></button>`).join('')}
  `).join(''):`<div class="empty">没有匹配的实例</div>`;
  $$('#instanceList [data-inst]').forEach(b=>b.onclick=()=>setInstance(b.dataset.inst));
}

function statePill(){
  const cls=state.uiState==='error'?'err':state.uiState==='waiting'?'warn':state.uiState==='ready'||state.uiState==='visible'?'ok':'';
  return `<span class="pill ${cls}">${esc(state.uiState)}</span>`;
}

function actionButtons(i,preferred=[]){
  let binds=i.actionBindings.filter(b=>preferred.includes(b.slot));
  if(!binds.length) binds=i.actionBindings.filter(b=>b.slot!=='cancel').slice(0,3);
  return binds.map((b,idx)=>{
    let label=ACTION_LABELS[b.slot]||b.slot;
    if(b.slot==='approve'){
      if(i.id.includes('delete')) label='确认删除';
      else if(i.id.includes('deploy')) label='确认部署';
      else if(i.id.includes('vpn')) label='打开 VPN';
    }
    if(b.slot==='reject'&&i.id.includes('vpn')) label='取消';
    if(b.slot==='test'&&i.id.includes('vpn')) label='测试 VPN';
    const tone=idx===0?'primary':(b.slot==='reject'||b.slot==='cancel'?'danger':'');
    return `<button class="wire-btn ${tone}" data-action="${esc(b.slot)}" data-target="${esc(b.target)}">${esc(label)}</button>`;
  }).join('');
}

function wireHead(kicker,title,desc){
  return `<div class="wire-head"><div><div class="wire-kicker">${esc(kicker)}</div><h3>${esc(title)}</h3><p>${esc(desc)}</p></div>${statePill()}</div>`;
}

function renderDialog(i){
  const isVpn=i.id.includes('vpn');
  const isDelete=i.id.includes('delete');
  const isDeploy=i.id.includes('deploy');
  const title=isVpn?'VPN 未运行':isDelete?'确认删除':isDeploy?'确认部署':i.name;
  const desc=isVpn?'VPN 软件没有打开。是否打开默认 VPN？':isDelete?'删除后不可恢复，确认继续？':isDeploy?'即将部署到生产环境，确认继续？':i.desc;
  return `<div class="dim"><div class="wire dialog-card">
    ${wireHead('APPROVAL · GATE',title,desc)}
    <div class="wire-body">
      <div class="form-row"><span class="form-label">上下文</span><span class="fake-input">${esc((i.dataBindings[0]||{}).target||'approval.context')}</span></div>
      <div class="form-row"><span class="form-label">实例</span><span class="fake-input">${esc(i.id)}@r${i.revision}</span></div>
      <div style="display:flex;gap:5px;margin-top:10px">${(i.dataBindings||[]).map(b=>`<span class="pill">${esc(b.slot)}</span>`).join('')}</div>
    </div>
    <div class="wire-foot">${actionButtons(i,['approve','reject','cancel','open'])}</div>
  </div></div>`;
}

function renderForm(i){
  const fields=(i.dataBindings||[]).slice(0,6);
  const rows=fields.map(b=>{
    const label=FIELD_LABELS[b.slot]||b.slot;
    if(['autoOpenApp','autoConnect','rememberChoice','append','overlay','checkReachability'].includes(b.slot)){
      return `<div class="form-row"><span class="form-label">${esc(label)}</span><span class="toggle ${['autoOpenApp','autoConnect','append','overlay'].includes(b.slot)?'on':''}"></span></div>`;
    }
    const val=b.slot==='defaultApp'?'DefaultVPN':b.slot==='timeoutSec'?'30':b.slot==='vpnRequirement'?'required':(b.target||'').split('.').pop();
    return `<div class="form-row"><span class="form-label">${esc(label)}</span><span class="fake-input">${esc(val)}</span></div>`;
  }).join('');
  return `<div class="wire">
    ${wireHead('FORM · SETTINGS',i.name,i.desc)}
    <div class="wire-body">${rows||'<div class="form-row"><span class="form-label">字段</span><span class="fake-input">schema-driven</span></div>'}</div>
    <div class="wire-foot">${actionButtons(i,['save','test','submit','cancel'])}</div>
  </div>`;
}

function renderCardGrid(i){
  if(i.id.includes('site')){
    const sites=[['YouTube','youtube.com','required'],['GitHub','github.com','required'],['Google','google.com','required'],['内网','intranet','none']];
    return `<div class="wire">${wireHead('CARD GRID · SITES',i.name,'点击卡片运行对应站点实例；VPN 由 flow.open-external-site 内部处理。')}
      <div class="wire-body"><div class="site-grid">${sites.map(([n,h,p])=>`<div class="site-card"><b>${n}</b><span>${h}</span><span class="state">${p==='required'?'VPN required':'direct'}</span></div>`).join('')}</div></div>
      <div class="wire-foot">${actionButtons(i,['run','open'])}</div></div>`;
  }
  return `<div class="wire">${wireHead('CARD GRID',i.name,i.desc)}
    <div class="wire-body"><div class="site-grid">${(i.dataBindings||[]).slice(0,4).map((b,idx)=>`<div class="site-card"><b>${esc(b.slot)} ${idx+1}</b><span>${esc(b.target)}</span><span class="state">card</span></div>`).join('')||'<div class="empty">cards</div>'}</div></div>
    <div class="wire-foot">${actionButtons(i,['run','open'])}</div></div>`;
}

function renderTable(i){
  const rows=i.id.includes('point')?[['vpn.status','PointClass','vpn.default.status@r1'],['app.launch','PointClass','vpn.default.launch@r1'],['sys.open','PointClass','open.browser.github@r1'],['flow.ensure-vpn','FlowClass','inst.ensure-vpn-ask@r2']]:
    i.id.includes('run')?[['FlowRun','ok','1,300ms'],['FlowRun','ok','220ms'],['FlowRun','error','—'],['FlowRun','ok','980ms']]:
    [['inst.site-github','FlowInstance','active'],['inst.site-youtube','FlowInstance','active'],['inst.site-intranet','FlowInstance','active']];
  return `<div class="wire">${wireHead('TABLE',i.name,i.desc)}<div class="wire-body">
    <table class="table-wire"><thead><tr><th>name</th><th>type</th><th>status / target</th></tr></thead><tbody>
      ${rows.map(r=>`<tr><td>${esc(r[0])}</td><td><span class="pill">${esc(r[1])}</span></td><td>${esc(r[2])}</td></tr>`).join('')}
    </tbody></table></div><div class="wire-foot">${actionButtons(i,['inspect','createInstance','run','open'])}</div></div>`;
}

function renderInspectorWire(i){
  const isSlot=i.id.includes('slot');
  const rows=isSlot?[['slot','slot.vpn'],['accepts','flow.ensure-vpn'],['default','inst.ensure-vpn-ask@r2'],['bound','inst.ensure-vpn-ask@r2'],['revision','r2']]:[['object',i.id],['class',i.classId],['revision','r'+i.revision],['status',i.status]];
  return `<div class="wire">${wireHead('INSPECTOR',i.name,i.desc)}<div class="wire-body">
    ${rows.map(([k,v])=>`<div class="form-row"><span class="form-label">${esc(k)}</span><span class="fake-input">${esc(v)}</span></div>`).join('')}
  </div><div class="wire-foot">${actionButtons(i,['replaceBinding','openSubflow','edit','bind','replay'])}</div></div>`;
}

function renderNotification(i){
  if(i.id.includes('system')) return `<div style="width:100%"><div class="toast-wire"><div class="bar"></div><b>GPU 温度告警</b><p>GPU 温度 86°C，超过警戒线 80°C。当前占用 94%，风扇 72%。</p><div class="toast-actions">${actionButtons(i,['open','dismiss'])}</div></div></div>`;
  const isVpn=i.id.includes('vpn');
  return `<div style="width:100%"><div class="toast-wire"><div class="bar"></div><b>${isVpn?'VPN 未连接':'运行完成'}</b><p>${isVpn?'VPN 软件已打开，但隧道未连接。你可以连接 VPN、打开 VPN 面板或取消。':'FlowRun #1287 成功，耗时 1.8s。'}</p><div class="toast-actions">${actionButtons(i,['openSettings','retry','openRun','dismiss'])}</div></div></div>`;
}

function renderPalette(i){
  return `<div class="wire palette-wire">${wireHead('COMMAND PALETTE',i.name,i.desc)}<div class="wire-body">
    <div class="palette-input">⌕ 输入命令、实例或设置…</div>
    <div class="palette-list">
      <div class="palette-item"><span class="dot"></span>打开 GitHub<code>inst.site-github</code></div>
      <div class="palette-item"><span class="dot"></span>打开 YouTube<code>inst.site-youtube</code></div>
      <div class="palette-item"><span class="dot"></span>VPN 设置<code>surface.settings.vpn</code></div>
      <div class="palette-item"><span class="dot"></span>运行历史<code>surface.run-history.vpn</code></div>
    </div></div><div class="wire-foot">${actionButtons(i,['run','open'])}</div></div>`;
}

function renderRunHistory(i){
  const rows=i.id.includes('vpn')?[['FlowRun · inst.site-github','ok','1.8s'],['↳ FlowRun · inst.ensure-vpn-ask','ok','1.3s'],['  ↳ PointRun · vpn.status','ok','80ms'],['  ↳ PointRun · app.launch','skipped','—'],['  ↳ PointRun · notify','ok','10ms']]:[['FlowRun #1287','ok','1.8s'],['FlowRun #1286','ok','2.1s'],['FlowRun #1285','error','—']];
  return `<div class="wire">${wireHead('RUN HISTORY',i.name,i.desc)}<div class="wire-body"><div class="run-wire">${rows.map(r=>`<div class="run-row"><b>${esc(r[0])}</b><span class="pill ${r[1]==='ok'?'ok':r[1]==='error'?'err':'warn'}">${esc(r[1])}</span><code>${esc(r[2])}</code></div>`).join('')}</div></div><div class="wire-foot">${actionButtons(i,['replay','openSettings','export'])}</div></div>`;
}

function renderCanvas(i){
  return `<div class="wire">${wireHead('CANVAS',i.name,i.desc)}<div class="wire-body"><div class="canvas-wire">
    <div class="canvas-node" style="left:14px;top:28px"><b>VPN 保障</b>flow.ensure-vpn</div>
    <div class="canvas-node" style="left:170px;top:28px"><b>可达性</b>net.reachable</div>
    <div class="canvas-node" style="left:326px;top:28px"><b>打开 URL</b>sys.open</div>
    <div class="canvas-node last" style="left:482px;top:28px"><b>通知</b>notify.toast</div>
    <div class="canvas-node" style="left:170px;top:120px"><b>槽位绑定</b>inst.ensure-vpn-ask@r2</div>
    <div class="canvas-node last" style="left:326px;top:120px"><b>FlowInstance</b>inst.site-github@r1</div>
  </div></div><div class="wire-foot">${actionButtons(i,['run','save','addNode','connect'])}</div></div>`;
}

function renderWizard(i){
  return `<div class="wire wizard-wire">${wireHead('WIZARD',i.name,i.desc)}<div class="wire-body">
    <div class="steps"><div class="step active">1 选模板</div><div class="step">2 绑槽位</div><div class="step">3 试运行</div></div>
    <div class="form-row"><span class="form-label">模板</span><span class="fake-input">flow.open-external-site</span></div>
    <div class="form-row"><span class="form-label">VPN 策略</span><span class="fake-input">required</span></div>
  </div><div class="wire-foot">${actionButtons(i,['next','back','finish','cancel'])}</div></div>`;
}

function sparkline(points,color='#06b6d4'){
  const w=320,h=44,min=Math.min(...points),max=Math.max(...points),span=Math.max(1,max-min);
  const pts=points.map((v,i)=>`${(i/(points.length-1))*w},${h-((v-min)/span)*(h-6)-3}`).join(' ');
  return `<svg class="mc-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><polyline points="0,${h} ${pts} ${w},${h}" fill="${color}" opacity=".08" stroke="none"/></svg>`;
}

function renderMetricCard(i){
  const cfg={
    cpu:{label:'CPU',value:'42',unit:'%',status:'ok',sub:'58°C · 3.9 GHz · 8C / 16T',points:[28,35,31,48,44,52,41,38,46,42],threshold:'warn 80% · critical 95%'},
    gpu:{label:'GPU',value:'67',unit:'%',status:'ok',sub:'63°C · VRAM 6.2 / 8 GB · Fan 48%',points:[42,51,58,62,70,66,72,64,69,67],threshold:'temp warn 80°C · critical 88°C'},
    memory:{label:'MEM',value:'39',unit:'%',status:'ok',sub:'12.4 / 32 GB · Swap 1.2 GB',points:[31,33,34,36,38,37,39,40,38,39],threshold:'warn 80% · critical 92%'},
    network:{label:'NET',value:'1.24',unit:'MB/s',status:'ok',sub:'↓ 1.24 MB/s · ↑ 240 KB/s · Ping 28ms',points:[18,42,30,66,52,80,44,61,35,58],threshold:'idle < 20 KB/s'},
    disk:{label:'DISK',value:'40',unit:'%',status:'ok',sub:'412 / 1024 GB · R 18 MB/s · W 4 MB/s · 41°C',points:[38,39,40,40,41,40,42,41,40,40],threshold:'warn 85% · critical 95%'}
  }[i.id.split('.').pop()]||{label:'METRIC',value:'—',unit:'',status:'unknown',sub:'no sample',points:[1,2,1,3,2,4,3],threshold:'—'};
  const color=cfg.status==='critical'?'#ef4444':cfg.status==='warn'?'#f59e0b':'#06b6d4';
  return `<div class="metric-card-preview">
    <div class="mc-head"><div><div class="mc-label">${cfg.label}</div><div class="mc-id">${esc(i.id)}@r${i.revision}</div></div><span class="pill ${cfg.status==='ok'?'ok':cfg.status==='warn'?'warn':'err'}">${cfg.status}</span></div>
    <div class="mc-value">${cfg.value}<small>${cfg.unit}</small></div>
    <div class="mc-sub">${cfg.sub}</div>
    ${sparkline(cfg.points,color)}
    <div class="mc-foot"><span>${cfg.threshold}</span><span>sample 1s · history 60s</span></div>
  </div>`;
}

function renderSystemDashboard(i){
  const tile=(k,v,s,width,color)=>`<div class="sys-tile"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div><div class="bar"><i style="width:${width}%;background:${color}"></i></div></div>`;
  return `<div class="wire">${wireHead('SYSTEM DASHBOARD',i.name,i.desc)}
    <div class="sys-note"><span class="sys-live">LIVE · 1s sample</span><span>uptime 3d 14h · 32 GB · RTX 4070</span></div>
    <div class="wire-body"><div class="sys-grid">
      ${tile('CPU','42%','58°C · 3.9 GHz',42,'#3b82f6')}
      ${tile('GPU','67%','63°C · VRAM 6.2/8 GB',67,'#8b5cf6')}
      ${tile('MEMORY','39%','12.4 / 32 GB',39,'#06b6d4')}
      ${tile('NETWORK','1.24 MB/s','↓1.24 · ↑240 KB/s',24,'#22c55e')}
      ${tile('DISK','40%','412 / 1024 GB',40,'#f59e0b')}
      ${tile('TEMP','58°C','CPU 58 · GPU 63',58,'#ef4444')}
    </div>${sparkline([26,38,31,55,44,67,52,61,48,57],'#06b6d4')}</div>
    <div class="wire-foot">${actionButtons(i,['pause','refresh','settings','openRun'])}</div></div>`;
}

function renderDashboard(i){
  if(i.id.includes('system')) return renderSystemDashboard(i);
  return `<div class="wire">${wireHead('DASHBOARD',i.name,i.desc)}<div class="wire-body"><div class="metric-grid">
    <div class="metric"><span>RUNS</span><b>1,284</b><div class="bar"><i style="width:78%"></i></div></div>
    <div class="metric"><span>SUCCESS</span><b>97.2%</b><div class="bar"><i style="width:97%"></i></div></div>
    <div class="metric"><span>VPN ERR</span><b>12</b><div class="bar"><i style="width:22%"></i></div></div>
  </div></div><div class="wire-foot">${actionButtons(i,['drilldown','openRun','refresh'])}</div></div>`;
}

function renderDiff(i){
  return `<div class="wire">${wireHead('DIFF',i.name,i.desc)}<div class="wire-body"><div class="diff-grid">
    <div class="diff-side"><div class="del">- vpnRequirement: required</div><div class="del">- timeoutSec: 30</div><div>  bindings: 4</div></div>
    <div class="diff-side"><div class="add">+ vpnRequirement: preferred</div><div class="add">+ timeoutSec: 45</div><div>  bindings: 4</div></div>
  </div></div><div class="wire-foot">${actionButtons(i,['accept','reject','revert','open'])}</div></div>`;
}

function renderTray(i){
  if(i.id.includes('system')) return `<div class="wire"><div class="wire-body"><div class="tray-wire">
    <div class="tray-item">CPU 42% · 58°C <span>›</span></div>
    <div class="tray-item">GPU 67% · 63°C <span>›</span></div>
    <div class="tray-item">RAM 12.4 / 32 GB <span>›</span></div>
    <div class="tray-item">NET ↓1.24 MB/s ↑240 KB/s <span>›</span></div>
    <div class="tray-sep"></div>
    <div class="tray-item">打开系统监控 <span>›</span></div>
  </div></div><div class="wire-foot">${actionButtons(i,['open'])}</div></div>`;
  return `<div class="wire"><div class="wire-body"><div class="tray-wire">
    <div class="tray-item">打开 GitHub <span>⌘G</span></div>
    <div class="tray-item">打开 YouTube <span>⌘Y</span></div>
    <div class="tray-sep"></div>
    <div class="tray-item">VPN 设置 <span>›</span></div>
    <div class="tray-item">运行历史 <span>›</span></div>
  </div></div><div class="wire-foot">${actionButtons(i,['run','open'])}</div></div>`;
}

function renderHud(i){
  if(i.id.includes('system')) return `<div class="hud-wire"><b>系统状态</b><div class="hud-grid">
    <div class="hud-item"><div class="k">CPU</div><div class="v">42%</div><div class="s">58°C</div></div>
    <div class="hud-item"><div class="k">GPU</div><div class="v">67%</div><div class="s">63°C</div></div>
    <div class="hud-item"><div class="k">RAM</div><div class="v">39%</div><div class="s">12.4/32 GB</div></div>
    <div class="hud-item"><div class="k">NET</div><div class="v">1.24M</div><div class="s">↓ · ↑240K</div></div>
  </div><div class="toast-actions">${actionButtons(i,['open','pin','dismiss'])}</div></div>`;
  return `<div class="hud-wire"><b>${i.id.includes('vpn')?'VPN 已连接':'已翻译'}</b><p>${i.id.includes('vpn')?'DefaultVPN · 1.3s · 节点 Tokyo':'截图翻译完成 · en → zh'}</p><div class="toast-actions">${actionButtons(i,['pin','dismiss','open'])}</div></div>`;
}

function renderTree(i){
  return `<div class="wire">${wireHead('TREE',i.name,i.desc)}<div class="wire-body"><div class="tree-wire">
    <div class="l1">▾ text</div><div class="l2">├─ text.template</div><div class="l2">└─ text.regex</div>
    <div class="l1">▾ window</div><div class="l2">├─ window.find</div><div class="l2">└─ window.activate</div>
    <div class="l1">▾ web</div><div class="l2">├─ http.request</div><div class="l2">└─ web.search</div>
  </div></div><div class="wire-foot">${actionButtons(i,['select','expand'])}</div></div>`;
}

function renderGeneric(i){
  const c=i.surfaceClass;
  return `<div class="wire">${wireHead('SURFACE INSTANCE',i.name,i.desc)}<div class="wire-body"><div class="generic-wire">
    ${(c.regions||[]).map(r=>`<div class="region">${esc(r)}</div>`).join('')||'<div class="region">body</div>'}
    <div class="chips" style="margin-top:8px">${(c.slots||[]).map(s=>`<span class="chip">${esc(s)}</span>`).join('')}</div>
  </div></div><div class="wire-foot">${actionButtons(i)}</div></div>`;
}

function renderPreview(i){
  const fn={'surface.dialog':renderDialog,'surface.metric-card':renderMetricCard,'surface.form':renderForm,'surface.card-grid':renderCardGrid,'surface.table':renderTable,'surface.inspector':renderInspectorWire,'surface.notification':renderNotification,'surface.command-palette':renderPalette,'surface.run-history':renderRunHistory,'surface.canvas':renderCanvas,'surface.wizard':renderWizard,'surface.dashboard':renderDashboard,'surface.diff':renderDiff,'surface.tray-menu':renderTray,'surface.hud':renderHud,'surface.tree':renderTree}[i.classId]||renderGeneric;
  $('#preview').innerHTML=fn(i);
  $('#preview').onclick=(e)=>{
    const b=e.target.closest('[data-action]');
    if(!b)return;
    toast(`模拟动作：${b.dataset.action} → ${b.dataset.target}`);
  };
}

function renderStateStrip(i){
  const states=i.surfaceClass.states||['ready'];
  $('#stateStrip').innerHTML=states.map(s=>`<button class="state-btn ${s===state.uiState?'active':''}" data-state="${esc(s)}">${esc(s)}</button>`).join('');
  $$('#stateStrip [data-state]').forEach(b=>b.onclick=()=>{state.uiState=b.dataset.state;renderPreview(i);renderStateStrip(i);toast(`状态预览：${state.uiState}`);});
}

function renderBindings(i){
  const d=i.dataBindings||[], a=i.actionBindings||[];
  const hist=i._history||[];
  $('#bindingCount').textContent=`${d.length} data · ${a.length} action`;
  const toolbar=`<div class="bind-toolbar"><span>点击任意绑定行更换 target</span>${hist.length?`<button class="undo-btn" id="undoBtn" title="恢复上一步 target 和 revision">↶ 撤销上一步</button>`:''}</div>`;
  const dataRows=d.length?d.map((b,idx)=>`<div class="bind-row" data-bind-type="data" data-bind-index="${idx}" title="点击更换绑定"><code title="${esc(b.target)}">${esc(b.target)}</code><span class="bind-arrow">→</span><code class="slot">${esc(b.slot)}</code></div>`).join(''):'<div class="muted" style="font-size:9px">无数据绑定</div>';
  const actionRows=a.length?a.map((b,idx)=>`<div class="bind-row" data-bind-type="action" data-bind-index="${idx}" title="点击更换绑定"><code class="slot">${esc(b.slot)}</code><span class="bind-arrow">→</span><code title="${esc(b.target)}">${esc(b.target)}</code></div>`).join(''):'<div class="muted" style="font-size:9px">无动作绑定</div>';
  $('#bindingMap').innerHTML=`${toolbar}<div class="bind-section"><h4><span>DATA → SLOT</span><span class="n">${d.length}</span></h4>${dataRows}</div><div class="bind-section"><h4><span>SLOT → ACTION</span><span class="n">${a.length}</span></h4>${actionRows}</div>`;
  const ub=$('#undoBtn'); if(ub) ub.onclick=(e)=>{e.stopPropagation();undoLast();};
}

function renderPlacement(i){
  const p=i.placement;
  $('#placementLabel').textContent=placementLabel(p);
  $('#placementMeta').textContent=`${placementLabel(p)} · ${p}`;
  const zones=[['main','主面板'],['sidebar','侧栏'],['settings','设置'],['modal','模态'],['toast','Toast'],['tray','托盘'],['overlay','浮层'],['hotkey','快捷键']];
  $('#monitor').innerHTML=zones.map(([k,label])=>`<div class="zone ${k} ${k===p?'active':''}">${label}</div>`).join('');
  $('#placeMeta').innerHTML=`<div class="kv"><span class="k">placement</span><span>${esc(p)}</span></div>
    <div class="kv"><span class="k">表面</span><span>${esc(placementLabel(p))}</span></div>
    <div class="kv"><span class="k">revision</span><span>r${i.revision}</span></div>
    <div class="kv"><span class="k">说明</span><span>${esc(placementDesc(p))}</span></div>`;
}

function renderHeader(i){
  const c=i.surfaceClass, col=familyColor(c.family);
  $('#stageKicker').textContent=`SURFACEINSTANCE · ${c.family.toUpperCase()}`;
  $('#instName').textContent=i.name;
  $('#instId').textContent=`${i.id} @ r${i.revision}`;
  $('#instDesc').textContent=i.desc;
  $('#instBadges').innerHTML=`<span class="badge cyan">${esc(c.icon)} ${esc(c.name)}</span><span class="badge">${esc(i.classId)}</span><span class="badge green">r${i.revision}</span><span class="badge amber">${esc(i.placement)}</span><span class="badge">${esc(i.status)}</span>${i._edited?'<span class="badge green">edited</span>':''}`;
  $('#stageKicker').style.color=col;
}

function renderInspector(i){
  const c=i.surfaceClass;
  const clean={id:i.id,surfaceClassId:i.classId,surfaceClassVersion:'1.0.0',name:i.name,desc:i.desc,placement:i.placement,revision:i.revision,status:i.status,dataBindings:i.dataBindings,actionBindings:i.actionBindings};
  const bindRows=(rows,kind)=>rows.length?rows.map((b,idx)=>`<tr data-bind-type="${kind}" data-bind-index="${idx}" title="点击更换绑定"><td class="mono">${esc(b.slot)}</td><td><span class="pill">${esc(b.kind)}</span></td><td class="mono">${esc(b.target)}</td></tr>`).join(''):`<tr><td colspan="3" class="muted" style="padding:7px">无</td></tr>`;
  $('#inspector').innerHTML=`
    <div class="insp-head">
      <div class="wire-kicker" style="color:${familyColor(c.family)}">SURFACECLASS · ${esc(c.family)}</div>
      <h2>${esc(c.icon)} ${esc(c.name)}</h2>
      <code>${esc(c.id)} @ v1.0.0</code>
      <p>${esc(c.summary)}</p>
    </div>
    <div class="insp-section"><h4>实例</h4><div class="chain">
      <div class="chain-step"><span class="dot"></span><div><b>SurfaceClass</b><code>${esc(c.id)}@v1.0.0</code></div></div>
      <div class="chain-step"><span class="dot" style="background:var(--green)"></span><div><b>SurfaceInstance</b><code>${esc(i.id)}@r${i.revision}</code></div></div>
      <div class="chain-step"><span class="dot" style="background:var(--amber)"></span><div><b>placement</b><code>${esc(i.placement)}</code></div></div>
    </div></div>
    <div class="insp-section"><h4>契约</h4><div class="chips">${(c.regions||[]).map(x=>`<span class="chip">${esc(x)}</span>`).join('')}</div><div class="chips" style="margin-top:5px">${(c.states||[]).map(x=>`<span class="chip state">${esc(x)}</span>`).join('')}</div></div>
    <div class="insp-section"><h4>数据绑定</h4><table class="bind-table"><thead><tr><th>slot</th><th>kind</th><th>target</th></tr></thead><tbody>${bindRows(i.dataBindings||[],'data')}</tbody></table></div>
    <div class="insp-section"><h4>动作绑定</h4><table class="bind-table"><thead><tr><th>slot</th><th>kind</th><th>target</th></tr></thead><tbody>${bindRows(i.actionBindings||[],'action')}</tbody></table></div>
    ${(i._history||[]).length?`<div class="insp-section"><h4>变更记录 <span class="n">${i._history.length}</span></h4><div class="chain">${i._history.slice(-4).reverse().map(h=>`<div class="chain-step"><span class="dot" style="background:var(--amber)"></span><div><b>${esc(h.type)} · ${esc(h.slot)}</b><code>${esc(h.old.target)} → ${esc(h.new.target)} · r${h.oldRev} → r${h.newRev}</code></div></div>`).join('')}</div></div>`:''}
    <div class="insp-section"><h4>SurfaceInstance JSON</h4><pre class="json">${esc(JSON.stringify(clean,null,2))}</pre></div>`;
}

function openPicker(type,index){
  const i=current(); const arr=type==='data'?i.dataBindings:i.actionBindings; const b=arr[index];
  if(!b) return;
  state.picker={type,index,query:''};
  $('#pickerTitle').textContent=`更换${type==='data'?'数据':'动作'}绑定 · ${b.slot}`;
  $('#pickerSub').textContent=`当前：${b.kind} → ${b.target}`;
  $('#pickerSearch').value='';
  $('#picker').classList.remove('hidden');
  renderPickerList();
  setTimeout(()=>$('#pickerSearch').focus(),30);
}
function closePicker(){
  state.picker=null;
  const el=$('#picker'); if(el) el.classList.add('hidden');
}
function pickerCandidates(){
  const p=state.picker; if(!p) return [];
  const items=[...CANDIDATES[p.type]];
  const i=current(); const b=(p.type==='data'?i.dataBindings:i.actionBindings)[p.index];
  if(b && !items.some(c=>c.kind===b.kind&&c.target===b.target)) items.unshift({kind:b.kind,target:b.target,label:'当前绑定'});
  const q=(p.query||'').trim().toLowerCase();
  return items.filter(c=>!q || [c.kind,c.target,c.label].join(' ').toLowerCase().includes(q));
}
function renderPickerList(){
  const p=state.picker; if(!p) return;
  const items=pickerCandidates();
  const groups={};
  items.forEach(c=>{(groups[c.kind]??=[]).push(c);});
  const i=current(); const cur=(p.type==='data'?i.dataBindings:i.actionBindings)[p.index];
  $('#pickerList').innerHTML=items.length?Object.entries(groups).map(([kind,list])=>`<div class="cand-group"><h4><span>${esc(KIND_LABELS[kind]||kind)}</span><span class="n">${list.length}</span></h4>${list.map(c=>`<div class="cand ${cur&&cur.kind===c.kind&&cur.target===c.target?'current':''}" data-cand-kind="${esc(c.kind)}" data-cand-target="${esc(c.target)}"><span class="dot"></span><div style="min-width:0"><b>${esc(c.label||c.target)}</b><code>${esc(c.target)}</code></div><span class="tag">${esc(c.kind)}</span></div>`).join('')}</div>`).join(''):`<div class="empty">没有匹配的候选 target</div>`;
  $$('#pickerList [data-cand-target]').forEach(el=>el.onclick=()=>applyCandidate(el.dataset.candKind,el.dataset.candTarget));
}
function applyCandidate(kind,target){
  const p=state.picker; if(!p) return;
  const i=current(); const arr=p.type==='data'?i.dataBindings:i.actionBindings; const b=arr[p.index];
  if(!b) return;
  const old={kind:b.kind,target:b.target,slot:b.slot}; const oldRev=i.revision;
  b.kind=kind; b.target=target; i.revision+=1; i._edited=true; i._history=i._history||[];
  i._history.push({type:p.type,slot:b.slot,old,new:{kind:b.kind,target:b.target},oldRev,newRev:i.revision});
  const msg=`${b.slot}: ${old.kind} → ${kind} · ${target} · r${i.revision}`;
  closePicker(); renderAll(); toast(msg);
}
function undoLast(){
  const i=current(); const h=(i._history||[]).pop();
  if(!h){toast('没有可撤销的变更');return;}
  const arr=h.type==='data'?i.dataBindings:i.actionBindings; const b=arr.find(x=>x.slot===h.slot);
  if(b){b.kind=h.old.kind;b.target=h.old.target;}
  i.revision=Math.max(1,h.oldRev);
  if(!(i._history||[]).length) i._edited=false;
  renderAll(); toast(`已撤销 ${h.slot} · 回到 r${i.revision}`);
}

function renderAll(){
  const i=current();
  renderInstanceList();renderHeader(i);renderPreview(i);renderStateStrip(i);renderBindings(i);renderPlacement(i);renderInspector(i);
}

function toast(msg){
  const t=$('#toast');t.textContent=msg;t.classList.add('show');
  clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>t.classList.remove('show'),1700);
}

function initTheme(){
  let saved=null;try{saved=localStorage.getItem('surface-instance-theme');}catch(e){}
  if(saved==='light')document.body.classList.add('light');
  updateThemeBtn();
  $('#themeBtn').onclick=()=>{
    document.body.classList.toggle('light');
    try{localStorage.setItem('surface-instance-theme',document.body.classList.contains('light')?'light':'dark');}catch(e){}
    updateThemeBtn();
    toast(document.body.classList.contains('light')?'已切换浅色主题':'已切换深色主题');
  };
}
function updateThemeBtn(){$('#themeBtn').textContent=document.body.classList.contains('light')?'☀':'☾';}

function init(){
  initTheme();$('#picker').classList.add('hidden');renderAll();
  $('#search').oninput=(e)=>{state.query=e.target.value;renderInstanceList();};
  $('#bindingMap').onclick=(e)=>{
    if(e.target.closest('#undoBtn')) return;
    const row=e.target.closest('[data-bind-index]');
    if(row) openPicker(row.dataset.bindType,Number(row.dataset.bindIndex));
  };
  $('#inspector').onclick=(e)=>{
    const row=e.target.closest('[data-bind-index]');
    if(row) openPicker(row.dataset.bindType,Number(row.dataset.bindIndex));
  };
  $('#pickerClose').onclick=closePicker;
  $('#pickerCancel').onclick=closePicker;
  $('#picker').onclick=(e)=>{if(e.target===$('#picker')) closePicker();};
  $('#pickerSearch').oninput=(e)=>{if(state.picker){state.picker.query=e.target.value;renderPickerList();}};
  document.addEventListener('keydown',(e)=>{
    if(e.key==='Escape'&&state.picker){closePicker();return;}
    if(e.key==='/'&&document.activeElement!==$('#search')){e.preventDefault();$('#search').focus();}
    if(e.key==='Escape'&&document.activeElement===$('#search')){state.query='';$('#search').value='';$('#search').blur();renderInstanceList();}
  });
}
document.addEventListener('DOMContentLoaded',init);

