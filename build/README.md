# Build Workspace

原型构建的中间产物，不是产品源码。

```text
sources/   HTML 片段与 JS 源块（settingsv-*、linemgmt-*、surfmgmt-*、dockmgmt-* 等）
data/      JSON 目录数据（layer-catalogs / surface / body / field / ai / panel / gesture / dock …）
checks/    node --check / mock runtime 检查脚本
tools/     一次性构建脚本（build_current_html.py / build_line_visual.py / parse_point_data.py）
```

注意：

- 构建脚本原先在仓库根目录按裸文件名查找源块；移动到 `build/` 后，若要重新运行，需要把脚本里的根路径改为 `build/sources/`、`build/data/`。
- 最终可打开的 HTML 在 `../prototypes/`，不在这里。
- 这个目录不是运行时依赖，可安全归档。
