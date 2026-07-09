# 广勘智图 (my-map-viewer)

桌面端地形图 / DXF 浏览与编辑工具，基于 **Electron + React + OpenLayers + proj4** 构建。
面向测绘、勘察、规划设计场景，支持导入常见矢量格式、按真实结构解析高程点（GCD）、
图层化浏览与要素编辑、多底图叠加与坐标系纠偏。

---

## ✨ 功能特性

- **多格式导入**：DXF（R2000 ASCII，GBK/GB18030）、KML、GPX、GeoJSON、Shapefile、CSV 等
- **DXF 精细化渲染**
  - 块参照（INSERT）展开为可见几何
  - 二维多段线炸开为独立线段（永不误闭合）
  - 文字统一细体、恒定屏幕像素（不随缩放放大）
- **GCD 高程点显示**：按真实结构解析 —— 高程数值来自 `INSERT(gc200)` 实体段携带的
  `ATTRIB(tag="height")`，在插入点生成橙红色恒定像素高程注记
- **图层管理**
  - 按图层显隐
  - 图层下展开元素列表（点 / 线 / 面 / 文字），点击元素即选中并地图定位高亮
- **要素编辑**：选中后在线编辑属性（文字内容 / 字号 / 坐标 X,Y / 半径 / 线宽 / 颜色）
- **多底图与纠偏**
  - 天地图（WGS84）、高德（自动叠加 GCJ-02 火星坐标系纠偏）、卫星等
  - 缩放放大至 20 级（源无瓦片时标量 overzoom）
- **坐标系转换**：本地工程坐标 ↔ WGS84（`tmerc` / `proj4`）互转，支持自定义坐标系

---

## 🧱 技术栈

| 层 | 技术 |
|----|------|
| 运行时 | Electron 28 |
| 前端 | React 18（react-scripts 5） |
| 地图 | OpenLayers |
| 坐标 | proj4 |

---

## 🚀 安装与运行

```bash
# 1. 克隆
git clone https://github.com/hupiaoye/mymapview.git
cd my-map-viewer

# 2. 安装依赖（根 + 前端）
npm install
cd react-app && npm install && cd ..

# 3. 开发模式（同时起 Electron 与 React 热更新）
npm start
```

---

## 📦 打包（Windows）

```bash
npm run build:win
# 产物：dist/广勘智图 Setup 1.0.0.exe
```

> 国内网络建议使用 npmmirror 镜像，避免 Electron 二进制下载超时：
> ```bash
> set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
> set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
> ```

---

## 📁 目录结构

```
my-map-viewer/
├── electron/                 # Electron 主进程
├── react-app/
│   ├── src/
│   │   ├── App.js            # 主界面、图层树、属性面板、地图交互
│   │   ├── components/       # 工具栏、侧栏、各类面板
│   │   └── utils/
│   │       ├── dxfParser.js  # DXF 解析（含 GCD 高程、块展开、炸开）
│   │       ├── coordSystems.js
│   │       └── ...
│   └── __verify__/           # 解析器单元测试与 DXF 夹具
├── assets/                   # 资源
├── docs/                     # 需求 / 分析文档
├── scripts/                  # 辅助脚本
└── package.json
```

---

## 📝 说明

- `node_modules/`、`dist/`、`react-app/build/`、`*.log` 等已写入 `.gitignore`，不纳入版本库。
- 仓库仅包含源码与配置，安装依赖后本地体积约 1.x GB，属正常。

---

## 📄 License

详见仓库 License 设置（默认保留所有权利，如需开源请自行添加 LICENSE）。
