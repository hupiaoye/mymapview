// 由源码生成可在 Node(ESM) 中直接运行的副本：
//  - 将裸 'ol' 子模块名补全为 .js 扩展名（Node ESM 要求显式扩展名）
//  - 将相对导入 './coordSystems' 改为 './coordSystems.mjs'
// 仅用于本地验证，不改动项目源码。
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..'); // react-app

function transform(srcPath, outPath) {
  let s = readFileSync(srcPath, 'utf8');
  // 仅对 dxfParser 调整 'ol' 子模块扩展名与 './coordSystems' 扩展名
  // 注意：'ol' 桶在 Node 中不可直接导入；Feature 在 ol/Feature.js 中是默认导出。
  s = s.replace(/import \{ Feature \} from 'ol';/, "import Feature from 'ol/Feature.js';");
  s = s.replace(/from 'ol\/geom';/g, "from 'ol/geom.js';");
  s = s.replace(/from 'ol\/proj';/g, "from 'ol/proj.js';");
  s = s.replace(/from 'ol\/style';/g, "from 'ol/style.js';");
  s = s.replace(/from '\.\/coordSystems';/g, "from './coordSystems.mjs';");
  writeFileSync(outPath, s, 'utf8');
  console.log('生成副本:', outPath);
}

transform(resolve(root, 'src/utils/dxfParser.js'), resolve(here, 'dxfParser.mjs'));
transform(resolve(root, 'src/utils/coordSystems.js'), resolve(here, 'coordSystems.mjs'));

// 写入 package.json 使本目录按 ESM 处理
writeFileSync(resolve(here, 'package.json'), JSON.stringify({ type: 'module' }, null, 2), 'utf8');
console.log('生成 package.json');
