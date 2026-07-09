// 轻量验证脚本：验证 DXF 按内部图层码分组的逻辑（与 App.js 中 doImport 的实现保持一致）
// 用法：node scripts/verify_dxf_grouping.js

// 模拟 OpenLayers Feature 的最小桩：仅实现 get('layer')
function makeFeature(layer) {
  return { _layer: layer, get(k) { return k === 'layer' ? this._layer : undefined; } };
}

// 复刻 App.js 中的分组算法
function groupDxfLayers(feats, fileName) {
  const fileBase = fileName.replace(/\.[^.]+$/, '');
  const groups = {};
  feats.forEach((feat) => {
    const layerName = feat.get('layer') || '未命名';
    if (!groups[layerName]) groups[layerName] = [];
    groups[layerName].push(feat);
  });
  return Object.keys(groups).map((layerName, i) => ({
    id: `test_${i}`,
    name: `${layerName}（${groups[layerName].length}）`,
    visible: true,
    features: groups[layerName],
    dxfSub: true,
    fileBase,
  }));
}

// 构造假数据：混排 GCD / DGX / JMD / ZBTZ 及 1 个缺 layer 的要素
const fakeFeats = [
  ...Array.from({ length: 3 }, () => makeFeature('GCD')),
  ...Array.from({ length: 2 }, () => makeFeature('DGX')),
  ...Array.from({ length: 5 }, () => makeFeature('JMD')),
  ...Array.from({ length: 1 }, () => makeFeature('ZBTZ')),
  makeFeature(undefined), // 缺 layer，应归入“未命名”
];

const result = groupDxfLayers(fakeFeats, '黄山鲁.dxf');

// 断言
function assert(cond, msg) {
  if (!cond) { console.error('❌ FAIL:', msg); process.exitCode = 1; }
  else console.log('✅ PASS:', msg);
}

assert(result.length === 5, `分组数应为 5（GCD/DGX/JMD/ZBTZ/未命名），实际=${result.length}`);

const byName = Object.fromEntries(result.map((l) => [l.name, l]));
assert(byName['GCD（3）'] && byName['GCD（3）'].features.length === 3, 'GCD 分组含 3 个要素');
assert(byName['DGX（2）'] && byName['DGX（2）'].features.length === 2, 'DGX 分组含 2 个要素');
assert(byName['JMD（5）'] && byName['JMD（5）'].features.length === 5, 'JMD 分组含 5 个要素');
assert(byName['ZBTZ（1）'] && byName['ZBTZ（1）'].features.length === 1, 'ZBTZ 分组含 1 个要素');
assert(byName['未命名（1）'] && byName['未命名（1）'].features.length === 1, '缺 layer 的要素归入“未命名（1）”');

// 校验所有要素总数无遗漏：分组之和 === 原始总数
const total = result.reduce((s, l) => s + l.features.length, 0);
assert(total === fakeFeats.length, `分组要素总和${total} 应等于原始总数${fakeFeats.length}`);

// 校验 fileBase 提取正确（去掉扩展名）
assert(result.every((l) => l.fileBase === '黄山鲁'), 'fileBase 应为 "黄山鲁"（已去掉 .dxf）');

// 校验每个子图层 features 引用的就是原对象（用于显隐/删除时操作真实 source 要素）
assert(byName['GCD（3）'].features.every((f) => fakeFeats.includes(f)), '子图层 features 应为原始对象引用（无复制丢失）');

// 模拟导出文件名构造
function buildExportName(layerName, fileBase, ext) {
  const layerCode = (layerName || 'layer').split('（')[0].replace(/\s+/g, '');
  return `${fileBase}_${layerCode}.${ext}`;
}
assert(buildExportName('DGX（8406）', '黄山鲁', 'kml') === '黄山鲁_DGX.kml', '导出文件名应为 黄山鲁_DGX.kml');

console.log('\n分组结果预览:');
result.forEach((l) => console.log(`  - ${l.name}  fileBase=${l.fileBase}`));
