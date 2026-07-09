// 补充验证（QA 盲点覆盖）：
//  - 任务② 可读性：GCD 高程注记文字必须带白色光晕(halo)，在深色底图上仍清晰；
//  - 任务① 编辑后保持样式：改动 colorOverride 后 applyFeatureStyle 重建时，
//    固定像素小圆点的填充色必须跟随覆盖色（不丢小圆点、不回退默认色）；
//  - 任务③ 恒定像素：小圆点半径恒为 3.5px，不随分辨率变化（CircleStyle 半径即屏幕像素）。
// 运行：node __verify__/test_gcd_review_supp.mjs
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Circle as CircleStyle, Stroke } from 'ol/style.js';

const here = dirname(fileURLToPath(import.meta.url));
const realFixture = resolve(here, 'fixture_gcd_real.dxf');

const { parseDXF, applyFeatureStyle } = await import('./dxfParser.mjs');

console.log('========== QA 补充：halo 可读性 + 编辑后小圆点跟随色 + 恒定像素 ==========');
const text = readFileSync(realFixture, 'utf8');
const { features } = await parseDXF(text, 'wgs84', 'm');

const gcdElev = features.filter(f => f.get && f.get('isGcdElevation'));

let pass = true;
const log = [];
function check(name, cond) {
  log.push(`  ${cond ? '✓' : '✗'} ${name}`);
  if (!cond) pass = false;
}

check('GCD 高程注记要素数为 2', gcdElev.length === 2);

let haloOk = true;
let dotFollowsOverride = true;
let radiusFixed = true;
for (const f of gcdElev) {
  const s = f.getStyle();
  const t = s ? s.getText() : null;
  // 任务②：白色光晕（OpenLayers Text 的 stroke 即 halo 描边）
  const halo = t && t.getStroke();
  const haloColor = halo ? halo.getColor() : null;
  const haloWidth = halo ? halo.getWidth() : 0;
  if (!(halo && haloColor === 'white' && haloWidth > 0)) haloOk = false;

  // 任务③：小圆点半径固定 3.5px
  const img = s ? s.getImage() : null;
  if (!(img instanceof CircleStyle && img.getRadius() === 3.5)) radiusFixed = false;

  // 任务①：改动 colorOverride -> 小圆点填充色必须跟随
  const origColor = f.get('colorOverride');
  f.set('colorOverride', '#00aaff');
  applyFeatureStyle(f);
  const s2 = f.getStyle();
  const img2 = s2.getImage();
  const dotColor = img2 && img2.getFill ? img2.getFill().getColor() : null;
  if (dotColor !== '#00aaff') dotFollowsOverride = false;
  // 还原，避免影响其它用例
  f.set('colorOverride', origColor);
  applyFeatureStyle(f);
}

check('GCD 高程注记文字带白色光晕(halo)——深色底图可读', haloOk);
check('编辑后固定像素小圆点填充色跟随 colorOverride', dotFollowsOverride);
check('小圆点半径恒定 3.5px（不随分辨率变化）', radiusFixed);

log.forEach(l => console.log(l));
console.log('\nQA 补充验证结论:', pass ? 'GCD_REVIEW_SUPP_OK' : 'GCD_REVIEW_SUPP_FAIL');
process.exit(pass ? 0 : 1);
