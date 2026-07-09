// GCD 高程数字提取 —— 边界补充验证（独立 QA 增补，锁定 review 盲区）。
// 覆盖工程师自测未覆盖的 3 个边界：
//   A. 块名 gcbj（图形/注记块）即使在非 GCD 层带 height ATTRIB，
//      也不应被主路径误判为 GCD 高程注记（正则 /^gc\d*$/i 必须排除 gcbj）。
//   B. height 值带单位后缀（如 "7.73m"）仍应生成高程注记，name 保留原始值。
//   C. height 值为空（""）时不生成高程注记，且不崩溃，块几何被抑制(不随缩放变化)。
// 运行：node __verify__/test_gcd_attrib_edge.mjs
import { resolve, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * 构造最小 DXF：1 个块(含 CIRCLE 几何，无 ATTDEF) + 1 个 INSERT(带 height ATTRIB)。
 * @param {string} blockName 块名
 * @param {string} layer 插入点图层
 * @param {string} heightVal height ATTRIB 的值（可空）
 */
function buildFixture(blockName, layer, heightVal) {
  const h = heightVal == null ? '' : String(heightVal);
  return `0
SECTION
2
HEADER
9
$INSUNITS
70
6
0
ENDSEC
0
SECTION
2
TABLES
0
TABLE
2
LAYER
0
LAYER
2
GCD
70
64
62
3
0
ENDTAB
0
ENDSEC
0
SECTION
2
BLOCKS
0
BLOCK
2
${blockName}
70
0
10
0.0
20
0.0
0
CIRCLE
8
${layer}
10
0.0
20
0.0
40
1.0
0
ENDBLK
0
ENDSEC
0
SECTION
2
ENTITIES
0
INSERT
2
${blockName}
8
${layer}
10
113.264
20
23.129
0
ATTRIB
2
height
1
${h}
0
SEQEND
0
ENDSEC
0
EOF
`;
}

/**
 * 执行 GCD 高程属性提取边界补充测试。
 * @returns {Promise<boolean>} 全部断言通过返回 true
 */
export async function runGcdEdgeTest() {
  const { parseDXF } = await import('./dxfParser.mjs');

  console.log('========== GCD 高程数字提取·边界补充（test_gcd_attrib_edge）==========');
  let allPass = true;

  // ---------- A. gcbj 图形块在主路径不应被误判 ----------
  const a = await parseDXF(buildFixture('gcbj', '0', '9.99'), 'wgs84', 'm');
  const aElev = a.features.filter(f => f.get && f.get('isGcdElevation'));
  const aHasBlockGeom = a.features.some(f => f.get('type') === 'dxf_circle' || f.get('fromBlock'));
  const aOk = aElev.length === 0 && aHasBlockGeom;
  console.log(`[A] gcbj 图层0 height=9.99 -> GCD高程注记数=${aElev.length}(期望0), 块几何展开=${aHasBlockGeom}: ${aOk}`);
  allPass = allPass && aOk;

  // ---------- B. height 带单位后缀仍生成注记，name 为原始值 ----------
  const b = await parseDXF(buildFixture('gc200', 'GCD', '7.73m'), 'wgs84', 'm');
  const bElev = b.features.filter(f => f.get && f.get('isGcdElevation'));
  const bFeat = bElev.find(f => f.get('name') === '7.73m');
  const bOk = bElev.length === 1 && !!bFeat &&
    bFeat.get('layer') === 'GCD' &&
    bFeat.get('fromAttrib') === true &&
    bFeat.get('attTag') === 'height';
  console.log(`[B] gc200 图层GCD height=7.73m -> GCD高程注记数=${bElev.length}, name=${bFeat ? bFeat.get('name') : '无'}(期望1,"7.73m"): ${bOk}`);
  allPass = allPass && bOk;

  // ---------- C. height 为空时不生成注记且不崩溃 ----------
  const c = await parseDXF(buildFixture('gc200', 'GCD', ''), 'wgs84', 'm');
  const cElev = c.features.filter(f => f.get && f.get('isGcdElevation'));
  const cHasBlockGeom = c.features.some(f => f.get('type') === 'dxf_circle' || f.get('fromBlock'));
  const cOk = cElev.length === 0 && !cHasBlockGeom;   // 空height：不生成注记，且抑制块几何(不随缩放变化)，不崩溃
  console.log(`[C] gc200 图层GCD height=(空) -> GCD高程注记数=${cElev.length}(期望0), 块几何抑制=${!cHasBlockGeom}(不崩溃): ${cOk}`);
  allPass = allPass && cOk;

  console.log('\nGCD 边界补充结论:', allPass ? 'GCD_EDGE_OK' : 'GCD_EDGE_FAIL');
  return allPass;
}

// 仅当本文件作为入口直接执行时才运行
const isDirect = !!process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isDirect) {
  runGcdEdgeTest().then(ok => process.exit(ok ? 0 : 1));
}
