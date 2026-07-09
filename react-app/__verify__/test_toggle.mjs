// Bug1 实证验证（主理人指定文件名）：无头模拟 App.js 修复后的 toggleLayer 逻辑，验证：
//  - 将 setVisible 副作用移出 setState updater（updater 为纯函数）
//  - 处理 features 中的 undefined 与无 setVisible 的脏对象时不抛异常
//  - 可见状态正确翻转，合法要素的 setVisible 被调用一次
// 运行：node __verify__/test_toggle.mjs
import { pathToFileURL } from 'url';

/**
 * 复刻 App.js 中修复后的 toggleLayer（纯逻辑，不依赖 React / OpenLayers）：
 * 1) 从当前状态取出目标图层并计算新可见状态；
 * 2) 在 setState 之外施加副作用（带防御，跳过 undefined / 非要素对象）；
 * 3) 用纯函数只更新 React 状态。
 * @param {() => Array} getLayers - 取得最新 layers 的快照
 * @param {(updater: (prev: Array) => Array) => void} setLayers - 模拟 React setState
 * @returns {(id: string) => void}
 */
function makeToggleLayer(getLayers, setLayers) {
  return (id) => {
    const target = getLayers().find(l => l.id === id);
    if (!target) return;
    const newVisible = !target.visible;

    // 2) 在 setState 之外施加副作用：逐个要素设置可见性（带防御）
    if (Array.isArray(target.features)) {
      target.features.forEach(f => {
        if (f && typeof f.setVisible === 'function') {
          f.setVisible(newVisible);
        }
      });
    }

    // 3) 纯函数更新 React 状态（不含任何副作用）
    setLayers(prev => prev.map(l => (l.id === id ? { ...l, visible: newVisible } : l)));
  };
}

/**
 * 构造极简 mock 要素（主理人指定 stub 形态），额外记录 setVisible 调用次数以便断言。
 */
function makeFeature() {
  let v = true;
  let calls = 0;
  return {
    _v: true,
    setVisible(x) { this._v = x; calls++; },
    visible() { return this._v; },
    callCount() { return calls; }
  };
}

/**
 * 执行 toggleLayer 无头模拟测试。
 * @returns {boolean} 全部断言通过返回 true
 */
export function runToggleTest() {
  const dirtyNoSetVisible = { name: '脏对象-无setVisible' }; // 没有 setVisible 方法
  const fA = makeFeature();
  const fB = makeFeature();

  let layers = [{
    id: 'L1',
    name: 'GCD（3）',
    visible: true,
    features: [fA, undefined, dirtyNoSetVisible, fB] // 含 undefined 与脏对象
  }];

  // 模拟 React setLayers：StrictMode 下 updater 会被调用两次（验证纯函数无副作用）
  function setLayers(updater) {
    updater(layers); // 第一次
    layers = updater(layers); // 第二次（StrictMode 双调用，updater 不应产生任何 setVisible 副作用）
  }

  const toggleLayer = makeToggleLayer(() => layers, setLayers);

  let pass = true;
  const log = [];

  try {
    toggleLayer('L1');
  } catch (e) {
    pass = false;
    log.push('调用 toggleLayer 抛异常: ' + e.message);
  }

  // 校验：target.visible 翻转
  if (layers[0].visible !== false) { pass = false; log.push('图层 visible 未翻转，当前=' + layers[0].visible); }
  // 校验：合法要素 setVisible 被调用一次且值为 false
  for (const [name, f] of [['fA', fA], ['fB', fB]]) {
    if (f.visible() !== false) { pass = false; log.push(name + ' 可见状态错误: ' + f.visible()); }
    if (f.callCount() !== 1) { pass = false; log.push(name + ' setVisible 调用次数错误: ' + f.callCount()); }
  }
  // 校验：脏对象与 undefined 被安全跳过（未抛异常、未被当作要素）
  if (typeof dirtyNoSetVisible.setVisible !== 'undefined') {
    pass = false;
    log.push('脏对象不应被注入 setVisible');
  }

  log.push('合法要素 setVisible 调用: fA=' + fA.callCount() + ', fB=' + fB.callCount());
  log.push('target.visible=' + layers[0].visible + '（期望 false）');

  console.log('========== Bug1 实证：toggleLayer 副作用移出 updater（test_toggle）==========');
  log.forEach(l => console.log(' - ' + l));
  console.log('\nBug1 验证结论:', pass ? 'TOGGLE_OK' : 'TOGGLE_FAIL');
  return pass;
}

// 仅当本文件作为入口直接执行时才运行（被其它脚本 import 时不自动运行）
const isDirect = !!process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isDirect) {
  process.exit(runToggleTest() ? 0 : 1);
}
