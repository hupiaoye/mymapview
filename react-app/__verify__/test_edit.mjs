// 任务4 实证验证（无头）：用极简要素模拟「设置 name/color -> 调用 applyFeatureStyle 重建样式
// -> 断言样式颜色/文字已更新」，证明编辑链路可工作。不依赖 React / 地图交互。
// 运行：node __verify__/test_edit.mjs
import Feature from 'ol/Feature.js';
import { Style, Text, Fill, Stroke } from 'ol/style.js';

const { applyFeatureStyle } = await import('./dxfParser.mjs');

console.log('========== 任务4 实证：属性编辑链路（test_edit）==========');

let pass = true;
const log = [];

function check(name, cond) {
  log.push(`  ${cond ? '✓' : '✗'} ${name}`);
  if (!cond) pass = false;
}

// --- (1) 文字类：GCDA 高程注记，默认红；编辑 name + 颜色后更新 ---
const fText = new Feature({ type: 'dxf_text', layer: 'GCDA', colorIndex: 7, name: '旧值' });
applyFeatureStyle(fText);
let s = fText.getStyle();
check('文字默认红字(GCDA)', s.getText().getFill().getColor() === '#FF0000');
check('文字默认内容="旧值"', s.getText().getText() === '旧值');

fText.set('name', '新值');
fText.set('colorOverride', '#00FF00');
fText.set('fontSize', 20);
applyFeatureStyle(fText);
s = fText.getStyle();
check('编辑后内容="新值"', s.getText().getText() === '新值');
check('编辑后颜色=#00FF00', s.getText().getFill().getColor() === '#00FF00');
check('编辑后字号=20', /20px/.test(s.getText().getFont())); // 字体串含 20px
check('文字恒定像素(scale undefined)', s.getText().getScale == null || s.getText().getScale() === undefined || s.getText().getScale() === 1);

// --- (2) 线状：DLSS 默认深灰（colorIndex=256 表示 BYLAYER，解析真实 DXF 时即如此）；编辑颜色后更新 ---
const fLine = new Feature({ type: 'dxf_line', layer: 'DLSS', colorIndex: 256 });
applyFeatureStyle(fLine);
let sl = fLine.getStyle();
check('线默认色=DLSS深灰', sl.getStroke().getColor() === '#2C2C2C');

fLine.set('colorOverride', '#123456');
fLine.set('lineWidth', 3);
applyFeatureStyle(fLine);
sl = fLine.getStyle();
check('编辑后线色=#123456', sl.getStroke().getColor() === '#123456');
check('编辑后线宽=3', sl.getStroke().getWidth() === 3);

// --- (3) 点状：GCD 隐藏点；编辑颜色+半径后变为可见圆点 ---
const fPoint = new Feature({ type: 'dxf_point', layer: 'GCD', colorIndex: 3 });
applyFeatureStyle(fPoint);
let sp = fPoint.getStyle();
check('GCD 点默认有 image 样式(编辑后为可见)', sp.getImage() != null);
check('GCD 点默认橙红', sp.getImage().getFill().getColor() === '#FF6600');

fPoint.set('colorOverride', '#FF0000');
fPoint.set('pointRadius', 6);
applyFeatureStyle(fPoint);
sp = fPoint.getStyle();
check('编辑后点色=#FF0000', sp.getImage().getFill().getColor() === '#FF0000');
check('编辑后点半径=6', sp.getImage().getRadius() === 6);

// --- (4) 炸开后的多段线（MultiLineString）也能重建描边样式 ---
const fPoly = new Feature({ type: 'dxf_polyline', layer: 'DLSS', colorIndex: 7 });
applyFeatureStyle(fPoly);
check('多段线可重建描边样式', fPoly.getStyle().getStroke() != null);

log.forEach(l => console.log(l));
console.log('\n任务4 验证结论:', pass ? 'EDIT_OK' : 'EDIT_FAIL');
process.exit(pass ? 0 : 1);
