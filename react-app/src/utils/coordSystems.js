/**
 * 坐标系配置
 * 支持三度带、三参数、七参数转换
 */
import proj4 from 'proj4';

// 三度带预设（中央子午线）
export const THREE_DEGREE_ZONES = [
  { zone: 24, lon: 75, name: '3度带-24带(75°)' },
  { zone: 25, lon: 78, name: '3度带-25带(78°)' },
  { zone: 26, lon: 81, name: '3度带-26带(81°)' },
  { zone: 27, lon: 84, name: '3度带-27带(84°)' },
  { zone: 28, lon: 87, name: '3度带-28带(87°)' },
  { zone: 29, lon: 90, name: '3度带-29带(90°)' },
  { zone: 30, lon: 93, name: '3度带-30带(93°)' },
  { zone: 31, lon: 96, name: '3度带-31带(96°)' },
  { zone: 32, lon: 99, name: '3度带-32带(99°)' },
  { zone: 33, lon: 102, name: '3度带-33带(102°)' },
  { zone: 34, lon: 105, name: '3度带-34带(105°)' },
  { zone: 35, lon: 108, name: '3度带-35带(108°)' },
  { zone: 36, lon: 111, name: '3度带-36带(111°)' },
  { zone: 37, lon: 114, name: '3度带-37带(114°)' },
  { zone: 38, lon: 117, name: '3度带-38带(117°)' },
  { zone: 39, lon: 120, name: '3度带-39带(120°)' },
  { zone: 40, lon: 123, name: '3度带-40带(123°)' },
  { zone: 41, lon: 126, name: '3度带-41带(126°)' },
  { zone: 42, lon: 129, name: '3度带-42带(129°)' },
  { zone: 43, lon: 132, name: '3度带-43带(132°)' },
  { zone: 44, lon: 135, name: '3度带-44带(135°)' }
];

// 坐标系定义
export const COORD_SYSTEMS = {
  // ========== 地理坐标系（经纬度） ==========
  wgs84: {
    id: 'wgs84',
    name: 'WGS84',
    nameCN: 'WGS84 (GPS)',
    type: 'geographic',
    epsg: 'EPSG:4326',
    proj4: '+proj=longlat +datum=WGS84 +no_defs',
    description: 'GPS原始坐标，国际标准',
    ellipsoid: 'WGS84'
  },
  gcj02: {
    id: 'gcj02',
    name: 'GCJ02',
    nameCN: 'GCJ02 (火星坐标)',
    type: 'geographic',
    epsg: 'EPSG:4490',
    proj4: '+proj=longlat +datum=CGCS2000 +no_defs',
    description: '国测局坐标，高德/腾讯地图使用',
    ellipsoid: 'CGCS2000',
    offset: true
  },
  bd09: {
    id: 'bd09',
    name: 'BD09',
    nameCN: 'BD09 (百度坐标)',
    type: 'geographic',
    epsg: 'EPSG:900913',
    proj4: '+proj=longlat +datum=WGS84 +no_defs',
    description: '百度坐标，在GCJ02基础上偏移',
    ellipsoid: 'WGS84',
    offset: true
  },
  cgcs2000: {
    id: 'cgcs2000',
    name: 'CGCS2000',
    nameCN: 'CGCS2000',
    type: 'geographic',
    epsg: 'EPSG:4490',
    proj4: '+proj=longlat +datum=CGCS2000 +no_defs',
    description: '2000国家大地坐标系',
    ellipsoid: 'CGCS2000'
  },
  xian80: {
    id: 'xian80',
    name: 'Xian80',
    nameCN: '西安80',
    type: 'geographic',
    epsg: 'EPSG:4608',
    proj4: '+proj=longlat +a=6378140 +b=6356755.288157528 +no_defs',
    description: '1980西安坐标系',
    ellipsoid: 'IAG75'
  },
  beijing54: {
    id: 'beijing54',
    name: 'Beijing54',
    nameCN: '北京54',
    type: 'geographic',
    epsg: 'EPSG:4214',
    proj4: '+proj=longlat +a=6378245 +b=6356863.018773047 +no_defs',
    description: '1954北京坐标系',
    ellipsoid: 'Krassowsky'
  },

  // ========== 投影坐标系（平面坐标） ==========
  utm_49n: {
    id: 'utm_49n',
    name: 'UTM Zone 49N',
    nameCN: 'UTM 49N (广东)',
    type: 'projected',
    epsg: 'EPSG:32649',
    proj4: '+proj=utm +zone=49 +datum=WGS84 +units=m +no_defs',
    description: 'UTM投影 49N带（覆盖广东）',
    datum: 'WGS84'
  },
  utm_50n: {
    id: 'utm_50n',
    name: 'UTM Zone 50N',
    nameCN: 'UTM 50N (华东)',
    type: 'projected',
    epsg: 'EPSG:32650',
    proj4: '+proj=utm +zone=50 +datum=WGS84 +units=m +no_defs',
    description: 'UTM投影 50N带（覆盖华东）',
    datum: 'WGS84'
  },

  // ========== 广州2000坐标系 ==========
  guangzhou2000: {
    id: 'guangzhou2000',
    name: 'Guangzhou 2000',
    nameCN: '广州2000坐标系',
    type: 'local',
    epsg: null,
    proj4: '+proj=tmerc +lat_0=0 +lon_0=113.28333333 +k=1 +x_0=39980 +y_0=-2329620 +ellps=GRS_1980 +units=m +no_defs',
    description: '广州2000坐标系（CGCS2000椭球，中央子午线113°17\'）',
    datum: 'CGCS2000',
    params: {
      centralMeridian: 113.28333333,
      falseEasting: 39980,
      falseNorthing: -2329620,
      scaleFactor: 1,
      ellipsoid: 'CGCS2000',
      semiMajorAxis: 6378137,
      inverseFlattening: 298.257222101
    }
  }
};

/**
 * 获取坐标系分类
 */
export function getCoordCategories() {
  return {
    geographic: {
      name: '地理坐标系（经纬度）',
      items: Object.values(COORD_SYSTEMS).filter(s => s.type === 'geographic')
    },
    projected: {
      name: '投影坐标系',
      items: Object.values(COORD_SYSTEMS).filter(s => s.type === 'projected')
    },
    local: {
      name: '广州坐标系',
      items: Object.values(COORD_SYSTEMS).filter(s => s.type === 'local')
    },
    custom: {
      name: '自定义坐标系（三参数/四参数/七参数）',
      items: getCustomCoordSystems()
    }
  };
}

/**
 * 获取所有坐标系列表
 */
export function getAllCoordSystems() {
  return [...Object.values(COORD_SYSTEMS), ...getCustomCoordSystems()];
}

/**
 * 根据ID获取坐标系
 */
export function getCoordSystem(id) {
  return COORD_SYSTEMS[id] || getCustomCoordSystems().find(s => s.id === id) || null;
}

/**
 * 获取自定义坐标系
 */
export function getCustomCoordSystems() {
  try {
    const saved = localStorage.getItem('custom_coord_systems');
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
}

/**
 * 保存自定义坐标系
 */
export function saveCustomCoordSystem(system) {
  const systems = getCustomCoordSystems();
  const index = systems.findIndex(s => s.id === system.id);
  if (index >= 0) {
    systems[index] = system;
  } else {
    systems.push(system);
  }
  localStorage.setItem('custom_coord_systems', JSON.stringify(systems));
  return system;
}

/**
 * 删除自定义坐标系
 */
export function deleteCustomCoordSystem(id) {
  const systems = getCustomCoordSystems().filter(s => s.id !== id);
  localStorage.setItem('custom_coord_systems', JSON.stringify(systems));
}

/**
 * 获取全局默认坐标系
 */
export function getDefaultCoordSystem() {
  const saved = localStorage.getItem('default_coord_system');
  return saved || 'wgs84';
}

/**
 * 设置全局默认坐标系
 */
export function setDefaultCoordSystem(id) {
  localStorage.setItem('default_coord_system', id);
}

/**
 * 本地工程坐标（假原点）参数
 * 当 detectDXFCoordSystem 识别出「任意正数米制坐标」时返回 'local_engineering'，
 * 由此处提供可配置的中央子午线与假东/北偏移；默认与广州2000一致，
 * 可由 setLocalEngineeringParams 覆盖为用户在设置中配置的假原点。
 */
export let localEngineeringParams = {
  centralMeridian: 113.28333333,
  falseEasting: 39980,
  falseNorthing: -2329620
};

export function setLocalEngineeringParams(p) {
  localEngineeringParams = Object.assign({}, localEngineeringParams, p || {});
}

/**
 * 四参数转换
 * 参数：dx, dy, scale, rotation
 * 公式：X' = dx + scale * (X * cos(rotation) - Y * sin(rotation))
 *       Y' = dy + scale * (X * sin(rotation) + Y * cos(rotation))
 */
export function transform4Param(x, y, params) {
  const { dx = 0, dy = 0, scale = 1, rotation = 0 } = params;
  const rad = rotation * Math.PI / 180;
  const cosR = Math.cos(rad);
  const sinR = Math.sin(rad);
  
  return [
    dx + scale * (x * cosR - y * sinR),
    dy + scale * (x * sinR + y * cosR)
  ];
}

/**
 * 七参数转换（布尔莎模型）
 * 参数：dx, dy, dz, rx, ry, rz, scale
 * 公式：X' = dx + (1+s)*X - rz*Y + ry*Z
 *       Y' = dy + rz*X + (1+s)*Y - rx*Z
 *       Z' = dz - ry*X + rx*Y + (1+s)*Z
 */
export function transform7Param(x, y, z, params) {
  const { dx = 0, dy = 0, dz = 0, rx = 0, ry = 0, rz = 0, scale = 0 } = params;
  const radRx = rx * Math.PI / 180;
  const radRy = ry * Math.PI / 180;
  const radRz = rz * Math.PI / 180;
  const s = scale * 1e-6; // ppm转为比例
  
  return [
    dx + (1 + s) * x - radRz * y + radRy * z,
    dy + radRz * x + (1 + s) * y - radRx * z,
    dz - radRy * x + radRx * y + (1 + s) * z
  ];
}

/**
 * 简化参数转换（平移+缩放）
 * 参数：dx, dy, scaleX, scaleY
 */
export function transformSimple(x, y, params) {
  const { dx = 0, dy = 0, scaleX = 1, scaleY = 1 } = params;
  return [
    dx + x * scaleX,
    dy + y * scaleY
  ];
}

/**
 * 固定参数转换（固定偏移量）
 * 参数：dx, dy
 */
export function transformFixed(x, y, params) {
  const { dx = 0, dy = 0 } = params;
  return [x + dx, y + dy];
}

/**
 * 坐标转换（使用proj4）
 */
export function convertCoordinate(x, y, fromSystemId, toSystemId) {

  // WGS84/GCJ02/BD09 之间的偏移算法
  if (['wgs84', 'gcj02', 'bd09'].includes(fromSystemId) &&
      ['wgs84', 'gcj02', 'bd09'].includes(toSystemId)) {
    return convertWGS84Offset(x, y, fromSystemId, toSystemId);
  }

  const fromSystem = getCoordSystem(fromSystemId);
  const toSystem = getCoordSystem(toSystemId);

  // 自定义坐标系 / 本地工程坐标：委托给 convertCustomSystem（支持横轴墨卡托与四/七参数）
  if (isCustomSystem(fromSystemId, fromSystem) || isCustomSystem(toSystemId, toSystem)) {
    return convertCustomSystem(x, y, fromSystemId, toSystemId);
  }

  // 其余（含三度带）走 proj4
  const fromDef = buildProj4Def(fromSystemId, fromSystem);
  const toDef = buildProj4Def(toSystemId, toSystem);

  if (!fromDef || !toDef) {
    console.error('无法获取坐标系定义:', fromSystemId, toSystemId);
    throw new Error('无法获取坐标系定义');
  }

  const fromName = 'from_' + fromSystemId;
  const toName = 'to_' + toSystemId;
  proj4.defs(fromName, fromDef);
  proj4.defs(toName, toDef);
  return proj4(fromName, toName, [x, y]);
}

/** 判断是否为需要走自定义转换流程的坐标系 */
function isCustomSystem(id, sys) {
  if (!id) return false;
  if (id === 'local_engineering') return true;
  if (sys && sys.custom) return true;
  return false;
}

/** 构造 proj4 定义（三度带 / 内置预设） */
function buildProj4Def(id, sys) {
  if (!id) return null;
  if (id.startsWith('cgcs2000_3_') || id.startsWith('wgs84_3_')) {
    const parts = id.split('_');
    const zone = parseInt(parts[2], 10);
    const lon = zone * 3;
    const ellps = parts[0] === 'wgs84' ? 'WGS84' : 'GRS_1980';
    return `+proj=tmerc +lat_0=0 +lon_0=${lon} +k=1 +x_0=500000 +y_0=0 +ellps=${ellps} +units=m +no_defs`;
  }
  if (sys && sys.proj4) return sys.proj4;
  return null;
}

/**
 * 自定义坐标系转换
 * 支持两类自定义坐标系：
 *  1) 本地横轴墨卡托（携带 centralMeridian / falseEasting / falseNorthing，或 explicit proj4 定义）
 *  2) 参数型（四/七/简化/固定），视为相对 WGS84 的偏移
 * 任意一侧为 WGS84 时直接单向换算；两侧均为自定义时经 WGS84 中转。
 */
export function convertCustomSystem(x, y, fromSystemId, toSystemId) {
  const fromSystem = getCoordSystem(fromSystemId);
  const toSystem = getCoordSystem(toSystemId);

  const toWgs84 = (sys, id, cx, cy) => {
    if (id === 'wgs84') return [cx, cy];
    if (!sys) return [cx, cy];
    const def = sys.proj4 || buildTmercDefFromSystem(sys);
    if (!def) return applyParamTransform(cx, cy, sys.params);
    const name = 'custom_' + id;
    proj4.defs(name, def);
    return proj4(name, 'EPSG:4326', [cx, cy]);
  };

  const fromWgs84 = (sys, id, lon, lat) => {
    if (id === 'wgs84') return [lon, lat];
    if (!sys) return [lon, lat];
    const def = sys.proj4 || buildTmercDefFromSystem(sys);
    if (!def) return applyInverseParamTransform(lon, lat, sys.params);
    const name = 'custom_' + id;
    proj4.defs(name, def);
    return proj4('EPSG:4326', name, [lon, lat]);
  };

  if (fromSystemId === 'wgs84') return fromWgs84(toSystem, toSystemId, x, y);
  if (toSystemId === 'wgs84') return toWgs84(fromSystem, fromSystemId, x, y);

  const [lon, lat] = toWgs84(fromSystem, fromSystemId, x, y);
  return fromWgs84(toSystem, toSystemId, lon, lat);
}

/** 从自定义坐标系对象构造本地横轴墨卡托 proj4 定义 */
function buildTmercDefFromSystem(sys) {
  if (!sys) return null;
  if (sys.id === 'local_engineering') {
    return buildTmercDef(
      localEngineeringParams.centralMeridian,
      localEngineeringParams.falseEasting,
      localEngineeringParams.falseNorthing
    );
  }
  if (sys.custom && sys.centralMeridian !== undefined &&
      (sys.falseEasting !== undefined || sys.falseNorthing !== undefined)) {
    return buildTmercDef(sys.centralMeridian, sys.falseEasting || 0, sys.falseNorthing || 0);
  }
  return null;
}

/** 构造本地横轴墨卡托 proj4 定义 */
function buildTmercDef(lon0, fe, fn) {
  return `+proj=tmerc +lat_0=0 +lon_0=${lon0} +k=1 +x_0=${fe} +y_0=${fn} +ellps=WGS84 +units=m +no_defs`;
}

/** 参数型正向（自定义 -> WGS84） */
function applyParamTransform(x, y, params) {
  if (!params) return [x, y];
  switch (params.type) {
    case '4param': return transform4Param(x, y, params);
    case '7param': return transform7Param(x, y, 0, params);
    case 'simple': return transformSimple(x, y, params);
    case 'fixed':
    default: return transformFixed(x, y, params);
  }
}

/** 参数型逆向（WGS84 -> 自定义） */
function applyInverseParamTransform(x, y, params) {
  if (!params) return [x, y];
  switch (params.type) {
    case '4param': return transform4Param(x, y, invert4Param(params));
    case '7param': return transform7Param(x, y, 0, invert7Param(params));
    case 'simple':
      return transformSimple(x, y, {
        dx: -params.dx,
        dy: -params.dy,
        scaleX: 1 / (params.scaleX || 1),
        scaleY: 1 / (params.scaleY || 1)
      });
    case 'fixed':
    default:
      return transformFixed(x, y, { dx: -params.dx, dy: -params.dy });
  }
}

/**
 * 四参数逆向
 */
function invert4Param(params) {
  const { dx = 0, dy = 0, scale = 1, rotation = 0 } = params;
  return {
    dx: -dx / scale,
    dy: -dy / scale,
    scale: 1 / scale,
    rotation: -rotation
  };
}

/**
 * 七参数逆向
 */
function invert7Param(params) {
  const { dx = 0, dy = 0, dz = 0, rx = 0, ry = 0, rz = 0, scale = 0 } = params;
  return {
    dx: -dx,
    dy: -dy,
    dz: -dz,
    rx: -rx,
    ry: -ry,
    rz: -rz,
    scale: -scale
  };
}

// GCJ02/BD09 偏移算法
const PI = Math.PI;
const X_PI = PI * 3000.0 / 180.0;
const A = 6378245.0;
const EE = 0.00669342162296594323;

function transformLat(x, y) {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0;
  ret += (150.0 * Math.sin(y / 12.0 * PI) + 300.0 * Math.sin(y / 30.0 * PI)) * 2.0 / 3.0;
  return ret;
}

function transformLon(x, y) {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0;
  ret += (160.0 * Math.sin(y / 12.0 * PI) + 320 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0;
  return ret;
}

function wgs84ToGcj02(lon, lat) {
  let dLat = transformLat(lon - 105.0, lat - 35.0);
  let dLon = transformLon(lon - 105.0, lat - 35.0);
  const radLat = lat / 180.0 * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI);
  dLon = (dLon * 180.0) / (A / sqrtMagic * Math.cos(radLat) * PI);
  return [lon + dLon, lat + dLat];
}

function gcj02ToWgs84(lon, lat) {
  let dLat = transformLat(lon - 105.0, lat - 35.0);
  let dLon = transformLon(lon - 105.0, lat - 35.0);
  const radLat = lat / 180.0 * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI);
  dLon = (dLon * 180.0) / (A / sqrtMagic * Math.cos(radLat) * PI);
  return [lon - dLon, lat - dLat];
}

function gcj02ToBd09(lon, lat) {
  const z = Math.sqrt(lon * lon + lat * lat) + 0.00002 * Math.sin(lat * X_PI);
  const theta = Math.atan2(lat, lon) + 0.000003 * Math.cos(lon * X_PI);
  return [z * Math.cos(theta) + 0.0065, z * Math.sin(theta) + 0.006];
}

function bd09ToGcj02(lon, lat) {
  const x = lon - 0.0065;
  const y = lat - 0.006;
  const z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * X_PI);
  const theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * X_PI);
  return [z * Math.cos(theta), z * Math.sin(theta)];
}

function wgs84ToBd09(lon, lat) {
  const gcj02 = wgs84ToGcj02(lon, lat);
  return gcj02ToBd09(gcj02[0], gcj02[1]);
}

function bd09ToWgs84(lon, lat) {
  const gcj02 = bd09ToGcj02(lon, lat);
  return gcj02ToWgs84(gcj02[0], gcj02[1]);
}

/**
 * 判断是否在中国境外。
 * GCJ-02（火星坐标系）偏移算法仅在中国境内有效，境外坐标应直接返回原值，避免错误偏移。
 */
export function outOfChina(lng, lat) {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

/**
 * WGS84 -> GCJ-02（火星坐标系）。
 * 中国境外坐标不偏移，直接返回原值；境内按国测局偏移算法计算。
 * @param {number} lng - WGS84 经度
 * @param {number} lat - WGS84 纬度
 * @returns {[number, number]} [gcj02Lng, gcj02Lat]
 */
export function wgs84togcj02(lng, lat) {
  if (outOfChina(lng, lat)) return [lng, lat];
  return wgs84ToGcj02(lng, lat);
}

/**
 * GCJ-02 -> WGS84。
 * 中国境外坐标不偏移，直接返回原值；境内按国测局偏移算法反算。
 * @param {number} lng - GCJ-02 经度
 * @param {number} lat - GCJ-02 纬度
 * @returns {[number, number]} [wgs84Lng, wgs84Lat]
 */
export function gcj02towgs84(lng, lat) {
  if (outOfChina(lng, lat)) return [lng, lat];
  return gcj02ToWgs84(lng, lat);
}

function convertWGS84Offset(lon, lat, fromId, toId) {
  let wgs84Lon, wgs84Lat;
  
  switch (fromId) {
    case 'wgs84':
      wgs84Lon = lon;
      wgs84Lat = lat;
      break;
    case 'gcj02':
      [wgs84Lon, wgs84Lat] = gcj02ToWgs84(lon, lat);
      break;
    case 'bd09':
      [wgs84Lon, wgs84Lat] = bd09ToWgs84(lon, lat);
      break;
    default:
      throw new Error('不支持的坐标系');
  }
  
  switch (toId) {
    case 'wgs84':
      return [wgs84Lon, wgs84Lat];
    case 'gcj02':
      return wgs84ToGcj02(wgs84Lon, wgs84Lat);
    case 'bd09':
      return wgs84ToBd09(wgs84Lon, wgs84Lat);
    default:
      throw new Error('不支持的坐标系');
  }
}