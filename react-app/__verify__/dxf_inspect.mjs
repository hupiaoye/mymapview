// 诊断脚本（任务3(c)）：打印 DXF 结构，用于定位 GCD 高程存储方式。
// 主理人可用它对真实地形图 DXF 做结构分析，从而精确判断高程是存在：
//  - 块的 ATTDEF（tag 列表）/ TEXT / MTEXT 子图元
//  - INSERT 是否带 ATTRIB 实例
//  - 独立 TEXT/MTEXT 实体（按图层统计）
// 用法：node __verify__/dxf_inspect.mjs <path-to.dxf>
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const arg = process.argv[2];
if (!arg) {
  console.error('用法: node __verify__/dxf_inspect.mjs <path-to.dxf>');
  process.exit(2);
}
const path = resolve(process.cwd(), arg);
const text = readFileSync(path, 'latin1'); // DXF 多为 ASCII/GBK；结构扫描不需解码中文
const lines = text.split(/\r?\n/);

/**
 * 从位置 p（lines[p]==='0', lines[p+1]===实体类型）读取一个子实体，
 * 直到遇到下一个 '0' 为止，返回 { type, props, nextP }。
 * props 以组码为键，值为字符串；同一组码出现多次则合并为数组。
 */
function readEntity(lines, p) {
  const type = lines[p + 1].trim();
  const props = {};
  let q = p + 2;
  while (q < lines.length) {
    const c = parseInt(lines[q].trim(), 10);
    const v = q + 1 < lines.length ? lines[q + 1].trim() : '';
    if (c === 0) break;
    if (props[c] === undefined) props[c] = v;
    else if (Array.isArray(props[c])) props[c].push(v);
    else props[c] = [props[c], v];
    q += 2;
  }
  return { type, props, nextP: q };
}

function sampleText(props) {
  const a = props[1];
  const b = props[3];
  return [a, b].filter(x => x != null).join('');
}

// ---- 扫描 BLOCKS 段 ----
function inspectBlocks() {
  const blocks = {};
  let inBlocks = false;
  let cur = null;
  let p = 0;
  while (p < lines.length) {
    const line = lines[p].trim();
    if (line === 'BLOCKS') { inBlocks = true; p++; continue; }
    if (inBlocks && line === 'ENDSEC') break;
    if (inBlocks && line === '0' && p + 1 < lines.length) {
      const type = lines[p + 1].trim();
      if (type === 'BLOCK') {
        const e = readEntity(lines, p);
        cur = {
          name: e.props[2] || '',
          base: [parseFloat(e.props[10]) || 0, parseFloat(e.props[20]) || 0],
          childTypes: [],
          attdefs: [],
          texts: []
        };
        blocks[cur.name] = cur;
        p = e.nextP;
        continue;
      }
      if (type === 'ENDBLK') { cur = null; p += 2; continue; }
      if (cur) {
        const e = readEntity(lines, p);
        cur.childTypes.push(type);
        if (type === 'ATTDEF') cur.attdefs.push({ tag: e.props[2] || '', value: e.props[1] || '' });
        else if (type === 'TEXT' || type === 'MTEXT') cur.texts.push(sampleText(e.props));
        p = e.nextP;
        continue;
      }
    }
    p += 1;
  }
  return blocks;
}

// ---- 扫描 ENTITIES 段 ----
function inspectEntities() {
  const inserts = [];
  const textByLayer = {};
  let p = 0;
  let inEnt = false;
  while (p < lines.length) {
    const line = lines[p].trim();
    if (line === 'ENTITIES') { inEnt = true; p++; continue; }
    if (inEnt && line === 'ENDSEC') break;
    if (inEnt && line === '0' && p + 1 < lines.length) {
      const type = lines[p + 1].trim();
      const e = readEntity(lines, p);
      if (type === 'INSERT') {
        // 检查 INSERT 后是否紧跟 ATTRIB 实例
        let hasAttrib = false;
        let q = e.nextP;
        while (q < lines.length) {
          if (lines[q].trim() !== '0' || q + 1 >= lines.length) break;
          const nt = lines[q + 1].trim();
          if (nt === 'ATTRIB') { hasAttrib = true; const sub = readEntity(lines, q); q = sub.nextP; continue; }
          if (nt === 'SEQEND') { const sub = readEntity(lines, q); q = sub.nextP; break; }
          break;
        }
        inserts.push({ block: e.props[2] || '', layer: e.props[8] || '', hasAttrib });
        p = e.nextP;
        continue;
      }
      if (type === 'TEXT' || type === 'MTEXT') {
        const layer = e.props[8] || '未命名';
        const t = sampleText(e.props);
        if (!textByLayer[layer]) textByLayer[layer] = { count: 0, samples: [] };
        textByLayer[layer].count++;
        if (textByLayer[layer].samples.length < 5) textByLayer[layer].samples.push(t);
        p = e.nextP;
        continue;
      }
      p = e.nextP;
      continue;
    }
    p += 1;
  }
  return { inserts, textByLayer };
}

// ---- 输出 ----
const blocks = inspectBlocks();
const { inserts, textByLayer } = inspectEntities();

console.log('================ DXF 结构诊断报告 ================');
console.log(`\n[ BLOCKS 段 ] 共 ${Object.keys(blocks).length} 个块定义`);
for (const [name, b] of Object.entries(blocks)) {
  const attTags = b.attdefs.map(a => a.tag || '(无tag)').join(', ') || '无';
  const sampleT = b.texts.slice(0, 3).join(' | ') || '无';
  console.log(`\n  块名: ${name}  (基点 ${b.base[0]}, ${b.base[1]})`);
  console.log(`    子图元类型清单: ${b.childTypes.join(', ') || '无'}`);
  console.log(`    含 ATTDEF: ${b.attdefs.length > 0 ? '是' : '否'}  tag列表: [${attTags}]`);
  console.log(`    含 TEXT/MTEXT: ${b.texts.length > 0 ? '是' : '否'}  样例: "${sampleT}"`);
}

console.log(`\n[ ENTITIES 段 - INSERT ] 共 ${inserts.length} 个块参照`);
for (const ins of inserts) {
  console.log(`  引用块: ${ins.block}  图层: ${ins.layer}  带ATTRIB实例: ${ins.hasAttrib ? '是' : '否'}`);
}

console.log(`\n[ ENTITIES 段 - TEXT/MTEXT 按图层统计 ]`);
const layerKeys = Object.keys(textByLayer);
if (layerKeys.length === 0) console.log('  （无 TEXT/MTEXT 实体）');
for (const l of layerKeys) {
  const info = textByLayer[l];
  console.log(`  图层 ${l}: ${info.count} 个, 样例: ${JSON.stringify(info.samples)}`);
}

console.log('\n================ 诊断结束 ================');
