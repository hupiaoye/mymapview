// 任务4 实证复现：GCJ-02 底图下「编辑点坐标」会偏回 WGS84（与 team-lead 指出的 App.js 252 行 bug 对应）。
// 复现的是 App.js applyFeatureEdit 中点坐标编辑分支（isPoint 块）的真实逻辑：
//   当前代码：const [lon, lat] = await convertCoordinate(sx, sy, srcSystem, 'wgs84');
//             geom.setCoordinates(fromLonLat([lon, lat]));   // 未叠加当前底图 GCJ-02 偏移
//   fix：      if (curDatum === 'gcj02') [lon, lat] = wgs84togcj02(lon, lat);
//             geom.setCoordinates(fromLonLat([lon, lat]));
// 这里用 App 真实的 wgs84togcj02 偏移函数，模拟「用户在 GCJ-02 底图上重新输入同一个点的源坐标」：
//   编辑前：要素几何已被 shiftFeaturesDatum 偏移到 GCJ-02 空间；
//   编辑后（当前代码）：几何被覆写为纯 WGS84 —— 点会从 GCJ-02 位置跳回 WGS84 位置（错位约数百米）。
// 运行：node __verify__/repro_gcj02_point_edit.mjs
import { fromLonLat, toLonLat } from 'ol/proj.js';
import { convertCoordinate, wgs84togcj02 } from './coordSystems.mjs';

function distMeters(a, b) {
  const dx = (b[0] - a[0]) * 111320 * Math.cos((a[1] + b[1]) / 2 * Math.PI / 180);
  const dy = (b[1] - a[1]) * 110540;
  return Math.hypot(dx, dy);
}

const lon = 113.264, lat = 23.129;     // 某 GCD 点的 WGS84 真值
const srcSystem = 'wgs84';

// 编辑前：该点所在图层在 高德(gcj02) 底图上，几何已被 shiftFeaturesDatum 偏移到 GCJ-02
const preGeom = fromLonLat(wgs84togcj02(lon, lat));
const preLL = toLonLat(preGeom);

// 用户重新输入「相同」的源坐标（等价：把点移动到某新源坐标）
const sx = lon, sy = lat;
const [lon2, lat2] = await convertCoordinate(sx, sy, srcSystem, 'wgs84'); // = [lon, lat]

// —— 当前（buggy）实现 —— 仅 fromLonLat，未叠加 GCJ-02 偏移
const postBuggy = fromLonLat([lon2, lat2]);
const bugLL = toLonLat(postBuggy);

// —— 修复后（fixed）实现 —— 叠加当前底图 datum='gcj02' 偏移
const postFixed = fromLonLat(wgs84togcj02(lon2, lat2));
const fixLL = toLonLat(postFixed);

const jumpBuggy = distMeters(preLL, bugLL);   // 期望≈0（不应跳），实际≈GCJ偏移量
const jumpFixed = distMeters(preLL, fixLL);   // 期望≈0

console.log('========== 任务4 复现：GCJ-02 底图编辑点坐标 ==========');
console.log(`pre-edit(已偏移GCJ-02): ${preLL[0].toFixed(6)}, ${preLL[1].toFixed(6)}`);
console.log(`post-edit(buggy 纯WGS84): ${bugLL[0].toFixed(6)}, ${bugLL[1].toFixed(6)}  跳动=${jumpBuggy.toFixed(1)} m`);
console.log(`post-edit(fixed 叠加GCJ): ${fixLL[0].toFixed(6)}, ${fixLL[1].toFixed(6)}  跳动=${jumpFixed.toFixed(1)} m`);

// 断言：在 GCJ-02 底图上重新输入坐标后，点不应相对同图层其它已偏移要素发生可见错位（<1m）
const EXPECT_NO_JUMP = jumpBuggy < 1;
console.log(`\n断言(当前代码): 编辑后点不跳动(<1m) => ${EXPECT_NO_JUMP ? 'PASS' : 'FAIL'}  (实测 ${jumpBuggy.toFixed(1)} m)`);
console.log(`对照(修复后): 编辑后点不跳动(<1m) => ${jumpFixed < 1 ? 'PASS' : 'FAIL'}`);

// 关键结论：当前实现下，点会跳回 WGS84 位置，与同图层已偏移要素错位约 ${jumpBuggy.toFixed(0)} m。
process.exit(EXPECT_NO_JUMP ? 0 : 1);
