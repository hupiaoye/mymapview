// 任务5 实证验证：二维多段线应炸开为「相邻两点一组」的独立线段（MultiLineString），
// 无论首尾是否重合都不再形成闭合面（dxf_polygon / Polygon）。
// 覆盖两种情形：
//  (a) 首尾重合的 LWPOLYLINE（5 个顶点，末点==首点）-> 应炸成 4 段 MultiLineString，不闭合
//  (b) 不闭合的 LWPOLYLINE（3 个顶点）-> 应炸成 2 段 MultiLineString
// 运行：node __verify__/test_explode.mjs
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = resolve(here, 'fixture_explode.dxf');

const { parseDXF } = await import('./dxfParser.mjs');

console.log('========== 任务5 实证：多段线炸开为独立线段（test_explode）==========');
const text = readFileSync(fixture, 'utf8');
const { features } = await parseDXF(text, 'wgs84', 'm');

const polys = features.filter(f => f.get('type') === 'dxf_polyline');
const anyPolygon = features.some(f => f.get('type') === 'dxf_polygon');

// 检查每条多段线：均为 MultiLineString，且段数 == 顶点数-1，未闭合
let segCheck = true;
let coordCheck = true;
const details = [];
for (const f of polys) {
  const g = f.getGeometry();
  const typeName = g.getType();
  const segs = g.getCoordinates();
  const src = f.get('srcCoords') || [];
  const isClosed = f.get('isClosed');
  const okGeom = typeName === 'MultiLineString';
  const okSeg = segs.length === src.length - 1;
  if (!okGeom) coordCheck = false;
  if (!okSeg) segCheck = false;
  if (isClosed !== false) segCheck = false; // isClosed 必须恒为 false
  details.push({ type: f.get('type'), isClosed, geom: typeName, segCount: segs.length, vertexCount: src.length });
}

if (polys.length === 0) { segCheck = false; coordCheck = false; }
if (anyPolygon) coordCheck = false; // 绝不能出现 Polygon

details.forEach((d, i) => console.log(`  #${i} type=${d.type} isClosed=${d.isClosed} geom=${d.geom} 段数=${d.segCount} 顶点数=${d.vertexCount}`));
console.log('多段线要素数:', polys.length, '| 是否出现 Polygon(应为false):', anyPolygon);
console.log(`断言: 均为MultiLineString且段数=顶点-1且isClosed=false: ${segCheck}, 未形成Polygon: ${coordCheck}`);

const allPass = segCheck && coordCheck && polys.length === 2;
console.log('\n任务5 验证结论:', allPass ? 'EXPLODE_OK' : 'EXPLODE_FAIL');
process.exit(allPass ? 0 : 1);
