# Prototypes

全部可交互 HTML 原型放在这个目录。所有页面互相引用同一目录下的文件名，保持平铺以避免相对路径失效。

## 管理页

| 页面 | 作用 |
|---|---|
| `settings-workspace-settings-only.html` | 设置页：只有“设置”，顶部管理页跳转 |
| `settings-workspace.html` | 通用设置版 |
| `atom-catalog-management.html` | 点层管理页（稳定版） |
| `line-management.html` | 线层管理页 |
| `surface-management.html` | 面层管理页 |
| `panel-management.html` | 面板管理页（CRUD + 工作台） |
| `gesture-management.html` | 手势管理页（按需识别 + 点/线映射） |
| `dock-management.html` | 启动坞管理页（CLaunch 式编辑） |
| `body-management.html` | 体层管理页 |
| `field-management.html` | 场层管理页 |
| `layer-management.html` | 通用层管理页（体/场兜底） |

## 可视化 / 参考页

| 页面 | 参考 |
|---|---|
| `atom-catalog.html` | 点层目录 / 管理基底 |
| `point-studio-visual.html` | 点层工作室 |
| `atom-3d.html` / `atom-3d-axes.html` | 原子 3D 视图 |
| `atom-line-visual.html` | 线层数据流图 |
| `surface-catalog.html` | SurfaceClass / SurfaceInstance 目录 |
| `surface-instance-visual.html` | SurfaceInstance 预览 |
| `panel-layer-visual.html` | PanelClass / PanelInstance anatomy |
| `gesture-binding-surface.html` | 手势识别参考 |
| `launch-dock-surface.html` | CLaunch 启动坞参考 |
| `quick-launch-surface.html` | 快捷启动面 |
| `body-layer-visual.html` | BodyClass / BodyInstance 可视化 |
| `settings-visual.html` | 设置视觉参考 |

## 快照 / 历史版本

这些是稳定快照或早期版本，日常使用上面的管理页：

```text
atom-catalog-manage.html
body-management-v2.html
dock-management-v2.html
field-management-v2.html
gesture-management-v2.html
gesture-management-final.html
line-management-v2.html
panel-management-v2.html
point-layer-current.html
settings-workspace-layers.html
settings-workspace-two-tabs.html
settings-workspace-v2.html
surface-management-v2.html
```

## 约定

- 所有 HTML 平铺在同一目录，互相引用使用裸文件名。
- 不在这里放数据、构建脚本或设计文档；它们分别在 `../build/` 和 `../design/`。
