// GCD 高程数字提取实证验证（重写以反映真实地形图结构）。
// 主路径（本次 Bug 修复）：
//   INSERT(gc200) 在实体段携带 ATTRIB(tag="height", 大小写不敏感).value = 高程数值，
//   块定义(BLOCKS)无 ATTDEF；解析器应在插入点生成高程注记 text 要素。
//   fixture_gcd_real.dxf：gc200 块 + 两个 INSERT，分别带 "height" 与 "HEIGHT"（验证大小写不敏感）。
// 次级路径（兼容保留，回归保护）：
//   块定义含 ATTDEF，INSERT 段 ATTRIB 实例覆盖默认值。
//   fixture_gcd.dxf：GCDPT 块(含 ATTDEF ELEV) + 两个 INSERT（一个带 ELEV 实例、一个不带）。
// 运行：node __verify__/test_gcd_attrib.mjs
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const realFixture = resolve(here, 'fixture_gcd_real.dxf');
const legacyFixture = resolve(here, 'fixture_gcd.dxf');

/**
 * 执行 GCD 高程属性提取实证测试。
 * @returns {Promise<boolean>} 全部断言通过返回 true
 */
export async function runGcdAttribTest() {
  const { parseDXF } = await import('./dxfParser.mjs');

  console.log('========== GCD 高程数字提取（test_gcd_attrib）==========');

  // ---------- 主路径：真实结构 INSERT(gc200) + ATTRIB height ----------
  const realText = readFileSync(realFixture, 'utf8');
  const real = await parseDXF(realText, 'wgs84', 'm');
  const realGcdElev = real.features.filter(f => f.get && f.get('isGcdElevation'));

  console.log('[真实结构] 总要素数:', real.features.length, '| GCD 高程注记要素数:', realGcdElev.length);
  const realByValue = {};
  let realAllValid = true;
  let realGeomFinite = true;
  for (const f of realGcdElev) {
    const v = f.get('name');
    realByValue[v] = f;
    const okType = f.get('type') === 'dxf_text';
    const okLayer = f.get('layer') === 'GCD';
    const okTag = f.get('attTag') === 'height';
    const okFromAttrib = f.get('fromAttrib') === true;
    const style = f.getStyle();
    const okStyle = style && typeof style.getText === 'function' && !!style.getText();
    const geom = f.getGeometry();
    const okGeom = !!geom && geom.getCoordinates && Array.isArray(geom.getCoordinates());
    const coords = geom ? geom.getCoordinates() : [];
    const okFinite = coords.every(c => typeof c === 'number' && isFinite(c));
    if (!okType || !okLayer || !okTag || !okFromAttrib || !okStyle || !okGeom || !okFinite) realAllValid = false;
    if (!okFinite) realGeomFinite = false;
    console.log(`  - 高程="${v}" layer=${f.get('layer')} srcCoords=${JSON.stringify(f.get('srcCoords'))} 有效=${okType && okLayer && okTag && okFromAttrib && okStyle && okGeom && okFinite}`);
  }

  // 期望：'7.73' 对应插入点 (113.264, 23.129)；'12.25' 对应插入点 (113.270, 23.133)
  const f73 = realByValue['7.73'];
  const f1225 = realByValue['12.25'];

  const realOkCount = realGcdElev.length === 2;
  const realOk73 = !!f73 && f73.get('layer') === 'GCD' &&
    Math.abs(f73.get('srcCoords')[0][0] - 113.264) < 1e-9 &&
    Math.abs(f73.get('srcCoords')[0][1] - 23.129) < 1e-9;
  const realOk1225 = !!f1225 && f1225.get('layer') === 'GCD' &&
    Math.abs(f1225.get('srcCoords')[0][0] - 113.270) < 1e-9 &&
    Math.abs(f1225.get('srcCoords')[0][1] - 23.133) < 1e-9;
  const realOk = realOkCount && realOk73 && realOk1225 && realAllValid && realGeomFinite;

  // ---------- 次级路径（回归）：块定义 ATTDEF + 实例覆盖默认值 ----------
  const legacyText = readFileSync(legacyFixture, 'utf8');
  const legacy = await parseDXF(legacyText, 'wgs84', 'm');
  const total = legacy.features.length;
  const byLayer = {};
  const texts = [];
  const attrTexts = [];
  let geomAllFinite = true;
  let allStyleHasText = true;
  for (const f of legacy.features) {
    const l = f.get('layer') || '未命名';
    byLayer[l] = (byLayer[l] || 0) + 1;
    const geom = f.getGeometry();
    if (geom) {
      const c = geom.getCoordinates ? geom.getCoordinates() : null;
      const flat = c ? (Array.isArray(c[0]) ? c.flat(Infinity) : c) : [];
      for (const v of flat) if (typeof v === 'number' && !isFinite(v)) geomAllFinite = false;
    } else {
      geomAllFinite = false;
    }
    const style = f.getStyle();
    const hasText = style && typeof style.getText === 'function' && style.getText();
    if (f.get('type') === 'dxf_text' && !hasText) allStyleHasText = false;
    if (f.get('type') === 'dxf_text') {
      const t = f.get('name');
      texts.push(t);
      if (f.get('fromAttrib')) attrTexts.push({ layer: l, tag: f.get('attTag'), text: t });
    }
  }
  console.log('\n[遗留结构] 总要素数:', total, '| 各图层:', JSON.stringify(byLayer));
  console.log('  text 类文字:', JSON.stringify(texts), '| 块属性文字:', JSON.stringify(attrTexts));

  const legacyOk1 = total === 6;                  // 2 个 GCD INSERT 各(点+属性文字)=4 + GCDA TEXT/MTEXT=2
  const legacyOk2 = (byLayer['GCD'] || 0) === 4;
  const legacyOk3 = (byLayer['GCDA'] || 0) === 2;
  const legacyOk4 = texts.includes('33.7');       // INSERT 带 ATTRIB ELEV -> 实例值覆盖默认
  const legacyOk5 = texts.includes('12.5');       // INSERT 不带 ATTRIB -> ATTDEF 默认值兜底
  const legacyOk6 = attrTexts.length === 2;       // 由块属性(ATTDEF)生成的 text 数（33.7、12.5）
  const legacyOk7 = geomAllFinite && allStyleHasText;
  const legacyOk = legacyOk1 && legacyOk2 && legacyOk3 && legacyOk4 && legacyOk5 && legacyOk6 && legacyOk7;

  console.log(`\n断言[真实]: 注记数===2:${realOkCount}, 7.73坐标/图层:${realOk73}, 12.25坐标/图层:${realOk1225}, 全部有效:${realAllValid}, 几何有限:${realGeomFinite}`);
  console.log(`断言[遗留]: total===6:${legacyOk1}, GCD===4:${legacyOk2}, GCDA===2:${legacyOk3}, 含33.7:${legacyOk4}, 含12.5:${legacyOk5}, 块属性text===2:${legacyOk6}, 几何有限&样式有效:${legacyOk7}`);

  const allPass = realOk && legacyOk;
  console.log('\nGCD 验证结论:', allPass ? 'GCD_TEXT_OK' : 'GCD_TEXT_FAIL');
  return allPass;
}

// 仅当本文件作为入口直接执行时才运行（被其它脚本 import 时不自动运行）
const isDirect = !!process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isDirect) {
  runGcdAttribTest().then(ok => process.exit(ok ? 0 : 1));
}
