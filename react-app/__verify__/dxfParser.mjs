import Feature from 'ol/Feature.js';
import { Point, LineString, Polygon, MultiLineString } from 'ol/geom.js';
import { fromLonLat } from 'ol/proj.js';
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style.js';
import { convertCoordinate, COORD_SYSTEMS } from './coordSystems.mjs';

// DXF颜色映射表（标准颜色）
const DXF_COLORS = {
  0: '#000000', 1: '#FF0000', 2: '#FFFF00', 3: '#00FF00',
  4: '#00FFFF', 5: '#0000FF', 6: '#FF00FF', 7: '#FFFFFF',
  8: '#808080', 9: '#C0C0C0', 10: '#FF0000', 20: '#FFFF00',
  30: '#00FF00', 40: '#00FFFF', 50: '#0000FF', 60: '#FF00FF',
  70: '#FF8080', 80: '#FFFF80', 90: '#80FF80', 100: '#80FFFF',
  110: '#8080FF', 120: '#FF80FF', 130: '#FF8000', 140: '#FFBF00',
  150: '#80FF00', 160: '#00FF80', 170: '#00BFFF', 180: '#0080FF',
  190: '#8000FF', 200: '#FF0080', 210: '#FF4040', 220: '#FF8040',
  230: '#FFBF40', 240: '#FFFF40', 250: '#BFFF40',   255: '#000000'
};

// 统一文字字体族（任务2优化）：优先清晰无衬线字体栈，保证中文高程注记与中文注记都细体、清晰。
// 配合 buildTextStyle 的白色光晕(halo)进一步提高画布对比度与可读性。
const TEXT_FONT_FAMILY = 'Microsoft YaHei, PingFang SC, Helvetica Neue, Arial, sans-serif';

// GCD 高程注记样式（本次 Bug 修复）：
// 高程数值恒定橙红色、细体(normal)、恒定屏幕像素(scale:undefined，不随缩放放大)。
// 与现有 GCD 点色(#FF6600)同源，取更醒目的橙红；复用 dxf_text 类型与现有样式管线。
const GCD_ELEVATION_COLOR = '#ff5500';
const GCD_ELEVATION_FONT_SIZE = 14;

// GCD 高程点（小圆点符号）恒定屏幕像素半径，绝不随地图缩放变大变小（任务3）。
const GCD_ELEVATION_DOT_RADIUS = 3.5;

/**
 * 统一文字样式构造器（任务2）：
 *  - 细字重（normal 或传入更轻字重），提升“细”观感；
 *  - 固定屏幕像素大小（scale:undefined，OpenLayers Text 不随地图 zoom/resolution 缩放）；
 *  - 白色光晕(halo)描边，提高复杂底图上的对比与清晰度；
 *  - 合理设置 textBaseline / textAlign / offset，便于锚定（如高程数字偏右避免压住小圆点）。
 * @param {Object} o
 * @param {string} o.text 文字内容
 * @param {string} o.color 填充色
 * @param {number} [o.fontSize=12] 字号(px)
 * @param {string} [o.fontWeight='normal'] 字重
 * @param {string} [o.fontFamily] 字体族，缺省用 TEXT_FONT_FAMILY
 * @param {string} [o.haloColor='white'] 光晕色
 * @param {number} [o.haloWidth=2] 光晕宽度(px)
 * @param {string} [o.textAlign='center'] 水平对齐
 * @param {string} [o.textBaseline='middle'] 垂直对齐
 * @param {number} [o.offsetX=0] 水平偏移(px)
 * @param {number} [o.offsetY=0] 垂直偏移(px)
 * @returns {Text}
 */
function buildTextStyle(o) {
  const font = `${o.fontWeight || 'normal'} ${o.fontSize || 12}px ${o.fontFamily || TEXT_FONT_FAMILY}`;
  return new Text({
    text: o.text,
    font,
    fill: new Fill({ color: o.color || '#000000' }),
    stroke: new Stroke({ color: o.haloColor || 'white', width: o.haloWidth != null ? o.haloWidth : 2 }),
    textAlign: o.textAlign || 'center',
    textBaseline: o.textBaseline || 'middle',
    offsetX: o.offsetX || 0,
    offsetY: o.offsetY || 0,
    scale: undefined // 恒定屏幕像素，不随缩放放大
  });
}

// 图层色表（按图层名记录 DXF 图层 ACI 颜色，用于实体 BYLAYER 着色）
const layerColorMap = {};

/**
 * 解析 DXF 文件
 * @param {ArrayBuffer|string} content - 文件内容
 * @param {string} sourceCoordSystem - 源坐标系ID
 * @param {string} unit - 坐标单位
 * @returns {Object} 包含features和layers信息
 */
export async function parseDXF(content, sourceCoordSystem = 'wgs84', unit = null) {
  const features = [];
  const layers = {};
  
  try {
    let text = '';
    
    // 处理各种输入格式
    if (typeof content === 'string') {
      text = content;
    } else if (content instanceof ArrayBuffer) {
      text = new TextDecoder('gb18030').decode(content);
    } else if (content instanceof Uint8Array) {
      text = new TextDecoder('gb18030').decode(content);
    } else if (Array.isArray(content)) {
      // Electron IPC传输的数组格式
      const bytes = new Uint8Array(content);
      text = new TextDecoder('gb18030').decode(bytes);
    } else if (content && typeof content.text === 'function') {
      text = await content.text();
    } else if (content && content.data) {
      const bytes = new Uint8Array(content.data);
      text = new TextDecoder('gb18030').decode(bytes);
    } else {
      throw new Error('不支持的文件格式');
    }

    if (!text || text.trim().length === 0) {
      throw new Error('文件内容为空');
    }

    // 解析单位：调用方已传入 unit 时优先使用；否则按 DXF 的 INSUNITS 自动判断；缺省为米
    if (!unit) {
      unit = detectDXFUnit(text);
    }

    // 检查是否包含DXF标记
    if (!text.includes('ENTITIES') && !text.includes('ENDSEC')) {
      throw new Error('文件不是有效的DXF格式');
    }

    const lines = text.split(/\r?\n/);
    
    // 第一遍：解析图层信息
    parseLayers(lines, layers);
    
    // 解析BLOCKS段，获取图块定义
    const blocks = {};
    parseBlocks(lines, blocks);
    
    // 第二遍：解析实体
    let inEntities = false;
    let currentLayer = '0';
    let currentColor = 7;
    let entityCount = 0;
    let i = 0;
    
    while (i < lines.length) {
      const line = lines[i].trim();
      
      if (line === 'ENTITIES') {
        inEntities = true;
        i++;
        continue;
      }
      
      if (inEntities) {
        if (line === 'ENDSEC') {
          break;
        }
        
        // DXF格式: 0在一行，实体类型在下一行
        if (line === '0' && i + 1 < lines.length) {
          const entityType = lines[i + 1].trim();
          i++; // 跳过实体类型行
          
          // 解析实体
          if (entityType === 'LINE') {
            entityCount++;
            const result = await parseLINE(lines, i + 1, sourceCoordSystem, unit, currentLayer, currentColor);
            if (result.feature) {
              result.feature.set('srcSystem', sourceCoordSystem);
              features.push(result.feature);
              addFeatureToLayer(layers, currentLayer, result.feature);
            }
            // 解析器返回的 nextIndex 已越过“下一个实体的 0 + 类型行”（各占一行），
            // 这里回退 2 行使其重新指向该 '0'，主循环才能正确识别下一个实体。
            // 修复：此前直接 i = result.nextIndex 会导致每两个实体被跳过一个（块参照等大量丢失）。
            i = result.nextIndex - 2;
            continue;
          }
          
          if (entityType === 'LWPOLYLINE') {
            entityCount++;
            const result = await parseLWPOLYLINE(lines, i + 1, sourceCoordSystem, unit, currentLayer, currentColor);
            if (result.feature) {
              result.feature.set('srcSystem', sourceCoordSystem);
              features.push(result.feature);
              addFeatureToLayer(layers, currentLayer, result.feature);
            }
            // 解析器返回的 nextIndex 已越过“下一个实体的 0 + 类型行”（各占一行），
            // 这里回退 2 行使其重新指向该 '0'，主循环才能正确识别下一个实体。
            // 修复：此前直接 i = result.nextIndex 会导致每两个实体被跳过一个（块参照等大量丢失）。
            i = result.nextIndex - 2;
            continue;
          }
          
          if (entityType === 'POLYLINE') {
            entityCount++;
            const result = await parsePOLYLINE(lines, i + 1, sourceCoordSystem, unit, currentLayer, currentColor);
            if (result.feature) {
              result.feature.set('srcSystem', sourceCoordSystem);
              features.push(result.feature);
              addFeatureToLayer(layers, currentLayer, result.feature);
            }
            // 解析器返回的 nextIndex 已越过“下一个实体的 0 + 类型行”（各占一行），
            // 这里回退 2 行使其重新指向该 '0'，主循环才能正确识别下一个实体。
            // 修复：此前直接 i = result.nextIndex 会导致每两个实体被跳过一个（块参照等大量丢失）。
            i = result.nextIndex - 2;
            continue;
          }
          
          if (entityType === 'CIRCLE') {
            entityCount++;
            const result = await parseCIRCLE(lines, i + 1, sourceCoordSystem, unit, currentLayer, currentColor);
            if (result.feature) {
              result.feature.set('srcSystem', sourceCoordSystem);
              features.push(result.feature);
              addFeatureToLayer(layers, currentLayer, result.feature);
            }
            // 解析器返回的 nextIndex 已越过“下一个实体的 0 + 类型行”（各占一行），
            // 这里回退 2 行使其重新指向该 '0'，主循环才能正确识别下一个实体。
            // 修复：此前直接 i = result.nextIndex 会导致每两个实体被跳过一个（块参照等大量丢失）。
            i = result.nextIndex - 2;
            continue;
          }
          
          if (entityType === 'ARC') {
            entityCount++;
            const result = await parseARC(lines, i + 1, sourceCoordSystem, unit, currentLayer, currentColor);
            if (result.feature) {
              result.feature.set('srcSystem', sourceCoordSystem);
              features.push(result.feature);
              addFeatureToLayer(layers, currentLayer, result.feature);
            }
            // 解析器返回的 nextIndex 已越过“下一个实体的 0 + 类型行”（各占一行），
            // 这里回退 2 行使其重新指向该 '0'，主循环才能正确识别下一个实体。
            // 修复：此前直接 i = result.nextIndex 会导致每两个实体被跳过一个（块参照等大量丢失）。
            i = result.nextIndex - 2;
            continue;
          }
          
          if (entityType === 'POINT') {
            entityCount++;
            const result = await parsePOINT(lines, i + 1, sourceCoordSystem, unit, currentLayer, currentColor);
            if (result.feature) {
              result.feature.set('srcSystem', sourceCoordSystem);
              features.push(result.feature);
              addFeatureToLayer(layers, currentLayer, result.feature);
            }
            // 任务3(b)：POINT 带 Z 值时额外产出的高程注记 TEXT 要素也要加入要素集与图层分组
            if (result.extraFeatures) {
              for (const ef of result.extraFeatures) {
                ef.set('srcSystem', sourceCoordSystem);
                features.push(ef);
                addFeatureToLayer(layers, currentLayer, ef);
              }
            }
            // 解析器返回的 nextIndex 已越过“下一个实体的 0 + 类型行”（各占一行），
            // 这里回退 2 行使其重新指向该 '0'，主循环才能正确识别下一个实体。
            // 修复：此前直接 i = result.nextIndex 会导致每两个实体被跳过一个（块参照等大量丢失）。
            i = result.nextIndex - 2;
            continue;
          }
          
          if (entityType === 'TEXT' || entityType === 'MTEXT') {
            entityCount++;
            const result = await parseTEXT(lines, i + 1, sourceCoordSystem, unit, currentLayer, currentColor);
            if (result.feature) {
              result.feature.set('srcSystem', sourceCoordSystem);
              features.push(result.feature);
              addFeatureToLayer(layers, currentLayer, result.feature);
            }
            // 解析器返回的 nextIndex 已越过“下一个实体的 0 + 类型行”（各占一行），
            // 这里回退 2 行使其重新指向该 '0'，主循环才能正确识别下一个实体。
            // 修复：此前直接 i = result.nextIndex 会导致每两个实体被跳过一个（块参照等大量丢失）。
            i = result.nextIndex - 2;
            continue;
          }
          
          // INSERT实体（图块引用）
          if (entityType === 'INSERT') {
            entityCount++;
            const result = await parseINSERT(lines, i + 1, sourceCoordSystem, unit, currentLayer, currentColor, blocks);
            if (result.features && result.features.length > 0) {
              result.features.forEach(f => {
                features.push(f);
                addFeatureToLayer(layers, currentLayer, f);
              });
            }
            // 解析器返回的 nextIndex 已越过“下一个实体的 0 + 类型行”（各占一行），
            // 这里回退 2 行使其重新指向该 '0'，主循环才能正确识别下一个实体。
            // 修复：此前直接 i = result.nextIndex 会导致每两个实体被跳过一个（块参照等大量丢失）。
            i = result.nextIndex - 2;
            continue;
          }
          
          // SOLID实体
          if (entityType === 'SOLID') {
            entityCount++;
            const result = await parseSOLID(lines, i + 1, sourceCoordSystem, unit, currentLayer, currentColor);
            if (result.feature) {
              result.feature.set('srcSystem', sourceCoordSystem);
              features.push(result.feature);
              addFeatureToLayer(layers, currentLayer, result.feature);
            }
            // 解析器返回的 nextIndex 已越过“下一个实体的 0 + 类型行”（各占一行），
            // 这里回退 2 行使其重新指向该 '0'，主循环才能正确识别下一个实体。
            // 修复：此前直接 i = result.nextIndex 会导致每两个实体被跳过一个（块参照等大量丢失）。
            i = result.nextIndex - 2;
            continue;
          }
        }
      }
      
      i++;
    }

  } catch (error) {
    console.error('DXF解析失败:', error);
    throw new Error('DXF文件解析失败: ' + error.message);
  }

  return { features, layers };
}

/**
 * 根据 DXF 的 INSUNITS 自动判断坐标单位
 * INSUNITS: 1=英寸 2=英尺 4=毫米 5=厘米 6=米 7=千米 ...
 * 缺省返回 'm'（米），避免米制坐标被当成毫米而 ÷1000
 */
function detectDXFUnit(text) {
  const m = text.match(/\$INSUNITS[\s\S]*?\n\s*70\s*\n\s*(\d+)/);
  if (m) {
    const v = parseInt(m[1], 10);
    if (v === 4) return 'mm';
    if (v === 6) return 'm';
    if (v === 5) return 'cm';
  }
  return 'm';
}

/**
 * 解析图层信息
 */
function parseLayers(lines, layers) {
  let inTables = false;
  let inLayer = false;
  let layerName = '';
  let layerColor = 7;
  let layerType = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line === 'TABLES') {
      inTables = true;
      continue;
    }
    
    if (inTables && line === 'LAYER') {
      inLayer = true;
      continue;
    }
    
    if (inLayer) {
      if (line === '0' && i + 1 < lines.length && lines[i + 1].trim() === 'LAYER') {
        // 保存当前图层
        if (layerName) {
          layers[layerName] = {
            name: layerName,
            color: DXF_COLORS[layerColor] || '#FFFFFF',
            colorIndex: layerColor,
            type: layerType,
            features: []
          };
        }
        layerName = '';
        layerColor = 7;
        layerType = '';
        continue;
      }
      
      if (line === 'ENDSEC' || line === 'ENDTAB') {
        // 保存最后一个图层
        if (layerName) {
          layers[layerName] = {
            name: layerName,
            color: DXF_COLORS[layerColor] || '#FFFFFF',
            colorIndex: layerColor,
            type: layerType,
            features: []
          };
        }
        inLayer = false;
        inTables = false;
        continue;
      }
      
      // 解析图层属性
      if (i + 1 < lines.length) {
        const code = parseInt(line);
        const value = lines[i + 1].trim();
        
        switch (code) {
          case 2: layerName = value; break;
          case 62:
            layerColor = parseInt(value) || 7;
            if (layerName) layerColorMap[layerName] = layerColor;
            break;
          case 6: layerType = value; break;
        }
      }
    }
  }
}

/**
 * 添加Feature到图层
 * 优先使用要素自身已解析出的图层（实体 group 8），回退到传入的 layerName。
 * 修复：此前直接用未跟踪的 currentLayer('0') 覆盖，导致 DXF 真实图层（GCD/FIXTURE…）全部丢失。
 */
function addFeatureToLayer(layers, layerName, feature) {
  const realLayer = (feature.get && feature.get('layer')) || layerName;
  if (!layers[realLayer]) {
    layers[realLayer] = {
      name: realLayer,
      color: '#FFFFFF',
      colorIndex: 7,
      type: '',
      features: []
    };
  }
  layers[realLayer].features.push(feature);
  feature.set('layer', realLayer);
}

/**
 * 读取组码和值
 */
function readGroupCode(lines, index) {
  if (index >= lines.length) return { code: 0, value: '', nextIndex: index };
  const code = parseInt(lines[index].trim());
  const value = index + 1 < lines.length ? lines[index + 1].trim() : '';
  return { code, value, nextIndex: index + 2 };
}

/**
 * 转换坐标到WGS84
 */
async function convertToWGS84(x, y, sourceSystem, unit = 'm') {
  let realX = x;
  let realY = y;
  
  if (unit === 'mm') {
    realX = x / 1000;
    realY = y / 1000;
  }
  
  
  const sys = COORD_SYSTEMS[sourceSystem];
  if (!sys) {
    return [realX, realY];
  }
  
  
  const isProjected = sys.type === 'projected' || sys.type === 'local' || sys.type === 'military';
  
  if (isProjected) {
    try {
      const result = await convertCoordinate(realX, realY, sourceSystem, 'wgs84');
      return result;
    } catch (e) {
      console.error('投影转换失败:', e);
      return [realX, realY];
    }
  } else {
    if (sourceSystem === 'wgs84') return [realX, realY];
    try {
      return await convertCoordinate(realX, realY, sourceSystem, 'wgs84');
    } catch (e) {
      return [realX, realY];
    }
  }
}

/**
 * 地形图国标图层样式映射表
 * 按图层码（如 GCD、DLSS、JMD）分发渲染样式，解决导入后样式失真问题。
 * 字段说明：
 *  - point  : 点状图层样式（仅对 POINT / INSERT 生效）
 *  - line   : 线状图层样式（对所有线性实体生效）
 *  - polygon: 面状/闭合图层样式（对闭合 LWPOLYLINE / POLYLINE / CIRCLE / SOLID 生效）
 *  - type   : 图层主类型，用于 POINT 分支判断
 *  - dash   : 虚线控制 [实线段, 空白段]
 */
const LAYER_STYLE_MAP = {
  // === 点状图层 ===
  GCD: {   // 高程点 — 数量巨大(16867)，隐藏圆点！由 GCDA 文字标注代替显示
    point: { visible: false },
    type: 'point'
  },
  GXYZ: {  // 测量控制点
    point: { visible: true, radius: 3, fill: '#FF0000', stroke: 'white' },
    type: 'point'
  },
  GCDA: {  // 控制点注记（高程数值）— 文字层！仍用红色，但任务1要求细体（normal、不倾斜）
    text: { color: '#FF0000', fontSize: 14, fontWeight: 'normal', fontFamily: TEXT_FONT_FAMILY, strokeColor: 'white', strokeWidth: 2.5 },
    type: 'text'
  },

  // === 线状图层 ===
  DGX: {   // 等高线 — 绿色系，清晰可见
    line: { color: '#228B22', width: 1.3 },
    polygon: { fill: null, stroke: { color: '#228B22', width: 1.3 } },
    type: 'line'
  },
  DLSS: {  // 道路设施 — 深灰中粗
    line: { color: '#2C2C2C', width: 1.8 },
    polygon: { fill: null, stroke: { color: '#2C2C2C', width: 1.8 } },
    type: 'line'
  },
  DMTZ: {  // 地貌（陡坎等）
    line: { color: '#CD853F', width: 1.2 },
    polygon: { fill: null, stroke: { color: '#CD853F', width: 1.2 } },
    type: 'line'
  },
  SXSS: {  // 水系 — 亮蓝色
    line: { color: '#1E90FF', width: 1.5 },
    polygon: { fill: 'rgba(30,144,255,0.18)', stroke: { color: '#1E90FF', width: 1.2 } },
    type: 'line'
  },
  DLDW: {  // 地物边界
    line: { color: '#666666', width: 1.0 },
    polygon: { fill: null, stroke: { color: '#666666', width: 1.0 } },
    type: 'line'
  },
  ZDH: {   // 地貌注记/地貌
    line: { color: '#CD853F', width: 1.0 },
    polygon: { fill: null, stroke: { color: '#CD853F', width: 1.0 } },
    type: 'line'
  },

  // === 面状图层 ===
  JMD: {   // 居民地（房屋）— 仅描边
    polygon: { fill: null, stroke: { color: '#333333', width: 1.2 } },
    line: { color: '#333333', width: 1.2 },
    type: 'polygon'
  },
  ZBTZ: {  // 植被 — 明显绿晕
    polygon: { fill: 'rgba(34,139,34,0.20)', stroke: { color: '#228B22', width: 1.0 } },
    line: { color: '#228B22', width: 1.0 },
    type: 'polygon'
  },

  // === 辅助层 ===
  assist: {
    line: { color: '#999999', width: 0.5, dash: [4, 3] },
    polygon: { fill: null, stroke: { color: '#999999', width: 0.5, dash: [4, 3] } },
    type: 'line'
  },
  COMPONENT: {
    point: { visible: false },
    type: 'point'
  },

  // === 文字注记层（新增）===
  '文字注记': {
    text: { color: '#000000', fontSize: 13, fontWeight: 'normal', fontFamily: TEXT_FONT_FAMILY, strokeColor: 'white', strokeWidth: 2.0 },
    type: 'text'
  }
};

// 默认样式（未知图层兜底）
const DEFAULT_STYLE = {
  line: { color: '#888888', width: 1.0 },
  polygon: { fill: null, stroke: { color: '#888888', width: 1.0 } },
  point: { visible: true, radius: 2, fill: '#888888', stroke: null },
  type: 'line'
};

/**
 * 根据图层名称获取样式定义
 * 先精确匹配，再尝试前缀匹配（如 "DLSS-辅助" 匹配 DLSS），最后兜底默认样式。
 * @param {string} layerName - 图层名称
 * @returns {Object} 样式定义对象（含 line/polygon/point/type 字段）
 */
function getLayerStyle(layerName) {
  if (LAYER_STYLE_MAP[layerName]) return LAYER_STYLE_MAP[layerName];
  for (const [key, style] of Object.entries(LAYER_STYLE_MAP)) {
    if (layerName.startsWith(key)) return style;
  }
  return DEFAULT_STYLE;
}

/**
 * 获取颜色样式
 */
function getColorStyle(colorIndex, isFill = false) {
  const color = DXF_COLORS[colorIndex] || '#FFFFFF';
  if (isFill) {
    return color + '33'; // 添加透明度
  }
  return color;
}

/**
 * 将 DXF 真彩色（24位 BGR 编码）转为 #RRGGBB
 * @param {number} v - DXF 420 组码真彩色值
 * @returns {string} 十六进制颜色
 */
function trueColorToHex(v) {
  const r = v & 0xff;
  const g = (v >> 8) & 0xff;
  const b = (v >> 16) & 0xff;
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * 解析 DXF 实体最终颜色：真彩色 > 实体色(非 BYBLOCK/BYLAYER) > 图层色。
 * 返回 null 表示"无明确色"，调用方应回退到 LAYER_STYLE_MAP 的颜色。
 * @param {string} layer - 实体所在图层名
 * @param {number} colorIndex - 实体 ACI 色号（0=BYBLOCK, 256=BYLAYER）
 * @param {number|null} trueColor - 真彩色值（group 420），无则为 null
 * @returns {string|null}
 */
function resolveDxfColor(layer, colorIndex, trueColor) {
  if (trueColor != null) return trueColorToHex(trueColor);
  if (colorIndex && colorIndex !== 0 && colorIndex !== 256) return DXF_COLORS[colorIndex] || '#FFFFFF';
  const lc = layerColorMap[layer];
  if (lc != null && lc !== 256) return DXF_COLORS[lc] || '#FFFFFF';
  return null;
}

/**
 * 从 rgba(...) 字符串中提取透明度 alpha（提取不到时默认 0.2）
 * @param {string} fillStr - 图层样式中的 fill 字符串
 * @returns {number}
 */
function extractAlpha(fillStr) {
  if (!fillStr) return 0.2;
  const m = fillStr.match(/rgba?\([^)]*?,\s*([\d.]+)\s*\)/);
  if (m) return parseFloat(m[1]);
  return 0.2;
}

/**
 * 将十六进制颜色（#RGB 或 #RRGGBB）转换为 rgba(r,g,b,alpha)
 * @param {string} hexColor - 十六进制颜色
 * @param {number} alpha - 透明度 0~1
 * @returns {string}
 */
function hexToRgba(hexColor, alpha) {
  let h = (hexColor || '#888888').replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const r = parseInt(h.substring(0, 2), 16) || 0;
  const g = parseInt(h.substring(2, 4), 16) || 0;
  const b = parseInt(h.substring(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * 局部坐标 -> 世界坐标变换（块参照展开用）
 * 公式：world = insPoint + R(rot) * S(scale) * (local - base)
 * @param {number} lx - 局部 x
 * @param {number} ly - 局部 y
 * @param {Array} base - 块基点 [bx, by]
 * @param {number} insX - 插入点 x
 * @param {number} insY - 插入点 y
 * @param {number} rot - 旋转角（弧度）
 * @param {number} sx - x 方向缩放
 * @param {number} sy - y 方向缩放
 * @returns {Array} [wx, wy]
 */
function transformLocalToWorld(lx, ly, base, insX, insY, rot, sx, sy) {
  const x = lx - base[0];
  const y = ly - base[1];
  const cos = Math.cos(rot), sin = Math.sin(rot);
  const rx = x * sx * cos - y * sy * sin;
  const ry = x * sx * sin + y * sy * cos;
  return [insX + rx, insY + ry];
}

/**
 * 清理 MTEXT 格式码，保留可见文字。
 * 去除 \\f \\H \\W \\px \\A \\Q \\S \\c 等控制串，以及 \\L \\l \\O \\o 开关、
 * \\P(→空格) \\~(→空格) \\;(→;) %%u %%o 等；不破坏普通文字。
 * @param {string} s - 原始文本
 * @returns {string}
 */
function cleanMtext(s) {
  if (!s) return s;
  return s
    .replace(/\\f[^;]*;/g, '')        // 字体名 \f...;
    .replace(/\\F[^;]*;/g, '')        // 字体名（大写）
    .replace(/\\H[^;]*;/g, '')        // 文字高度 \H...;
    .replace(/\\W[^;]*;/g, '')        // 宽度因子 \W...;
    .replace(/\\px[^;]*;/g, '')       // 字距 \px...;
    .replace(/\\Q[^;]*;/g, '')        // 倾斜角度 \Q...;
    .replace(/\\S[^;]*;/g, '')        // 堆叠分数 \S...;
    .replace(/\\A[0-9];/g, '')        // 对齐方式 \A1; 等
    .replace(/\\c[0-9];/g, '')        // 颜色索引 \cN;
    .replace(/\\L/g, '')              // 下划线开
    .replace(/\\l/g, '')              // 下划线关
    .replace(/\\O/g, '')              // 上划线开
    .replace(/\\o/g, '')              // 上划线关
    .replace(/\\P/g, ' ')             // 段落换行 → 空格
    .replace(/\\~/g, ' ')             // 不间断空格 → 空格
    .replace(/\\;/g, ';')             // 转义分号
    .replace(/%%u/gi, '')             // 下划线开关
    .replace(/%%o/gi, '')             // 上划线开关
    .replace(/%%[dcp]/gi, '');        // %%d 度 %%c 直径 %%p 正负号
}

/**
 * 解析LINE实体
 */
async function parseLINE(lines, startIndex, sourceCoordSystem, unit, layer, colorIndex) {
  let i = startIndex;
  let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
  let trueColor = null;
  
  while (i < lines.length) {
    const { code, value, nextIndex } = readGroupCode(lines, i);
    i = nextIndex;
    if (code === 0) break;
    
    switch (code) {
      case 8: layer = value; break;
      case 10: x1 = parseFloat(value) || 0; break;
      case 20: y1 = parseFloat(value) || 0; break;
      case 11: x2 = parseFloat(value) || 0; break;
      case 21: y2 = parseFloat(value) || 0; break;
      case 62: colorIndex = parseInt(value) || colorIndex; break;
      case 420: trueColor = parseInt(value) || null; break;
    }
  }
  
  const [lon1, lat1] = await convertToWGS84(x1, y1, sourceCoordSystem, unit);
  const [lon2, lat2] = await convertToWGS84(x2, y2, sourceCoordSystem, unit);
  
  const feature = new Feature({
    geometry: new LineString([fromLonLat([lon1, lat1]), fromLonLat([lon2, lat2])]),
    type: 'dxf_line',
    layer: layer,
    colorIndex: colorIndex,
    srcCoords: [[x1, y1], [x2, y2]]
  });

  const lsty = getLayerStyle(layer);
  const lineStyle = lsty.line || DEFAULT_STYLE.line;
  const dxfColor = resolveDxfColor(layer, colorIndex, trueColor);
  feature.setStyle(new Style({
    stroke: new Stroke({
      color: dxfColor || lineStyle.color,
      width: lineStyle.width,
      ...(lineStyle.dash ? { lineDash: lineStyle.dash } : {})
    })
  }));

  return { feature, nextIndex: i };
}

/**
 * 解析LWPOLYLINE实体
 * 任务5：二维多段线不再闭合为面，改为炸开为「相邻两点一组」的独立线段，用 MultiLineString 承载。
 * 无论首尾顶点是否重合都不再形成闭合面（isClosed 永远 false）；srcCoords 仍保存完整顶点列表供编辑/重投影。
 */
async function parseLWPOLYLINE(lines, startIndex, sourceCoordSystem, unit, layer, colorIndex) {
  let i = startIndex;
  const vertices = [];
  let trueColor = null;

  while (i < lines.length) {
    const { code, value, nextIndex } = readGroupCode(lines, i);
    i = nextIndex;
    if (code === 0) break;

    switch (code) {
      case 8: layer = value; break;
      case 70: break; // 忽略 group70 强制闭合标志（任务5：多段线永不闭合）
      case 10: vertices.push([parseFloat(value) || 0, 0]); break;
      case 20: if (vertices.length > 0) vertices[vertices.length - 1][1] = parseFloat(value) || 0; break;
      case 62: colorIndex = parseInt(value) || colorIndex; break;
      case 420: trueColor = parseInt(value) || null; break;
    }
  }

  if (vertices.length < 2) return { feature: null, nextIndex: i };

  // 先统一将全部顶点转换到 WGS84（保持与旧实现相同的转换次数，避免重复 await）
  const coords = [];
  for (const v of vertices) {
    const [lon, lat] = await convertToWGS84(v[0], v[1], sourceCoordSystem, unit);
    coords.push(fromLonLat([lon, lat]));
  }

  // 炸开：每相邻两点构成一条线段，整体用 MultiLineString 承载（永不闭合）
  const segments = [];
  for (let s = 0; s < coords.length - 1; s++) {
    segments.push([coords[s], coords[s + 1]]);
  }

  const feature = new Feature({
    geometry: new MultiLineString(segments),
    type: 'dxf_polyline',
    layer: layer,
    colorIndex: colorIndex,
    srcCoords: vertices.map(v => [v[0], v[1]]),
    isClosed: false
  });

  const lsty = getLayerStyle(layer);
  const polyStyle = lsty.polygon || DEFAULT_STYLE.polygon;
  const dxfColor = resolveDxfColor(layer, colorIndex, trueColor);
  const strokeColor = dxfColor || polyStyle.stroke.color;
  feature.setStyle(new Style({
    stroke: new Stroke({
      color: strokeColor,
      width: polyStyle.stroke.width,
      ...(polyStyle.stroke.dash ? { lineDash: polyStyle.stroke.dash } : {})
    })
  }));

  return { feature, nextIndex: i };
}

/**
 * 解析POLYLINE实体（老式：含 VERTEX / SEQEND 子实体）
 * 单个状态机：遇到 code 0 即子实体边界，VERTEX 时收集其 10/20 坐标，SEQEND 结束。
 * 任务5：与 LWPOLYLINE 一致，炸开为 MultiLineString，永不闭合。
 */
async function parsePOLYLINE(lines, startIndex, sourceCoordSystem, unit, layer, colorIndex) {
  let i = startIndex;
  const vertices = [];
  let trueColor = null;
  let done = false;
  let collectingVertex = false;
  let vx = 0;
  let vy = 0;

  const flushVertex = () => {
    if (collectingVertex && (vx !== 0 || vy !== 0)) {
      vertices.push([vx, vy]);
    }
    collectingVertex = false;
    vx = 0;
    vy = 0;
  };

  while (i < lines.length && !done) {
    const { code, value, nextIndex } = readGroupCode(lines, i);
    i = nextIndex;

    if (code === 0) {
      // 遇到子实体边界：先收尾当前正在收集的顶点
      flushVertex();
      const entityType = value;
      if (entityType === 'VERTEX') {
        collectingVertex = true;
        continue;
      }
      if (entityType === 'SEQEND') {
        done = true;
        break;
      }
      // 遇到其他实体（如后续 POLYLINE）：回退交由外层处理
      i -= 2;
      done = true;
      break;
    }

    if (collectingVertex) {
      // VERTEX 实体的坐标（忽略 70 顶点标志、30 凸度、42 等）
      switch (code) {
        case 10: vx = parseFloat(value) || 0; break;
        case 20: vy = parseFloat(value) || 0; break;
        default: break;
      }
    } else {
      // POLYLINE 头部属性
      switch (code) {
        case 8: layer = value; break;
        case 70: break; // 忽略 group70 强制闭合标志（任务5：多段线永不闭合）
        case 62: colorIndex = parseInt(value, 10) || colorIndex; break;
        case 420: trueColor = parseInt(value, 10) || null; break;
        default: break;
      }
    }
  }

  if (vertices.length < 2) return { feature: null, nextIndex: i };

  const coords = [];
  for (const v of vertices) {
    const [lon, lat] = await convertToWGS84(v[0], v[1], sourceCoordSystem, unit);
    coords.push(fromLonLat([lon, lat]));
  }

  // 炸开：每相邻两点构成一条线段，整体用 MultiLineString 承载（永不闭合）
  const segments = [];
  for (let s = 0; s < coords.length - 1; s++) {
    segments.push([coords[s], coords[s + 1]]);
  }

  const feature = new Feature({
    geometry: new MultiLineString(segments),
    type: 'dxf_polyline',
    layer: layer,
    colorIndex: colorIndex,
    srcCoords: vertices.map(v => [v[0], v[1]]),
    isClosed: false
  });

  const lsty = getLayerStyle(layer);
  const polyStyle = lsty.polygon || DEFAULT_STYLE.polygon;
  const dxfColor = resolveDxfColor(layer, colorIndex, trueColor);
  const strokeColor = dxfColor || polyStyle.stroke.color;
  feature.setStyle(new Style({
    stroke: new Stroke({
      color: strokeColor,
      width: polyStyle.stroke.width,
      ...(polyStyle.stroke.dash ? { lineDash: polyStyle.stroke.dash } : {})
    })
  }));

  return { feature, nextIndex: i };
}

/**
 * 解析CIRCLE实体
 */
async function parseCIRCLE(lines, startIndex, sourceCoordSystem, unit, layer, colorIndex) {
  let i = startIndex;
  let cx = 0, cy = 0, radius = 0;
  let trueColor = null;
  
  while (i < lines.length) {
    const { code, value, nextIndex } = readGroupCode(lines, i);
    i = nextIndex;
    if (code === 0) break;
    
    switch (code) {
      case 8: layer = value; break;
      case 10: cx = parseFloat(value) || 0; break;
      case 20: cy = parseFloat(value) || 0; break;
      case 40: radius = parseFloat(value) || 0; break;
      case 62: colorIndex = parseInt(value) || colorIndex; break;
      case 420: trueColor = parseInt(value) || null; break;
    }
  }
  
  if (radius === 0) return { feature: null, nextIndex: i };
  
  const [lon, lat] = await convertToWGS84(cx, cy, sourceCoordSystem, unit);
  const points = 36;
  const polygonCoords = [];
  const approxRadiusDeg = radius / 111000;
  
  for (let j = 0; j <= points; j++) {
    const angle = (j / points) * 2 * Math.PI;
    polygonCoords.push(fromLonLat([
      lon + approxRadiusDeg * Math.cos(angle),
      lat + approxRadiusDeg * Math.sin(angle)
    ]));
  }
  
  const feature = new Feature({
    geometry: new Polygon([polygonCoords]),
    type: 'dxf_circle',
    layer: layer,
    colorIndex: colorIndex,
    srcCoords: [[cx, cy]]
  });
  
  const lsty = getLayerStyle(layer);
  const polyStyle = lsty.polygon || DEFAULT_STYLE.polygon;
  const dxfColor = resolveDxfColor(layer, colorIndex, trueColor);
  const strokeColor = dxfColor || polyStyle.stroke.color;
  const fillColor = polyStyle.fill ? hexToRgba(strokeColor, extractAlpha(polyStyle.fill)) : undefined;
  feature.setStyle(new Style({
    fill: fillColor ? new Fill({ color: fillColor }) : undefined,
    stroke: new Stroke({
      color: strokeColor,
      width: polyStyle.stroke.width,
      ...(polyStyle.stroke.dash ? { lineDash: polyStyle.stroke.dash } : {})
    })
  }));
  
  return { feature, nextIndex: i };
}

/**
 * 解析ARC实体
 */
async function parseARC(lines, startIndex, sourceCoordSystem, unit, layer, colorIndex) {
  let i = startIndex;
  let cx = 0, cy = 0, radius = 0, startAngle = 0, endAngle = 360;
  let trueColor = null;
  
  while (i < lines.length) {
    const { code, value, nextIndex } = readGroupCode(lines, i);
    i = nextIndex;
    if (code === 0) break;
    
    switch (code) {
      case 8: layer = value; break;
      case 10: cx = parseFloat(value) || 0; break;
      case 20: cy = parseFloat(value) || 0; break;
      case 40: radius = parseFloat(value) || 0; break;
      case 50: startAngle = parseFloat(value) || 0; break;
      case 51: endAngle = parseFloat(value) || 0; break;
      case 62: colorIndex = parseInt(value) || colorIndex; break;
      case 420: trueColor = parseInt(value) || null; break;
    }
  }
  
  if (radius === 0) return { feature: null, nextIndex: i };
  
  const [lon, lat] = await convertToWGS84(cx, cy, sourceCoordSystem, unit);
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;
  const lineCoords = [];
  const approxRadiusDeg = radius / 111000;
  
  for (let j = 0; j <= 36; j++) {
    const angle = startRad + (j / 36) * (endRad - startRad);
    lineCoords.push(fromLonLat([
      lon + approxRadiusDeg * Math.cos(angle),
      lat + approxRadiusDeg * Math.sin(angle)
    ]));
  }
  
  const feature = new Feature({
    geometry: new LineString(lineCoords),
    type: 'dxf_arc',
    layer: layer,
    colorIndex: colorIndex,
    srcCoords: [[cx, cy]]
  });

  const lsty = getLayerStyle(layer);
  const lineStyle = lsty.line || DEFAULT_STYLE.line;
  const dxfColor = resolveDxfColor(layer, colorIndex, trueColor);
  feature.setStyle(new Style({
    stroke: new Stroke({
      color: dxfColor || lineStyle.color,
      width: lineStyle.width,
      ...(lineStyle.dash ? { lineDash: lineStyle.dash } : {})
    })
  }));
  
  return { feature, nextIndex: i };
}

/**
 * 解析POINT实体
 */
async function parsePOINT(lines, startIndex, sourceCoordSystem, unit, layer, colorIndex, fromBlock = false) {
  let i = startIndex;
  let x = 0, y = 0;
  let zValue = 0, hasZ = false;   // 任务3(b)：group 30 高程值（仅显式存在时 hasZ=true）
  
  while (i < lines.length) {
    const { code, value, nextIndex } = readGroupCode(lines, i);
    i = nextIndex;
    if (code === 0) break;
    
    switch (code) {
      case 8: layer = value; break;
      case 10: x = parseFloat(value) || 0; break;
      case 20: y = parseFloat(value) || 0; break;
      case 30: zValue = parseFloat(value) || 0; hasZ = true; break;  // 高程（Z 值）
      case 62: colorIndex = parseInt(value) || colorIndex; break;
    }
  }
  
  const [lon, lat] = await convertToWGS84(x, y, sourceCoordSystem, unit);
  
  const feature = new Feature({
    geometry: new Point(fromLonLat([lon, lat])),
    type: 'dxf_point',
    layer: layer,
    colorIndex: colorIndex,
    srcCoords: [[x, y]]
  });
  
  const lsty = getLayerStyle(layer);
  if (lsty.point && lsty.point.visible === false) {
    const isGcd = layer === 'GCD' || layer.startsWith('GCD');
    if (fromBlock) {
      // 块展开得到的要素默认可见：高程点(GCD)用显眼橙红小点（固定屏幕像素），其余用中性灰点。
      feature.setStyle(new Style({
        image: new CircleStyle({
          radius: isGcd ? GCD_ELEVATION_DOT_RADIUS : 2,
          fill: new Fill({ color: isGcd ? GCD_ELEVATION_COLOR : '#888888' }),
          stroke: new Stroke({ color: 'white', width: 1 })
        })
      }));
    } else if (isGcd) {
      // 任务3：独立 GCD 高程点（非块展开，如直接导入的 GCD POINT）——渲染为固定屏幕大小的小圆点，
      // 恒定像素(3.5px)，绝不随地图缩放变大变小，与 GCD 高程注记(数字)配套显示。
      feature.setStyle(new Style({
        image: new CircleStyle({
          radius: GCD_ELEVATION_DOT_RADIUS,
          fill: new Fill({ color: GCD_ELEVATION_COLOR }),
          stroke: new Stroke({ color: 'white', width: 1 })
        })
      }));
    } else {
      feature.setStyle(null); // 其它隐藏点层（如 COMPONENT）保持隐藏
    }
  } else if (lsty.type === 'point' && lsty.point) {
    const p = lsty.point;
    feature.setStyle(new Style({
      image: new CircleStyle({
        radius: p.radius || 2,
        fill: p.fill ? new Fill({ color: p.fill }) : undefined,
        stroke: p.stroke ? new Stroke({ color: p.stroke, width: 1 }) : undefined
      })
    }));
  } else {
    feature.setStyle(new Style({
      image: new CircleStyle({ radius: 2, fill: new Fill({ color: '#888' }) })
    }));
  }

  // 任务3(b)：POINT 带显式 Z（高程值）且非块内点 -> 尽力而为生成高程注记 TEXT 要素。
  // 避免与块内点重复（块通常已通过 ATTDEF/ATTRIB 或块内 TEXT 表达高程，故 fromBlock 跳过）。
  const extraFeatures = [];
  if (!fromBlock && hasZ && isFinite(zValue)) {
    const zText = zValue.toFixed(2); // 四舍五入 2 位小数
    const zFeature = new Feature({
      geometry: new Point(fromLonLat([lon, lat])),
      name: zText,
      type: 'dxf_text',
      layer: layer,
      colorIndex: colorIndex,
      srcCoords: [[x, y]],
      fromZFallback: true
    });
    zFeature.setStyle(new Style({
      text: buildTextStyle({ text: zText, color: '#FF0000', fontSize: 14, haloColor: 'white', haloWidth: 2.5 })
    }));
    extraFeatures.push(zFeature);
  }

  return { feature, extraFeatures, nextIndex: i };
}

/**
 * 解析TEXT/MTEXT实体
 */
async function parseTEXT(lines, startIndex, sourceCoordSystem, unit, layer, colorIndex) {
  let i = startIndex;
  let x = 0, y = 0, text = '';
  let trueColor = null;

  while (i < lines.length) {
    const { code, value, nextIndex } = readGroupCode(lines, i);
    i = nextIndex;
    if (code === 0) break;

    switch (code) {
      case 8: layer = value; break;
      case 10: x = parseFloat(value) || 0; break;
      case 20: y = parseFloat(value) || 0; break;
      case 1: text = value; break;
      case 3: text += value; break;   // MTEXT 长文本续行
      case 62: colorIndex = parseInt(value) || colorIndex; break;
      case 420: trueColor = parseInt(value) || null; break;
    }
  }

  if (!text) return { feature: null, nextIndex: i };

  // 修复5：清理 MTEXT 格式码，保留可见文字
  const displayText = cleanMtext(text);

  const [lon, lat] = await convertToWGS84(x, y, sourceCoordSystem, unit);

  const feature = new Feature({
    geometry: new Point(fromLonLat([lon, lat])),
    name: displayText,
    type: 'dxf_text',
    layer: layer,
    colorIndex: colorIndex,
    srcCoords: [[x, y]]
  });

  // 图层感知：优先使用图层专属文字样式（如 GCDA 高程注记、文字注记层），否则回退到 DXF ACI 色号逻辑。
  // 任务2：统一通过 buildTextStyle 渲染——细体 + 白色光晕 + 固定屏幕像素，清晰可读。
  const lsty = getLayerStyle(layer);
  let textStyle;
  if (lsty.text) {
    textStyle = buildTextStyle({
      text: displayText,
      color: lsty.text.color || '#000000',
      fontSize: lsty.text.fontSize || 12,
      haloColor: lsty.text.strokeColor || 'white',
      haloWidth: lsty.text.strokeWidth || 2
    });
  } else {
    const dxfColor = resolveDxfColor(layer, colorIndex, trueColor);
    textStyle = buildTextStyle({
      text: displayText,
      color: dxfColor || getColorStyle(colorIndex),
      fontSize: 12,
      haloColor: 'white',
      haloWidth: 2
    });
  }

  feature.setStyle(new Style({ text: textStyle }));

  return { feature, nextIndex: i };
}

/**
 * 解析BLOCKS段
 */
function parseBlocks(lines, blocks) {
  let i = 0;
  let inBlocks = false;
  let inBlock = false;       // 是否处于某个 BLOCK...ENDBLK 内部
  let blockName = '';
  let base = [0, 0];         // 块基点 [bx, by]
  let ents = [];             // 当前块收集到的子图元（每个为原始 [code, value] 配数组）
  let atts = [];            // 当前块收集到的属性定义 ATTDEF：{ tag, value, x, y }
  let cur = null;            // 当前正在收集的子图元

  while (i < lines.length) {
    const line = lines[i].trim();

    if (line === 'BLOCKS') {
      inBlocks = true;
      i++;
      continue;
    }
    if (inBlocks && line === 'ENDSEC') break;

    // 实体类型边界：0 组后跟实体类型名
    if (inBlocks && line === '0' && i + 1 < lines.length) {
      const type = lines[i + 1].trim();

      if (type === 'BLOCK') {
        // 新的块头开始：初始化，准备收集基点与子图元
        inBlock = true;
        blockName = '';
        base = [0, 0];
        ents = [];
        atts = [];
        cur = null;
        i += 2;
        continue;
      }

      if (type === 'ENDBLK') {
        // 块定义结束：收尾最后一个子图元并存档
        if (cur) ents.push(cur);
        if (blockName) blocks[blockName] = { base: base, ents: ents, atts: atts };
        inBlock = false;
        blockName = '';
        ents = [];
        atts = [];
        cur = null;
        i += 2;
        continue;
      }

      // 修复2：收集块属性定义 ATTDEF（高程点 GCD 的块通常用 ATTDEF 承载高程数值）
      // DXF 组码：2=tag（属性标签），1=default（默认值，如 "12.5"），10/20=属性插入点
      if (type === 'ATTDEF') {
        const att = { tag: '', value: '', x: 0, y: 0 };
        let j = i + 2; // 跳过 '0' 与 'ATTDEF' 两行，指向首个属性组码
        while (j < lines.length) {
          const c = parseInt(lines[j].trim(), 10);
          const v = j + 1 < lines.length ? lines[j + 1].trim() : '';
          if (c === 0) break; // 遇到下一个实体（ENDBLK / 几何图元 / 其它 ATTDEF）即停止
          if (c === 2) att.tag = v;        // 属性标签
          else if (c === 1) att.value = v; // 默认值（高程数字等）
          else if (c === 10) att.x = parseFloat(v) || 0; // 属性插入点 x
          else if (c === 20) att.y = parseFloat(v) || 0; // 属性插入点 y
          j += 2;
        }
        if (att.tag) atts.push(att); // 仅在有 tag 时记录
        i = j; // j 已指向下一个实体的 '0' 行，接回主循环继续解析
        continue;
      }

      // 其它 0 组后为子图元类型 → 记为块内子图元
      if (inBlock) {
        if (cur) ents.push(cur);
        cur = [[0, type]];
        i += 2;
        continue;
      }
    }

    // 非实体类型边界行：属性组码
    if (inBlock && line !== '') {
      const code = parseInt(line, 10);
      const value = i + 1 < lines.length ? lines[i + 1].trim() : '';
      if (cur === null) {
        // 仍处于块头属性区：收集块名与基点
        if (code === 2) blockName = value;
        else if (code === 10) base[0] = parseFloat(value) || 0;
        else if (code === 20) base[1] = parseFloat(value) || 0;
      } else if (code !== 0) {
        // 子图元的属性：收集原始 [code, value] 配数组
        cur.push([code, value]);
      }
      i += 2;
      continue;
    }

    i++;
  }
}

/**
 * 健壮的块定义查找：处理块名带空格、星号（匿名块 *Uxx）、大小写差异。
 * 依次尝试：精确匹配 -> 去空格匹配 -> 大小写不敏感匹配 -> 去掉星号前缀后再匹配。
 * @param {Object} blocks - 已解析的块定义表 { blockName: { base:[bx,by], ents:[[code,value]...] } }
 * @param {string} name - INSERT 引用的块名
 * @returns {Object|null} 块定义对象，找不到时返回 null
 */
function findBlock(blocks, name) {
  if (!name || !blocks) return null;
  if (blocks[name]) return blocks[name];                       // 精确匹配（INSERT 名直接匹配）
  const trimmed = name.trim();
  if (blocks[trimmed]) return blocks[trimmed];                 // 去首尾空格匹配
  const lowerMap = {};
  for (const k of Object.keys(blocks)) lowerMap[k.toLowerCase()] = k;
  const lower = trimmed.toLowerCase();
  if (lowerMap[lower]) return blocks[lowerMap[lower]];         // 大小写不敏感匹配
  // 匿名块（*Uxx 等）：去掉星号前缀后再做一次大小写不敏感匹配
  const stripped = trimmed.replace(/^[*]+/, '');
  if (lowerMap[stripped.toLowerCase()]) return blocks[lowerMap[stripped.toLowerCase()]];
  // 任务3(a)：去掉尾随数字再匹配（如 "GCDPT1" / "GCDPT12" -> "GCDPT"），兼容 CAD 自动编号的块名
  const noTrailing = stripped.replace(/\d+$/, '');
  if (noTrailing && lowerMap[noTrailing.toLowerCase()]) return blocks[lowerMap[noTrailing.toLowerCase()]];
  return null;
}

/**
 * 尝试为 GCD 高程点 INSERT 生成高程注记 text 要素（本次 Bug 修复主路径）。
 *
 * 真实地形图结构（来自对 sample.dxf 的探查）：
 *  - GCD 图层有 567 个 INSERT，全部引用块名 gc200（圆点+十字丝+HATCH 填充的符号）。
 *  - 块定义(BLOCKS 段)通常没有 ATTDEF。
 *  - 每个 INSERT 实体在实体段携带 1 个 ATTRIB 实例：tag="height"，value=高程数值(如 "7.73")。
 *  - 实体段中独立的 POINT 多在 JMD 等图层，与 GCD 无关（POINT Z 兜底对真实地形图无效）。
 *
 * 因此高程数值必须直接从 INSERT 段跟随的 ATTRIB 实例读取，位置即该 INSERT 的插入点。
 *
 * 触发条件（满足其一即可，且必须存在 height ATTRIB）：
 *  - 块名为高程符号块：gc / gc200 等（正则 /^gc\d*$/i 不匹配 gcbj 等非高程图形块）；
 *  - 图层为高程图层：GCD / GCDA（前缀匹配）。
 *
 * 产出的要素：
 *  - type: 'dxf_text'（复用 getLayerStyle / applyFeatureStyle / featureLabel 管线）；
 *  - 橙红色、细体、恒定屏幕像素(scale:undefined)；
 *  - props 标记 isGcdElevation:true，便于后续样式区分；colorOverride 保证 applyFeatureStyle 重渲染仍保持橙红。
 *
 * @param {string} blockName - INSERT 引用的块名
 * @param {string} layer - INSERT 所在图层
 * @param {Object} attribs - INSERT 段收集到的 ATTRIB 实例 { tag: value }
 * @param {number} insX - 插入点原始 x（DXF 坐标）
 * @param {number} insY - 插入点原始 y
 * @param {number} colorIndex - 实体 ACI 色号
 * @param {string} sourceCoordSystem - 源坐标系
 * @param {string} unit - 坐标单位
 * @returns {Promise<Feature|null>} 命中时返回高程注记要素，否则返回 null
 */
async function tryBuildGcdElevation(blockName, layer, attribs, insX, insY, colorIndex, sourceCoordSystem, unit) {
  const isGcdBlock = /^gc\d*$/i.test(blockName || '');
  const isGcdLayer = /^(GCD|GCDA)/i.test(layer || '');
  if (!isGcdBlock && !isGcdLayer) return null;

  // 查找 tag 为 "height" 的 ATTRIB 实例（大小写不敏感），且值非空
  let heightVal = null;
  for (const tag of Object.keys(attribs || {})) {
    if (tag.toLowerCase() === 'height') {
      const v = attribs[tag];
      if (v != null && String(v).trim() !== '') heightVal = String(v).trim();
      break;
    }
  }
  if (heightVal == null) return null;

  // 插入点经坐标系转换（真实地形图中通常为高斯投影 -> WGS84）
  const [lon, lat] = await convertToWGS84(insX, insY, sourceCoordSystem, unit);
  if (!isFinite(lon) || !isFinite(lat)) return null;

  const feat = new Feature({
    geometry: new Point(fromLonLat([lon, lat])),
    name: heightVal,
    type: 'dxf_text',
    layer: layer,
    colorIndex: colorIndex,
    srcCoords: [[insX, insY]],
    fromBlock: true,
    fromAttrib: true,
    attTag: 'height',
    isGcdElevation: true,
    // colorOverride / fontSize 让 applyFeatureStyle 重渲染时仍然保持橙红、恒定字号
    colorOverride: GCD_ELEVATION_COLOR,
    fontSize: GCD_ELEVATION_FONT_SIZE
  });

  // 任务3：GCD 高程点渲染为「小尺寸固定屏幕大小的符号(恒定像素小圆点) + 橙红高程数字」。
  //  - 小圆点：CircleStyle 半径恒为像素(3.5px)，绝不随地图缩放变大变小（画布点符号固定像素）；
  //  - 数字：buildTextStyle 固定屏幕像素(scale:undefined) + 白色光晕，细体橙红、清晰；
  //    数字偏右(offsetX)以免压在小圆点上，更接近 CAD 高程点样式。
  const gcdImage = new CircleStyle({
    radius: GCD_ELEVATION_DOT_RADIUS,
    fill: new Fill({ color: GCD_ELEVATION_COLOR }),
    stroke: new Stroke({ color: 'white', width: 1 })
  });
  feat.setStyle(new Style({
    image: gcdImage,
    text: buildTextStyle({
      text: heightVal,
      color: GCD_ELEVATION_COLOR,
      fontSize: GCD_ELEVATION_FONT_SIZE,
      haloColor: 'white',
      haloWidth: 2.5,
      textAlign: 'left',
      offsetX: 6
    })
  }));

  return feat;
}

/**
 * 解析INSERT实体（图块引用）
 */
async function parseINSERT(lines, startIndex, sourceCoordSystem, unit, layer, colorIndex, blocks) {
  let i = startIndex;
  let blockName = '';
  let x = 0, y = 0;
  let rot = 0;             // 旋转角（弧度）
  let scaleX = 1, scaleY = 1;
  const attribs = {};      // INSERT 段内 ATTRIB 实例：{ tag: value }，用于覆盖块默认属性值

  while (i < lines.length) {
    const { code, value, nextIndex } = readGroupCode(lines, i);
    i = nextIndex;
    if (code === 0) {
      // INSERT 自身结束；其后是 ATTRIB 实例与 SEQEND，需一并消费，保持 nextIndex 契约
      const nextType = value;
      if (nextType === 'ATTRIB') {
        // 收集一个 ATTRIB 实例：tag(组码2) + 值(组码1)
        let k = i;
        let tag = '', val = '';
        while (k < lines.length) {
          const rc = parseInt(lines[k].trim(), 10);
          const rv = k + 1 < lines.length ? lines[k + 1].trim() : '';
          if (rc === 0) break; // 该 ATTRIB 结束（下一个实体开始）
          if (rc === 2) tag = rv;
          else if (rc === 1) val = rv;
          k += 2;
        }
        if (tag) attribs[tag] = val;
        i = k; // 推进到下一个实体的 '0' 行
        continue;
      }
      if (nextType === 'SEQEND') {
        // 属性序列结束，仅占 '0'+'SEQEND' 两行，已越过，继续读取下一个实体
        continue;
      }
      // 其它实体类型：INSERT 段结束，交回主循环（保持 nextIndex 语义）
      break;
    }

    switch (code) {
      case 2: blockName = value; break;
      case 8: layer = value; break; // 读取块参照所在图层，展开的子图元沿用该图层
      case 10: x = parseFloat(value) || 0; break;
      case 20: y = parseFloat(value) || 0; break;
      case 50: rot = ((parseFloat(value) || 0) * Math.PI) / 180; break; // DXF 旋转角为度
      case 41: scaleX = parseFloat(value) || 1; break;
      case 42: scaleY = parseFloat(value) || 1; break;
      case 62: colorIndex = parseInt(value) || colorIndex; break;
      case 420: break; // 块参照真彩色暂按实体色处理
    }
  }

  const block = findBlock(blocks, blockName);
  const features = [];

  // 本次 Bug 修复主路径：直接从 INSERT 段携带的 ATTRIB(tag="height") 读取高程数值，
  // 在插入点生成高程注记 text 要素（块定义无 ATTDEF 的真实地形图结构）。
  // 与后续“块几何展开”“块 ATTDEF 文字”两条次级路径互不冲突，可并存。
  const gcdElevationFeature = await tryBuildGcdElevation(
    blockName, layer, attribs, x, y, colorIndex, sourceCoordSystem, unit
  );
  if (gcdElevationFeature) features.push(gcdElevationFeature);

  // 任务3：若已从高程块(gc200 等)产出 GCD 高程注记，则抑制「随缩放变大的块几何」展开，
  // 改由 GCD 高程注记(固定像素小圆点 + 橙红数字)表达。此时直接返回，不再生成回退插入点。
  const suppressBlockGeom = !!gcdElevationFeature;
  if (suppressBlockGeom) {
    return { features, nextIndex: i };
  }

  // 修复1&3：块参照真正展开为真实几何（始终可见，不受 GCD point.visible:false 影响）
  if (block && block.ents && block.ents.length > 0) {
    const base = block.base || [0, 0];
    for (const ent of block.ents) {
      const type = (ent[0] && ent[0][0] === 0) ? ent[0][1] : '';
      // 跳过多余/嵌套图元，避免死循环与无效展开
      if (!type || type === 'INSERT' || type === 'ATTRIB' || type === 'ATTDEF' || type === 'DIMENSION') continue;

      // 将块内局部坐标变换到世界坐标（圆半径 group40 乘 sx）
      const pairs = ent.map(([c, v]) => [c, v]);
      for (let k = 0; k < pairs.length; k++) {
        const c = pairs[k][0];
        if (c === 40) {
          pairs[k][1] = String((parseFloat(pairs[k][1]) || 0) * scaleX);
        } else if (c === 20 || c === 21 || c === 22 || c === 23) {
          const xCode = c - 10; // 20->10, 21->11, ...
          for (let m = k - 1; m >= 0; m--) {
            if (pairs[m][0] === xCode) {
              const lx = parseFloat(pairs[m][1]) || 0;
              const ly = parseFloat(pairs[k][1]) || 0;
              const [wx, wy] = transformLocalToWorld(lx, ly, base, x, y, rot, scaleX, scaleY);
              pairs[m][1] = String(wx);
              pairs[k][1] = String(wy);
              break;
            }
          }
        }
      }

      // 重新拼成 lines 字符串数组（code 一行、value 一行）
      const subLines = [];
      for (const [c, v] of pairs) {
        subLines.push(String(c));
        subLines.push(String(v));
      }

      // 调用对应子图元解析函数（startIndex=2：跳过 '0' 与实体类型两行）
      let result = null;
      try {
        if (type === 'LINE') result = await parseLINE(subLines, 2, sourceCoordSystem, unit, layer, colorIndex);
        else if (type === 'LWPOLYLINE') result = await parseLWPOLYLINE(subLines, 2, sourceCoordSystem, unit, layer, colorIndex);
        else if (type === 'POLYLINE') result = await parsePOLYLINE(subLines, 2, sourceCoordSystem, unit, layer, colorIndex);
        else if (type === 'POINT') result = await parsePOINT(subLines, 2, sourceCoordSystem, unit, layer, colorIndex, true);
        else if (type === 'TEXT' || type === 'MTEXT') result = await parseTEXT(subLines, 2, sourceCoordSystem, unit, layer, colorIndex);
        else if (type === 'CIRCLE') result = await parseCIRCLE(subLines, 2, sourceCoordSystem, unit, layer, colorIndex);
        else if (type === 'ARC') result = await parseARC(subLines, 2, sourceCoordSystem, unit, layer, colorIndex);
        else if (type === 'SOLID') result = await parseSOLID(subLines, 2, sourceCoordSystem, unit, layer, colorIndex);
      } catch (e) {
        console.error('块子图元解析失败:', type, e);
      }

      if (result && result.feature) {
        result.feature.set('srcSystem', sourceCoordSystem);
        result.feature.set('fromBlock', true); // 标记为块展开要素，默认可见（不受点图层 visible:false 影响）
        features.push(result.feature);
      }
    }

    // 修复2：块属性文字提取（ATTDEF 定义 + ATTRIB 实例）→ 生成高程数字等注记 text 要素
    // 仅当块内含 ATTDEF 定义时展开；文字内容优先用 INSERT 段内 ATTRIB 实例值，回退 ATTDEF 的 default。
    if (block && block.atts && block.atts.length > 0) {
      for (const att of block.atts) {
        const tag = att.tag;
        // 实例值优先（INSERT 自带 ATTRIB），否则用块定义默认值兜底，保证数字仍然出现
        const val = (attribs[tag] != null && String(attribs[tag]) !== '') ? attribs[tag] : (att.value || '');
        if (!val) continue; // 无任何文字可标注则跳过
        // 属性插入点（块局部坐标）经与块几何相同的变换（插入点/旋转/缩放/基点）变换到世界坐标
        const [awx, awy] = transformLocalToWorld(att.x, att.y, base, x, y, rot, scaleX, scaleY);
        if (!isFinite(awx) || !isFinite(awy)) continue;
        // 复用 parseTEXT 同款文字样式逻辑（图层感知：getLayerStyle(layer).text；无则回退 DXF 颜色）
        const subLines = [
          '0', 'TEXT',
          '8', layer,
          '10', String(awx),
          '20', String(awy),
          '1', val
        ];
        try {
          const r = await parseTEXT(subLines, 2, sourceCoordSystem, unit, layer, colorIndex);
          if (r && r.feature) {
            r.feature.set('srcSystem', sourceCoordSystem);
            r.feature.set('fromBlock', true);
            r.feature.set('fromAttrib', true); // 标记为块属性文字（高程数值等）
            r.feature.set('attTag', tag);
            features.push(r.feature);
          }
        } catch (e) {
          console.error('块属性文字生成失败:', tag, e);
        }
      }
    }

    return { features, nextIndex: i };
  }

  // 兼容：块找不到 → 生成一个插入点 Point，保持原行为（含 GCD 隐藏逻辑）
  const [lon, lat] = await convertToWGS84(x, y, sourceCoordSystem, unit);
  const feature = new Feature({
    geometry: new Point(fromLonLat([lon, lat])),
    name: blockName || 'block',
    type: 'dxf_block',
    layer: layer,
    colorIndex: colorIndex,
    srcCoords: [[x, y]]
  });

  const lsty = getLayerStyle(layer);
  if (lsty.point && lsty.point.visible === false) {
    feature.setStyle(null);
  } else if (lsty.type === 'point' && lsty.point) {
    const p = lsty.point;
    feature.setStyle(new Style({
      image: new CircleStyle({
        radius: p.radius || 3,
        fill: p.fill ? new Fill({ color: p.fill }) : undefined,
        stroke: p.stroke ? new Stroke({ color: p.stroke, width: 1 }) : undefined
      })
    }));
  } else {
    feature.setStyle(new Style({
      image: new CircleStyle({ radius: 3, fill: new Fill({ color: '#888' }) })
    }));
  }

  // 保留前面已生成的高程注记（即使块找不到，只要 INSERT 带 height ATTRIB 仍应输出高程）
  return { features: [...features, feature], nextIndex: i };
}

/**
 * 解析SOLID实体
 */
async function parseSOLID(lines, startIndex, sourceCoordSystem, unit, layer, colorIndex) {
  let i = startIndex;
  let x1 = 0, y1 = 0, x2 = 0, y2 = 0, x3 = 0, y3 = 0, x4 = 0, y4 = 0;
  let trueColor = null;
  
  while (i < lines.length) {
    const { code, value, nextIndex } = readGroupCode(lines, i);
    i = nextIndex;
    if (code === 0) break;
    
    switch (code) {
      case 8: layer = value; break;
      case 10: x1 = parseFloat(value) || 0; break;
      case 20: y1 = parseFloat(value) || 0; break;
      case 11: x2 = parseFloat(value) || 0; break;
      case 21: y2 = parseFloat(value) || 0; break;
      case 12: x3 = parseFloat(value) || 0; break;
      case 22: y3 = parseFloat(value) || 0; break;
      case 13: x4 = parseFloat(value) || 0; break;
      case 23: y4 = parseFloat(value) || 0; break;
      case 62: colorIndex = parseInt(value) || colorIndex; break;
      case 420: trueColor = parseInt(value) || null; break;
    }
  }
  
  if (x4 === 0 && y4 === 0) { x4 = x3; y4 = y3; }
  
  const p1 = await convertToWGS84(x1, y1, sourceCoordSystem, unit);
  const p2 = await convertToWGS84(x2, y2, sourceCoordSystem, unit);
  const p3 = await convertToWGS84(x3, y3, sourceCoordSystem, unit);
  const p4 = await convertToWGS84(x4, y4, sourceCoordSystem, unit);
  
  const feature = new Feature({
    geometry: new Polygon([[fromLonLat(p1), fromLonLat(p2), fromLonLat(p3), fromLonLat(p4), fromLonLat(p1)]]),
    type: 'dxf_solid',
    layer: layer,
    colorIndex: colorIndex,
    srcCoords: [[x1, y1], [x2, y2], [x3, y3], [x4, y4]]
  });
  
  const lsty = getLayerStyle(layer);
  const polyStyle = lsty.polygon || DEFAULT_STYLE.polygon;
  const dxfColor = resolveDxfColor(layer, colorIndex, trueColor);
  const strokeColor = dxfColor || polyStyle.stroke.color;
  const fillColor = polyStyle.fill ? hexToRgba(strokeColor, extractAlpha(polyStyle.fill)) : undefined;
  feature.setStyle(new Style({
    fill: fillColor ? new Fill({ color: fillColor }) : undefined,
    stroke: new Stroke({
      color: strokeColor,
      width: polyStyle.stroke.width,
      ...(polyStyle.stroke.dash ? { lineDash: polyStyle.stroke.dash } : {})
    })
  }));
  
  return { feature, nextIndex: i };
}

/**
 * 任务4：根据要素当前属性（含编辑后的覆盖值）重建 OpenLayers 样式。
 * 复用现有 getLayerStyle / resolveDxfColor 逻辑，支持：
 *  - 文字类（dxf_text）：颜色(colorOverride / 图层文字色)、字号(fontSize)、内容(name)
 *  - 点类（dxf_point / dxf_block 回退点）：颜色、点半径(pointRadius)
 *  - 线/面类：颜色、线宽(lineWidth)
 * 注：几何本身不在此处改动（点坐标编辑在 App.js 中经 convertToWGS84 重投影后调用本函数刷新样式）。
 * @param {Object} feature - 已带 type/layer/colorIndex 等属性的 OL 要素
 */
export function applyFeatureStyle(feature) {
  if (!feature) return;
  const type = feature.get('type') || '';
  const layer = feature.get('layer') || '0';
  const colorIndex = feature.get('colorIndex');
  const overrideColor = feature.get('colorOverride') || null;     // 十六进制覆盖色（编辑产生，优先级最高）
  const trueColor = feature.get('trueColor') != null ? feature.get('trueColor') : null;
  const lsty = getLayerStyle(layer);

  // 解析最终颜色：覆盖色 > 真彩色 > 实体色/图层色
  const resolved = overrideColor || resolveDxfColor(layer, colorIndex, trueColor);

  // 文字类
  if (type === 'dxf_text') {
    const tColor = overrideColor || (lsty.text ? lsty.text.color : (resolved || '#000000'));
    const fontSize = feature.get('fontSize') || (lsty.text ? lsty.text.fontSize : 12);
    const t = feature.get('name') || '';
    const haloColor = lsty.text ? (lsty.text.strokeColor || 'white') : 'white';
    const haloWidth = lsty.text ? (lsty.text.strokeWidth || 2) : 2;
    const isGcdElev = feature.get('isGcdElevation');
    // GCD 高程注记：数字偏右(offsetX)以免压在小圆点上，保持细体橙红、固定屏幕像素
    const textStyle = buildTextStyle({
      text: t,
      color: tColor,
      fontSize,
      haloColor,
      haloWidth,
      textAlign: isGcdElev ? 'left' : 'center',
      offsetX: isGcdElev ? 6 : 0
    });
    const styleOpts = { text: textStyle };
    // 任务3：GCD 高程点附带固定屏幕像素小圆点（不随缩放变化），颜色跟随编辑后的覆盖色
    if (isGcdElev) {
      const dotColor = overrideColor || GCD_ELEVATION_COLOR;
      styleOpts.image = new CircleStyle({
        radius: GCD_ELEVATION_DOT_RADIUS,
        fill: new Fill({ color: dotColor }),
        stroke: new Stroke({ color: 'white', width: 1 })
      });
    }
    feature.setStyle(new Style(styleOpts));
    return;
  }

  // 点类（含块展开的点 / 找不到块时的回退插入点）
  if (type === 'dxf_point' || type === 'dxf_block') {
    // 与 parsePOINT 保持一致：GCD 类点用橙色小点、其余用灰点（仅当图层隐藏点时才走此兜底）
    const isGcd = layer === 'GCD' || layer.startsWith('GCD');
    const base = (lsty.point && lsty.point.visible !== false)
      ? lsty.point
      : { visible: true, radius: isGcd ? 3 : 2, fill: isGcd ? '#FF6600' : '#888888', stroke: 'white' };
    const radius = feature.get('pointRadius') || base.radius || (isGcd ? 3 : 2);
    const fillColor = overrideColor || base.fill || resolved || (isGcd ? '#FF6600' : '#888888');
    feature.setStyle(new Style({
      image: new CircleStyle({
        radius,
        fill: new Fill({ color: fillColor }),
        stroke: new Stroke({ color: base.stroke || 'white', width: 1 })
      })
    }));
    return;
  }

  // 面状（闭合多边形 / 圆 / SOLID）
  if (type === 'dxf_polygon' || type === 'dxf_circle' || type === 'dxf_solid') {
    const polyStyle = lsty.polygon || DEFAULT_STYLE.polygon;
    const strokeColor = overrideColor || resolved || (polyStyle.stroke ? polyStyle.stroke.color : '#888888');
    const width = feature.get('lineWidth') || (polyStyle.stroke ? polyStyle.stroke.width : 1);
    const fillColor = (polyStyle.fill && !overrideColor)
      ? hexToRgba(strokeColor, extractAlpha(polyStyle.fill))
      : undefined;
    feature.setStyle(new Style({
      fill: fillColor ? new Fill({ color: fillColor }) : undefined,
      stroke: new Stroke({
        color: strokeColor,
        width,
        ...(polyStyle.stroke && polyStyle.stroke.dash ? { lineDash: polyStyle.stroke.dash } : {})
      })
    }));
    return;
  }

  // 线状（含任务5炸开后的 MultiLineString 多段线）
  const lineStyle = lsty.line || DEFAULT_STYLE.line;
  const strokeColor = overrideColor || resolved || lineStyle.color;
  const width = feature.get('lineWidth') || lineStyle.width;
  feature.setStyle(new Style({
    stroke: new Stroke({
      color: strokeColor,
      width,
      ...(lineStyle.dash ? { lineDash: lineStyle.dash } : {})
    })
  }));
}

/**
 * 任务：生成要素的可读标签，用于图层展开后的元素列表。
 * 纯函数，仅依赖传入要素对象的 get(k) / getGeometry()（与地图渲染解耦，便于单元测试）。
 * 规则：
 *  - 文字(type 含 text)：优先用 f.get('name')（文字内容），截断到前 12 字；无内容时回退 '文字'
 *  - 点(type 含 point/block)：'点 #'+index，若带高程 name 则追加显示
 *  - 线/多段线：'线 #'+index
 *  - 面/填充：'面 #'+index
 *  - 圆/弧：'圆 #'+index
 *  - 兜底：type + ' #' + index
 * @param {Object} f - 要素对象（OL Feature 或测试 stub），需实现 get(key)；可选实现 getGeometry()
 * @param {number} index - 该要素在图层内的序号（从 1 起，调用方控制），用于拼接展示
 * @returns {string} 可读标签
 */
export function featureLabel(f, index) {
  const type = (f && typeof f.get === 'function' ? f.get('type') : (f && f.type)) || '';
  const getName = () => (f && typeof f.get === 'function' ? f.get('name') : (f && f.name)) || '';

  // 文字类：优先显示文字内容（取前 12 字）
  if (type.includes('text')) {
    const name = getName();
    const text = name ? String(name) : '文字';
    return text.length > 12 ? text.slice(0, 12) + '…' : text;
  }

  // 点类（含块展开的回退点）：默认 '点 #index'，有高程 name 时追加
  if (type.includes('point') || type.includes('block')) {
    const name = getName();
    return name ? `点 #${index} ${String(name).slice(0, 12)}` : `点 #${index}`;
  }

  // 线 / 多段线
  if (type.includes('polyline') || type.includes('line')) return `线 #${index}`;

  // 面 / 填充
  if (type.includes('polygon') || type.includes('solid')) return `面 #${index}`;

  // 圆 / 弧
  if (type.includes('circle') || type.includes('arc')) return `圆 #${index}`;

  // 兜底
  return `${type} #${index}`;
}
