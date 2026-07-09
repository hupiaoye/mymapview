// 语法检查：对改动的源文件做语法校验。
//  - dxfParser.js / coordSystems.js 为纯 ESM，用 @babel/parser 解析（sourceType=module）
//  - App.js 含 JSX，用 @babel/parser + jsx 插件解析（node --check 无法解析 JSX）
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const root = path.resolve(__dirname, '..');
const targets = [
  ['src/utils/dxfParser.js', []],
  ['src/utils/coordSystems.js', []],
  ['src/App.js', ['jsx']],
];

let allOk = true;
for (const [rel, plugins] of targets) {
  const file = path.join(root, rel);
  const code = fs.readFileSync(file, 'utf8');
  try {
    parser.parse(code, { sourceType: 'module', plugins });
    console.log('OK  语法通过:', rel);
  } catch (e) {
    allOk = false;
    console.log('ERR 语法错误:', rel, '->', e.message);
  }
}
console.log(allOk ? 'ALL_SYNTAX_OK' : 'SYNTAX_FAIL');
process.exit(allOk ? 0 : 1);
