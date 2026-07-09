// 坐标系定义
import proj4 from 'proj4';

export const WGS84 = 'EPSG:4326';
export const GCJ02 = 'EPSG:4490';
export const BD09 = 'EPSG:900913';
export const WEB_MERCATOR = 'EPSG:3857';

// PI
const PI = Math.PI;
const X_PI = PI * 3000.0 / 180.0;

/**
 * WGS84 转 GCJ02
 */
export function wgs84ToGcj02(lon, lat) {
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

/**
 * GCJ02 转 WGS84
 */
export function gcj02ToWgs84(lon, lat) {
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

/**
 * GCJ02 转 BD09
 */
export function gcj02ToBd09(lon, lat) {
  const z = Math.sqrt(lon * lon + lat * lat) + 0.00002 * Math.sin(lat * X_PI);
  const theta = Math.atan2(lat, lon) + 0.000003 * Math.cos(lon * X_PI);
  return [z * Math.cos(theta) + 0.0065, z * Math.sin(theta) + 0.006];
}

/**
 * BD09 转 GCJ02
 */
export function bd09ToGcj02(lon, lat) {
  const x = lon - 0.0065;
  const y = lat - 0.006;
  const z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * X_PI);
  const theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * X_PI);
  return [z * Math.cos(theta), z * Math.sin(theta)];
}

/**
 * WGS84 转 BD09
 */
export function wgs84ToBd09(lon, lat) {
  const gcj02 = wgs84ToGcj02(lon, lat);
  return gcj02ToBd09(gcj02[0], gcj02[1]);
}

/**
 * BD09 转 WGS84
 */
export function bd09ToWgs84(lon, lat) {
  const gcj02 = bd09ToGcj02(lon, lat);
  return gcj02ToWgs84(gcj02[0], gcj02[1]);
}

/**
 * 通用坐标转换
 * @param {number} lon - 经度
 * @param {number} lat - 纬度
 * @param {string} from - 源坐标系 ('wgs84', 'gcj02', 'bd09')
 * @param {string} to - 目标坐标系 ('wgs84', 'gcj02', 'bd09')
 */
export function convertCoord(lon, lat, from, to) {
  if (from === to) return [lon, lat];

  // 先统一转换到WGS84
  let wgs84Lon, wgs84Lat;
  switch (from) {
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
      throw new Error(`不支持的源坐标系: ${from}`);
  }

  // 从WGS84转换到目标坐标系
  switch (to) {
    case 'wgs84':
      return [wgs84Lon, wgs84Lat];
    case 'gcj02':
      return wgs84ToGcj02(wgs84Lon, wgs84Lat);
    case 'bd09':
      return wgs84ToBd09(wgs84Lon, wgs84Lat);
    default:
      throw new Error(`不支持的目标坐标系: ${to}`);
  }
}

// WGS84 椭球参数
const A = 6378245.0; // 长半轴
const EE = 0.00669342162296594323; // 偏心率平方

/**
 * 经度偏移
 */
function transformLon(x, y) {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0;
  ret += (160.0 * Math.sin(y / 12.0 * PI) + 320 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0;
  return ret;
}

/**
 * 纬度偏移
 */
function transformLat(x, y) {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0;
  ret += (150.0 * Math.sin(y / 12.0 * PI) + 300.0 * Math.sin(y / 30.0 * PI)) * 2.0 / 3.0;
  return ret;
}

/**
 * 自定义坐标系转换（基于proj4）
 * 支持常见的投影坐标系
 */
export const CUSTOM_COORD_SYSTEMS = {
  'CGCS2000': {
    name: 'CGCS2000',
    epsg: 'EPSG:4490',
    proj4: '+proj=longlat +datum=CGCS2000 +no_defs'
  },
  'XIAN80': {
    name: '西安80',
    epsg: 'EPSG:4608',
    proj4: '+proj=longlat +a=6378140 +b=6356755.288157528 +no_defs'
  },
  'BEIJING54': {
    name: '北京54',
    epsg: 'EPSG:4214',
    proj4: '+proj=longlat +a=6378245 +b=6356863.018773047 +no_defs'
  },
  'UTM_Zone_50N': {
    name: 'UTM 50N',
    epsg: 'EPSG:32650',
    proj4: '+proj=utm +zone=50 +datum=WGS84 +units=m +no_defs'
  }
};

/**
 * 自定义坐标系转换
 */
export function convertCustomCoord(lon, lat, fromSystem, toSystem) {
  const defOf = (sys) => {
    if (!sys) return null;
    if (sys.proj4) return sys.proj4;
    if (sys.centralMeridian !== undefined) {
      return `+proj=tmerc +lat_0=0 +lon_0=${sys.centralMeridian} +k=1 +x_0=${sys.falseEasting || 0} +y_0=${sys.falseNorthing || 0} +ellps=WGS84 +units=m +no_defs`;
    }
    return null;
  };
  const fromDef = defOf(fromSystem);
  const toDef = defOf(toSystem);
  if (!fromDef || !toDef) {
    console.warn('convertCustomCoord: 缺少坐标系定义，原样返回', fromSystem, toSystem);
    return [lon, lat];
  }
  const fn = `cc_${fromSystem && fromSystem.id ? fromSystem.id : 'from'}`;
  const tn = `cc_${toSystem && toSystem.id ? toSystem.id : 'to'}`;
  proj4.defs(fn, fromDef);
  proj4.defs(tn, toDef);
  return proj4(fn, tn, [lon, lat]);
}