import React, { useState, useRef, useEffect, useCallback } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer';
import { XYZ, Vector as VectorSource } from 'ol/source';
import { createXYZ } from 'ol/tilegrid';
import { fromLonLat, toLonLat } from 'ol/proj';
import { Point, LineString, Polygon } from 'ol/geom';
import { Feature } from 'ol';
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style';
import Draw from 'ol/interaction/Draw';
import KML from 'ol/format/KML';
import GeoJSON from 'ol/format/GeoJSON';
import './index.css';

import { parseKML } from './utils/kmlParser';
import { parseGPX } from './utils/gpxParser';
import { parseCSV } from './utils/csvParser';
import { parseGeoJSON } from './utils/geojsonParser';
import { parseShapefile } from './utils/shapefileParser';
import { parseDXF, applyFeatureStyle, featureLabel } from './utils/dxfParser';
import { COORD_SYSTEMS, THREE_DEGREE_ZONES, convertCoordinate, setLocalEngineeringParams, wgs84togcj02, gcj02towgs84 } from './utils/coordSystems';
import { GridOverlayComponent } from './utils/gridOverlay';

// 简单的Divider组件
const Divider = () => <hr style={{border: 'none', borderTop: '1px solid #ddd', margin: '12px 0'}} />;

const MAP_SOURCES = {
  // datum: 底图所用基准面。高德系为火星坐标系 GCJ-02；天地图系 CGCS2000≈WGS84。
  // maxZoom: 图源真实最大瓦片级别（高德/天地图均约 18），用于 overzoom 钳制。
  gaode: { name: '高德地图', datum: 'gcj02', maxZoom: 18, url: 'https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}' },
  gaodeSatellite: { name: '高德卫星', datum: 'gcj02', maxZoom: 18, url: 'https://webst01.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}' },
  tianditu_vec: { name: '天地图', datum: 'wgs84', maxZoom: 18, url: 'https://t0.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}&tk=329ae98a7ad41aa54ca64be0b33057a9' },
  tianditu_img: { name: '天地图影像', datum: 'wgs84', maxZoom: 18, url: 'https://t0.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}&tk=329ae98a7ad41aa54ca64be0b33057a9' }
};

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
    if (!srcSystem || !srcCoords || !srcCoords.length || !geom) { f.set('datum', 'wgs84'); continue; }
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
  const vectorSourceRef = useRef(new VectorSource());
  const drawRef = useRef(null);
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

    const vLayer = new VectorLayer({
      source: vectorSourceRef.current,
      style: new Style({
        fill: new Fill({ color: 'rgba(25,118,210,0.2)' }),
        stroke: new Stroke({ color: '#1976d2', width: 2 }),
        image: new CircleStyle({ radius: 8, fill: new Fill({ color: '#1976d2' }), stroke: new Stroke({ color: 'white', width: 2 }) })
      })
    });

    const tLayer = new TileLayer({
      source: buildBasemapSource(mapSource)
    });

    const map = new Map({
      target: mapRef.current,
      layers: [tLayer, vLayer],
      view: new View({ center: fromLonLat([113.264, 23.129]), zoom: 10, maxZoom: 20 }),
      controls: []
    });

    map.on('pointermove', (e) => {
      const c = toLonLat(e.coordinate);
      setMousePos({ lon: c[0].toFixed(6), lat: c[1].toFixed(6), x: e.coordinate[0].toFixed(2), y: e.coordinate[1].toFixed(2) });
    });

    map.getView().on('change:resolution', () => setZoom(map.getView().getZoom()));
    setZoom(map.getView().getZoom());

    // 任务4：点击选中要素。命中 DXF 要素 -> 存入 selectedFeature；空白处 -> 保留原标注新增行为并清空选中
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
          // 空白处：保留原有“新增标注”行为
          const c = toLonLat(e.coordinate);
          const m = { id: Date.now(), name: `标注${markers.length + 1}`, coordinates: c, color: '#e91e63', description: '' };
          setMarkers(prev => [...prev, m]);
          vectorSourceRef.current.addFeature(new Feature({ geometry: new Point(e.coordinate), markerData: m }));
        }
      }
    });

    mapRef2.current = map;
    return () => { map.setTarget(null); mapRef2.current = null; };
  }, []);

  // 切换地图源：重建底图瓦片源（含 overzoom），并按新底图基准面重算已加载要素几何
  useEffect(() => {
    if (!mapRef2.current) return;
    mapRef2.current.getLayers().item(0).setSource(buildBasemapSource(mapSource));
    // 高德(GCJ-02)与天地图(WGS84)基准面不同，切换时需对要素几何做偏移/反偏移
    updateFeaturesGeometry(vectorSourceRef.current.getFeatures(), { datum: getBasemapDatum(mapSource) });
  }, [mapSource]);

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

  // IPC监听器 - 从localStorage读取最新的坐标系设置
  useEffect(() => {
    if (!window.require) return;
    const { ipcRenderer } = window.require('electron');

    const handleImportData = (event, files) => {
      if (files && files.length > 0) {
        // 从localStorage读取最新的坐标系设置
        const currentCoordSys = localStorage.getItem('globalCoordSys') || 'wgs84';
        
        // 检查是否需要坐标系选择器
        const needPicker = files.some(f => ['dxf', 'dwg', 'shp', 'csv', 'xlsx'].includes(f.name.split('.').pop().toLowerCase()));
        if (needPicker) {
          setPendingFiles(files);
          setSelectedCoordSys(currentCoordSys); // 设置默认选中的坐标系
          setShowCoordSysPicker(true);
        } else {
          doImport(files, currentCoordSys, importUnit);
        }
      }
    };

    ipcRenderer.on('import-data', handleImportData);

    return () => {
      ipcRenderer.removeListener('import-data', handleImportData);
    };
  }, []);

  // 检测DXF坐标系
  const detectDXFCoordSystem = (content) => {
    if (!content) return 'guangzhou2000';
    
    let text = '';
    if (typeof content === 'string') {
      text = content;
    } else if (content instanceof Uint8Array) {
      text = new TextDecoder('gb2312').decode(content);
    } else if (Array.isArray(content)) {
      text = new TextDecoder('gb2312').decode(new Uint8Array(content));
    }
    
    if (!text) return 'guangzhou2000';
    
    // 提取EXTMIN和EXTMAX来判断坐标范围
    const extMinMatch = text.match(/\$EXTMIN[\s\S]*?10\s*\n\s*([-\d.]+)/);
    const extMaxMatch = text.match(/\$EXTMAX[\s\S]*?10\s*\n\s*([-\d.]+)/);
    const extMinYMatch = text.match(/\$EXTMIN[\s\S]*?20\s*\n\s*([-\d.]+)/);
    const extMaxYMatch = text.match(/\$EXTMAX[\s\S]*?20\s*\n\s*([-\d.]+)/);
    
    if (extMinMatch && extMaxMatch && extMinYMatch && extMaxYMatch) {
      const minX = parseFloat(extMinMatch[1]);
      const maxX = parseFloat(extMaxMatch[1]);
      const minY = parseFloat(extMinYMatch[1]);
      const maxY = parseFloat(extMaxYMatch[1]);
      
      
      // 广州2000坐标系特征：X是5位数，Y是6位数
      // X范围通常在0-100000之间
      // Y范围通常在-3000000到0之间
      if (minX >= 0 && maxX < 100000 && minY < 0 && maxY < 0) {
        return 'guangzhou2000';
      }
      
      // UTM坐标系特征：X和Y都是6位数以上
      if (minX > 100000 && minY > 1000000) {
        return 'utm_50n';
      }
      
      // WGS84坐标系特征：X是经度（-180到180），Y是纬度（-90到90）
      if (minX >= -180 && maxX <= 180 && minY >= -90 && maxY <= 90) {
        return 'wgs84';
      }
    }
    
    // 未匹配任何已知预设：识别为「本地工程坐标（假原点）」，交由用户配置
    // 中央子午线/假东/北偏移，避免强行套用固定假原点的广州2000 导致位置错误
    return 'local_engineering';
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

        // 坐标系：用户已显式选择（cs）时优先使用；仅当未指定时才自动检测
        let coordSys = cs;
        const autoDetect = !cs || cs === 'auto';
        if (['dxf', 'dwg'].includes(ext) && autoDetect) {
          coordSys = detectDXFCoordSystem(content);
        } else {
        }

        // 处理三度带坐标系
        if (coordSys && (coordSys.startsWith('cgcs2000_3_') || coordSys.startsWith('wgs84_3_'))) {
          // 解析带号
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
            const result = await parseDXF(content, coordSys, unit);
            if (result && result.features) {
              feats = result.features;
            } else if (Array.isArray(result)) {
              feats = result;
            }
            break;
          default: console.warn('不支持的格式:', ext);
        }

        if (feats && feats.length > 0) {
          // 所有要素统一加入 vectorSource 用于地图渲染（保持现有渲染流程不变）
          feats.forEach(feat => vectorSourceRef.current.addFeature(feat));

          // 按当前底图基准面（GCJ-02 / WGS84）校正要素几何：
          // 先给每个要素打上默认基准面 'wgs84'，再据当前底图统一做基准面变换（幂等）。
          feats.forEach(f => { if (f.get('datum') == null) f.set('datum', 'wgs84'); });
          await updateFeaturesGeometry(vectorSourceRef.current.getFeatures(), { datum: getBasemapDatum(mapSource) });

          if (ext === 'dxf' || ext === 'dwg') {
            // DXF：按内部图层码（feature.get('layer')）拆分为多个子图层条目
            const fileBase = f.name.replace(/\.[^.]+$/, '');
            const groups = {};
            feats.forEach(feat => {
              const layerName = feat.get('layer') || '未命名';
              if (!groups[layerName]) groups[layerName] = [];
              groups[layerName].push(feat);
            });
            const subLayers = Object.keys(groups).map((layerName, i) => ({
              id: `${Date.now()}_${i}`,
              name: `${layerName}（${groups[layerName].length}）`,
              visible: true,
              features: groups[layerName],
              dxfSub: true,
              fileBase,
            }));
            setLayers(prev => [...prev, ...subLayers]);
          } else {
            // 其他格式：整体作为 1 条图层条目
            setLayers(prev => [...prev, { id: Date.now(), name: f.name, visible: true, features: feats }]);
          }

          setGlobalCoordSys(coordSys); // 更新全局坐标系
        } else {
          console.warn('没有解析到要素:', f.name);
        }
      } catch (e) {
        console.error('导入失败:', e);
        alert(`导入 ${f.name} 失败: ${e.message}`);
      }
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
    const features = vectorSourceRef.current.getFeatures();
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

  // 删除图层
  const deleteLayer = (id) => {
    const l = layers.find(x => x.id === id);
    if (l) {
      l.features.forEach(f => vectorSourceRef.current.removeFeature(f));
      setLayers(prev => prev.filter(x => x.id !== id));
    }
  };

  // 删除标注
  const deleteMarker = (id) => {
    const f = vectorSourceRef.current.getFeatures().find(f => f.get('markerData')?.id === id);
    if (f) vectorSourceRef.current.removeFeature(f);
    setMarkers(prev => prev.filter(m => m.id !== id));
  };

  // 切换图层可见性
  // 修复（Bug1）：原先把 f.setVisible(...) 副作用写在了 setLayers 的 updater 回调内部。
  // React 要求 setState 的 updater 必须是纯函数（不产生外部副作用），且在 StrictMode 下
  // updater 会被调用两次；OL 的 setVisible 会同步触发 change 事件，在渲染期外溢极易导致
  // "Cannot update a component while rendering a different component" 甚至硬崩溃。
  // 现改为：1) 先从当前状态取出目标图层并计算新可见状态；2) 在 setState 之外施加副作用；
  // 3) 用纯函数只更新 React 状态。
  const toggleLayer = (id) => {
    // 1) 取出目标图层（组件级 layers 为当前渲染的最新值），计算目标可见状态
    const target = layers.find(l => l.id === id);
    if (!target) return;
    const newVisible = !target.visible;

    // 2) 在 setState 之外施加副作用：逐个要素设置可见性（带防御，跳过 undefined / 非要素对象）
    if (Array.isArray(target.features)) {
      target.features.forEach(f => {
        if (f && typeof f.setVisible === 'function') {
          f.setVisible(newVisible);
        }
      });
    }

    // 3) 纯函数更新 React 状态（不含任何副作用）
    setLayers(prev => prev.map(l => (l.id === id ? { ...l, visible: newVisible } : l)));
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
    updateFeaturesGeometry(vectorSourceRef.current.getFeatures(), { coordSystem: cs, datum: getBasemapDatum(mapSource) });
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
    const feats = vectorSourceRef.current.getFeatures();
    if (feats.length === 0) { alert('没有数据'); return; }
    let content = '', mime = 'text/plain';
    if (fmt === 'kml') {
      content = '<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>';
      feats.forEach((f, i) => { const c = toLonLat(f.getGeometry().getCoordinates()); content += `<Placemark><name>${i + 1}</name><Point><coordinates>${c[0]},${c[1]}</coordinates></Point></Placemark>`; });
      content += '</Document></kml>';
      mime = 'application/vnd.google-earth.kml+xml';
    } else if (fmt === 'csv') {
      content = '名称,经度,纬度\n';
      feats.forEach((f, i) => { const c = toLonLat(f.getGeometry().getCoordinates()); content += `${i + 1},${c[0]},${c[1]}\n`; });
    } else if (fmt === 'geojson') {
      content = JSON.stringify({ type: 'FeatureCollection', features: feats.map((f, i) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: toLonLat(f.getGeometry().getCoordinates()) }, properties: { name: i + 1 } })) });
    }
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `export.${fmt}`;
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

  // 快捷键
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'o') { e.preventDefault(); triggerImport(); }
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); setShowExport(true); }
      if (e.key === 'F11') { e.preventDefault(); fullscreen(); }
      if (e.key === 'Delete') {
        // 删除选中的要素（简化实现）
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 编辑标注
  const handleEditMarker = (marker) => {
    setEditingMarker(marker);
  };

  // 保存编辑
  const handleSaveEdit = () => {
    if (editingMarker) {
      setMarkers(prev => prev.map(m => m.id === editingMarker.id ? editingMarker : m));
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
          <div className="toolbar-separator"></div>
          <button className={`toolbar-btn ${measureType === 'area' ? 'active' : ''}`} title="面积测量" onClick={() => { setMeasureType(measureType === 'area' ? null : 'area'); setActiveTool(measureType === 'area' ? 'pointer' : 'polygon'); }}>📐 面积</button>
          <button className={`toolbar-btn ${measureType === 'distance' ? 'active' : ''}`} title="距离测量" onClick={() => { setMeasureType(measureType === 'distance' ? null : 'distance'); setActiveTool(measureType === 'distance' ? 'pointer' : 'line'); }}>📏 距离</button>
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
          <select className="toolbar-select" value={mapSource} onChange={(e) => setMapSource(e.target.value)}>
            {Object.entries(MAP_SOURCES).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
          </select>
        </div>
      </div>

      <div className="main-content">
        {/* 左侧工具栏 */}
        <div className="left-toolbar">
          <button className={`left-btn ${activeTool === 'pointer' ? 'active' : ''}`} title="选择/标注" onClick={() => { setActiveTool('pointer'); setMeasureType(null); }}>🖱</button>
          <button className={`left-btn ${activeTool === 'line' ? 'active' : ''}`} title="画线" onClick={() => { setActiveTool('line'); setMeasureType('distance'); }}>📏</button>
          <button className={`left-btn ${activeTool === 'polygon' ? 'active' : ''}`} title="画面" onClick={() => { setActiveTool('polygon'); setMeasureType('area'); }}>⬡</button>
          <div className="left-separator"></div>
          <button className="left-btn" title="放大" onClick={zoomIn}>＋</button>
          <button className="left-btn" title="缩小" onClick={zoomOut}>－</button>
          <button className="left-btn" title="全图" onClick={zoomFull}>⌂</button>
          <div style={{flex: 1}}></div>
          <button className="left-btn" title="图层" onClick={() => setRightTab('layers')}>📑</button>
          <button className="left-btn" title="标注" onClick={() => setRightTab('markers')}>🏷</button>
        </div>

        {/* 地图 */}
        <div className="map-area">
          <div ref={mapRef} className="map"></div>
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
                      <div key={l.id} className="layer-block">
                        <div className="list-item">
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
                          <button className="btn-icon" onClick={() => deleteLayer(l.id)}>✕</button>
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
                  <div className="empty-hint">点击地图添加标注<br/>双击标注编辑</div>
                ) : (
                  <div className="list-container">
                    {markers.map(m => (
                      <div key={m.id} className="list-item" onDoubleClick={() => handleEditMarker(m)}>
                        <div className="color-dot" style={{background: m.color}}></div>
                        <span className="item-name">{m.name}</span>
                        <button className="btn-icon" onClick={() => flyTo(m)}>👁</button>
                        <button className="btn-icon" onClick={() => deleteMarker(m.id)}>✕</button>
                      </div>
                    ))}
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
                const m = { id: Date.now(), name: `标注${markers.length + 1}`, coordinates: [parseFloat(mousePos.lon), parseFloat(mousePos.lat)], color: '#e91e63', description: '' };
                setMarkers(prev => [...prev, m]);
                vectorSourceRef.current.addFeature(new Feature({ geometry: new Point(fromLonLat(m.coordinates)), markerData: m }));
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
          </div>
        </div>
      )}

      {/* 编辑标注弹窗 */}
      {editingMarker && (
        <div className="popup" style={{width: 350}}>
          <div className="popup-title">✏️ 编辑标注 <button onClick={() => setEditingMarker(null)}>✕</button></div>
          <div className="popup-body">
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
    </div>
  );
}

export default App;