// 任务③ / 任务① 实证验证：GCD 高程点渲染为「固定屏幕大小的小圆点 + 橙红高程数字」，且
//  - 抑制随缩放变大的块几何（gc200 块不再展开为地图坐标 CIRCLE）；
//  - 小圆点为恒定像素(CircleStyle 半径 3.5px，绝不随地图 zoom/resolution 变大变小)；
//  - 高程数字文字固定屏幕像素(scale:undefined)，细体橙红、清晰；
//  - 选中要素（图层展开列表点击即 selectedFeature）具备可编辑 props，且编辑后 applyFeatureStyle 重建
//    仍保持固定像素小圆点 + 数字（即 App.js applyFeatureEdit 链路可用）。
// 运行：node __verify__/test_gcd_elevation_symbol.mjs
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Circle as CircleStyle } from 'ol/style.js';

const here = dirname(fileURLToPath(import.meta.url));
const realFixture = resolve(here, 'fixture_gcd_real.dxf');

const { parseDXF, applyFeatureStyle } = await import('./dxfParser.mjs');

console.log('========== 任务③/① 实证：GCD 高程点固定屏幕大小符号（test_gcd_elevation_symbol）==========');
const text = readFileSync(realFixture, 'utf8');
const { features } = await parseDXF(text, 'wgs84', 'm');

const gcdElev = features.filter(f => f.get && f.get('isGcdElevation'));
const hasScalingCircle = features.some(f => f.get('type') === 'dxf_circle'); // 块展开产生的缩放圆

let pass = true;
const log = [];
function check(name, cond) {
  log.push(`  ${cond ? '✓' : '✗'} ${name}`);
  if (!cond) pass = false;
}

check('GCD 高程注记要素数为 2', gcdElev.length === 2);
check('已抑制随缩放变大的块几何(dxf_circle 不应出现)', hasScalingCircle === false);

let fixedSymbolOk = true;
for (const f of gcdElev) {
  const s = f.getStyle();
  const hasText = s && typeof s.getText === 'function' && !!s.getText();
  const hasImage = s && typeof s.getImage === 'function' && !!s.getImage();
  // 小圆点：CircleStyle 半径恒为像素(3.5)，不随分辨率变化
  const img = s ? s.getImage() : null;
  const isCircle = img instanceof CircleStyle;
  const radius = img ? img.getRadius() : NaN;
  const radiusFixed = isCircle && radius === 3.5;
  // 数字：固定屏幕像素(scale:undefined)，橙红
  const t = s ? s.getText() : null;
  const scaleFixed = t && (t.getScale == null || t.getScale() === undefined || t.getScale() === 1);
  const colorOk = t && t.getFill() && t.getFill().getColor() === '#ff5500';
  if (!(hasText && hasImage && radiusFixed && scaleFixed && colorOk)) fixedSymbolOk = false;
}
check('每个高程注记均含「固定像素小圆点(CircleStyle r=3.5) + 橙红数字(scale:undefined)」', fixedSymbolOk);

// —— 任务① 数据级模拟：选中要素(=selectedFeature)具备可编辑 props，编辑后 applyFeatureStyle 重建仍保持固定符号 ——
const f = gcdElev[0];
const origName = f.get('name');
f.set('name', '99.99');            // 编辑文字内容（图层展开面板“文字内容”字段）
f.set('colorOverride', '#00ff00'); // 编辑颜色（面板“颜色”字段）
f.set('fontSize', 18);             // 编辑字号（面板“字号”字段）
applyFeatureStyle(f);              // 等价于 App.js applyFeatureEdit 对文字/颜色的写回
const s2 = f.getStyle();
const textAfter = s2.getText();
const imgAfter = s2.getImage();
check('编辑后文字内容已更新', textAfter.getText() === '99.99');
check('编辑后颜色已更新', textAfter.getFill().getColor() === '#00ff00');
check('编辑后字号已更新(18px)', /18px/.test(textAfter.getFont()));
check('编辑后固定像素小圆点仍存在(r=3.5)', imgAfter instanceof CircleStyle && imgAfter.getRadius() === 3.5);
check('编辑后数字仍为固定屏幕像素(scale:undefined)', textAfter.getScale == null || textAfter.getScale() === undefined || textAfter.getScale() === 1);
// 还原，避免影响其它用例（此处为独立进程，非必须）
f.set('name', origName);
f.set('colorOverride', '#ff5500');
f.set('fontSize', 14);
applyFeatureStyle(f);

log.forEach(l => console.log(l));
console.log('\n任务③/① 验证结论:', pass ? 'GCD_SYMBOL_OK' : 'GCD_SYMBOL_FAIL');
process.exit(pass ? 0 : 1);
