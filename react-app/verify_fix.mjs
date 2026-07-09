/**
 * verify_fix.mjs — 广勘智图 (my-map-viewer) BugFix 验证脚本
 *
 * 目标：
 *  1) Bug 2: 老式 POLYLINE(VERTEX/SEQEND) 不再被丢弃 —— 用真实 parseDXF 解析合成 DXF + 真实桌面 DXF 窗口。
 *  2) Bug 1: 米/毫米单位透传 —— 用「米」解析黄山鲁工程坐标应落在 113.54~113.60 / 22.77~22.80；「毫米」应明显荒谬。
 *  3) Bug 4/5/6: 自定义本地横轴墨卡托坐标系能把工程坐标正确转到经纬度。
 *
 * 运行：node verify_fix.mjs   （在 react-app/ 目录下）
 */

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

// 注册 loader：把 'ol' 重定向到浏览器无关桩模块，使 dxfParser 可在 Node 下运行
register('./verify-loader.mjs', pathToFileURL('./'));

const DXF_PATH = 'C:/Users/Administrator/Desktop/黄山鲁0702总初步成果.dxf';
const WINDOW = 200000; // 仅取 ENTITIES 段前 20 万行做窗口解析（避免一次性载入 3800 万行）

const results = [];
function check(name, cond, detail = '') {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? 'PASS' : 'FAIL'} | ${name}${detail ? '  ::  ' + detail : ''}`);
}

const fmt = (n) => (typeof n === 'number' ? n.toFixed(6) : String(n));

// ===== 在 register 之后动态导入真实模块 =====
const { parseDXF } = await import('./src/utils/dxfParser.js');
const { COORD_SYSTEMS, convertCoordinate } = await import('./src/utils/coordSystems.js');

// 流式扫描真实 DXF：统计全量 POLYLINE / LWPOLYLINE，并截取 ENTITIES 段一段窗口
function streamDxf(filePath) {
  return new Promise((resolve, reject) => {
    const rl = createInterface({
      input: createReadStream(filePath, { highWaterMark: 1024 * 1024 }),
      crlfDelay: Infinity,
    });
    let lineNo = 0;
    let entitiesLine = -1;
    const collected = [];
    const full = { POLYLINE: 0, LWPOLYLINE: 0 };
    const win = { POLYLINE: 0, LWPOLYLINE: 0 };

    rl.on('line', (line) => {
      const t = line.trim();
      lineNo++;
      if (t === 'ENTITIES') entitiesLine = lineNo;
      const inWindow = entitiesLine >= 0 && lineNo - entitiesLine <= WINDOW;
      if (t === 'POLYLINE') { full.POLYLINE++; if (inWindow) win.POLYLINE++; }
      else if (t === 'LWPOLYLINE') { full.LWPOLYLINE++; if (inWindow) win.LWPOLYLINE++; }
      if (inWindow) collected.push(line);
    });
    rl.on('close', () => resolve({ full, win, collected }));
    rl.on('error', reject);
  });
}

console.log('\n=== [0] 扫描真实桌面 DXF（黄山鲁）===');
const { full, win, collected } = await streamDxf(DXF_PATH);
console.log(`全量实体统计: POLYLINE=${full.POLYLINE}, LWPOLYLINE=${full.LWPOLYLINE}`);
console.log(`窗口(${WINDOW}行)统计: POLYLINE=${win.POLYLINE}, LWPOLYLINE=${win.LWPOLYLINE}`);

check('真实 DXF 存在老式 POLYLINE（Bug 2 前提）', full.POLYLINE > 0,
  `POLYLINE=${full.POLYLINE}`);
check('真实 DXF 存在 LWPOLYLINE（对照）', full.LWPOLYLINE > 0,
  `LWPOLYLINE=${full.LWPOLYLINE}`);

// 用真实 parseDXF 解析 ENTITIES 窗口（guangzhou2000 + 米）
const windowText = collected.join('\n') + '\nENDSEC\n0\nEOF';
console.log('\n=== [1] 用真实 parseDXF 解析 ENTITIES 窗口（guangzhou2000, 米）===');
const winResult = await parseDXF(windowText, 'guangzhou2000', 'm');
const winFeatures = winResult.features || [];
console.log(`窗口解析要素数: ${winFeatures.length}（窗口 POLYLINE+LWPOLYLINE=${win.POLYLINE + win.LWPOLYLINE}）`);

// 窗口解析应覆盖 POLYLINE（之前会被整体丢弃）。精确统计折线/多边形类要素（来自 LWPOLYLINE 与 POLYLINE）。
// 注：真实地形图中存在大量退化（<2 顶点）的 LWPOLYLINE/POLYLINE 会被跳过，故此处仅做存在性/合理性校验，
// POLYLINE 状态机的正确性由下方合成 DXF 测试 [2] 严格证明。
const polyFeatures = winFeatures.filter((f) => ['dxf_polyline', 'dxf_polygon'].includes(f.get('type'))).length;
console.log(`窗口折线/多边形类要素: ${polyFeatures}（窗口 LWPOLYLINE=${win.LWPOLYLINE}, POLYLINE=${win.POLYLINE}）`);
check('窗口解析出折线/多边形类要素（POLYLINE 已在解析路径内）',
  polyFeatures > 0, `polyFeatures=${polyFeatures}`);

// 要素坐标应落在黄山鲁范围
let inRange = 0;
for (const f of winFeatures) {
  const g = f.getGeometry();
  if (!g) continue;
  const cs = g.getCoordinates();
  let first;
  if (g.getType() === 'Point') first = cs;
  else if (g.getType() === 'Polygon') first = cs[0][0];
  else first = cs[0]; // LineString 等
  if (Array.isArray(first) && first.length >= 2) {
    const [lon, lat] = first;
    if (lon >= 113.0 && lon <= 114.5 && lat >= 21.5 && lat <= 23.5) inRange++;
  }
}
check('窗口要素坐标落在黄山鲁合理范围', inRange > 0,
  `在范围内要素=${inRange}/${winFeatures.length}`);

// ===== 合成 DXF：状态机 + 单位 =====
function synthPolyline() {
  // 老式 POLYLINE + 3 个 VERTEX(含顶点标志 70 与凸度 30) + SEQEND
  return [
    '0', 'SECTION', '2', 'ENTITIES',
    '0', 'POLYLINE', '8', '0', '66', '1', '70', '0',
    '0', 'VERTEX', '8', '0', '70', '32', '10', '100.0', '20', '200.0', '30', '0.0',
    '0', 'VERTEX', '8', '0', '70', '32', '10', '300.0', '20', '400.0', '30', '0.0',
    '0', 'VERTEX', '8', '0', '70', '32', '10', '500.0', '20', '600.0', '30', '0.0',
    '0', 'SEQEND',
    '0', 'ENDSEC', '0', 'EOF',
  ].join('\n');
}

function synthLW(coordsPairs) {
  const lines = ['0', 'SECTION', '2', 'ENTITIES', '0', 'LWPOLYLINE', '8', '0', '90', String(coordsPairs.length), '70', '0'];
  for (const [x, y] of coordsPairs) {
    lines.push('10', String(x), '20', String(y));
  }
  lines.push('0', 'ENDSEC', '0', 'EOF');
  return lines.join('\n');
}

console.log('\n=== [2] 合成 POLYLINE 状态机（Bug 2）===');
const polyRes = await parseDXF(synthPolyline(), 'wgs84', 'm');
check('老式 POLYLINE 被解析为 1 个要素', polyRes.features.length === 1,
  `features=${polyRes.features.length}`);
const polyGeom = polyRes.features[0]?.getGeometry();
const polyPts = polyGeom?.getCoordinates() || [];
check('POLYLINE 收集到 3 个 VERTEX 坐标', polyPts.length === 3,
  `vertices=${polyPts.length}, 首点=${JSON.stringify(polyPts[0])}`);

console.log('\n=== [3] 单位透传：米 vs 毫米（Bug 1）===');
const lwM = synthLW([[67000.0, 190000.0], [68000.0, 191000.0]]);
const lwMM = synthLW([[67000.0, 190000.0], [68000.0, 191000.0]]);

const mRes = await parseDXF(lwM, 'guangzhou2000', 'm');
const mmRes = await parseDXF(lwMM, 'guangzhou2000', 'mm');

const mGeom = mRes.features[0]?.getGeometry();
const mmGeom = mmRes.features[0]?.getGeometry();
const mPt = (mGeom?.getCoordinates()?.[0]) || [];
const mmPt = (mmGeom?.getCoordinates()?.[0]) || [];
console.log(`米:   首点=(${fmt(mPt[0])}, ${fmt(mPt[1])})`);
console.log(`毫米: 首点=(${fmt(mmPt[0])}, ${fmt(mmPt[1])})`);

const mInRange = mPt[0] >= 113.54 && mPt[0] <= 113.60 && mPt[1] >= 22.77 && mPt[1] <= 22.80;
const mmAbsurd = !(mmPt[0] >= 113.0 && mmPt[0] <= 114.5 && mmPt[1] >= 21.5 && mmPt[1] <= 23.5);

check('「米」单位：黄山鲁范围 (113.54~113.60, 22.77~22.80)', mInRange,
  `(${fmt(mPt[0])}, ${fmt(mPt[1])})`);
check('「毫米」单位：坐标明显荒谬（远离黄山鲁）', mmAbsurd,
  `(${fmt(mmPt[0])}, ${fmt(mmPt[1])})`);

console.log('\n=== [4] 自定义本地横轴墨卡托坐标系（Bug 4/5/6）===');
// 注入一个横轴墨卡托自定义坐标系：lon0=113.5, 假东=500000, 假北=0
COORD_SYSTEMS.test_local = {
  id: 'test_local',
  name: 'Test Local TMerc',
  custom: true,
  centralMeridian: 113.5,
  falseEasting: 500000,
  falseNorthing: 0,
};
// 工程坐标 (505135, 2519000) 应落在 ~ (113.55, 22.78)
const customRes = await convertCoordinate(505135, 2519000, 'test_local', 'wgs84');
console.log(`自定义TMerc(505135,2519000) -> 经纬度 = (${fmt(customRes[0])}, ${fmt(customRes[1])})`);
check('自定义横墨卡托：工程坐标正确转为经纬度',
  customRes[0] >= 113.50 && customRes[0] <= 113.60 && customRes[1] >= 22.75 && customRes[1] <= 22.82,
  `(${fmt(customRes[0])}, ${fmt(customRes[1])})`);

// 参数型自定义系统（四/七/简化/固定）也应走通
COORD_SYSTEMS.test_fixed = {
  id: 'test_fixed', name: 'Test Fixed', custom: true, type: 'fixed', params: { dx: 10, dy: 20 },
};
const fwd = await convertCoordinate(100, 200, 'test_fixed', 'wgs84');
const rev = await convertCoordinate(fwd[0], fwd[1], 'wgs84', 'test_fixed');
console.log(`参数型 fixed: (100,200) -> wgs84 (${fmt(fwd[0])}, ${fmt(fwd[1])}) -> 还原 (${fmt(rev[0])}, ${fmt(rev[1])})`);
check('参数型自定义系统正向/逆向转换正确', Math.abs(fwd[0] - 110) < 1e-6 && Math.abs(fwd[1] - 220) < 1e-6
  && Math.abs(rev[0] - 100) < 1e-6 && Math.abs(rev[1] - 200) < 1e-6,
  `fwd=(${fmt(fwd[0])},${fmt(fwd[1])}), rev=(${fmt(rev[0])},${fmt(rev[1])})`);

// ===== 汇总 =====
console.log('\n=== 汇总 ===');
const failed = results.filter((r) => !r.pass);
if (failed.length === 0) {
  console.log(`IS_PASS: YES（全部 ${results.length} 项通过）`);
} else {
  console.log(`IS_PASS: NO（${failed.length} 项失败）`);
  for (const f of failed) console.log(`  - ${f.name} :: ${f.detail}`);
}
process.exit(failed.length === 0 ? 0 : 1);
