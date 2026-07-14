import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import OlMap from 'ol/Map';
import View from 'ol/View';
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer';
import { XYZ, Vector as VectorSource } from 'ol/source';
import { createXYZ } from 'ol/tilegrid';
import { fromLonLat, toLonLat } from 'ol/proj';
import { Point, LineString, Polygon } from 'ol/geom';
import { Feature } from 'ol';
import { Style, Fill, Stroke, Circle as CircleStyle, Text, Icon } from 'ol/style';
import Draw from 'ol/interaction/Draw';
import DragBox from 'ol/interaction/DragBox';
import DragPan from 'ol/interaction/DragPan';
import KML from 'ol/format/KML';
import GeoJSON from 'ol/format/GeoJSON';
import ScaleLine from 'ol/control/ScaleLine';
import 'ol/ol.css';
import './index.css';

import { parseKML } from './utils/kmlParser';
import { parseGPX } from './utils/gpxParser';
import { parseCSV } from './utils/csvParser';
import { parseGeoJSON } from './utils/geojsonParser';
import { parseShapefile } from './utils/shapefileParser';
import { parseDXF, applyFeatureStyle, featureLabel } from './utils/dxfParser';
import { parseOVOBJ, featuresToOVOBJ } from './utils/ovobj';
import { ICON_LIBRARY, DEFAULT_ICON_ID, iconToDataUri, getIconById } from './utils/iconLibrary';
import { COORD_SYSTEMS, THREE_DEGREE_ZONES, convertCoordinate, setLocalEngineeringParams, wgs84togcj02, gcj02towgs84 } from './utils/coordSystems';
import { GridOverlayComponent } from './utils/gridOverlay';
import IconPicker from './components/IconPicker';

// 简单的Divider组件
const Divider = () => <hr style={{border: 'none', borderTop: '1px solid #ddd', margin: '12px 0'}} />;

const MAP_SOURCES = {
  // datum: 底图所用基准面。高德系为火星坐标系 GCJ-02；天地图系 CGCS2000≈WGS84。
  // maxZoom: 图源真实最大瓦片级别（高德/天地图均约 18），用于 overzoom 钳制。
  gaode: { name: '高德地图', datum: 'gcj02', maxZoom: 18, url: 'https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}' },
  gaodeSatellite: { name: '高德卫星', datum: 'gcj02', maxZoom: 18, url: 'https://webst01.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}' },
  tianditu_vec: { name: '天地图', datum: 'wgs84', maxZoom: 18, url: 'https://t0.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}&tk=329ae98a7ad41aa54ca64be0b33057a9' },
  tianditu_img: { name: '天地图影像', datum: 'wgs84', maxZoom: 18, url: 'https://t0.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}&tk=329ae98a7ad41aa54ca64be0b33057a9' },
  arcgis_img: { name: 'ArcGIS影像', datum: 'wgs84', maxZoom: 19, url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' }
};

// 注记（路网/地名）叠加层：透明中文注记，叠在卫星影像之上。仅 WGS84 底图可用
// （GCJ-02 底图与 WGS84 注记会偏移数百米，故对 GCJ-02 底图禁用）。
const ANNOTATION_SOURCE = {
  name: '天地图注记', datum: 'wgs84', maxZoom: 18,
  url: 'https://t0.tianditu.gov.cn/cia_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cia&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}&tk=329ae98a7ad41aa54ca64be0b33057a9'
};

// 注记叠加源构造（与底图同款 overzoom 钳制）
function buildAnnotationSource() {
  const def = ANNOTATION_SOURCE;
  const realMax = def.maxZoom != null ? def.maxZoom : 18;
  return new XYZ({
    crossOrigin: 'anonymous',
    tileGrid: createXYZ({ maxZoom: realMax }),
    maxZoom: realMax,
    tileUrlFunction: (tileCoord) => {
      const z = Math.min(tileCoord[0], realMax);
      const x = tileCoord[1];
      const y = tileCoord[2];
      return def.url.replace('{z}', z).replace('{x}', x).replace('{y}', y);
    }
  });
}

// 元素列表渲染上限（性能硬约束：GCD 等超大图层严禁一次性把上万要素塞进 DOM）
const ELEMENT_CAP = 300;        // 默认每层最多渲染的元素数
const ELEMENT_CAP_MAX = 2000;   // 点击"展开全部"后放宽到的上限

/**
 * 按要素 type 返回用于列表左侧色块的颜色，便于区分点/线/面/文字等类型。
 * @param {string} type - 要素类型字符串（如 dxf_point / dxf_text ...）
 * @returns {string} 十六进制颜色
 */
function elementTypeColor(type) {
  if (!type) return '#888888';
  if (type.includes('text')) return '#E91E63';
  if (type.includes('point') || type.includes('block')) return '#FF6600';
  if (type.includes('polyline') || type.includes('line')) return '#1976d2';
  if (type.includes('polygon') || type.includes('solid')) return '#388E3C';
  if (type.includes('circle') || type.includes('arc')) return '#7B1FA2';
  return '#888888';
}

/**
 * 由底图 key 推导其基准面（datum）。高德两源 -> 'gcj02'，其余 -> 'wgs84'。
 */
function getBasemapDatum(key) {
  const def = MAP_SOURCES[key];
  return (def && def.datum) || 'wgs84';
}

/**
 * 构造底图瓦片源，并实现 overzoom（标量放大）：
 *  - tileGrid 的 maxZoom 钳制在图源真实最大级（realMax，约 18），保证不会请求 19/20 级（不存在的瓦片 -> 404 空白）。
 *  - View 的 maxZoom 设为 20，超过 realMax 时由 OpenLayers 自动复用最高级瓦片并放大。
 *  - tileUrlFunction 中对请求级别 z 做防御性钳制（min(z, realMax)），作为双保险。
 */
function buildBasemapSource(key) {
  const def = MAP_SOURCES[key] || MAP_SOURCES.gaode;
  const realMax = def.maxZoom != null ? def.maxZoom : 18;
  return new XYZ({
    crossOrigin: 'anonymous',
    tileGrid: createXYZ({ maxZoom: realMax }),
    maxZoom: realMax,
    tileUrlFunction: (tileCoord) => {
      const z = Math.min(tileCoord[0], realMax);
      const x = tileCoord[1];
      const y = tileCoord[2];
      return def.url
        .replace('{z}', z)
        .replace('{x}', x)
        .replace('{y}', y);
    }
  });
}

/**
 * 将单个地图坐标（EPSG:3857）按基准面变换函数 fn 改写：
 * 先以 toLonLat 转经纬度 -> 应用 fn（wgs84togcj02 / gcj02towgs84）-> 再以 fromLonLat 写回 EPSG:3857。
 */
function applyDatumToCoord(coord, fn) {
  const ll = toLonLat(coord);
  const out = fn(ll[0], ll[1]);
  return fromLonLat(out);
}

/** 对几何做基准面变换（Point/LineString/Polygon 通用）。 */
function transformGeometryByDatum(geom, fn) {
  const type = geom.getType();
  if (type === 'Point') {
    geom.setCoordinates(applyDatumToCoord(geom.getCoordinates(), fn));
  } else if (type === 'LineString') {
    geom.setCoordinates(geom.getCoordinates().map((c) => applyDatumToCoord(c, fn)));
  } else if (type === 'Polygon') {
    geom.setCoordinates(geom.getCoordinates().map((ring) => ring.map((c) => applyDatumToCoord(c, fn))));
  }
}

/**
 * 批量将要素几何从当前基准面变换到目标基准面 toDatum。
 *  - 通过要素上的 'datum' 属性记录当前基准面，避免重复/错误变换（幂等）。
 *  - 跳过用户标注（含 markerData），标注本身是地图坐标，不应随底图基准面偏移。
 */
async function shiftFeaturesDatum(features, toDatum) {
  const fn = toDatum === 'gcj02' ? wgs84togcj02 : gcj02towgs84;
  for (const f of features) {
    if (f.get('markerData')) continue; // 用户标注不参与基准面变换
    const cur = f.get('datum') || 'wgs84';
    if (cur === toDatum) continue;
    const geom = f.getGeometry();
    if (!geom) { f.set('datum', toDatum); continue; }
    transformGeometryByDatum(geom, fn);
    f.set('datum', toDatum);
  }
}

/**
 * 按各要素的源坐标系（srcSystem + srcCoords）重新构建 WGS84 几何（坐标系重投影）。
 * 仅对含完整源坐标的要素重建；CIRCLE/ARC 仅保存圆心 srcCoords，无法重建完整圆，保留现有 WGS84 几何。
 * 重建后将其基准面重置为 'wgs84'，以便后续叠加基准面变换。
 */
async function rebuildGeometryFromSrc(features, targetSys) {
  for (const f of features) {
    const srcSystem = f.get('srcSystem');
    const srcCoords = f.get('srcCoords');
    const geom = f.getGeometry();
    // 无源坐标系/源坐标的要素（如早期块派生要素）无法重建，保持现有 datum 不变，
    // 避免 datum 与几何脱节导致重复偏移（修复高德/天地图切换时高程点漂移）。
    if (!srcSystem || !srcCoords || !srcCoords.length || !geom) { continue; }
    const type = geom.getType();
    try {
      const newCoords = [];
      for (const c of srcCoords) {
        const [lon, lat] = await convertCoordinate(c[0], c[1], srcSystem, 'wgs84');
        newCoords.push(fromLonLat([lon, lat]));
      }
      if (type === 'Polygon') {
        if (newCoords.length >= 3) geom.setCoordinates([newCoords.concat([newCoords[0]])]);
      } else if (type === 'Point') {
        geom.setCoordinates(newCoords[0]);
      } else {
        geom.setCoordinates(newCoords);
      }
      f.set('datum', 'wgs84');
    } catch (e) {
      console.warn('重投影要素失败:', e);
      f.set('datum', 'wgs84');
    }
  }
}

/**
 * 统一几何重算入口：可同时接受坐标系重投影（coordSystem）与基准面变换（datum），二者可叠加。
 * 坐标系重投影先执行（得到干净 WGS84），再叠加基准面（GCJ-02）变换。
 * @param {Array<Feature>} features - 要素数组
 * @param {Object} opts - { coordSystem?: string, datum?: 'wgs84'|'gcj02' }
 */
async function updateFeaturesGeometry(features, opts = {}) {
  const { coordSystem = null, datum = null } = opts;
  if (coordSystem) await rebuildGeometryFromSrc(features, coordSystem);
  if (datum) await shiftFeaturesDatum(features, datum);
}

function App() {
  const mapRef = useRef(null);
  const mapRef2 = useRef(null);
  const vectorSourceRef = useRef(new VectorSource()); // 保留声明（兼容，已不再作为唯一共享源）
  const drawRef = useRef(null);
  // 任务③：每个逻辑图层 = 独立的 OL VectorLayer（支持逐图层透明度与 z-order 拖拽排序）
  const olLayersRef = useRef(new Map()); // layerId -> OL VectorLayer
  const baseLayerRef = useRef(null);     // 底图瓦片层
  const annLayerRef = useRef(null);      // 注记叠加层
  const markersLayerRef = useRef(null);  // 标注层（恒置顶）
  const highlightLayerRef = useRef(null);// 框选高亮层
  const boxInteractionRef = useRef(null); // 框选 DragBox 交互
  // 任务4：用 ref 记录最新 activeTool / measureType，供地图点击处理器读取（避免闭包过期）
  const activeToolRef = useRef('pointer');
  const measureTypeRef = useRef(null);

  const [mapSource, setMapSource] = useState('gaode');
  const [layers, setLayers] = useState([]);
  const [markers, setMarkers] = useState([]);
  const [measureType, setMeasureType] = useState(null);
  const [measureResult, setMeasureResult] = useState(null);
  const [mousePos, setMousePos] = useState(null);
  const [zoom, setZoom] = useState(10);
  const [rightTab, setRightTab] = useState('layers');
  const [activeTool, setActiveTool] = useState('pointer');
  const [showCoordPicker, setShowCoordPicker] = useState(false);
  const [showCoordSysPicker, setShowCoordSysPicker] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [selectedCoordSys, setSelectedCoordSys] = useState('wgs84');
  const [importUnit, setImportUnit] = useState('m'); // DXF 坐标单位：米(m)/毫米(mm)
  const [showExport, setShowExport] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [editingMarker, setEditingMarker] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [globalCoordSys, setGlobalCoordSys] = useState(() => {
    return localStorage.getItem('globalCoordSys') || 'wgs84';
  });
  const [showCustomCoord, setShowCustomCoord] = useState(false);
  // 大文件导入进度（Bug A）：null 表示无导入进行中；[0,1] 表示进度
  const [importProgress, setImportProgress] = useState(null);
  // Q2 撤销/重做：操作栈（最多 50 步）。每个可撤销变更登记「逆操作 / 重做」闭包。
  const historyRef = useRef({ undo: [], redo: [] });
  const applyingHistoryRef = useRef(false); // undo/redo 执行期间跳过再次登记历史
  const pushHistory = (undoFn, redoFn) => {
    if (applyingHistoryRef.current) return;
    historyRef.current.undo.push({ undo: undoFn, redo: redoFn });
    historyRef.current.redo = [];
    if (historyRef.current.undo.length > 50) historyRef.current.undo.shift();
  };
  const undoAction = () => {
    const h = historyRef.current.undo.pop();
    if (!h) return;
    applyingHistoryRef.current = true;
    try { h.undo(); } catch (e) { console.error('撤销失败:', e); }
    applyingHistoryRef.current = false;
    historyRef.current.redo.push(h);
    showToast('已撤销', 'info');
  };
  const redoAction = () => {
    const h = historyRef.current.redo.pop();
    if (!h) return;
    applyingHistoryRef.current = true;
    try { h.redo(); } catch (e) { console.error('重做失败:', e); }
    applyingHistoryRef.current = false;
    historyRef.current.undo.push(h);
    showToast('已重做', 'info');
  };

  // Q4 图例符号编辑：按 DXF 图层码保存的样式覆盖（颜色/线宽/点半径/字号）
  const [layerStyles, setLayerStyles] = useState({});
  // 图例编辑草稿（未应用前的中间值）
  const [legendDraft, setLegendDraft] = useState({});
  // 任务4：选中的要素与属性编辑表单
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', color: '#FF0000', fontSize: 14, x: '', y: '', radius: 3, lineWidth: 1 });

  // 任务：DXF 图层可展开/收起，记录已展开图层 id 集合
  const [expandedLayers, setExpandedLayers] = useState(() => new Set());
  // 已放宽渲染上限（最多 2000）的图层 id 集合
  const [capRaisedLayers, setCapRaisedLayers] = useState(() => new Set());
  // 可见性切换后用于强制刷新列表图标的计数
  const [visTick, setVisTick] = useState(0);
  
  // 自定义坐标系参数（参照奥维）
  const [customCoord, setCustomCoord] = useState(() => {
    const saved = localStorage.getItem('customCoordParams');
    return saved ? JSON.parse(saved) : {
      coordType: 'guangzhou2000',      // 经纬度 <--> 自定义
      transformType: 'custom',          // 经纬度 <--> 自定义
      centralMeridian: 113.283333333333, // 中央经线
      latitudeBase: 0,                  // 纬度基线
      falseEasting: 39980,              // 东偏移
      falseNorthing: -2329620,          // 北偏移
      dx: 0, dy: 0, dz: 0,             // 三参数（米）
      rx: 0, ry: 0, rz: 0,             // 七参数旋转（秒）
      m: 0,                             // 七参数缩放（ppm）
      useCorrection: false,             // 使用校正参数
      deltaX: 0, deltaY: 0,            // 校正参数（米）
      projectionHeight: 0               // 投影高度
    };
  });

  // 任务①：注记叠加开关、框选工具、空格平移、toast 提示等状态
  const [showAnnotation, setShowAnnotation] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const [boxSelFeatures, setBoxSelFeatures] = useState([]); // 框选命中的要素（真实引用）
  const boxSelRef = useRef([]);                              // 同上，供闭包外同步读取
  const dragIdRef = useRef(null);                            // 拖拽排序：当前被拖动的图层 id
  const [spacePan, setSpacePan] = useState(false);          // 空格拖拽平移模式
  // 用 ref 持有最新 activeTool（供键盘/框选等闭包外读取，避免过期）
  const uiRef = useRef({});

  // 轻量 toast 提示（自动消失）
  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  };

  // 汇聚所有"数据图层"要素（用于坐标系变换、缩放适配、批量导出等）
  const getAllFeatures = () => {
    const all = [];
    olLayersRef.current.forEach((lyr) => {
      const src = lyr.getSource && lyr.getSource();
      if (src) all.push(...src.getFeatures());
    });
    if (markersLayerRef.current) all.push(...markersLayerRef.current.getSource().getFeatures());
    return all;
  };

  // 把逻辑图层渲染到地图：保持"列表顶部 = 地图顶层"，标注层恒置顶、高亮层次之
  const syncLayerOrder = () => {
    const map = mapRef2.current;
    if (!map) return;
    const desired = [baseLayerRef.current, annLayerRef.current];
    // 列表顶部应位于地图顶层 => 反序后作为数据层（底->顶）
    for (let i = layers.length - 1; i >= 0; i--) {
      const lyr = olLayersRef.current.get(layers[i].id);
      if (lyr) desired.push(lyr);
    }
    desired.push(highlightLayerRef.current, markersLayerRef.current);
    const mapLayers = map.getLayers();
    desired.forEach((lyr, i) => {
      if (!lyr) return;
      if (mapLayers.getArray().indexOf(lyr) !== i) {
        mapLayers.remove(lyr);
        mapLayers.insertAt(i, lyr);
      }
    });
  };

  // 新建一个数据图层（独立 VectorLayer），返回 OL 图层
  const createDataLayer = () => {
    const layer = new VectorLayer({
      source: new VectorSource(),
      style: new Style({
        fill: new Fill({ color: 'rgba(25,118,210,0.2)' }),
        stroke: new Stroke({ color: '#1976d2', width: 2 }),
        image: new CircleStyle({ radius: 8, fill: new Fill({ color: '#1976d2' }), stroke: new Stroke({ color: 'white', width: 2 }) })
      })
    });
    return layer;
  };

  // 渲染期同步最新 UI 状态到 ref（供键盘/Esc 等闭包外读取，避免过期）
  uiRef.current = { selectedFeature, showExport, showCoordPicker, showCoordSysPicker, showSettings, editingMarker, measureType, activeTool };

  // 任务4：同步 activeTool / measureType 到 ref，供地图事件处理器读取最新值（避免闭包过期）
  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { measureTypeRef.current = measureType; }, [measureType]);

  // 任务4：选中要素变化时，用要素当前属性初始化编辑表单
  useEffect(() => {
    if (!selectedFeature) return;
    const type = selectedFeature.get('type') || '';
    const isPoint = type === 'dxf_point' || type === 'dxf_block';
    const src = selectedFeature.get('srcCoords');
    setEditForm({
      name: selectedFeature.get('name') || '',
      color: selectedFeature.get('colorOverride') || '#FF0000',
      fontSize: selectedFeature.get('fontSize') || 14,
      x: (isPoint && src && src[0]) ? String(src[0][0]) : '',
      y: (isPoint && src && src[0]) ? String(src[0][1]) : '',
      radius: selectedFeature.get('pointRadius') || 3,
      lineWidth: selectedFeature.get('lineWidth') || 1
    });
  }, [selectedFeature]);

  // 任务①/④：把属性面板编辑写回 OL 要素（重建样式 / 重投影几何），地图即时刷新。
  // 支持传入 formOverride（实时编辑场景），缺省使用当前 editForm 快照。
  const applyFeatureEdit = async (formOverride) => {
    const f = selectedFeature;
    if (!f) return;
    const form = formOverride || editForm;
    const type = f.get('type') || '';
    const isPoint = type === 'dxf_point' || type === 'dxf_block';
    const isText = type === 'dxf_text';

    if (isText) {
      f.set('name', form.name);
      f.set('fontSize', parseFloat(form.fontSize) || 12);
    }
    f.set('colorOverride', form.color);
    if (isPoint) f.set('pointRadius', parseFloat(form.radius) || 3);
    else f.set('lineWidth', parseFloat(form.lineWidth) || 1);

    // 点坐标编辑：经源坐标系重投影更新几何。
    // 几何已随当前底图基准面物理偏移（datum 记录当前显示基准面），编辑后需先重投影到 WGS84，
    // 再叠加同一基准面偏移写回，保持与同图层其它要素一致——避免跳回 WGS84 造成错位，
    // 也避免 datum 仍为 gcj02 而几何是 WGS84 导致后续切底图时二次偏移、误差累积。
    if (isPoint) {
      const sx = parseFloat(form.x);
      const sy = parseFloat(form.y);
      if (isFinite(sx) && isFinite(sy)) {
        const srcSystem = f.get('srcSystem') || 'wgs84';
        const curDatum = f.get('datum') || 'wgs84';
        const [lon, lat] = await convertCoordinate(sx, sy, srcSystem, 'wgs84');
        const [dlon, dlat] = curDatum === 'gcj02' ? wgs84togcj02(lon, lat) : [lon, lat];
        f.set('srcCoords', [[sx, sy]]);
        const geom = f.getGeometry();
        if (geom && geom.getType() === 'Point') geom.setCoordinates(fromLonLat([dlon, dlat]));
      }
    }

    applyFeatureStyle(f);   // 据最新属性重建样式，地图即时刷新
  };

  // 任务①：属性编辑实时生效（类似 CAD 改属性）。非坐标字段随输入即时应用；
  // 坐标 X/Y 在失焦(blur)时应用，避免输入中途(如 "113.")触发几何重投影跳变。
  const applyField = (patch) => {
    const next = { ...editForm, ...patch };
    setEditForm(next);
    applyFeatureEdit(next);
  };
  const applyCoordEdit = () => {
    applyFeatureEdit();
  };

  // 初始化地图
  useEffect(() => {
    if (!mapRef.current || mapRef2.current) return;

    // 标注样式：标记(markerData)用 Icon 渲染
    function markerStyleFunc(feature) {
      const md = feature.get('markerData');
      if (!md) return new Style();
      const iconId = md.icon || DEFAULT_ICON_ID;
      const iconObj = getIconById(iconId);
      return new Style({
        image: new Icon({
          src: iconToDataUri(iconObj, 28),
          anchor: [0.5, 1],
          anchorXUnits: 'fraction',
          anchorYUnits: 'fraction',
          scale: 1
        })
      });
    }

    // 框选高亮样式（橙色）
    const highlightStyle = new Style({
      fill: new Fill({ color: 'rgba(249,115,22,0.18)' }),
      stroke: new Stroke({ color: '#f97316', width: 3 }),
      image: new CircleStyle({ radius: 7, fill: new Fill({ color: '#f97316' }), stroke: new Stroke({ color: '#fff', width: 2 }) })
    });

    const baseLayer = new TileLayer({ source: buildBasemapSource(mapSource) });
    const annLayer = new TileLayer({ source: buildAnnotationSource(), visible: false });
    const markersLayer = new VectorLayer({ source: new VectorSource(), style: markerStyleFunc });
    const highlightLayer = new VectorLayer({ source: new VectorSource(), style: highlightStyle });

    baseLayerRef.current = baseLayer;
    annLayerRef.current = annLayer;
    markersLayerRef.current = markersLayer;
    highlightLayerRef.current = highlightLayer;

    const map = new OlMap({
      target: mapRef.current,
      layers: [baseLayer, annLayer, markersLayer, highlightLayer],
      view: new View({ center: fromLonLat([113.264, 23.129]), zoom: 10, maxZoom: 20 }),
      controls: [
        new ScaleLine({ units: 'metric', bar: true, steps: 4, minWidth: 64 })
      ]
    });

    map.on('pointermove', (e) => {
      const c = toLonLat(e.coordinate);
      setMousePos({ lon: c[0].toFixed(6), lat: c[1].toFixed(6), x: e.coordinate[0].toFixed(2), y: e.coordinate[1].toFixed(2) });
    });

    map.getView().on('change:resolution', () => setZoom(map.getView().getZoom()));
    setZoom(map.getView().getZoom());

    // 任务4：点击选中要素。命中 DXF 要素 -> 存入 selectedFeature；空白处 -> 新增标注到独立标注层
    map.on('singleclick', (e) => {
      if (activeToolRef.current !== 'pointer' || measureTypeRef.current) return;
      let hit = null;
      map.forEachFeatureAtPixel(e.pixel, (f) => { hit = f; return true; }, { hitTolerance: 5 });
      if (hit && !hit.get('markerData')) {
        setSelectedFeature(hit);   // 命中 DXF 要素 -> 选中
        setRightTab('props');      // 任务①：选中要素后自动切到「属性」面板，与列表点击行为一致、可编辑
      } else {
        setSelectedFeature(null);  // 命中标注或空白 -> 清空选中
        if (!hit) {
          // 空白处：保留原有"新增标注"行为
          const c = toLonLat(e.coordinate);
          const m = { id: Date.now(), name: `标注${markers.length + 1}`, coordinates: c, color: '#e91e63', description: '', icon: DEFAULT_ICON_ID };
          setMarkers(prev => [...prev, m]);
          markersLayerRef.current.getSource().addFeature(new Feature({ geometry: new Point(e.coordinate), markerData: m }));
        }
      }
    });

    // 双击标注/标记 -> 打开编辑弹窗（可修改图标）
    map.on('dblclick', (e) => {
      if (activeToolRef.current !== 'pointer') return;
      let hit = null;
      map.forEachFeatureAtPixel(e.pixel, (f) => { hit = f; return true; }, { hitTolerance: 8 });
      if (hit && hit.get('markerData')) {
        const md = hit.get('markerData');
        handleEditMarker(md);
      }
    });

    mapRef2.current = map;
    return () => { map.setTarget(null); mapRef2.current = null; };
  }, []);

  // 切换地图源：重建底图瓦片源（含 overzoom）+ 注记源；并按新底图基准面重算已加载要素几何
  useEffect(() => {
    if (!mapRef2.current) return;
    if (baseLayerRef.current) baseLayerRef.current.setSource(buildBasemapSource(mapSource));
    // 注记仅 WGS84 底图可用（GCJ-02 底图与 WGS84 注记会错位）
    const datum = getBasemapDatum(mapSource);
    if (annLayerRef.current) {
      annLayerRef.current.setSource(buildAnnotationSource());
      annLayerRef.current.setVisible(showAnnotation && datum === 'wgs84');
    }
    // 高德(GCJ-02)与天地图(WGS84)基准面不同，切换时需对要素几何做偏移/反偏移
    updateFeaturesGeometry(getAllFeatures(), { datum });
  }, [mapSource]);

  // 注记叠加开关（仅 WGS84 底图生效）
  useEffect(() => {
    if (!annLayerRef.current || !mapRef2.current) return;
    const datum = getBasemapDatum(mapSource);
    annLayerRef.current.setVisible(showAnnotation && datum === 'wgs84');
  }, [showAnnotation, mapSource]);

  // 图层列表顺序 ↔ 地图 z-order 同步（列表顶部 = 地图顶层；标注层恒置顶）
  useEffect(() => {
    syncLayerOrder();
  }, [layers]);

  // 框选工具：拉框选中范围内全部要素并高亮（与拖拽平移互斥）
  useEffect(() => {
    const map = mapRef2.current;
    if (!map) return;
    // 清理上一次交互并恢复默认拖拽平移
    if (boxInteractionRef.current) {
      map.removeInteraction(boxInteractionRef.current);
      boxInteractionRef.current = null;
    }
    map.getInteractions().forEach(i => { if (i instanceof DragPan) i.setActive(true); });
    if (activeTool !== 'box') return;

    // 框选模式下禁用默认拖拽平移，避免与拉框冲突
    map.getInteractions().forEach(i => { if (i instanceof DragPan) i.setActive(false); });

    const dragBox = new DragBox();
    dragBox.on('boxend', () => {
      const extent = dragBox.getGeometry().getExtent();
      const sel = [];
      olLayersRef.current.forEach(lyr => {
        const src = lyr.getSource();
        if (!src) return;
        src.forEachFeatureInExtent(extent, (f) => {
          const g = f.getGeometry();
          if (g && g.intersectsExtent(extent)) sel.push(f);
        });
      });
      const hl = highlightLayerRef.current.getSource();
      hl.clear();
      sel.forEach(f => { const g = f.getGeometry(); if (g) hl.addFeature(new Feature({ geometry: g.clone() })); });
      boxSelRef.current = sel;
      setBoxSelFeatures(sel);
      if (sel.length) showToast(`已框选 ${sel.length} 个要素`, 'success');
      else showToast('框选范围内没有要素', 'info');
    });
    map.addInteraction(dragBox);
    boxInteractionRef.current = dragBox;
  }, [activeTool]);

  // 测量工具
  useEffect(() => {
    if (!mapRef2.current) return;
    if (drawRef.current) { mapRef2.current.removeInteraction(drawRef.current); drawRef.current = null; }
    if (measureType) {
      const src = new VectorSource();
      mapRef2.current.addLayer(new VectorLayer({ source: src, style: new Style({ fill: new Fill({ color: 'rgba(255,0,0,0.2)' }), stroke: new Stroke({ color: '#f00', width: 2 }) }) }));
      const draw = new Draw({ source: src, type: measureType === 'area' ? 'Polygon' : 'LineString' });
      draw.on('drawend', (e) => {
        const g = e.feature.getGeometry();
        if (measureType === 'area') {
          const coords = g.getCoordinates()[0];
          let area = 0;
          for (let i = 0; i < coords.length - 1; i++) {
            const p1 = toLonLat(coords[i]), p2 = toLonLat(coords[i + 1]);
            area += (p2[0] - p1[0]) * (p1[1] + p2[1]);
          }
          setMeasureResult({ value: (Math.abs(area) * 123210).toFixed(2), unit: 'm²' });
        } else {
          const coords = g.getCoordinates();
          let dist = 0;
          for (let i = 1; i < coords.length; i++) {
            const p1 = toLonLat(coords[i - 1]), p2 = toLonLat(coords[i]);
            dist += Math.sqrt(Math.pow((p2[0] - p1[0]) * 111000, 2) + Math.pow((p2[1] - p1[1]) * 111000, 2));
          }
          setMeasureResult({ value: dist > 1000 ? (dist / 1000).toFixed(3) : dist.toFixed(2), unit: dist > 1000 ? 'km' : 'm' });
        }
      });
      mapRef2.current.addInteraction(draw);
      drawRef.current = draw;
    }
  }, [measureType]);

  // 导入数据统一入口（Electron 与 WinForms+WebView2 共用）：files = [{name, content, isBinary}]
  const handleImportData = (event, files) => {
    if (files && files.length > 0) {
      const currentCoordSys = localStorage.getItem('globalCoordSys') || 'wgs84';
      const autoFiles = [];   // 自动探测可信、可直接导入
      const promptFiles = []; // 需手动选坐标系

      for (const f of files) {
        const ext = f.name.split('.').pop().toLowerCase();
        if (['dxf', 'dwg'].includes(ext)) {
          const dt = detectDXFCoordSystem(f.content, f.name);
          if (dt.confident) autoFiles.push({ f, sys: dt.sys });
          else promptFiles.push(f);
        } else {
          // shp/csv/xlsx 无可靠自动探测，交用户选择
          promptFiles.push(f);
        }
      }

      if (autoFiles.length) {
        const names = [...new Set(autoFiles.map(a => a.sys))];
        autoFiles.forEach(({ f, sys }) => doImport([f], sys, importUnit));
        showToast(`已自动识别坐标系并导入：${names.join('、')}`, 'success');
      }
      if (promptFiles.length) {
        setPendingFiles(promptFiles);
        setSelectedCoordSys(currentCoordSys);
        setShowCoordSysPicker(true);
      }
    }
  };

  // IPC监听器（仅 Electron 环境注册；WebView2 下 window.require 不存在，自动跳过）
  useEffect(() => {
    if (!window.require) return;
    const { ipcRenderer } = window.require('electron');
    ipcRenderer.on('import-data', handleImportData);
    return () => {
      ipcRenderer.removeListener('import-data', handleImportData);
    };
  }, []);

  // ===== WinForms + WebView2 桥接（C# ↔ JS） =====
  // WebView2 环境 window.chrome.webview 存在；Electron 下忽略。C# 通过 window.__gkApp 调用，
  // JS 通过 window.chrome.webview.postMessage 回传图层树/选中要素/状态。
  useEffect(() => {
    const w = window;
    const post = (obj) => { try { if (w.chrome && w.chrome.webview) w.chrome.webview.postMessage(JSON.stringify(obj)); } catch (e) {} };
    w.__gkPost = post;
    // 供 importFiles 调用：把已取到字节的 files 交给统一的导入入口
    w.__gkAppImport = (files) => handleImportData(null, files);
    w.__gkApp = {
      // items: [{name, token, isBinary}]，token 由本地服务 /api/upload 返回
      async importFiles(items) {
        try {
          const files = [];
          for (const it of (items || [])) {
            const res = await fetch('/api/file?token=' + encodeURIComponent(it.token));
            const buf = await res.arrayBuffer();
            files.push({ name: it.name, content: new Uint8Array(buf), isBinary: !!it.isBinary });
          }
          if (files.length) w.__gkAppImport(files);
        } catch (e) { console.error('importFiles 失败', e); }
      },
      fit() { try { const map = mapRef2.current; if (!map) return; const ext = map.getView().calculateExtent(map.getSize()); map.getView().fit(ext, { padding: [60, 60, 60, 60], maxZoom: 19, duration: 300 }); } catch (e) {} },
      zoomIn() { try { zoomIn(); } catch (e) {} },
      zoomOut() { try { zoomOut(); } catch (e) {} },
      setLayerVisible(id, vis) {
        const ol = olLayersRef.current && olLayersRef.current.get(id);
        if (ol) ol.setVisible(!!vis);
        setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !!vis } : l));
      },
      setLayerOpacity(id, val) {
        const ol = olLayersRef.current && olLayersRef.current.get(id);
        const v = (typeof val === 'number') ? val : parseFloat(val);
        if (ol && isFinite(v)) ol.setOpacity(v);
        setLayers(prev => prev.map(l => l.id === id ? { ...l, opacity: isFinite(v) ? v : l.opacity } : l));
      },
      exportData(fmt) { try { exportData(fmt); } catch (e) {} },
      // 属性面板回写：patch = {name, colorOverride, fontSize, pointRadius, lineWidth, ...}
      updateFeature(fid, patch) {
        try {
          const map = mapRef2.current; if (!map) return;
          let target = null;
          map.getLayers().getArray().forEach(l => {
            if (target) return;
            const s = l.getSource && l.getSource();
            if (s && s.getFeatures) s.getFeatures().forEach(f => { if (target) return; if ((f.get('fid') || f.ol_uid) === fid) target = f; });
          });
          if (!target) return;
          Object.keys(patch || {}).forEach(k => target.set(k, patch[k]));
          if (typeof applyFeatureStyle === 'function') applyFeatureStyle(target);
        } catch (e) {}
      }
    };
    return () => { try { delete w.__gkApp; delete w.__gkAppImport; } catch (e) {} };
  }, []);

  // 图层变化 → 推送给 WinForms 图层树
  useEffect(() => {
    if (window.__gkPost) window.__gkPost({ type: 'layers', layers: (layers || []).map(l => ({ id: l.id, name: l.name, visible: l.visible !== false, opacity: l.opacity != null ? l.opacity : 1 })) });
  }, [layers]);

  // 选中要素 → 推送给 WinForms 属性面板（只读关键属性，编辑经 updateFeature 回写）
  useEffect(() => {
    if (!window.__gkPost) return;
    const f = selectedFeature;
    if (!f) { window.__gkPost({ type: 'select', feature: null }); return; }
    window.__gkPost({
      type: 'select',
      feature: {
        fid: f.get('fid') || f.ol_uid,
        layer: f.get('layer') || '',
        type: f.get('type') || '',
        name: f.get('name') || '',
        fromBlock: !!f.get('fromBlock'),
        fromAttrib: !!f.get('fromAttrib'),
        attTag: f.get('attTag') || '',
        colorOverride: f.get('colorOverride') || '',
        fontSize: f.get('fontSize') || 0,
        pointRadius: f.get('pointRadius') || 0,
        lineWidth: f.get('lineWidth') || 0
      }
    });
  }, [selectedFeature]);

  // 检测DXF坐标系
  // 自动探测 DXF 坐标系：结合「图框坐标范围(EXTMIN/EXTMAX)」+「文件名关键字」判定。
  // 返回 { sys, confident }：confident=true 时导入流程可直接采用、无需弹框；
  // 返回 local_engineering 视为不确定，仍需用户手动选择。
  const detectDXFCoordSystem = (content, filename = '') => {
    let sys = 'local_engineering';
    let confident = false;

    // —— 文件名关键字（优先级低于坐标范围，但可作为强提示） ——
    const fn = (filename || '').toLowerCase();
    let fileNameHint = null;
    if (/guangzhou|广州|gz2000/.test(fn)) fileNameHint = 'guangzhou2000';
    else if (/wgs84|wgs-84|cgcs2000|cgcs|2000/.test(fn)) fileNameHint = 'wgs84';
    else if (/utm/.test(fn)) fileNameHint = 'utm_50n';
    else if (/xian80|西安80/.test(fn)) fileNameHint = 'xian80';
    else if (/beijing54|北京54/.test(fn)) fileNameHint = 'beijing54';

    if (!content) {
      if (fileNameHint) { sys = fileNameHint; confident = true; }
      return { sys, confident };
    }

    let text = '';
    if (typeof content === 'string') {
      text = content;
    } else if (content instanceof Uint8Array) {
      text = new TextDecoder('gb2312').decode(content);
    } else if (Array.isArray(content)) {
      text = new TextDecoder('gb2312').decode(new Uint8Array(content));
    }

    if (!text) {
      if (fileNameHint) { sys = fileNameHint; confident = true; }
      return { sys, confident };
    }

    // —— 图框坐标范围判定（最可靠） ——
    const extMinX = text.match(/\$EXTMIN[\s\S]*?10\s*\n\s*([-\d.]+)/);
    const extMaxX = text.match(/\$EXTMAX[\s\S]*?10\s*\n\s*([-\d.]+)/);
    const extMinY = text.match(/\$EXTMIN[\s\S]*?20\s*\n\s*([-\d.]+)/);
    const extMaxY = text.match(/\$EXTMAX[\s\S]*?20\s*\n\s*([-\d.]+)/);

    if (extMinX && extMaxX && extMinY && extMaxY) {
      const minX = parseFloat(extMinX[1]);
      const maxX = parseFloat(extMaxX[1]);
      const minY = parseFloat(extMinY[1]);
      const maxY = parseFloat(extMaxY[1]);

      // 广州2000：X 为 5 位数(0~100000)，Y 为 6 位数且为负(-3.5e6~0)
      if (minX >= 0 && maxX < 100000 && minY < 0 && maxY < 0) {
        return { sys: 'guangzhou2000', confident: true };
      }
      // UTM：X、Y 均为 6 位以上
      if (minX > 100000 && minY > 1000000) {
        return { sys: 'utm_50n', confident: true };
      }
      // WGS84：X 在经度范围、Y 在纬度范围
      if (minX >= -180 && maxX <= 180 && minY >= -90 && maxY <= 90) {
        return { sys: 'wgs84', confident: true };
      }
    }

    // —— 坐标范围无法判定：退回文件名关键字 ——
    if (fileNameHint) { sys = fileNameHint; confident = true; }
    return { sys, confident };
  };

  // 导入数据
  const doImport = async (files, cs, unit = 'm') => {
    for (const f of files) {
      try {
        const ext = f.name.split('.').pop().toLowerCase();
        let content = f.content;

        if (['dxf', 'dwg'].includes(ext) && Array.isArray(content)) {
          content = new Uint8Array(content);
        } else if (content instanceof File) {
          content = await content.text();
        }

        // 坐标系：用户已显式选择（cs）时优先使用；仅当未指定时自动检测（结合图框+文件名）
        let coordSys = cs;
        const autoDetect = !cs || cs === 'auto';
        if (['dxf', 'dwg'].includes(ext) && autoDetect) {
          const dt = detectDXFCoordSystem(content, f.name);
          coordSys = dt.sys;
        }

        // 处理三度带坐标系
        if (coordSys && (coordSys.startsWith('cgcs2000_3_') || coordSys.startsWith('wgs84_3_'))) {
          const parts = coordSys.split('_');
          const zone = parseInt(parts[2]);
          const lon = zone * 3;
        }

        let feats = [];

        switch (ext) {
          case 'kml': case 'kmz': feats = await parseKML(content); break;
          case 'gpx': feats = await parseGPX(content); break;
          case 'csv': case 'xlsx': feats = await parseCSV(content, coordSys); break;
          case 'geojson': feats = await parseGeoJSON(content); break;
          case 'shp': feats = await parseShapefile(content, coordSys); break;
          case 'dxf': case 'dwg':
            setImportProgress(0);
            const result = await parseDXF(content, coordSys, unit, (p) => setImportProgress(p));
            if (result && result.features) {
              feats = result.features;
            } else if (Array.isArray(result)) {
              feats = result;
            }
            break;
          case 'ovobj': {
            // .ovobj = 奥维互动地图「对象工程」二进制格式，魔术头 "OviO"。
            // 经逆向解析确认：每个以 '{' 起始、'}' 结束的对象记录内嵌——
            //   · 图层码（如 JMD_57 房屋 / DLSS 道路 / GCD 高程 / DLDW 独立地物 …）
            //   · UTF-8 中文文字注记（如 "碧桂园云麓半山小区""保安亭"）
            //   · 几何坐标：IEEE754 小端 double 对，顺序固定为 (经度, 纬度)
            // 因此 .ovobj 与 DXF 是「同一份地形图的两种平行表达」：
            //   · DXF  用本地米制坐标（如广州2000），需配准/投影到经纬度后才能上图；
            //   · .ovobj 已是按对象记录的经纬度(WGS84≈CGCS2000)，无需配准即可直接上图，
            //     且天然带 点/线/面/文字，与 DXF 导入后看到的要素一致。
            // 解析器见 utils/ovobj.js（parseOVOBJ → parseOVOBJBinary），点/线/面/文字全量还原。
            const ov = parseOVOBJ(content);
            feats = ov.features || [];
            // 标注写入独立标注层（原逻辑只入 state 不上图，这里补上）
            if (ov.markers && ov.markers.length) {
              ov.markers.forEach(m => markersLayerRef.current.getSource().addFeature(new Feature({ geometry: new Point(fromLonLat(m.coordinates)), markerData: m })));
              setMarkers(prev => [...prev, ...ov.markers]);
            }
            break;
          }
          case 'ovkml':
          case 'ovkmz': {
            // OVKML/OVKMZ 是奥维官方数据交换格式，本质是 XML/KML（CGCS2000≈WGS84）。
            const raw = typeof content === 'string' ? content : new TextDecoder('utf-8').decode(content);
            const kmlResult = parseKML(raw.replace(/^\uFEFF/, ''));
            if (kmlResult) {
              if (Array.isArray(kmlResult)) {
                feats = kmlResult;
              } else if (kmlResult.features) {
                feats = kmlResult.features;
              }
              if (kmlResult.markers && kmlResult.markers.length) {
                kmlResult.markers.forEach(m => markersLayerRef.current.getSource().addFeature(new Feature({ geometry: new Point(fromLonLat(m.coordinates)), markerData: m })));
                setMarkers(prev => [...prev, ...kmlResult.markers]);
              }
            }
            break;
          }
          case 'gkzt': {
            // 工程分享包：还原 要素/标注/底图/坐标系/图层顺序/透明度/图例样式
            const pkg = JSON.parse(typeof content === 'string' ? content : new TextDecoder('utf-8').decode(content));
            if (pkg.basemap) setMapSource(pkg.basemap);
            if (pkg.coordSys) setGlobalCoordSys(pkg.coordSys);
            const gkztEntries = [];
            const fmt = new GeoJSON({ featureProjection: 'EPSG:3857', dataProjection: 'EPSG:3857' });
            (pkg.layers || []).forEach((pl, i) => {
              const layer = createDataLayer();
              layer.setVisible(pl.visible !== false);
              layer.setOpacity(pl.opacity != null ? pl.opacity : 1);
              let feats = [];
              try { feats = fmt.readFeatures(pl.features || { type: 'FeatureCollection', features: [] }); } catch (e) { feats = []; }
              feats.forEach(f => { if (f.get('datum') == null) f.set('datum', 'wgs84'); applyFeatureStyle(f); layer.getSource().addFeature(f); });
              const id = `${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`;
              olLayersRef.current.set(id, layer);
              mapRef2.current.addLayer(layer);
              gkztEntries.push({ id, name: pl.name, visible: pl.visible !== false, opacity: pl.opacity != null ? pl.opacity : 1, features: feats, dxfSub: pl.dxfSub, fileBase: pl.fileBase });
            });
            if (Array.isArray(pkg.markers) && pkg.markers.length) {
              pkg.markers.forEach(m => {
                const f = new Feature({ geometry: new Point(fromLonLat(m.coordinates)), markerData: m });
                markersLayerRef.current.getSource().addFeature(f);
              });
              setMarkers(prev => [...prev, ...pkg.markers]);
            }
            if (pkg.layerStyles) {
              setLayerStyles(pkg.layerStyles);
              Object.entries(pkg.layerStyles).forEach(([code, style]) => applyLegendStyle(code, style));
            }
            await updateFeaturesGeometry(getAllFeatures(), { datum: getBasemapDatum(mapSource) });
            setLayers(prev => [...gkztEntries, ...prev]);
            feats = []; // 跳过通用分支（已在 case 内完成添加）
            break;
          }
          default: console.warn('不支持的格式:', ext);
        }

        if (feats && feats.length > 0) {
          // 每个图层 = 独立的 OL VectorLayer（支持逐图层透明度/拖拽排序）
          // 先打基准面默认 'wgs84'，再统一按当前底图做基准面变换（幂等）
          feats.forEach(ft => { if (ft.get('datum') == null) ft.set('datum', 'wgs84'); });

          const newLayerEntries = [];
          if (ext === 'dxf' || ext === 'dwg') {
            // DXF：按内部图层码（feature.get('layer')）拆分为多个子图层条目
            const fileBase = f.name.replace(/\.[^.]+$/, '');
            const groups = {};
            feats.forEach(feat => {
              const layerName = feat.get('layer') || '未命名';
              if (!groups[layerName]) groups[layerName] = [];
              groups[layerName].push(feat);
            });
            Object.keys(groups).forEach((layerName, i) => {
              const layer = createDataLayer();
              groups[layerName].forEach(ft => layer.getSource().addFeature(ft));
              const id = `${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`;
              olLayersRef.current.set(id, layer);
              mapRef2.current.addLayer(layer);
              newLayerEntries.push({
                id, name: `${layerName}（${groups[layerName].length}）`,
                visible: true, opacity: 1, features: groups[layerName], dxfSub: true, fileBase,
              });
            });
          } else {
            // 其他格式：整体作为 1 条图层条目
            const layer = createDataLayer();
            feats.forEach(ft => layer.getSource().addFeature(ft));
            const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            olLayersRef.current.set(id, layer);
            mapRef2.current.addLayer(layer);
            newLayerEntries.push({ id, name: f.name, visible: true, opacity: 1, features: feats });
          }

          // 统一按当前底图基准面校正（含历史图层，幂等）
          await updateFeaturesGeometry(getAllFeatures(), { datum: getBasemapDatum(mapSource) });
          // 新导入置于列表顶部（= 地图顶层），并同步 z-order
          setLayers(prev => [...newLayerEntries, ...prev]);
          setGlobalCoordSys(coordSys); // 更新全局坐标系
        } else {
          console.warn('没有解析到要素:', f.name);
        }
      } catch (e) {
        console.error('导入失败:', e);
        alert(`导入 ${f.name} 失败: ${e.message}`);
      } finally {
        setImportProgress(null);
      }
    }
  };

  // Q4 图例符号编辑：收集当前所有要素去重后的 DXF 图层码（用于图例列表）
  const distinctLayerCodes = useMemo(() => {
    const set = new Set();
    layers.forEach(l => (l.features || []).forEach(f => {
      const code = f.get && f.get('layer');
      if (code) set.add(code);
    }));
    return Array.from(set).sort();
  }, [layers]);

  // Q4 应用某图层的样式覆盖（颜色/线宽/点半径/字号），实时刷新要素渲染
  const applyLegendStyle = (layerCode, style) => {
    const prevStyle = layerStyles[layerCode] || null; // 撤销用：当前（应用前）样式
    const color = style.color || '';
    const lineWidth = style.lineWidth != null && style.lineWidth !== '' ? Number(style.lineWidth) : null;
    const pointRadius = style.pointRadius != null && style.pointRadius !== '' ? Number(style.pointRadius) : null;
    const fontSize = style.fontSize != null && style.fontSize !== '' ? Number(style.fontSize) : null;
    layers.forEach(entry => {
      (entry.features || []).forEach(f => {
        if (f.get && f.get('layer') !== layerCode) return;
        if (color) f.set('colorOverride', color); else f.unset('colorOverride');
        if (lineWidth != null) f.set('lineWidth', lineWidth); else f.unset('lineWidth');
        if (pointRadius != null) f.set('pointRadius', pointRadius); else f.unset('pointRadius');
        if (fontSize != null) f.set('fontSize', fontSize); else f.unset('fontSize');
        applyFeatureStyle(f);
      });
    });
    setLayerStyles(prev => ({ ...prev, [layerCode]: { color, lineWidth, pointRadius, fontSize } }));
    setLegendDraft(prev => ({ ...prev, [layerCode]: { ...style } }));
    pushHistory(
      () => { if (prevStyle) applyLegendStyle(layerCode, prevStyle); else resetLegendStyle(layerCode); },
      () => { applyLegendStyle(layerCode, style); }
    );
    showToast(`已应用「${layerCode}」图例样式`, 'success');
  };

  const resetLegendStyle = (layerCode) => {
    const prevStyle = layerStyles[layerCode] || null; // 撤销用
    layers.forEach(entry => {
      (entry.features || []).forEach(f => {
        if (f.get && f.get('layer') !== layerCode) return;
        f.unset('colorOverride'); f.unset('lineWidth'); f.unset('pointRadius'); f.unset('fontSize');
        applyFeatureStyle(f);
      });
    });
    setLayerStyles(prev => { const n = { ...prev }; delete n[layerCode]; return n; });
    setLegendDraft(prev => { const n = { ...prev }; delete n[layerCode]; return n; });
    pushHistory(
      () => { if (prevStyle) applyLegendStyle(layerCode, prevStyle); else resetLegendStyle(layerCode); },
      () => { resetLegendStyle(layerCode); }
    );
    showToast(`已重置「${layerCode}」图例样式`, 'info');
  };

  // Q3 数据质检：弹出面板 + 结果
  const [showQC, setShowQC] = useState(false);
  const [qcIssues, setQcIssues] = useState([]);
  const [qcRunning, setQcRunning] = useState(false);

  // 定位并选中某个要素（供质检/列表点击跳转）
  const locateFeature = (f) => {
    const geom = f && f.getGeometry && f.getGeometry();
    if (!geom || !mapRef2.current) return;
    try {
      mapRef2.current.getView().fit(geom.getExtent(), { padding: [80, 80, 80, 80], maxZoom: 19, duration: 300 });
    } catch (e) { /* 忽略非法 extent */ }
    setSelectedFeature(f);
  };

  // Q3 执行数据质检：扫描所有要素，返回问题列表
  const runDataQualityCheck = () => {
    setQcRunning(true);
    // 让出主线程，避免大批量扫描时卡顿
    setTimeout(() => {
      const issues = [];
      const hashes = new Map(); // 坐标指纹 -> 出现次数（用于重复检测）
      layers.forEach(entry => {
        (entry.features || []).forEach(f => {
          if (!f || !f.get) return;
          const layer = f.get('layer') || '';
          const type = f.get('type') || '';
          const geom = f.getGeometry ? f.getGeometry() : null;
          if (!geom) { issues.push({ f, layer, type: '空几何', msg: '要素无几何对象' }); return; }
          let coords = [];
          try { coords = geom.getCoordinates ? geom.getCoordinates() : []; } catch (e) { coords = []; }
          const flat = JSON.stringify(coords);
          if (/null|NaN|Infinity/.test(flat)) {
            issues.push({ f, layer, type: '坐标异常', msg: '坐标含 NaN / Infinity / 空值' });
          }
          // 高程越界（GCD 高程点）
          if (f.get('isGcdElevation')) {
            const ele = parseFloat(f.get('name'));
            if (!isNaN(ele) && (ele < -1000 || ele > 9000)) {
              issues.push({ f, layer, type: '高程越界', msg: `高程 ${ele} 超出合理范围[-1000, 9000]m` });
            }
          }
          // 文字空内容
          if (type === 'dxf_text') {
            const txt = (f.get('name') || '').toString().trim();
            if (!txt) issues.push({ f, layer, type: '空文字', msg: '文字注记内容为空' });
          }
          // 重复要素（坐标指纹）
          if (flat && flat !== '[]' && flat !== '[[]]' && flat !== '[[[]]]') {
            const h = flat;
            hashes.set(h, (hashes.get(h) || 0) + 1);
          }
        });
      });
      // 标记重复（出现 >1 次）
      const dupHashes = new Set();
      hashes.forEach((cnt, h) => { if (cnt > 1) dupHashes.add(h); });
      if (dupHashes.size > 0) {
        layers.forEach(entry => {
          (entry.features || []).forEach(f => {
            if (!f || !f.getGeometry) return;
            let coords = [];
            try { coords = f.getGeometry().getCoordinates(); } catch (e) { return; }
            const h = JSON.stringify(coords);
            if (dupHashes.has(h)) issues.push({ f, layer: f.get('layer') || '', type: '重复要素', msg: '与另一要素坐标完全相同' });
          });
        });
      }
      setQcIssues(issues);
      setQcRunning(false);
    }, 30);
  };

  // Q5 导出工程分享包 .gkzt：要素 + 标注 + 底图 + 坐标系 + 图层顺序/透明度 + 图例样式
  const exportProjectPackage = () => {
    try {
      if (layers.length === 0) { showToast('当前没有可导出的数据', 'info'); return; }
      const fmt = new GeoJSON({ featureProjection: 'EPSG:3857', dataProjection: 'EPSG:3857' });
      const project = {
        app: '广勘智图', version: 1, kind: 'gkzt',
        exportedAt: new Date().toISOString(),
        basemap: mapSource,
        coordSys: globalCoordSys,
        layerStyles,
        markers,
        layers: layers.map(l => {
          const valid = (l.features || []).filter(f => f && f.getGeometry);
          let fc = { type: 'FeatureCollection', features: [] };
          if (valid.length) { try { fc = JSON.parse(fmt.writeFeatures(valid, {})); } catch (e) { /* 忽略单图层错误 */ } }
          return {
            name: l.name, visible: l.visible !== false, opacity: l.opacity != null ? l.opacity : 1,
            fileBase: l.fileBase || '', dxfSub: !!l.dxfSub, features: fc
          };
        })
      };
      const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(project.layers[0] && project.layers[0].fileBase) || '广勘智图工程'}.gkzt`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('已导出工程分享包 .gkzt', 'success');
    } catch (e) {
      console.error('导出分享包失败:', e);
      alert('导出分享包失败: ' + e.message);
    }
  };

  // 坐标系选择确认
  const handleCoordSysConfirm = () => {
    setShowCoordSysPicker(false);
    if (pendingFiles.length > 0) {
      // 如果选择了"使用系统设置坐标系"，则使用customCoord.coordType
      const coordSys = selectedCoordSys === 'system' ? customCoord.coordType : selectedCoordSys;
      doImport(pendingFiles, coordSys, importUnit);
      setPendingFiles([]);
    }
  };

  // 缩放到全部要素
  const zoomToFitAll = () => {
    const features = getAllFeatures();
    if (features.length === 0) {
      alert('没有要素可缩放');
      return;
    }
    
    // 计算所有要素的范围
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    features.forEach(f => {
      const geom = f.getGeometry();
      if (geom) {
        const extent = geom.getExtent();
        minX = Math.min(minX, extent[0]);
        minY = Math.min(minY, extent[1]);
        maxX = Math.max(maxX, extent[2]);
        maxY = Math.max(maxY, extent[3]);
      }
    });
    
    if (minX === Infinity) {
      alert('无法计算要素范围');
      return;
    }
    
    // 添加一些边距
    const padding = 50;
    const extent = [minX - padding, minY - padding, maxX + padding, maxY + padding];
    
    mapRef2.current.getView().fit(extent, {
      size: mapRef2.current.getSize(),
      duration: 1000
    });
    
  };

  // 触发导入
  const triggerImport = () => {
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.invoke('import-data');
    }
  };

  // 删除图层（同时移除地图中的 OL 图层与 ref）
  const deleteLayer = (id) => {
    const l = layers.find(x => x.id === id);
    const idx = layers.findIndex(x => x.id === id);
    if (l) {
      const olLayer = olLayersRef.current.get(id);
      const featuresSnapshot = l.features ? [...l.features] : [];
      if (olLayer) {
        olLayer.getSource() && olLayer.getSource().clear();
        mapRef2.current && mapRef2.current.removeLayer(olLayer);
        olLayersRef.current.delete(id);
      }
      setLayers(prev => prev.filter(x => x.id !== id));
      pushHistory(
        () => { // 撤销：重建该图层并放回原位置
          const nl = createDataLayer();
          nl.setVisible(l.visible !== false);
          nl.setOpacity(l.opacity != null ? l.opacity : 1);
          featuresSnapshot.forEach(f => nl.getSource().addFeature(f));
          olLayersRef.current.set(id, nl);
          mapRef2.current.addLayer(nl);
          setLayers(prev => {
            const copy = [...prev];
            copy.splice(Math.min(idx, copy.length), 0, l);
            return copy;
          });
        },
        () => { // 重做：再次删除
          const ly = olLayersRef.current.get(id);
          if (ly) { ly.getSource() && ly.getSource().clear(); mapRef2.current.removeLayer(ly); olLayersRef.current.delete(id); }
          setLayers(prev => prev.filter(x => x.id !== id));
        }
      );
    }
  };

  // 删除标注
  const deleteMarker = (id) => {
    if (markersLayerRef.current) {
      const f = markersLayerRef.current.getSource().getFeatures().find(f => f.get('markerData')?.id === id);
      if (f) markersLayerRef.current.getSource().removeFeature(f);
    }
    setMarkers(prev => prev.filter(m => m.id !== id));
  };

  // 切换图层可见性（整层 OL 图层显隐，避免逐要素副作用）
  const toggleLayer = (id) => {
    const target = layers.find(l => l.id === id);
    if (!target) return;
    const newVisible = !target.visible;
    const olLayer = olLayersRef.current.get(id);
    if (olLayer) olLayer.setVisible(newVisible);
    setLayers(prev => prev.map(l => (l.id === id ? { ...l, visible: newVisible } : l)));
  };

  // 设置图层透明度（0~1）
  const setLayerOpacity = (id, opacity) => {
    const olLayer = olLayersRef.current.get(id);
    if (olLayer) olLayer.setOpacity(opacity);
    setLayers(prev => prev.map(l => (l.id === id ? { ...l, opacity } : l)));
  };

  // 拖拽排序：把 fromId 图层移动到 toId 图层的位置（列表顶部=地图顶层）
  const reorderLayers = (fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return;
    setLayers(prev => {
      const arr = [...prev];
      const fromIdx = arr.findIndex(l => l.id === fromId);
      const toIdx = arr.findIndex(l => l.id === toId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      return arr;
    });
  };

  // 任务④：框选区域批量导出
  // 清除框选（高亮 + 状态）
  const clearBoxSelection = () => {
    boxSelRef.current = [];
    setBoxSelFeatures([]);
    if (highlightLayerRef.current) highlightLayerRef.current.getSource().clear();
  };

  // 几何转 WKT（WGS84 经纬度）
  const geomToWKT = (geom) => {
    try {
      const t = geom.getType();
      if (t === 'Point') {
        const c = toLonLat(geom.getCoordinates());
        return `POINT(${c[0]} ${c[1]})`;
      }
      if (t === 'LineString') {
        const pts = geom.getCoordinates().map(c => { const ll = toLonLat(c); return `${ll[0]} ${ll[1]}`; });
        return `LINESTRING(${pts.join(',')})`;
      }
      if (t === 'Polygon') {
        const ring = geom.getCoordinates()[0].map(c => { const ll = toLonLat(c); return `${ll[0]} ${ll[1]}`; });
        return `POLYGON((${ring.join(',')}))`;
      }
      return t;
    } catch (e) { return ''; }
  };

  // 导出框选要素为 CSV（含 WKT 坐标）
  const exportBoxCSV = () => {
    const feats = boxSelRef.current;
    if (!feats.length) { alert('没有选中要素'); return; }
    let csv = '名称,类型,图层,几何类型,WKT\n';
    feats.forEach((f, i) => {
      const g = f.getGeometry();
      csv += `${i + 1},${f.get('type') || ''},${f.get('layer') || ''},${g ? g.getType() : ''},${g ? geomToWKT(g) : ''}\n`;
    });
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `框选要素_${feats.length}个.csv`;
    a.click();
    showToast(`已导出 ${feats.length} 个要素坐标 (CSV)`, 'success');
  };

  // 导出框选要素为 KML
  const exportBoxKML = () => {
    const feats = boxSelRef.current;
    if (!feats.length) { alert('没有选中要素'); return; }
    const opts = { featureProjection: 'EPSG:3857', dataProjection: 'EPSG:4326' };
    const str = new KML().writeFeatures(feats, opts);
    const blob = new Blob([str], { type: 'application/vnd.google-earth.kml+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `框选要素_${feats.length}个.kml`;
    a.click();
    showToast(`已导出 ${feats.length} 个要素 (KML)`, 'success');
  };

  // 飞到标注
  const flyTo = (m) => mapRef2.current?.getView().animate({ center: fromLonLat(m.coordinates), zoom: 15, duration: 500 });

  // 切换图层展开/收起
  const toggleExpand = (id) => {
    setExpandedLayers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // 放宽某图层元素列表渲染上限到 ELEMENT_CAP_MAX（应对 GCD 等超大图层）
  const raiseCap = (id) => {
    setCapRaisedLayers(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  // 点击元素：选中（与地图单击选中共用 selectedFeature）+ 定位到地图
  // 几何可能为 null（个别图块/异常要素），此时仅选中不定位。
  const selectAndLocate = (f) => {
    if (!f) return;
    setSelectedFeature(f);  // 联动右侧属性面板
    setRightTab('props');   // 任务①：从图层展开列表点击元素 -> 自动打开可编辑「属性」面板
    const map = mapRef2.current;
    if (!map) return;
    try {
      const geom = (typeof f.getGeometry === 'function') ? f.getGeometry() : null;
      if (!geom) return;   // 几何为 null 时跳过重定位，仅选中
      const extent = geom.getExtent();
      if (!extent || !extent.every(v => isFinite(v))) return;
      map.getView().fit(extent, { padding: [100, 100, 100, 100], maxZoom: 18, duration: 400 });
    } catch (e) {
      console.warn('要素定位失败（已选中但不定位）:', e);
    }
  };

  // 缩放
  const zoomIn = () => mapRef2.current?.getView().setZoom(mapRef2.current.getView().getZoom() + 1);
  const zoomOut = () => mapRef2.current?.getView().setZoom(mapRef2.current.getView().getZoom() - 1);
  const zoomFull = () => mapRef2.current?.getView().setCenter(fromLonLat([113.264, 23.129]));

  // 注：坐标系重投影与基准面变换已统一由文件顶部的模块级 updateFeaturesGeometry 处理，
  // 切换全局坐标系时的调用见下方 saveGlobalCoordSys。

  // 保存全局坐标系设置
  const saveGlobalCoordSys = (cs) => {
    setGlobalCoordSys(cs);
    localStorage.setItem('globalCoordSys', cs);
    localStorage.setItem('customCoordParams', JSON.stringify(customCoord));
    // 同步本地工程坐标（假原点）参数，供 local_engineering 使用
    setLocalEngineeringParams({
      centralMeridian: customCoord.centralMeridian,
      falseEasting: customCoord.falseEasting,
      falseNorthing: customCoord.falseNorthing
    });
    // 切换全局坐标系时，按各要素的源坐标系重新投影已加载要素，并叠加当前底图基准面变换
    updateFeaturesGeometry(getAllFeatures(), { coordSystem: cs, datum: getBasemapDatum(mapSource) });
    setShowSettings(false);
  };

  // 保存自定义坐标系配置
  const saveCustomCoordConfig = () => {
    setLocalEngineeringParams({
      centralMeridian: customCoord.centralMeridian,
      falseEasting: customCoord.falseEasting,
      falseNorthing: customCoord.falseNorthing
    });
    localStorage.setItem('customCoordParams', JSON.stringify(customCoord));
    alert('配置已保存');
  };

  // 全屏
  const fullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  };

  // 导出数据
  const exportData = (fmt) => {
    const feats = getAllFeatures().filter(f => !f.get('markerData')); // 数据要素（不含标注）
    if (feats.length === 0) { alert('没有数据'); return; }
    const opts = { featureProjection: 'EPSG:3857', dataProjection: 'EPSG:4326' };
    let content = '', mime = 'text/plain', ext = fmt;
    if (fmt === 'kml') {
      content = new KML().writeFeatures(feats, opts);
      mime = 'application/vnd.google-earth.kml+xml';
    } else if (fmt === 'geojson') {
      content = new GeoJSON().writeFeatures(feats, opts);
      mime = 'application/json';
    } else if (fmt === 'csv') {
      content = '名称,类型,图层,经度,纬度\n';
      feats.forEach((f, i) => {
        const g = f.getGeometry(); const t = f.get('type') || '';
        let lon = '', lat = '';
        let c0 = null;
        if (g && g.getFirstCoordinate) c0 = g.getFirstCoordinate();
        else if (g && g.getCoordinates) { const cs = g.getCoordinates(); c0 = Array.isArray(cs[0]) ? (Array.isArray(cs[0][0]) ? cs[0][0] : cs[0]) : cs; }
        if (c0) { const ll = toLonLat(c0); lon = ll[0].toFixed(6); lat = ll[1].toFixed(6); }
        content += `${i + 1},${t},${f.get('layer') || ''},${lon},${lat}\n`;
      });
    } else if (fmt === 'ovobj') {
      content = featuresToOVOBJ(feats, getBasemapDatum(mapSource));
      mime = 'application/json';
    }
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `export.${ext}`;
    a.click();
    setShowExport(false);
  };

  // 导出单个图层（含 DXF 子图层）为 KML / GeoJSON 文件
  //  features : 该图层的要素数组
  //  format   : 'kml' | 'geojson'
  //  layerName: 图层条目名（形如 "DGX（8406）"），用于提取图层码
  //  fileBase : 源文件名（无扩展名），用于构造文件名（如 "黄山鲁"）
  const exportLayerToFile = (features, format, layerName = '', fileBase = 'export') => {
    if (!features || features.length === 0) {
      alert('该图层没有可导出的要素');
      return;
    }

    // DXF 要素在导入时已被 fromLonLat 烘进 EPSG:3857，
    // 导出 KML/GeoJSON 时必须指定投影转换，才能得到正确的 WGS84 经纬度。
    // 同时导出真实几何（Point/LineString/Polygon），而非仅导点。
    const opts = { featureProjection: 'EPSG:3857', dataProjection: 'EPSG:4326' };
    let str = '', ext = 'geojson', mime = 'application/json';
    if (format === 'kml') {
      str = new KML().writeFeatures(features, opts);
      ext = 'kml';
      mime = 'application/vnd.google-earth.kml+xml';
    } else if (format === 'ovobj') {
      str = featuresToOVOBJ(features, getBasemapDatum(mapSource));
      ext = 'ovobj';
      mime = 'application/json';
    } else {
      str = new GeoJSON().writeFeatures(features, opts);
      ext = 'geojson';
      mime = 'application/json';
    }

    // 提取图层码（去掉“（要素数）”括号），构造文件名：<源文件名>_<图层码>.kml
    const layerCode = (layerName || 'layer').split('（')[0].replace(/\s+/g, '');
    const fileName = `${fileBase}_${layerCode}.${ext}`;

    // 渲染进程兜底保存：electron/main.js 未暴露“保存/另存为对话框” IPC，
    // 故不改动主进程，由渲染进程触发下载到系统下载目录。
    const blob = new Blob([str], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);

    alert(`已导出子图层：\n${layerName}\n→ ${fileName}\n（保存于系统下载目录）`);
  };

  // 删除选中的要素（从所属图层移除，并同步状态）
  // 注意：通过 uiRef 读取最新选中项 + 函数式 setLayers，避免被键盘 effect 的闭包捕获旧值
  const deleteSelectedFeature = () => {
    const f = uiRef.current.selectedFeature;
    if (!f) return;
    let removedFromId = null;
    olLayersRef.current.forEach((lyr, id) => {
      const s = lyr.getSource();
      if (s && s.getFeatures().includes(f)) { s.removeFeature(f); removedFromId = id; }
    });
    if (removedFromId) {
      setLayers(prev => prev.map(l => l.id === removedFromId ? { ...l, features: l.features.filter(x => x !== f) } : l));
      pushHistory(
        () => { // 撤销：把要素加回原图层
          const ly = olLayersRef.current.get(removedFromId);
          if (ly) ly.getSource().addFeature(f);
          setLayers(prev => prev.map(l => l.id === removedFromId ? { ...l, features: [...l.features, f] } : l));
        },
        () => { // 重做：再次删除
          const ly = olLayersRef.current.get(removedFromId);
          if (ly) ly.getSource().removeFeature(f);
          setLayers(prev => prev.map(l => l.id === removedFromId ? { ...l, features: l.features.filter(x => x !== f) } : l));
        }
      );
    }
    // 若该要素曾在框选中，清除其高亮
    if (boxSelRef.current && boxSelRef.current.includes(f)) clearBoxSelection();
    setSelectedFeature(null);
    showToast('已删除选中要素', 'info');
  };

  // 快捷键：Ctrl+O 导入 / Ctrl+S 导出 / F11 全屏 / Esc 关弹窗 / Del 删要素 / 空格拖拽平移
  useEffect(() => {
    const isTyping = (t) => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    const handleKeyDown = (e) => {
      if (isTyping(e.target)) return; // 输入框内不触发快捷键
      if (e.ctrlKey && e.key === 'o') { e.preventDefault(); triggerImport(); return; }
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); setShowExport(true); return; }
      if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); undoAction(); return; }
      if (e.ctrlKey && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redoAction(); return; }
      if (e.key === 'F11') { e.preventDefault(); fullscreen(); return; }
      if (e.key === 'Escape') {
        const u = uiRef.current;
        if (u.editingMarker) { setEditingMarker(null); return; }
        if (u.showCoordSysPicker) { setShowCoordSysPicker(false); setPendingFiles([]); return; }
        if (u.showExport) { setShowExport(false); return; }
        if (u.showCoordPicker) { setShowCoordPicker(false); return; }
        if (u.showSettings) { setShowSettings(false); return; }
        if (u.selectedFeature) { setSelectedFeature(null); return; }
        if (boxSelRef.current && boxSelRef.current.length) { clearBoxSelection(); return; }
        return;
      }
      if (e.key === 'Delete') {
        const u = uiRef.current;
        if (u.editingMarker) { deleteMarker(u.editingMarker.id); return; }
        if (u.selectedFeature) { deleteSelectedFeature(); return; }
      }
      if (e.code === 'Space') {
        if (!e.repeat) setSpacePan(true);
        e.preventDefault(); // 防止页面滚动
      }
    };
    const handleKeyUp = (e) => {
      if (e.code === 'Space') setSpacePan(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // 编辑标注
  const handleEditMarker = (marker) => {
    setEditingMarker(marker);
  };

  // 保存编辑（同步到 markers 状态 + 地图 Feature 的 markerData）
  const handleSaveEdit = () => {
    if (editingMarker) {
      // 更新 React 状态
      setMarkers(prev => prev.map(m => m.id === editingMarker.id ? editingMarker : m));
      // 同步到标注层中的 Feature（让地图立即刷新图标/样式）
      const features = markersLayerRef.current.getSource().getFeatures();
      for (const f of features) {
        if (f.get('markerData')?.id === editingMarker.id) {
          f.set('markerData', { ...editingMarker });
          f.changed(); // 触发样式重绘
          break;
        }
      }
      setEditingMarker(null);
    }
  };

  return (
    <div className="app-container">
      {/* 工具栏 */}
      <div className="toolbar">
        <div className="toolbar-left">
          <span className="app-title">广勘智图 v1.0</span>
          <div className="toolbar-separator"></div>
          <button className="toolbar-btn" title="导入" onClick={triggerImport}>📂 导入</button>
          <button className="toolbar-btn" title="导出" onClick={() => setShowExport(true)}>💾 导出</button>
          <button className="toolbar-btn" title="导出工程分享包(.gkzt)" onClick={exportProjectPackage}>📦 分享包</button>
          <div className="toolbar-separator"></div>
          <button className="toolbar-btn" title="撤销 (Ctrl+Z)" onClick={undoAction}>↩ 撤销</button>
          <button className="toolbar-btn" title="重做 (Ctrl+Y)" onClick={redoAction}>↪ 重做</button>
          <div className="toolbar-separator"></div>
          <button className={`toolbar-btn ${measureType === 'area' ? 'active' : ''}`} title="面积测量" onClick={() => { setMeasureType(measureType === 'area' ? null : 'area'); setActiveTool(measureType === 'area' ? 'pointer' : 'polygon'); }}>📐 面积</button>
          <button className={`toolbar-btn ${measureType === 'distance' ? 'active' : ''}`} title="距离测量" onClick={() => { setMeasureType(measureType === 'distance' ? null : 'distance'); setActiveTool(measureType === 'distance' ? 'pointer' : 'line'); }}>📏 距离</button>
          <button className={`toolbar-btn ${activeTool === 'box' ? 'active' : ''}`} title="框选区域批量导出要素坐标" onClick={() => { const on = activeTool === 'box'; setActiveTool(on ? 'pointer' : 'box'); setMeasureType(null); if (on) clearBoxSelection(); }}>▭ 框选</button>
          <button className={`toolbar-btn ${showQC ? 'active' : ''}`} title="数据质检" onClick={() => { setShowQC(true); runDataQualityCheck(); }}>🔍 质检</button>
          <div className="toolbar-separator"></div>
          <button className="toolbar-btn" title="坐标拾取" onClick={() => setShowCoordPicker(!showCoordPicker)}>📍 拾取</button>
          <button className="toolbar-btn" title="坐标转换" onClick={() => setShowCoordSysPicker(true)}>🔄 转换</button>
          <button className={`toolbar-btn ${showGrid ? 'active' : ''}`} title="坐标网格" onClick={() => setShowGrid(!showGrid)}>⊞ 网格</button>
          <div className="toolbar-separator"></div>
          <button className="toolbar-btn" title="缩放到全部要素" onClick={zoomToFitAll}>⊞ 全图</button>
          <button className="toolbar-btn" title="设置" onClick={() => setShowSettings(true)}>⚙ 设置</button>
          <button className="toolbar-btn" title="全屏" onClick={fullscreen}>⛶ 全屏</button>
        </div>
        <div className="toolbar-right">
          <button
            className={`toolbar-btn ${showAnnotation ? 'active' : ''}`}
            title={getBasemapDatum(mapSource) === 'wgs84' ? '注记叠加（路网/地名）' : '注记仅支持 WGS84 底图（高德/高德卫星不可用）'}
            disabled={getBasemapDatum(mapSource) !== 'wgs84'}
            onClick={() => setShowAnnotation(v => !v)}
          >注记</button>
          <select className="toolbar-select" value={mapSource} onChange={(e) => setMapSource(e.target.value)}>
            {Object.entries(MAP_SOURCES).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
          </select>
        </div>
      </div>

      {/* 大文件导入进度条（Bug A）：解析大 DXF 时显示，避免看起来卡死 */}
      {importProgress != null && (
        <div className="import-progress-bar">
          <div className="import-progress-fill" style={{ width: `${Math.round(importProgress * 100)}%` }}></div>
          <span className="import-progress-text">正在解析 DXF… {Math.round(importProgress * 100)}%</span>
        </div>
      )}

      <div className="main-content">
        {/* 地图 */}
        <div className={spacePan ? 'map-area pan-mode' : 'map-area'}>
          <div ref={mapRef} className="map"></div>
          {/* 指北针：标准箭头，指向正北 */}
          <div className="map-compass" title="正北方向">
            <svg viewBox="0 0 100 100" width="40" height="40">
              <polygon points="50,6 63,50 50,42 37,50" fill="#d32f2f" />
              <polygon points="50,94 63,50 50,58 37,50" fill="#fff" stroke="#666" strokeWidth="1.5" />
              <text x="50" y="20" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#d32f2f" fontFamily="Arial">N</text>
            </svg>
          </div>
          <GridOverlayComponent map={mapRef2.current} show={showGrid} gridType="latlon" />
          {measureResult && (
            <div className="measure-panel">
              <span>{measureType === 'area' ? '面积:' : '距离:'}</span>
              <span className="measure-value">{measureResult.value}</span>
              <span className="measure-unit">{measureResult.unit}</span>
              <button className="btn" onClick={() => { setMeasureType(null); setMeasureResult(null); setActiveTool('pointer'); }}>关闭</button>
            </div>
          )}
        </div>

        {/* 右侧面板 */}
        <div className="right-panel">
          <div className="right-tabs">
            <div className={`right-tab ${rightTab === 'layers' ? 'active' : ''}`} onClick={() => setRightTab('layers')}>图层</div>
            <div className={`right-tab ${rightTab === 'markers' ? 'active' : ''}`} onClick={() => setRightTab('markers')}>标注</div>
            <div className={`right-tab ${rightTab === 'props' ? 'active' : ''}`} onClick={() => setRightTab('props')}>属性</div>
            <div className={`right-tab ${rightTab === 'legend' ? 'active' : ''}`} onClick={() => setRightTab('legend')}>图例</div>
          </div>
          <div className="right-content">
            {rightTab === 'layers' && (
              <div>
                <div className="right-header">
                  <span>图层列表</span>
                  <button className="btn-small" onClick={triggerImport}>+导入</button>
                </div>
                {layers.length === 0 ? (
                  <div className="empty-hint">暂无图层<br/>点击导入按钮添加数据</div>
                ) : (
                  <div className="list-container">
                    {layers.map(l => {
                      const isExpanded = expandedLayers.has(l.id);
                      const cap = capRaisedLayers.has(l.id) ? ELEMENT_CAP_MAX : ELEMENT_CAP;
                      const total = (l.features && l.features.length) || 0;
                      const shown = Math.min(cap, total);
                      const visibleEls = isExpanded ? l.features.slice(0, shown) : [];
                      return (
                      <div
                        key={l.id}
                        className="layer-block"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => { e.preventDefault(); reorderLayers(dragIdRef.current, l.id); dragIdRef.current = null; }}
                      >
                        <div className="list-item">
                          <span
                            className="drag-handle"
                            title="拖拽排序"
                            draggable
                            onDragStart={(e) => { dragIdRef.current = l.id; e.dataTransfer.effectAllowed = 'move'; }}
                            onDragEnd={() => { dragIdRef.current = null; }}
                          >⠿</span>
                          <button
                            className="btn-expand"
                            title={isExpanded ? '收起元素' : '展开元素'}
                            onClick={() => toggleExpand(l.id)}
                          >{isExpanded ? '▼' : '▶'}</button>
                          <input type="checkbox" checked={l.visible} onChange={() => toggleLayer(l.id)} />
                          <div className="color-dot" style={{background: '#1976d2'}}></div>
                          <span className="item-name" title={l.name}>{l.name}</span>
                          <span className="item-count">{total}</span>
                          <button className="btn-icon" title="导出 KML" onClick={() => exportLayerToFile(l.features, 'kml', l.name, l.fileBase)}>K</button>
                          <button className="btn-icon" title="导出 GeoJSON" onClick={() => exportLayerToFile(l.features, 'geojson', l.name, l.fileBase)}>J</button>
                          <button className="btn-icon" title="导出 OVOBJ（奥维）" onClick={() => exportLayerToFile(l.features, 'ovobj', l.name, l.fileBase)}>O</button>
                          <button className="btn-icon" onClick={() => deleteLayer(l.id)}>✕</button>
                        </div>
                        <div className="layer-opacity">
                          <span className="opacity-label">透明度</span>
                          <input
                            type="range" min="0" max="1" step="0.05"
                            value={l.opacity != null ? l.opacity : 1}
                            onChange={(e) => setLayerOpacity(l.id, parseFloat(e.target.value))}
                            title="调节本图层透明度"
                          />
                          <span className="opacity-val">{Math.round((l.opacity != null ? l.opacity : 1) * 100)}%</span>
                        </div>
                        {isExpanded && (
                          <div className="element-list" data-vt={visTick}>
                            {total === 0 ? (
                              <div className="empty-hint">该图层暂无元素</div>
                            ) : (
                              <React.Fragment>
                                {visibleEls.map((f, idx) => {
                                  const index = idx + 1;
                                  const label = featureLabel(f, index);
                                  const type = (f.get && f.get('type')) || '';
                                  const isSel = selectedFeature === f;
                                  const typeColor = elementTypeColor(type);
                                  let coordText = '';
                                  try {
                                    const geom = (f.getGeometry && f.getGeometry());
                                    if (geom && typeof geom.getType === 'function' && geom.getType() === 'Point') {
                                      const c = toLonLat(geom.getCoordinates());
                                      coordText = c[0].toFixed(4) + ', ' + c[1].toFixed(4);
                                    }
                                  } catch (e) { /* 几何为 null 或异常时忽略坐标显示 */ }
                                  const fVisible = (typeof f.getVisible === 'function') ? f.getVisible() : true;
                                  return (
                                    <div
                                      key={'el_' + l.id + '_' + idx}
                                      className={'element-row' + (isSel ? ' selected' : '')}
                                      onClick={() => selectAndLocate(f)}
                                    >
                                      <span className="type-dot" style={{background: typeColor}} title={type}></span>
                                      <span className="el-label" title={label}>{label}</span>
                                      {coordText && <span className="el-coord">{coordText}</span>}
                                      <button
                                        className="btn-icon"
                                        title="定位到地图"
                                        onClick={(e) => { e.stopPropagation(); selectAndLocate(f); }}
                                      >👁</button>
                                      <button
                                        className="btn-icon"
                                        title={fVisible ? '点击隐藏该元素' : '点击显示该元素'}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (f && typeof f.setVisible === 'function') {
                                            f.setVisible(!fVisible);
                                            setVisTick(t => t + 1);
                                          }
                                        }}
                                      >{fVisible ? '👁' : '🚫'}</button>
                                    </div>
                                  );
                                })}
                                {total > cap && (
                                  <div className="element-hint">
                                    仅显示前 {shown} / 共 {total} 个元素
                                    {!capRaisedLayers.has(l.id) && (
                                      <button className="btn-small" onClick={() => raiseCap(l.id)}>
                                        展开全部（最多 {ELEMENT_CAP_MAX}）
                                      </button>
                                    )}
                                  </div>
                                )}
                              </React.Fragment>
                            )}
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {rightTab === 'markers' && (
              <div>
                <div className="right-header">
                  <span>标注列表 ({markers.length})</span>
                </div>
                {markers.length === 0 ? (
                  <div className="empty-hint">点击地图添加标注<br/>双击标注编辑图标</div>
                ) : (
                  <div className="list-container">
                    {markers.map(m => {
                      const iconObj = getIconById(m.icon || DEFAULT_ICON_ID);
                      return (
                        <div key={m.id} className="list-item" onDoubleClick={() => handleEditMarker(m)}>
                          <span style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                            dangerouslySetInnerHTML={{ __html: iconObj.svg }} />
                          <span className="item-name">{m.name}</span>
                          <button className="btn-icon" onClick={() => flyTo(m)}>👁</button>
                          <button className="btn-icon" onClick={() => deleteMarker(m.id)}>✕</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {rightTab === 'props' && (
              <div>
                <div className="right-header">
                  <span>属性编辑</span>
                  {selectedFeature && (
                    <button className="btn-small" onClick={() => setSelectedFeature(null)}>✕</button>
                  )}
                </div>
                {!selectedFeature && (
                  <div className="empty-hint">在地图上点击要素<br/>可查看并编辑其属性</div>
                )}
                {selectedFeature && (() => {
                  const type = selectedFeature.get('type') || '';
                  const isText = type === 'dxf_text';
                  const isPoint = type === 'dxf_point' || type === 'dxf_block';
                  const isLine = type === 'dxf_line' || type === 'dxf_polyline';
                  const isPolygon = type === 'dxf_polygon' || type === 'dxf_circle' || type === 'dxf_solid';
                  const fromBlock = selectedFeature.get('fromBlock');
                  const fromAttrib = selectedFeature.get('fromAttrib');
                  const attTag = selectedFeature.get('attTag');
                  return (
                    <div style={{ padding: 10 }}>
                      <div className="form-row readonly"><label>图层:</label><span>{selectedFeature.get('layer')}</span></div>
                      <div className="form-row readonly"><label>类型:</label><span>{type}</span></div>

                      {isText && (
                        <>
                          <div className="form-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                            <label>文字内容:</label>
                            <input value={editForm.name} onChange={(e) => applyField({ name: e.target.value })} style={{ marginTop: 4 }} />
                          </div>
                          <div className="form-row"><label>字号:</label>
                            <input type="number" value={editForm.fontSize} onChange={(e) => applyField({ fontSize: e.target.value })} style={{ width: 80 }} />
                          </div>
                        </>
                      )}

                      {isPoint && (
                        <>
                          <div className="form-row"><label>源X:</label><input value={editForm.x} onChange={(e) => setEditForm({ ...editForm, x: e.target.value })} onBlur={applyCoordEdit} style={{ width: 100 }} /></div>
                          <div className="form-row"><label>源Y:</label><input value={editForm.y} onChange={(e) => setEditForm({ ...editForm, y: e.target.value })} onBlur={applyCoordEdit} style={{ width: 100 }} /></div>
                          <div className="form-row"><label>点半径:</label><input type="number" value={editForm.radius} onChange={(e) => applyField({ radius: e.target.value })} style={{ width: 80 }} /></div>
                        </>
                      )}

                      {(isLine || isPolygon) && (
                        <div className="form-row"><label>线宽:</label><input type="number" value={editForm.lineWidth} onChange={(e) => applyField({ lineWidth: e.target.value })} style={{ width: 80 }} /></div>
                      )}

                      <div className="form-row"><label>颜色:</label>
                        <input type="color" value={editForm.color} onChange={(e) => applyField({ color: e.target.value })} />
                      </div>

                      {fromBlock && <div className="form-row readonly"><label>块派生:</label><span>是</span></div>}
                      {fromAttrib && (
                        <div className="form-row readonly"><label>属性标签:</label><span>{attTag || '-'}</span></div>
                      )}

                      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                        <button className="btn-primary" onClick={() => applyFeatureEdit()}>应用</button>
                        <button className="btn" onClick={() => setSelectedFeature(null)}>关闭</button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {rightTab === 'legend' && (
              <div>
                <div className="right-header">
                  <span>图例符号</span>
                  <span style={{ fontSize: 11, color: '#888' }}>按图层改样式</span>
                </div>
                {distinctLayerCodes.length === 0 ? (
                  <div className="empty-hint">暂无图层<br />导入数据后可在此编辑图例</div>
                ) : (
                  <div className="list-container">
                    {distinctLayerCodes.map(code => {
                      const stored = layerStyles[code] || {};
                      const draft = legendDraft[code] || stored || {};
                      const patch = (p) => setLegendDraft(prev => ({ ...prev, [code]: { ...(prev[code] || stored || {}), ...p } }));
                      return (
                        <div key={code} className="layer-block" style={{ padding: 8 }}>
                          <div style={{ fontWeight: 600, marginBottom: 6 }}>{code}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <label style={{ fontSize: 12 }}>颜色</label>
                            <input type="color" value={draft.color || '#1976d2'} onChange={(e) => patch({ color: e.target.value })} style={{ width: 36, height: 24 }} />
                            <label style={{ fontSize: 12 }}>线宽</label>
                            <input type="number" value={draft.lineWidth ?? ''} placeholder="默认" onChange={(e) => patch({ lineWidth: e.target.value })} style={{ width: 56 }} />
                            <label style={{ fontSize: 12 }}>点半径</label>
                            <input type="number" value={draft.pointRadius ?? ''} placeholder="默认" onChange={(e) => patch({ pointRadius: e.target.value })} style={{ width: 56 }} />
                            <label style={{ fontSize: 12 }}>字号</label>
                            <input type="number" value={draft.fontSize ?? ''} placeholder="默认" onChange={(e) => patch({ fontSize: e.target.value })} style={{ width: 56 }} />
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <button className="btn-small" onClick={() => applyLegendStyle(code, legendDraft[code] || stored || {})}>应用</button>
                            {(stored.color || stored.lineWidth != null || stored.pointRadius != null || stored.fontSize != null) && (
                              <button className="btn-small" onClick={() => resetLegendStyle(code)}>重置</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 状态栏 */}
      <div className="status-bar">
        <span>经度: <b>{mousePos?.lon || '--'}</b></span>
        <span>纬度: <b>{mousePos?.lat || '--'}</b></span>
        <div className="status-sep"></div>
        <span>X: {mousePos?.x || '--'}</span>
        <span>Y: {mousePos?.y || '--'}</span>
        <div className="status-sep"></div>
        <span>缩放: {zoom?.toFixed(1) || '--'}</span>
        <span>坐标系: {getBasemapDatum(mapSource) === 'gcj02' ? '高德GCJ-02' : 'WGS84'}</span>
        <div style={{flex: 1}}></div>
        <span>图层: {layers.length}</span>
        <span>标注: {markers.length}</span>
        {measureResult && <span>| {measureType === 'area' ? '面积' : '距离'}: {measureResult.value} {measureResult.unit}</span>}
      </div>

      {/* 坐标拾取面板 */}
      {showCoordPicker && (
        <div className="popup" style={{bottom: 30, top: 'auto', left: 60, width: 260}}>
          <div className="popup-title">📍 坐标拾取 <button onClick={() => setShowCoordPicker(false)}>✕</button></div>
          <div className="popup-body">
            <div className="form-row"><label>经度:</label><input value={mousePos?.lon || ''} readOnly /><button onClick={() => navigator.clipboard.writeText(mousePos?.lon)}>复制</button></div>
            <div className="form-row"><label>纬度:</label><input value={mousePos?.lat || ''} readOnly /><button onClick={() => navigator.clipboard.writeText(mousePos?.lat)}>复制</button></div>
            <div className="form-row"><button className="btn-primary" onClick={() => {
              if (mousePos) {
                const m = { id: Date.now(), name: `标注${markers.length + 1}`, coordinates: [parseFloat(mousePos.lon), parseFloat(mousePos.lat)], color: '#e91e63', description: '', icon: DEFAULT_ICON_ID };
                setMarkers(prev => [...prev, m]);
                markersLayerRef.current.getSource().addFeature(new Feature({ geometry: new Point(fromLonLat(m.coordinates)), markerData: m }));
              }
            }}>添加标注</button></div>
          </div>
        </div>
      )}

      {/* 坐标系选择 */}
      {showCoordSysPicker && (
        <div className="popup" style={{width: 500}}>
          <div className="popup-title">🔄 选择坐标系 <button onClick={() => { setShowCoordSysPicker(false); setPendingFiles([]); }}>✕</button></div>
          <div className="popup-body">
            <div className="form-row">
              <label>坐标系:</label>
              <select value={selectedCoordSys} onChange={(e) => setSelectedCoordSys(e.target.value)} style={{flex: 1}}>
                <option value="system">使用系统设置坐标系</option>
                <optgroup label="常用坐标系">
                  {Object.entries(COORD_SYSTEMS).map(([k, v]) => (
                    <option key={k} value={k}>{v.nameCN}</option>
                  ))}
                </optgroup>
                <optgroup label="三度带投影（CGCS2000）">
                  {THREE_DEGREE_ZONES.map(z => (
                    <option key={`cgcs2000_3_${z.zone}`} value={`cgcs2000_3_${z.zone}`}>
                      {z.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="三度带投影（WGS84）">
                  {THREE_DEGREE_ZONES.map(z => (
                    <option key={`wgs84_3_${z.zone}`} value={`wgs84_3_${z.zone}`}>
                      {z.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* DXF 坐标单位选择 */}
            <div className="form-row" style={{marginTop: 8}}>
              <label>坐标单位:</label>
              <select value={importUnit} onChange={(e) => setImportUnit(e.target.value)} style={{flex: 1}}>
                <option value="m">米 (m)</option>
                <option value="mm">毫米 (mm)</option>
              </select>
            </div>
            
            {/* 显示系统设置的坐标系信息 */}
            <div style={{padding: 10, background: '#f5f5f5', borderRadius: 4, marginTop: 8}}>
              <div style={{fontSize: 11, color: '#666', marginBottom: 4}}>系统设置坐标系:</div>
              <div style={{fontSize: 12, fontWeight: 'bold'}}>
                {COORD_SYSTEMS[customCoord.coordType]?.nameCN || customCoord.coordType}
              </div>
              <div style={{fontSize: 10, color: '#999', marginTop: 4}}>
                中央经线: {customCoord.centralMeridian}° | 东偏移: {customCoord.falseEasting}m | 北偏移: {customCoord.falseNorthing}m
              </div>
            </div>

            <div className="form-row" style={{marginTop: 8}}>
              <label>待导入:</label>
              <span>{pendingFiles.length} 个文件</span>
            </div>
            <div style={{fontSize: 11, color: '#666'}}>
              提示：如果CAD坐标X是5位数、Y是6位数，选择"广州2000坐标系"或"使用系统设置坐标系"
            </div>
          </div>
          <div className="popup-footer">
            <button onClick={() => { setShowCoordSysPicker(false); setPendingFiles([]); }}>取消</button>
            <button className="btn-primary" onClick={handleCoordSysConfirm}>确定</button>
          </div>
        </div>
      )}

      {/* 导出选择 */}
      {showExport && (
        <div className="popup" style={{width: 200}}>
          <div className="popup-title">💾 导出 <button onClick={() => setShowExport(false)}>✕</button></div>
          <div className="popup-body">
            <button className="btn-full" onClick={() => exportData('kml')}>导出 KML</button>
            <button className="btn-full" onClick={() => exportData('csv')}>导出 CSV</button>
            <button className="btn-full" onClick={() => exportData('geojson')}>导出 GeoJSON</button>
            <button className="btn-full" onClick={() => exportData('ovobj')}>导出 OVOBJ（奥维）</button>
          </div>
        </div>
      )}

      {/* 框选结果面板：批量导出要素坐标 */}
      {boxSelFeatures.length > 0 && (
        <div className="box-panel">
          <div className="box-panel-title">已框选 <b>{boxSelFeatures.length}</b> 个要素</div>
          <div className="box-panel-actions">
            <button className="btn-small" onClick={exportBoxCSV}>导出 CSV（WKT）</button>
            <button className="btn-small" onClick={exportBoxKML}>导出 KML</button>
            <button className="btn-icon" title="清除选择" onClick={clearBoxSelection}>✕</button>
          </div>
        </div>
      )}

      {/* 编辑标注弹窗（含图标选择器） */}
      {editingMarker && (
        <div className="popup" style={{width: 400, maxHeight: '85vh', overflow: 'auto'}}>
          <div className="popup-title">✏️ 编辑标注 <button onClick={() => setEditingMarker(null)}>✕</button></div>
          <div className="popup-body">
            {/* 图标选择器 — 独立区域，最醒目 */}
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#333', marginBottom: 4, display: 'block' }}>🎯 选择图标</label>
              <IconPicker
                value={editingMarker.icon || DEFAULT_ICON_ID}
                onChange={(iconId) => setEditingMarker({ ...editingMarker, icon: iconId })}
              />
            </div>

            {/* 基本信息 */}
            <div className="form-row"><label>名称:</label><input value={editingMarker.name} onChange={(e) => setEditingMarker({...editingMarker, name: e.target.value})} /></div>
            <div className="form-row"><label>描述:</label><textarea value={editingMarker.description} onChange={(e) => setEditingMarker({...editingMarker, description: e.target.value})} rows={3}></textarea></div>
            <div className="form-row"><label>颜色:</label><input type="color" value={editingMarker.color} onChange={(e) => setEditingMarker({...editingMarker, color: e.target.value})} /></div>
            <div className="form-row"><label>坐标:</label><span>{editingMarker.coordinates[0].toFixed(6)}, {editingMarker.coordinates[1].toFixed(6)}</span></div>
          </div>
          <div className="popup-footer">
            <button onClick={() => setEditingMarker(null)}>取消</button>
            <button className="btn-primary" onClick={handleSaveEdit}>保存</button>
          </div>
        </div>
      )}

      {/* 数据质检面板 */}
      {showQC && (
        <div className="popup" style={{ width: 520, maxHeight: '82vh', overflow: 'auto' }}>
          <div className="popup-title">🔍 数据质检
            <button onClick={() => setShowQC(false)}>✕</button>
          </div>
          <div className="popup-body" style={{ padding: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
              <button className="btn-primary" onClick={runDataQualityCheck} disabled={qcRunning}>
                {qcRunning ? '检查中…' : '重新检查'}
              </button>
              <span style={{ fontSize: 12, color: '#666' }}>
                共 {qcIssues.length} 个问题
                {(() => {
                  const byType = {};
                  qcIssues.forEach(i => { byType[i.type] = (byType[i.type] || 0) + 1; });
                  return Object.entries(byType).map(([t, c]) => ` · ${t}: ${c}`).join('');
                })()}
              </span>
            </div>
            {qcIssues.length === 0 ? (
              <div className="empty-hint">未发现明显问题 ✓</div>
            ) : (
              <div className="list-container">
                {qcIssues.map((iss, idx) => (
                  <div key={idx} className="element-row" onClick={() => locateFeature(iss.f)} style={{ cursor: 'pointer' }}>
                    <span className="el-label">[{iss.type}] {iss.layer} — {iss.msg}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="popup-footer">
            <button onClick={() => setShowQC(false)}>关闭</button>
          </div>
        </div>
      )}

      {/* 设置面板 */}
      {showSettings && (
        <div className="popup" style={{width: 420, maxHeight: '85vh', overflow: 'auto'}}>
          <div className="popup-title">横轴墨卡托投影坐标 <button onClick={() => setShowSettings(false)}>✕</button></div>
          <div className="popup-body" style={{padding: 12}}>
            {/* 坐标类型 */}
            <div style={{display: 'flex', alignItems: 'center', marginBottom: 8}}>
              <label style={{width: 100, fontSize: 12}}>坐标类型</label>
              <select value={customCoord.coordType} 
                onChange={(e) => setCustomCoord({...customCoord, coordType: e.target.value})}
                style={{flex: 1, padding: '4px 8px', border: '1px solid #ccc'}}>
                <option value="wgs84">经纬度 &lt;--&gt; WGS84</option>
                <option value="beijing54">经纬度 &lt;--&gt; 北京54</option>
                <option value="xian80">经纬度 &lt;--&gt; 西安80</option>
                <option value="cgcs2000">经纬度 &lt;--&gt; CGCS2000</option>
                <option value="guangzhou2000">经纬度 &lt;--&gt; 广州2000</option>
              </select>
            </div>

            {/* 转换类型 */}
            <div style={{display: 'flex', alignItems: 'center', marginBottom: 8}}>
              <label style={{width: 100, fontSize: 12}}>转换类型</label>
              <select value={customCoord.transformType}
                onChange={(e) => setCustomCoord({...customCoord, transformType: e.target.value})}
                style={{flex: 1, padding: '4px 8px', border: '1px solid #ccc'}}>
                <option value="custom">经纬度 &lt;--&gt; 自定义</option>
                <option value="beijing54">经纬度 &lt;--&gt; 北京54</option>
                <option value="xian80">经纬度 &lt;--&gt; 西安80</option>
                <option value="cgcs2000">经纬度 &lt;--&gt; CGCS2000</option>
                <option value="utm">经纬度 &lt;--&gt; UTM</option>
              </select>
            </div>

            <div style={{height: 1, background: '#ddd', margin: '12px 0'}}></div>

            {/* 投影参数 */}
            <div style={{display: 'flex', alignItems: 'center', marginBottom: 8}}>
              <label style={{width: 100, fontSize: 12}}>投影比例尺</label>
              <input type="number" step="0.0001" value={1}
                style={{width: 120, padding: '4px 8px', border: '1px solid #ccc'}} disabled />
            </div>

            <div style={{display: 'flex', alignItems: 'center', marginBottom: 8}}>
              <label style={{width: 100, fontSize: 12}}>中央经线[°]</label>
              <input type="number" step="0.000000001" value={customCoord.centralMeridian}
                onChange={(e) => setCustomCoord({...customCoord, centralMeridian: parseFloat(e.target.value) || 0})}
                style={{width: 200, padding: '4px 8px', border: '1px solid #ccc'}} />
            </div>

            <div style={{display: 'flex', alignItems: 'center', marginBottom: 8}}>
              <label style={{width: 100, fontSize: 12}}>纬度基线[°]</label>
              <input type="number" step="0.0001" value={customCoord.latitudeBase}
                onChange={(e) => setCustomCoord({...customCoord, latitudeBase: parseFloat(e.target.value) || 0})}
                style={{width: 200, padding: '4px 8px', border: '1px solid #ccc'}} />
            </div>

            <div style={{display: 'flex', alignItems: 'center', marginBottom: 8}}>
              <label style={{width: 100, fontSize: 12}}>东偏移[米]</label>
              <input type="number" step="1" value={customCoord.falseEasting}
                onChange={(e) => setCustomCoord({...customCoord, falseEasting: parseFloat(e.target.value) || 0})}
                style={{width: 200, padding: '4px 8px', border: '1px solid #ccc'}} />
            </div>

            <div style={{display: 'flex', alignItems: 'center', marginBottom: 8}}>
              <label style={{width: 100, fontSize: 12}}>北偏移[米]</label>
              <input type="number" step="1" value={customCoord.falseNorthing}
                onChange={(e) => setCustomCoord({...customCoord, falseNorthing: parseFloat(e.target.value) || 0})}
                style={{width: 200, padding: '4px 8px', border: '1px solid #ccc'}} />
            </div>

            <div style={{height: 1, background: '#ddd', margin: '12px 0'}}></div>

            {/* 七参数 */}
            <div style={{display: 'flex', alignItems: 'center', marginBottom: 8}}>
              <label style={{width: 100, fontSize: 12}}>DX[米]</label>
              <input type="number" step="0.001" value={customCoord.dx}
                onChange={(e) => setCustomCoord({...customCoord, dx: parseFloat(e.target.value) || 0})}
                style={{width: 200, padding: '4px 8px', border: '1px solid #ccc'}} />
            </div>

            <div style={{display: 'flex', alignItems: 'center', marginBottom: 8}}>
              <label style={{width: 100, fontSize: 12}}>DY[米]</label>
              <input type="number" step="0.001" value={customCoord.dy}
                onChange={(e) => setCustomCoord({...customCoord, dy: parseFloat(e.target.value) || 0})}
                style={{width: 200, padding: '4px 8px', border: '1px solid #ccc'}} />
            </div>

            <div style={{display: 'flex', alignItems: 'center', marginBottom: 8}}>
              <label style={{width: 100, fontSize: 12}}>DZ[米]</label>
              <input type="number" step="0.001" value={customCoord.dz}
                onChange={(e) => setCustomCoord({...customCoord, dz: parseFloat(e.target.value) || 0})}
                style={{width: 200, padding: '4px 8px', border: '1px solid #ccc'}} />
            </div>

            <div style={{display: 'flex', alignItems: 'center', marginBottom: 8}}>
              <label style={{width: 100, fontSize: 12}}>RX[秒]</label>
              <input type="number" step="0.0001" value={customCoord.rx}
                onChange={(e) => setCustomCoord({...customCoord, rx: parseFloat(e.target.value) || 0})}
                style={{width: 200, padding: '4px 8px', border: '1px solid #ccc'}} />
            </div>

            <div style={{display: 'flex', alignItems: 'center', marginBottom: 8}}>
              <label style={{width: 100, fontSize: 12}}>RY[秒]</label>
              <input type="number" step="0.0001" value={customCoord.ry}
                onChange={(e) => setCustomCoord({...customCoord, ry: parseFloat(e.target.value) || 0})}
                style={{width: 200, padding: '4px 8px', border: '1px solid #ccc'}} />
            </div>

            <div style={{display: 'flex', alignItems: 'center', marginBottom: 8}}>
              <label style={{width: 100, fontSize: 12}}>RZ[秒]</label>
              <input type="number" step="0.0001" value={customCoord.rz}
                onChange={(e) => setCustomCoord({...customCoord, rz: parseFloat(e.target.value) || 0})}
                style={{width: 200, padding: '4px 8px', border: '1px solid #ccc'}} />
            </div>

            <div style={{display: 'flex', alignItems: 'center', marginBottom: 8}}>
              <label style={{width: 100, fontSize: 12}}>m[ppm]</label>
              <input type="number" step="0.01" value={customCoord.m}
                onChange={(e) => setCustomCoord({...customCoord, m: parseFloat(e.target.value) || 0})}
                style={{width: 200, padding: '4px 8px', border: '1px solid #ccc'}} />
            </div>

            <div style={{height: 1, background: '#ddd', margin: '12px 0'}}></div>

            {/* 校正参数 */}
            <div style={{display: 'flex', alignItems: 'center', marginBottom: 8}}>
              <input type="checkbox" checked={customCoord.useCorrection}
                onChange={(e) => setCustomCoord({...customCoord, useCorrection: e.target.checked})}
                style={{marginRight: 8}} />
              <label style={{fontSize: 12}}>使用校正参数</label>
            </div>

            {customCoord.useCorrection && (
              <>
                <div style={{display: 'flex', alignItems: 'center', marginBottom: 8}}>
                  <label style={{width: 100, fontSize: 12}}>ΔX[米]</label>
                  <input type="number" step="0.001" value={customCoord.deltaX}
                    onChange={(e) => setCustomCoord({...customCoord, deltaX: parseFloat(e.target.value) || 0})}
                    style={{width: 200, padding: '4px 8px', border: '1px solid #ccc'}} />
                </div>

                <div style={{display: 'flex', alignItems: 'center', marginBottom: 8}}>
                  <label style={{width: 100, fontSize: 12}}>ΔY[米]</label>
                  <input type="number" step="0.001" value={customCoord.deltaY}
                    onChange={(e) => setCustomCoord({...customCoord, deltaY: parseFloat(e.target.value) || 0})}
                    style={{width: 200, padding: '4px 8px', border: '1px solid #ccc'}} />
                </div>
              </>
            )}

            <div style={{display: 'flex', alignItems: 'center', marginBottom: 8}}>
              <label style={{width: 100, fontSize: 12}}>投影高度</label>
              <input type="number" step="1" value={customCoord.projectionHeight}
                onChange={(e) => setCustomCoord({...customCoord, projectionHeight: parseFloat(e.target.value) || 0})}
                style={{width: 200, padding: '4px 8px', border: '1px solid #ccc'}} />
            </div>

            <div style={{height: 1, background: '#ddd', margin: '12px 0'}}></div>

            {/* 快捷设置 */}
            <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
              <button className="btn" onClick={() => setCustomCoord({...customCoord,
                centralMeridian: 113.283333333333, falseEasting: 39980, falseNorthing: -2329620,
                dx: 0, dy: 0, dz: 0, rx: 0, ry: 0, rz: 0, m: 0
              })}>广州2000</button>
              <button className="btn" onClick={() => setCustomCoord({...customCoord,
                centralMeridian: 114, falseEasting: 500000, falseNorthing: 0,
                dx: 0, dy: 0, dz: 0, rx: 0, ry: 0, rz: 0, m: 0
              })}>3度带114°</button>
              <button className="btn" onClick={() => setCustomCoord({...customCoord,
                centralMeridian: 117, falseEasting: 500000, falseNorthing: 0,
                dx: 0, dy: 0, dz: 0, rx: 0, ry: 0, rz: 0, m: 0
              })}>3度带117°</button>
            </div>
          </div>
          <div className="popup-footer">
            <button onClick={() => setShowSettings(false)}>取消</button>
            <button className="btn" onClick={saveCustomCoordConfig}>载入配置</button>
            <button className="btn" onClick={() => {
              localStorage.setItem('customCoordParams', JSON.stringify(customCoord));
              alert('配置已保存');
            }}>保存配置</button>
            <button className="btn-primary" onClick={() => saveGlobalCoordSys(customCoord.coordType)}>确定</button>
          </div>
        </div>
      )}
      {/* 轻量 toast 提示 */}
      {toast && (
        <div className={`app-toast app-toast-${toast.type}`}>{toast.msg}</div>
      )}
    </div>
  );
}

export default App;