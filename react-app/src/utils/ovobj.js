// 奥维地图 .ovobj 对象格式 导入/导出
// ---------------------------------------------------------------
// .ovobj 有两种形态：
//   1) 二进制格式（奥维官方导出）：魔术头 "OviO"，内含大量以 '{' 起始、'}' 结束的
//      对象记录。每个对象记录内嵌：
//        - 二进制元数据（对象类型、样式、ID、内嵌图标等）
//        - 图层名（如 JMD_57，长度前缀 ASCII）
//        - UTF-8 中文文字注记（如 "碧桂园云麓半山小区""保安亭"）
//        - 几何坐标：IEEE754 小端 double 对，顺序为 (经度, 纬度)
//          坐标分散在每个对象记录内部（被二进制元数据隔开），并非全局连续序列。
//      此为**主要/常见格式**，可解出完整的点、线、面、文字。
//   2) JSON 文本格式（第三方生成或手动编辑）：
//      { version:"1.0", objs:[ {type, name, des, pos}, ... ] }
//
// 导出始终输出 JSON 文本（兼容性最好，奥维虽不直接导入 JSON 但可转换）。
//
// 坐标系说明：
//   奥维内部通常使用 WGS84（或 CGCS2000≈WGS84），导出 ovkml 可选 GCJ-02。
//   导入时由调用方统一做基准面校正。
//   .ovobj 坐标本身是经纬度（度），直接作为 WGS84 使用即可，无需额外配准。

import { Feature } from 'ol';
import { Point, LineString, Polygon } from 'ol/geom';
import { fromLonLat, toLonLat } from 'ol/proj';
import { gcj02ToWgs84 } from './coordConvert';

const ALT = 0;
const OVIOMAGIC = new Uint8Array([0x4F, 0x76, 0x69, 0x4F]); // "OviO"

// 中国陆地大致经纬度范围（仅用于判定 double 对里哪个是纬度、哪个是经度）
const OV_LAT_RANGE = [3, 54];
const OV_LON_RANGE = [73, 136];

function toWgs84(lon, lat, datum) {
  if (datum === 'gcj02') {
    const [x, y] = gcj02ToWgs84(lon, lat);
    return [x, y];
  }
  return [lon, lat];
}

function round6(v) { return Math.round(v * 1e6) / 1e6; }

/* ================================================================
   二进制 OviO 解析器
   ================================================================ */

/**
 * 从对象记录字节中提取连续 UTF-8 中文文字注记（如 "碧桂园云麓半山小区"）。
 * @param {Uint8Array} rec
 * @returns {string}
 */
function extractCJKText(rec) {
  const texts = [];
  let cur = '';
  for (let i = 0; i < rec.length - 2; i++) {
    const b0 = rec[i], b1 = rec[i + 1], b2 = rec[i + 2];
    // UTF-8 中文 3 字节: 1110xxxx 10xxxxxx 10xxxxxx
    if ((b0 & 0xf0) === 0xe0 && (b1 & 0xc0) === 0x80 && (b2 & 0xc0) === 0x80) {
      const cp = ((b0 & 0x0f) << 12) | ((b1 & 0x3f) << 6) | (b2 & 0x3f);
      if (cp >= 0x4e00 && cp <= 0x9fff) { cur += String.fromCharCode(cp); i += 2; continue; }
    }
    if (cur) { texts.push(cur); cur = ''; }
  }
  if (cur) texts.push(cur);
  return texts.join('');
}

/**
 * 从对象记录字节中提取图层码（如 JMD_57、DLSS_23156）。
 * @param {Uint8Array} rec
 * @returns {string}
 */
function extractLayerName(rec) {
  const prefixes = ['JMD', 'DLSS', 'GCD', 'SXSS', 'ZBTZ', 'DMTZ', 'GXYZ', 'GZDJ', 'DLDW', 'DGX', 'KZD', 'DOM', 'TK'];
  let best = '';
  for (let i = 0; i < rec.length; i++) {
    for (const p of prefixes) {
      if (i + p.length > rec.length) continue;
      let ok = true;
      for (let k = 0; k < p.length; k++) {
        if (rec[i + k] !== p.charCodeAt(k)) { ok = false; break; }
      }
      if (!ok) continue;
      let end = i + p.length;
      const limit = Math.min(rec.length, i + 40);
      while (end < limit &&
        ((rec[end] >= 0x30 && rec[end] <= 0x39) || rec[end] === 0x5F ||
         (rec[end] >= 0x41 && rec[end] <= 0x5a) || (rec[end] >= 0x61 && rec[end] <= 0x7a))) end++;
      if (end - i > best.length) best = String.fromCharCode.apply(null, rec.subarray(i, end));
    }
  }
  return best;
}

/**
 * 解析二进制 ovobj 格式（OviO 魔术头）
 *
 * 核心逻辑：
 *   1. 查找所有 '{' 位置，对每个 '{' 做括号匹配找到对应的 '}'，得到一个对象记录。
 *   2. 在每个对象记录内扫描 IEEE754 小端 double 合法坐标对（自动判定 经度/纬度 顺序）。
 *      坐标分散在记录内部（被二进制元数据隔开），因此按记录解包即可还原点/线/面几何。
 *   3. 自适应中心裁剪：计算全部顶点的中位数中心，丢弃距中心 > 2° 的离群点
 *      （排除被误判为坐标的二进制元数据 double）。
 *   4. 单顶点 → 标注点（marker）；多顶点闭合 → 面；多顶点非闭合 → 线。
 *   5. 同时提取图层码与中文文字注记作为要素属性。
 *
 * @param {Uint8Array|ArrayBuffer|Buffer} bin
 * @returns {{features:Feature[], markers:object[], layerCount:number, layerNames:string[]}}
 */
export function parseOVOBJBinary(bin) {
  const buf = bin instanceof Uint8Array ? bin : new Uint8Array(bin);

  // 验证魔术头
  if (buf.length < 4 || buf[0] !== OVIOMAGIC[0] || buf[1] !== OVIOMAGIC[1] ||
      buf[2] !== OVIOMAGIC[2] || buf[3] !== OVIOMAGIC[3]) {
    throw new Error('无效的 ovobj 文件：缺少 OviO 魔术头。请确保文件是奥维互动地图导出的 .ovobj 格式。');
  }

  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const total = buf.length;
  const LAT = OV_LAT_RANGE, LON = OV_LON_RANGE;

  // 查找所有对象记录起始 '{'
  const lbPos = [];
  for (let i = 0; i < total; i++) if (buf[i] === 0x7b) lbPos.push(i);

  // 括号匹配：从 start 找到对应的 '}'
  function findClose(start) {
    let depth = 0;
    for (let i = start; i < total; i++) {
      if (buf[i] === 0x7b) depth++;
      else if (buf[i] === 0x7d) { depth--; if (depth === 0) return i; }
    }
    return -1;
  }

  // 第一遍：收集每个对象记录的顶点与元数据
  const objs = [];
  for (const s of lbPos) {
    const e = findClose(s);
    if (e < 0 || e - s > 300000) continue; // 跳过异常大/未闭合记录
    const rec = buf.subarray(s, e + 1);
    const verts = [];
    for (let off = s; off + 16 <= e; off += 8) {
      const a = dv.getFloat64(off, true);
      const b = dv.getFloat64(off + 8, true);
      let lat, lon;
      // 顺序判定：落在纬度范围(3~54)的是纬度，落在经度范围(73~136)的是经度
      if (a >= LAT[0] && a <= LAT[1] && b >= LON[0] && b <= LON[1]) { lat = a; lon = b; }
      else if (b >= LAT[0] && b <= LAT[1] && a >= LON[0] && a <= LON[1]) { lat = b; lon = a; }
      else continue;
      verts.push([lon, lat]);
    }
    if (verts.length === 0) continue;
    objs.push({ verts, text: extractCJKText(rec), layer: extractLayerName(rec) });
  }

  // 自适应中心裁剪：排除被误判为坐标的离群二进制 double
  if (objs.length) {
    const all = [];
    objs.forEach(o => o.verts.forEach(v => all.push(v)));
    const lats = all.map(v => v[1]).sort((a, b) => a - b);
    const lons = all.map(v => v[0]).sort((a, b) => a - b);
    const lat0 = lats[Math.floor(lats.length / 2)];
    const lon0 = lons[Math.floor(lons.length / 2)];
    for (const o of objs) {
      o.verts = o.verts.filter(([lon, lat]) => Math.abs(lat - lat0) < 2 && Math.abs(lon - lon0) < 2);
    }
  }

  // 构造要素
  const features = [];
  const markers = [];
  const layerSet = new Set();
  let nPoint = 0, nLine = 0, nPoly = 0;

  for (const o of objs) {
    if (o.verts.length === 0) continue;
    if (o.layer) layerSet.add(o.layer);
    const baseName = o.text || o.layer || 'ovobj对象';

    if (o.verts.length === 1) {
      const [lon, lat] = o.verts[0];
      const m = {
        id: Date.now() + Math.floor(Math.random() * 1e6),
        name: baseName,
        coordinates: [lon, lat],
        color: '#e91e63',
        description: o.text || '',
        icon: 'pin-red'
      };
      markers.push(m);
      features.push(new Feature({ geometry: new Point(fromLonLat([lon, lat])), markerData: m }));
      nPoint++;
    } else {
      const coords = o.verts.map(v => fromLonLat(v));
      const closed = o.verts.length >= 4 &&
        o.verts[0][0] === o.verts[o.verts.length - 1][0] &&
        o.verts[0][1] === o.verts[o.verts.length - 1][1];
      let f;
      if (closed) { f = new Feature({ geometry: new Polygon([coords]) }); nPoly++; }
      else { f = new Feature({ geometry: new LineString(coords) }); nLine++; }
      f.set('layer', o.layer || 'ovobj');
      f.set('name', baseName);
      f.set('text', o.text || '');
      features.push(f);
    }
  }

  console.log(`[ovobj] 解析: 点=${nPoint} 线=${nLine} 面=${nPoly} 含文字=${objs.filter(o=>o.text).length} 图层=${layerSet.size}`);
  return { features, markers, layerCount: objs.length, layerNames: [...layerSet] };
}

/* ================================================================
   JSON OviO 解析器（兼容第三方 JSON ovobj）
   ================================================================ */

function normalizePos(pos) {
  if (Array.isArray(pos) && (pos.length === 2 || pos.length === 3)) {
    const lon = Number(pos[0]), lat = Number(pos[1]);
    if (Number.isNaN(lon) || Number.isNaN(lat)) return null;
    return [lon, lat, pos[2] != null ? Number(pos[2]) : ALT];
  }
  return null;
}

function normalizeCoords(pos) {
  if (!Array.isArray(pos) || pos.length === 0) return null;
  if (typeof pos[0] === 'number') { const p = normalizePos(pos); return p ? [p] : null; }
  const out = [];
  for (const p of pos) { const np = normalizePos(p); if (np) out.push(np); }
  return out.length ? out : null;
}

/**
 * 解析 JSON 格式 ovobj
 * @param {string} text
 */
export function parseOVOBJJSON(text) {
  const data = JSON.parse(text);
  const objs = Array.isArray(data) ? data : (data && Array.isArray(data.objs) ? data.objs : []);
  const features = [], markers = [];

  objs.forEach((o, idx) => {
    if (!o || typeof o !== 'object') return;
    const type = String(o.type || '').toLowerCase();
    const name = o.name != null ? String(o.name) : '';
    const des = o.des != null ? String(o.des)
      : (o.description != null ? String(o.description) : (o.remark != null ? String(o.remark) : ''));

    if (type === 'label' || type === 'point' || type === 'place') {
      const pos = normalizePos(o.pos);
      if (!pos) return;
      const m = { id: Date.now() + idx * 1000, name: name || `标注${idx+1}`, coordinates: [pos[0], pos[1]], color: '#e91e63', description: des, icon: 'pin-red' };
      markers.push(m);
      features.push(new Feature({ geometry: new Point(fromLonLat([pos[0], pos[1]])), markerData: m }));
      return;
    }
    if (type === 'trajectory' || type === 'line' || type === 'route') {
      const coords = normalizeCoords(o.pos);
      if (!coords || coords.length < 2) return;
      const f = new Feature({ geometry: new LineString(coords.map(c => fromLonLat([c[0], c[1]]))) });
      f.set('layer', name || 'ovobj'); f.set('name', name);
      features.push(f); return;
    }
    if (type === 'axis' || type === 'rect' || type === 'circle' || type === 'ellipse' || type === 'area') {
      const coords = normalizeCoords(o.pos);
      if (!coords || coords.length < 3) return;
      const ring = coords.map(c => fromLonLat([c[0], c[1]]));
      if (ring[0][0] !== ring[ring.length-1][0] || ring[0][1] !== ring[ring.length-1][1]) ring.push(ring[0]);
      const f = new Feature({ geometry: new Polygon([ring]) });
      f.set('layer', name || 'ovobj'); f.set('name', name);
      features.push(f); return;
    }
  });

  return { features, markers };
}

/* ================================================================
   统一入口（自动检测二进制 vs JSON）
   ================================================================ */

/**
 * 解析 ovobj 数据（自动检测格式）
 * @param {string|Uint8Array|ArrayBuffer} input
 * @returns {{features:Feature[], markers:object[], layerCount?:number}}
 */
export function parseOVOBJ(input) {
  // 检测是否为二进制格式（Uint8Array / ArrayBuffer / 以 OviO 开头的 string）
  let isBinary = false;
  if (input instanceof Uint8Array || input instanceof ArrayBuffer) {
    isBinary = true;
  } else if (typeof input === 'string') {
    // 检查前几个字符是否像 OviO 魔术头
    const trimmed = input.trim();
    if (trimmed.startsWith('OviO') || trimmed.charCodeAt(0) > 127) {
      isBinary = true;
      input = new TextEncoder().encode(trimmed);
    }
  }

  if (isBinary) {
    return parseOVOBJBinary(input);
  }
  return parseOVOBJJSON(input);
}

/* ================================================================
   导出（始终输出 JSON 文本）
   ================================================================ */

export function featuresToOVOBJ(features, basemapDatum = 'wgs84') {
  const objs = [];
  for (const f of features) {
    const geom = f.getGeometry(); if (!geom) continue;
    const md = f.get('markerData');
    const name = md ? (md.name || '') : (f.get('name') || '');
    const des = md ? (md.description || '') : (f.get('des') || '');
    const datum = f.get('datum') || basemapDatum;

    const pushLine = (coords) => objs.push({ type: 'trajectory', name, des, pos: coords.map(c => { const ll = toLonLat(c); const [lon, lat] = toWgs84(ll[0], ll[1], datum); return [round6(lon), round6(lat), ALT]; }) });
    const pushArea = (ring) => objs.push({ type: 'axis', name, des, pos: ring.map(c => { const ll = toLonLat(c); const [lon, lat] = toWgs84(ll[0], ll[1], datum); return [round6(lon), round6(lat), ALT]; }) });

    if (md) { const c = toLonLat(geom.getCoordinates()); const [lon, lat] = toWgs84(c[0], c[1], datum); objs.push({ type: 'label', name, des, pos: [round6(lon), round6(lat), ALT] }); continue; }
    const type = geom.getType();
    if (type === 'Point') { const c = toLonLat(geom.getCoordinates()); const [lon, lat] = toWgs84(c[0], c[1], datum); objs.push({ type: 'label', name, des, pos: [round6(lon), round6(lat), ALT] }); }
    else if (type === 'LineString') pushLine(geom.getCoordinates());
    else if (type === 'Polygon') pushArea(geom.getCoordinates()[0]);
    else if (type === 'MultiLineString') geom.getCoordinates().forEach(line => pushLine(line));
    else if (type === 'MultiPolygon') geom.getCoordinates().forEach(poly => pushArea(poly[0]));
  }
  return JSON.stringify({ version: '1.0', objs }, null, 2);
}
