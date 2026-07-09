// 验证 featureLabel：对文字/点/线/面/圆 五种 type 的标签生成是否正确。
// 仅依赖 dxfParser.mjs 导出的纯函数 featureLabel，不依赖地图渲染。
// 运行：node __verify__/test_feature_label.mjs
import { fileURLToPath } from 'url';

const { featureLabel } = await import('./dxfParser.mjs');

// 极简 feature stub：仅需 get(k) / set(k,v) / getGeometry()
function makeStub(props) {
  return {
    _p: props || {},
    get(k) { return this._p[k]; },
    set(k, v) { this._p[k] = v; },
    getGeometry() { return null; }
  };
}

let allOk = true;
function assert(cond, msg) {
  if (cond) {
    console.log('PASS:', msg);
  } else {
    console.error('FAIL:', msg);
    allOk = false;
  }
  return cond;
}

// 1) 文字 type：标签取 f.get('name')，且 index 不参与拼接
const textF = makeStub({ type: 'dxf_text', name: '高程点ABC' });
const textLabel = featureLabel(textF, 0);
assert(textLabel.includes('高程点ABC'), `文字标签含内容: "${textLabel}"`);

// 文字无 name -> 兜底 '文字'
const textF2 = makeStub({ type: 'dxf_text' });
assert(featureLabel(textF2, 0) === '文字', `文字无内容兜底: "${featureLabel(textF2, 0)}"`);

// 文字超长 -> 截断到前 12 字
const textF3 = makeStub({ type: 'dxf_text', name: '一二三四五六七八九十十一十二十四' });
assert(featureLabel(textF3, 0).length <= 13 && featureLabel(textF3, 0).startsWith('一二三四五六七八九十'), `文字截断到12字: "${featureLabel(textF3, 0)}"`);

// 2) 点 type：'点 #'+index；带高程 name 时追加
const ptF = makeStub({ type: 'dxf_point' });
const ptLabel = featureLabel(ptF, 5);
assert(ptLabel.includes('点') && ptLabel.includes('5'), `点标签含关键字与index: "${ptLabel}"`);

const ptF2 = makeStub({ type: 'dxf_point', name: '12.50' });
const ptLabel2 = featureLabel(ptF2, 7);
assert(ptLabel2.includes('点') && ptLabel2.includes('7') && ptLabel2.includes('12.50'), `点含高程优先: "${ptLabel2}"`);

// 块回退点 dxf_block 也归为点
const blkF = makeStub({ type: 'dxf_block', name: 'PT1' });
assert(featureLabel(blkF, 2).includes('点'), `块点归为点: "${featureLabel(blkF, 2)}"`);

// 3) 线 / 多段线
const lineF = makeStub({ type: 'dxf_line' });
assert(featureLabel(lineF, 3).includes('线') && featureLabel(lineF, 3).includes('3'), `线标签: "${featureLabel(lineF, 3)}"`);
const plF = makeStub({ type: 'dxf_polyline' });
assert(featureLabel(plF, 9).includes('线') && featureLabel(plF, 9).includes('9'), `多段线标签归为线: "${featureLabel(plF, 9)}"`);

// 4) 面 / 填充
const polyF = makeStub({ type: 'dxf_polygon' });
assert(featureLabel(polyF, 2).includes('面') && featureLabel(polyF, 2).includes('2'), `面标签: "${featureLabel(polyF, 2)}"`);
const solidF = makeStub({ type: 'dxf_solid' });
assert(featureLabel(solidF, 4).includes('面'), `填充归为面: "${featureLabel(solidF, 4)}"`);

// 5) 圆 / 弧
const circF = makeStub({ type: 'dxf_circle' });
assert(featureLabel(circF, 4).includes('圆') && featureLabel(circF, 4).includes('4'), `圆标签: "${featureLabel(circF, 4)}"`);
const arcF = makeStub({ type: 'dxf_arc' });
assert(featureLabel(arcF, 8).includes('圆') && featureLabel(arcF, 8).includes('8'), `弧标签归为圆: "${featureLabel(arcF, 8)}"`);

// 6) 兜底：未知 type（不含 text/point/block/line/polyline/polygon/solid/circle/arc 任一子串）
//    返回 `${type} #${index}`。注意：dxf_spline 含 "line" 子串，会归为"线"，故这里用 dxf_ellipse。
const otherF = makeStub({ type: 'dxf_ellipse' });
assert(featureLabel(otherF, 1).includes('dxf_ellipse') && featureLabel(otherF, 1).includes('1'), `兜底标签: "${featureLabel(otherF, 1)}"`);

console.log(allOk ? '\nFEATURE_LABEL_OK' : '\nFEATURE_LABEL_FAIL');
process.exit(allOk ? 0 : 1);
