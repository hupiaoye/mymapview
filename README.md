# 我的地图 - 轻量级地图查看软件

基于 Electron + React + OpenLayers 的个人地图查看工具，支持多地图源、多格式数据导入导出。

## 功能特点

### 地图源支持
- 高德地图（标准/卫星）
- 天地图
- OpenStreetMap
- 百度地图
- 卫星影像

### 数据格式支持
- **导入**: KML/KMZ, GPX, CSV/Excel, GeoJSON, Shapefile, DXF/DWG
- **导出**: KML, GPX, GeoJSON, CSV

### 工具功能
- 坐标转换（WGS84/GCJ02/BD09）
- 面积测量
- 距离测量
- 标注管理
- 图层管理

## 安装与运行

### 环境要求
- Node.js >= 16
- npm 或 yarn

### 安装步骤

```bash
# 1. 进入项目目录
cd my-map-viewer

# 2. 安装主进程依赖
npm install

# 3. 安装React应用依赖
cd react-app
npm install
cd ..

# 4. 启动开发模式
npm start
```

### 构建Windows安装包

```bash
# 构建生产版本
npm run build:win
```

## 项目结构

```
my-map-viewer/
├── electron/               # Electron主进程
│   └── main.js
├── react-app/             # React应用
│   ├── public/
│   ├── src/
│   │   ├── components/    # React组件
│   │   ├── utils/         # 工具函数
│   │   │   ├── coordConvert.js  # 坐标转换
│   │   │   ├── kmlParser.js     # KML解析
│   │   │   ├── gpxParser.js     # GPX解析
│   │   │   ├── csvParser.js     # CSV/Excel解析
│   │   │   ├── geojsonParser.js # GeoJSON解析
│   │   │   ├── shapefileParser.js # Shapefile解析
│   │   │   └── dxfParser.js     # DXF解析
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
├── assets/                # 应用资源
├── package.json
└── README.md
```

## 使用说明

### 导入数据
1. 点击工具栏的"导入"按钮，或使用快捷键 Ctrl+O
2. 选择要导入的文件（支持多选）
3. 数据将自动显示在地图上

### 添加标注
1. 直接在地图上点击即可添加标注点
2. 标注会显示在右侧标注列表中
3. 可以定位或删除标注

### 坐标转换
1. 点击工具栏的"坐标转换"按钮
2. 选择源坐标系和目标坐标系
3. 输入经纬度，点击"转换"

### 测量工具
1. 点击"面积测量"或"距离测量"按钮
2. 在地图上绘制图形
3. 完成后显示测量结果

## 自定义配置

### 添加自定义坐标系
编辑 `react-app/src/utils/coordConvert.js` 中的 `CUSTOM_COORD_SYSTEMS` 对象。

### 修改地图源
编辑 `react-app/src/App.js` 中的 `MAP_SOURCES` 对象。

## 待实现功能

- [ ] 地理编码搜索
- [ ] 离线地图下载
- [ ] 数据同步功能
- [ ] 导出为PDF/图片
- [ ] 批量坐标转换
- [ ] 自定义样式配置

## 许可证

MIT License