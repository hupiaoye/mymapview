// Node ESM 解析钩子：
//  1) 将 'ol' 及其子模块全部重定向到浏览器无关的桩模块，使 dxfParser 可在 Node 下运行；
//  2) 补全相对路径扩展名（dxfParser 内部用 './coordSystems' 形式，浏览器打包器允许但 Node ESM 需要 .js）。
import { pathToFileURL } from 'node:url';

const stubUrl = new URL('./ol-stub.mjs', import.meta.url).href;

export async function resolve(specifier, context, next) {
  if (specifier === 'ol' || specifier.startsWith('ol/')) {
    return { url: stubUrl, shortCircuit: true };
  }
  if (specifier.startsWith('.') && !/\.(js|mjs|cjs|json)$/.test(specifier)) {
    const url = new URL(specifier + '.js', context.parentURL).href;
    return { url, shortCircuit: true };
  }
  return next(specifier, context);
}
