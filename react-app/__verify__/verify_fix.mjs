// 验证脚本：确认 INSERT（块参照）被正确展开为可见要素，并验证 GCJ-02 互转。
// 运行：node __verify__/verify_fix.mjs
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = resolve(here, 'fixture_block.dxf');

const { parseDXF } = await import('./dxfParser.mjs');
const { wgs84togcj02, gcj02towgs84 } = await import('./coordSystems.mjs');

console.log('========== 1) 块参照展开验证 ==========');
const text = readFileSync(fixture, 'utf8');
const { features, layers } = await parseDXF(text, 'wgs84', 'm');

const total = features.length;
const byLayer = {};
let fromBlock = 0;
let gcdVisible = 0;
let gcdHiddenFallback = 0;
for (const f of features) {
  const l = f.get('layer') || '未命名';
  byLayer[l] = (byLayer[l] || 0) + 1;
  if (f.get('fromBlock')) fromBlock++;
  if (l === 'GCD') {
    if (f.get('fromBlock') && f.getStyle() !== null) gcdVisible++;
    if (!f.get('fromBlock') && f.getStyle() === null) gcdHiddenFallback++;
  }
}

console.log('总要素数:', total);
console.log('块展开得到的要素数 (fromBlock):', fromBlock);
console.log('各图层要素数:', JSON.stringify(byLayer));
console.log('GCD 块展开可见要素数 (期望=4):', gcdVisible);
console.log('GCD 找不到块时的回退隐藏要素数 (期望=1):', gcdHiddenFallback);

// 断言
const ok1 = total === 9;            // 2+2+2+2 (块展开) + 1 (回退)
const ok2 = fromBlock === 8;        // 4 个 INSERT 各展开 2 / 1 个，但 NoSuchBlock 不展开
const ok3 = gcdVisible === 4;       // 两个 GCD 块 INSERT 各 2 个点
const ok4 = gcdHiddenFallback === 1;
console.log(`断言 total===9: ${ok1}, fromBlock===8: ${ok2}, gcdVisible===4: ${ok3}, gcdHiddenFallback===1: ${ok4}`);

console.log('\n========== 2) GCJ-02 互转验证 ==========');
// 取广州附近一点做往返测试
const lng = 113.264, lat = 23.129;
const g = wgs84togcj02(lng, lat);
const back = gcj02towgs84(g[0], g[1]);
const err = Math.hypot(back[0] - lng, back[1] - lat);
console.log(`WGS84(${lng},${lat}) -> GCJ02(${g[0].toFixed(6)},${g[1].toFixed(6)}) -> WGS84(${back[0].toFixed(6)},${back[1].toFixed(6)})`);
console.log('往返误差(度):', err.toExponential(3), '| 偏移量(度):', (g[0]-lng).toExponential(3), (g[1]-lat).toExponential(3));
const ok5 = err < 1e-6; // 往返误差应小于约 0.1 米（亚米级即可，GCJ-02 算法本身非完全可逆）
// 境外不偏移
const out = wgs84togcj02(2.3522, 48.8566); // 巴黎
const ok6 = Math.abs(out[0] - 2.3522) < 1e-12 && Math.abs(out[1] - 48.8566) < 1e-12;
console.log(`断言 往返误差<1e-6: ${ok5}, 境外不偏移: ${ok6}`);

const allPass = ok1 && ok2 && ok3 && ok4 && ok5 && ok6;
console.log('\n验证结论:', allPass ? 'ALL_PASS' : 'FAIL');
process.exit(allPass ? 0 : 1);
