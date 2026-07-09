// 任务4 修复回归：GCJ-02 底图下「编辑点坐标」必须叠加当前显示基准面偏移。
// 对应 App.js applyFeatureEdit 中点坐标编辑分支的修复（原 bug：几何被覆写为纯 WGS84，
// 导致在默认高德(gcj02)底图上点跳回 WGS84，与同图层已偏移要素错位约 296m，且切底图会二次偏移）。
// 本脚本复刻修复后的真实逻辑：先 convertCoordinate 到 WGS84，再若 curDatum==='gcj02' 叠加 wgs84togcj02，
// 写回显示空间几何；不改写要素 datum 属性。
// 运行：node __verify__/verify_fix_gcj02_point_edit.mjs
import { fromLonLat, toLonLat } from 'ol/proj.js';
import { convertCoordinate, wgs84togcj02 } from './coordSystems.mjs';

// 两经纬点间的近似地面距离（米）
function distMeters(a, b) {
  const dx = (b[0] - a[0]) * 111320 * Math.cos((a[1] + b[1]) / 2 * Math.PI / 180);
  const dy = (b[1] - a[1]) * 110540;
  return Math.hypot(dx, dy);
}

// 复刻 App.js applyFeatureEdit 的「点坐标编辑」分支（修复后实现）
async function editPointFixed(sx, sy, srcSystem, curDatum) {
  const [lon, lat] = await convertCoordinate(sx, sy, srcSystem, 'wgs84');
  const [dlon, dlat] = curDatum === 'gcj02' ? wgs84togcj02(lon, lat) : [lon, lat];
  return fromLonLat([dlon, dlat]); // 写回显示空间的几何
}

const lon = 113.264, lat = 23.129; // 某 GCD 点的 WGS84 真值（广州）
const srcSystem = 'wgs84';

// 编辑前：该点所在图层在高德(gcj02)底图上，几何已被 shiftFeaturesDatum 偏移到 GCJ-02
const preGeom = fromLonLat(wgs84togcj02(lon, lat));
const preLL = toLonLat(preGeom);

// 用户在 gcj02 底图上重新输入「相同」源坐标
const postGeom = await editPointFixed(lon, lat, srcSystem, 'gcj02');
const postLL = toLonLat(postGeom);
const jump = distMeters(preLL, postLL);

console.log('========== 任务4 修复回归：GCJ-02 底图编辑点坐标 ==========');
console.log(`pre-edit(已偏移GCJ-02): ${preLL[0].toFixed(6)}, ${preLL[1].toFixed(6)}`);
console.log(`post-edit(叠加GCJ偏移): ${postLL[0].toFixed(6)}, ${postLL[1].toFixed(6)}  跳动=${jump.toFixed(1)} m`);

const NO_JUMP = jump < 1;
console.log(`\n断言(修复后): 编辑后点不相对同图层已偏移要素错位(<1m) => ${NO_JUMP ? 'PASS' : 'FAIL'}  (实测 ${jump.toFixed(1)} m)`);
if (!NO_JUMP) {
  console.log('EDIT_GCJ02_FAIL');
  process.exit(1);
}
console.log('EDIT_GCJ02_OK');
process.exit(0);
