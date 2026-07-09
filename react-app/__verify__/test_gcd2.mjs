// 任务3 实证验证（重点）：覆盖多种 GCD 高程存储方式，确保高程数字都作为文字要素产出。
// 覆盖：
//  (a) 命名块 GCDPT 内含 TEXT"12.5" -> 块展开后产出文字
//  (b) 匿名块 *U1 内含 TEXT"33.7" -> 块名匹配（*前缀）后展开产出文字
//  (c) GCDA 图层独立 TEXT"45.2" -> 直接产出文字
//  (d) 带 Z 值(group30=88.8) 的 POINT -> 任务3(b) 兜底生成高程注记文字"88.80"
// 运行：node __verify__/test_gcd2.mjs
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = resolve(here, 'fixture_gcd2.dxf');

const { parseDXF } = await import('./dxfParser.mjs');

console.log('========== 任务3 实证：GCD 高程多结构覆盖（test_gcd2）==========');
const text = readFileSync(fixture, 'utf8');
const { features } = await parseDXF(text, 'wgs84', 'm');

const texts = [];
let fromBlock = 0;
let fromZFallback = 0;
const byLayer = {};
let geomAllFinite = true;
for (const f of features) {
  const l = f.get('layer') || '未命名';
  byLayer[l] = (byLayer[l] || 0) + 1;
  if (f.get('fromBlock')) fromBlock++;
  if (f.get('fromZFallback')) fromZFallback++;
  if (f.get('type') === 'dxf_text') texts.push(f.get('name'));
  const g = f.getGeometry();
  if (g) {
    const c = g.getCoordinates();
    const flat = Array.isArray(c[0]) ? c.flat(Infinity) : c;
    for (const v of flat) if (typeof v === 'number' && !isFinite(v)) geomAllFinite = false;
  } else geomAllFinite = false;
}

const numTexts = texts.map(t => parseFloat(t));
console.log('总要素数:', features.length);
console.log('各图层要素数:', JSON.stringify(byLayer));
console.log('text 类要素文字:', JSON.stringify(texts));
console.log('块展开要素数(fromBlock):', fromBlock, '| Z 兜底文字数(fromZFallback):', fromZFallback);

// 任务③（独立 GCD point 生效）：独立的 GCD POINT（非块展开，如带 Z 值的测量点）应渲染为可见的固定像素小圆点
let gcdPointVisible = false;
let gcdPointRadius = NaN;
for (const f of features) {
  if (f.get('type') === 'dxf_point' && (f.get('layer') === 'GCD' || f.get('layer').startsWith('GCD'))) {
    const s = f.getStyle();
    if (s && typeof s.getImage === 'function' && s.getImage()) {
      gcdPointVisible = true;
      gcdPointRadius = s.getImage().getRadius();
    }
  }
}

const ok1 = features.length === 6;                 // GCDPT(点+文)=2 + *U1(文)=1 + GCDA(文)=1 + POINT(Z 点+文)=2
const ok2 = texts.includes('12.5');                // (a) 命名块 GCDPT 内 TEXT
const ok3 = texts.includes('33.7');                // (b) 匿名块 *U1 内 TEXT
const ok4 = texts.includes('45.2');                // (c) GCDA 独立 TEXT
const ok5 = numTexts.includes(88.8);               // (d) POINT 的 Z 值兜底（"88.80" -> 88.8）
const ok6 = fromZFallback === 1;                   // 只有 1 个 Z 兜底文字
const ok7 = geomAllFinite;                         // 几何坐标全部有限
const ok8 = gcdPointVisible && gcdPointRadius > 0 && gcdPointRadius <= 5; // 独立 GCD point 可见、固定像素(≤5px)

console.log(`断言: total===6:${ok1}, 含12.5(命名块):${ok2}, 含33.7(匿名块*U1):${ok3}, 含45.2(GCDA):${ok4}, 含88.8(Z兜底):${ok5}, Z兜底数===1:${ok6}, 几何有限:${ok7}, 独立GCD点可见(固定像素):${ok8}`);

const allPass = ok1 && ok2 && ok3 && ok4 && ok5 && ok6 && ok7 && ok8;
console.log('\n任务3 验证结论:', allPass ? 'GCD2_OK' : 'GCD2_FAIL');
process.exit(allPass ? 0 : 1);
