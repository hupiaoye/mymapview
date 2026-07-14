// GCD 高程数字提取 —— 边界补充验证（独立 QA 增补，锁定 review 盲区）。
// 反映新数据模型：高程来自「炸块后圆的圆心 Z 坐标」（GCD 图层 INSERT 的插入点 Z）。
//   A. 块名 gcbj 在「非高程图层(0)」即使带 height ATTRIB，也不应被误判为 GCD 高程注记，
//      且块几何正常展开（不抑制）。
//   B. 圆心 Z 优先于 ATTRIB：gc200(GCD 层) 插入点 Z=7.73 且 ATTRIB height=99 时，
//      生成的注记 name 应为 '7.73'（圆心 Z 覆盖 ATTRIB）。
//   C. GCD 层块无圆、无属性时仍生成高程点标记（不展开会缩放的块几何、不崩溃）。
// 运行：node __verify__/test_gcd_attrib_edge.mjs
import { resolve, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * 构造最小 DXF：1 个块(可选含 CIRCLE) + 1 个 INSERT(可选 group30 Z、可选 height ATTRIB)。
 * @param {string} blockName 块名
 * @param {string} layer 插入点图层
 * @param {string} heightVal height ATTRIB 的值（可空）
 * @param {number|string|null} zVal INSERT 的 group30（圆心 Z / 插入点 Z），可空
 * @param {boolean} withCircle 块内是否含 CIRCLE（默认 true）
 */
function buildFixture(blockName, layer, heightVal, zVal, withCircle = true) {
  const h = heightVal == null ? '' : String(heightVal);
  const zLine = (zVal != null) ? `30\n${zVal}\n` : '';
  const circle = withCircle
    ? `0\nCIRCLE\n8\n${layer}\n10\n0.0\n20\n0.0\n40\n1.0\n`
    : '';
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
${layer}
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
${circle}0
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
${zLine}0
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

  // ---------- A. gcbj 图形块在非高程图层不应被误判 ----------
  const a = await parseDXF(buildFixture('gcbj', '0', '9.99'), 'wgs84', 'm');
  const aElev = a.features.filter(f => f.get && f.get('isGcdElevation'));
  const aHasBlockGeom = a.features.some(f => f.get('type') === 'dxf_circle' || f.get('fromBlock'));
  const aOk = aElev.length === 0 && aHasBlockGeom;
  console.log(`[A] gcbj 图层0 height=9.99 -> GCD高程注记数=${aElev.length}(期望0), 块几何展开=${aHasBlockGeom}: ${aOk}`);
  allPass = allPass && aOk;

  // ---------- B. 圆心 Z 优先于 ATTRIB：Z=7.73 覆盖 att='99' ----------
  const b = await parseDXF(buildFixture('gc200', 'GCD', '99', 7.73, true), 'wgs84', 'm');
  const bElev = b.features.filter(f => f.get && f.get('isGcdElevation'));
  const bFeat = bElev.find(f => f.get('name') === '7.73');
  const bHasWrong = bElev.some(f => f.get('name') === '99'); // ATTRIB 不应成为高程源
  const bOk = bElev.length === 1 && !!bFeat &&
    bFeat.get('layer') === 'GCD' &&
    bFeat.get('isGcdElevation') === true &&
    !bHasWrong;
  console.log(`[B] gc200 图层GCD Z=7.73/att=99 -> GCD高程注记数=${bElev.length}, name=${bFeat ? bFeat.get('name') : '无'}(期望1,"7.73"), ATTRIB误用=${bHasWrong}: ${bOk}`);
  allPass = allPass && bOk;

  // ---------- C. 无圆无属性仍生成标记点，不展开缩放几何、不崩溃 ----------
  const c = await parseDXF(buildFixture('gc200', 'GCD', '', null, false), 'wgs84', 'm');
  const cElev = c.features.filter(f => f.get && f.get('isGcdElevation'));
  const cHasBlockGeom = c.features.some(f => f.get('type') === 'dxf_circle' || f.get('fromBlock'));
  const cOk = cElev.length === 1 && !cHasBlockGeom;   // 高程标记点存在，块几何被抑制(不随缩放变化)，不崩溃
  console.log(`[C] gc200 图层GCD 无圆无属性 -> GCD高程注记数=${cElev.length}(期望1), 块几何抑制=${!cHasBlockGeom}(不崩溃): ${cOk}`);
  allPass = allPass && cOk;

  console.log('\nGCD 边界补充结论:', allPass ? 'GCD_EDGE_OK' : 'GCD_EDGE_FAIL');
  return allPass;
}

// 仅当本文件作为入口直接执行时才运行
const isDirect = !!process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isDirect) {
  runGcdEdgeTest().then(ok => process.exit(ok ? 0 : 1));
}
