/**
 * 广勘智图内置图标库 — 矢量化地图标记符号
 * 所有图标均为 SVG path 数据，按分类组织。
 * 每个图标: { id, name, category, svg: '<svg>...</svg>', color: 默认色 }
 *
 * 图标尺寸基准：viewBox="0 0 24 24"，渲染时通过 CSS 缩放。
 */

// ─── 辅助：生成标准 <svg> 字符串 ───
function svg(pathData, color = 'currentColor', viewBox = '0 0 24 24') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="24" height="24"><path fill="${color}" d="${pathData}"/></svg>`;
}

function svgMulti(paths, viewBox = '0 0 24 24') {
  const ps = paths.map(p => `<path fill="${p.fill || 'currentColor'}" d="${p.d}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="24" height="24">${ps}</svg>`;
}

// ═══════════════════════════════════════
//  分类定义
// ═══════════════════════════════════════
export const ICON_CATEGORIES = [
  { id: 'pin',       name: '图钉标记' },
  { id: 'flag',      name: '旗帜' },
  { id: 'location',  name: '位置定位' },
  { id: 'transport', name: '交通出行' },
  { id: 'building',  name: '建筑场所' },
  { id: 'nature',    name: '自然地理' },
  { id: 'service',   name: '生活服务' },
  { id: 'symbol',    name: '符号标注' },
  { id: 'activity',  name: '活动休闲' },
  { id: 'emergency', name: '紧急警示' },
  { id: 'shape',     name: '几何形状' },
];

// ═══════════════════════════════════════
//  图标数据
// ═══════════════════════════════════════
export const ICON_LIBRARY = [

  // ─────────────────────────────────────
  //  📌 图钉标记 (pin)
  // ─────────────────────────────────────
  { id: 'pin-red',      name: '红图钉',     category: 'pin',       color: '#E91E63',
    svg: svg('M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z','#E91E63') },
  { id: 'pin-green',    name: '绿图钉',     category: 'pin',       color: '#4CAF50',
    svg: svg('M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z','#4CAF50') },
  { id: 'pin-blue',     name: '蓝图钉',     category: 'pin',       color: '#2196F3',
    svg: svg('M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z','#2196F3') },
  { id: 'pin-yellow',   name: '黄图钉',     category: 'pin',       color: '#FFC107',
    svg: svg('M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z','#FFC107') },
  { id: 'pin-purple',   name: '紫图钉',     category: 'pin',       color: '#9C27B0',
    svg: svg('M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z','#9C27B0') },
  { id: 'pin-orange',   name: '橙图钉',     category: 'pin',       color: '#FF5722',
    svg: svg('M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z','#FF5722') },
  { id: 'pin-cyan',     name: '青图钉',     category: 'pin',       color: '#00BCD4',
    svg: svg('M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z','#00BCD4') },
  { id: 'pin-lime',     name: '柠图钉',     category: 'pin',       color: '#CDDC39',
    svg: svg('M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z','#CDDC39') },
  { id: 'pin-gray',     name: '灰图钉',     category: 'pin',       color: '#9E9E9E',
    svg: svg('M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z','#9E9E9E') },
  // 圆头图钉 (push-pin style)
  { id: 'pushpin-pink',   name: '粉圆头钉',  category: 'pin',       color: '#F06292',
    svg: svgMulti([
      {d:'M16 12V4H8v8l-2 2v2h5v6h2v-6h5v-2l-2-2z',fill:'#F06292'},
      {d:'M12 2a2 2 0 100 4 2 2 0 000-4z',fill:'#E91E63'}
    ]) },
  { id: 'pushpin-green',  name: '绿圆头钉',  category: 'pin',       color: '#81C784',
    svg: svgMulti([
      {d:'M16 12V4H8v8l-2 2v2h5v6h2v-6h5v-2l-2-2z',fill:'#81C784'},
      {d:'M12 2a2 2 0 100 4 2 2 0 000-4z',fill:'#4CAF50'}
    ]) },
  { id: 'pushpin-yellow', name: '黄圆头钉',  category: 'pin',       color: '#FFF176',
    svg: svgMulti([
      {d:'M16 12V4H8v8l-2 2v2h5v6h2v-6h5v-2l-2-2z',fill:'#FFF176'},
      {d:'M12 2a2 2 0 100 4 2 2 0 000-4z',fill:'#FFC107'}
    ]) },
  { id: 'pushpin-blue',   name: '蓝圆头钉',  category: 'pin',       color: '#64B5F6',
    svg: svgMulti([
      {d:'M16 12V4H8v8l-2 2v2h5v6h2v-6h5v-2l-2-2z',fill:'#64B5F6'},
      {d:'M12 2a2 2 0 100 4 2 2 0 000-4z',fill:'#2196F3'}
    ]) },
  { id: 'pushpin-purple', name: '紫圆头钉',  category: 'pin',       color: '#BA68C8',
    svg: svgMulti([
      {d:'M16 12V4H8v8l-2 2v2h5v6h2v-6h5v-2l-2-2z',fill:'#BA68C8'},
      {d:'M12 2a2 2 0 100 4 2 2 0 000-4z',fill:'#9C27B0'}
    ]) },
  { id: 'pushpin-orange', name: '橙圆头钉',  category: 'pin',       color: '#FF8A65',
    svg: svgMulti([
      {d:'M16 12V4H8v8l-2 2v2h5v6h2v-6h5v-2l-2-2z',fill:'#FF8A65'},
      {d:'M12 2a2 2 0 100 4 2 2 0 000-4z',fill:'#FF5722'}
    ]) },

  // ─────────────────────────────────────
  //  🚩 旗帜 (flag)
  // ─────────────────────────────────────
  { id: 'flag-red',     name: '红旗',     category: 'flag',      color: '#F44336',
    svg: svgMulti([{d:'M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z',fill:'#F44336'}]) },
  { id: 'flag-green',   name: '绿旗',     category: 'flag',      color: '#4CAF50',
    svg: svgMulti([{d:'M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z',fill:'#4CAF50'}]) },
  { id: 'flag-blue',    name: '蓝旗',     category: 'flag',      color: '#2196F3',
    svg: svgMulti([{d:'M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z',fill:'#2196F3'}]) },
  { id: 'flag-pink',    name: '粉旗',     category: 'flag',      color: '#E91E63',
    svg: svgMulti([{d:'M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z',fill:'#E91E63'}]) },
  { id: 'flag-yellow',  name: '黄旗',     category: 'flag',      color: '#FFC107',
    svg: svgMulti([{d:'M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z',fill:'#FFC107'}]) },
  { id: 'flag-cyan',    name: '青旗',     category: 'flag',      color: '#00BCD4',
    svg: svgMulti([{d:'M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z',fill:'#00BCD4'}]) },
  { id: 'flag-purple',  name: '紫旗',     category: 'flag',      color: '#9C27B0',
    svg: svgMulti([{d:'M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z',fill:'#9C27B0'}]) },
  { id: 'flag-orange',  name: '橙旗',     category: 'flag',      color: '#FF5722',
    svg: svgMulti([{d:'M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z',fill:'#FF5722'}]) },
  // 三角旗
  { id: 'tri-flag-red',    name: '三角红旗', category: 'flag',   color: '#EF5350',
    svg: svgMulti([{d:'M5 21V4h1l10 6-10 6z',fill:'#EF5350'}, {d:'M4 21h2V4H4z',fill:'#BDBDBD'}]) },
  { id: 'tri-flag-green',  name: '三角绿旗', category: 'flag',   color: '#66BB6A',
    svg: svgMulti([{d:'M5 21V4h1l10 6-10 6z',fill:'#66BB6A'}, {d:'M4 21h2V4H4z',fill:'#BDBDBD'}]) },
  { id: 'tri-flag-blue',   name: '三角蓝旗', category: 'flag',   color: '#42A5F5',
    svg: svgMulti([{d:'M5 21V4h1l10 6-10 6z',fill:'#42A5F5'}, {d:'M4 21h2V4H4z',fill:'#BDBDBD'}]) },
  { id: 'tri-flag-yellow', name: '三角黄旗', category: 'flag',   color: '#FFEE58',
    svg: svgMulti([{d:'M5 21V4h1l10 6-10 6z',fill:'#FFEE58'}, {d:'M4 21h2V4H4z',fill:'#BDBDBD'}]) },
  { id: 'tri-flag-pink',   name: '三角粉旗', category: 'flag',   color: '#F06292',
    svg: svgMulti([{d:'M5 21V4h1l10 6-10 6z',fill:'#F06292'}, {d:'M4 21h2V4H4z',fill:'#BDBDBD'}]) },

  // ─────────────────────────────────────
  //  📍 位置定位 (location)
  // ─────────────────────────────────────
  { id: 'loc-pink',    name: '粉定位点',  category: 'location',  color: '#E91E63',
    svg: svg('M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z') },
  { id: 'loc-green',   name: '绿定位点',  category: 'location',  color: '#4CAF50',
    svg: svg('M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z') },
  { id: 'loc-blue',    name: '蓝定位点',  category: 'location',  color: '#2196F3',
    svg: svg('M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z') },
  { id: 'loc-cyan',    name: '青定位点',  category: 'location',  color: '#00BCD4',
    svg: svg('M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z') },
  { id: 'loc-purple',  name: '紫定位点',  category: 'location',  color: '#9C27B0',
    svg: svg('M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z') },
  { id: 'loc-star',    name: '星标定位',  category: 'location',  color: '#2196F3',
    svg: svgMulti([
      {d:'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',fill:'#2196F3'},
      {d:'M12 6.5l1.2 2.4 2.7.4-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.4z',fill:'#FFEB3B'}
    ]) },
  { id: 'loc-circle',  name: '圆标定位',  category: 'location',  color: '#4CAF50',
    svg: svgMulti([
      {d:'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',fill:'#4CAF50'},
      {d:'M12 7.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z',fill:'#FFF'}
    ]) },
  { id: 'loc-diamond', name: '菱标定位',  category: 'location',  color: '#FF5722',
    svg: svgMulti([
      {d:'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',fill:'#FF5722'},
      {d:'M12 6l3 4-3 4-3-4z',fill:'#FFF'}
    ]) },

  // ─────────────────────────────────────
  //  🚗 交通出行 (transport)
  // ─────────────────────────────────────
  { id: 'car',        name: '汽车',     category: 'transport', color: '#1976D2',
    svg: svg('M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z') },
  { id: 'truck',      name: '卡车',     category: 'transport', color: '#607D8B',
    svg: svg('M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z') },
  { id: 'train',      name: '火车',     category: 'transport', color: '#3F51B5',
    svg: svg('M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-6H6V6h5v5zm2 0V6h5v5h-5zm3.5 6c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z') },
  { id: 'bus',        name: '公交',     category: 'transport', color: '#009688',
    svg: svg('M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4S4 2.5 4 6v10zm9 2H11v-2h2v2zm-6 0H5v-2h2v2zm1.5-7c-.83 0-1.5-.67-1.5-1.5S7.67 8 8.5 8s1.5.67 1.5 1.5S9.33 11 8.5 11zm7 0c-.83 0-1.5-.67-1.5-1.5S14.67 8 15.5 8s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z') },
  { id: 'plane',      name: '飞机',     category: 'transport', color: '#795548',
    svg: svg('M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z') },
  { id: 'bicycle',    name: '自行车',   category: 'transport', color: '#607D8B',
    svg: svg('M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm5.8-10l2.4-2.4.8.8c1.3 1.3 3 2.1 5.1 2.1V9c-1.5 0-2.7-.6-3.6-1.5l-1.9-1.9c-.5-.4-1.1-.6-1.7-.6-.7 0-1.4.3-1.9.9l-2.4 2.4 2.2 2.2zM19 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z') },
  { id: 'motorcycle',name: '摩托车',   category: 'transport', color: '#455A64',
    svg: svg('M19.44 9.03L15.41 5H11v2h3.59l2 2H5c-2.76 0-5 2.24-5 5s2.24 5 5 5c2.42 0 4.44-1.72 4.9-4h2.2c.46 2.28 2.48 4 4.9 4 2.76 0 5-2.24 5-5 0-1.65-.8-3.11-2.03-4.03zM7.5 17c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5zm9 0c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z') },
  { id: 'boat',       name: '帆船',     category: 'transport', color: '#03A9F4',
    svg: svgMulti([{d:'M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.34-.42-.6-.5L20 10.62V4c0-.55-.45-1-1-1h-3V1H9v2H6c-.55 0-1 .45-1 1v6.62l-1.29.42c-.26.08-.48.26-.6.5s-.15.52-.06.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z',fill:'#03A9F4'}]) },
  { id: 'anchor',     name: '锚',       category: 'transport', color: '#455A64',
    svg: svg('M17 15h-1v-4c0-1.1-.9-2-2-2h-3v2h3v4h-4v-2H9v4h4v3h2v-3h2v-2zm-5-9a2 2 0 100-4 2 2 0 000 4z') },
  { id: 'parking',    name: '停车场',   category: 'transport', color: '#1976D2',
    svg: svg('M13 3H6v18h4.5h8c1.93 0 3.5-1.57 3.5-3.5 0-1.58-1.05-2.91-2.49-3.35C20.31 13.94 21 12.8 21 11.5c0-1.93-1.57-3.5-3.5-3.5H13zM11 5h6.5c.83 0 1.5.67 1.5 1.5S18.33 8 17.5 8H11V5zm0 5h6.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5H11v-3z') },

  // ─────────────────────────────────────
  //  🏠 建筑场所 (building)
  // ─────────────────────────────────────
  { id: 'house',      name: '房屋',     category: 'building',  color: '#795548',
    svg: svg('M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z') },
  { id: 'office',     name: '办公楼',   category: 'building',  color: '#607D8B',
    svg: svg('M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z') },
  { id: 'factory',    name: '工厂',     category: 'building',  color: '#455A64',
    svg: svg('M2 22V8l7 4V8l7 4V2h6v20H2zm4-4h2v-4H6v4zm4 0h2v-4h-2v4zm4 0h2v-4h-2v4z') },
  { id: 'school',     name: '学校',     category: 'building',  color: '#F44336',
    svg: svg('M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z') },
  { id: 'hospital',   name: '医院',     category: 'building',  color: '#F44336',
    svg: svgMulti([{d:'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z',fill:'#F44336'}]) },
  { id: 'bank',       name: '银行',     category: 'building',  color: '#1976D2',
    svg: svgMulti([{d:'M4 10v7h3v-7H4zm6 0v7h3v-7h-3zM2 22h19v-3H2v3zm14-12v7h3v-7h-3zm-4.5-9L2 6h19l-9.5-5z',fill:'#1976D2'}]) },
  { id: 'gate',       name: '城门',     category: 'building',  color: '#795548',
    svg: svg('M2 20h20v-2H2v2zm2-4h2v-8H4v8zm4 0h2V8H8v8zm4 0h2V6h-2v10zm4 0h2V8h-2v8zm4 0h2v-8h-2v8zM2 4h20v2H2V4z') },
  { id: 'tower',      name: '塔',       category: 'building',  color: '#795548',
    svg: svg('M12 2L4 7v2h16V7L12 2zM5 11v10h3v-6h8v6h3V11H5z') },
  { id: 'bridge',     name: '桥梁',     category: 'building',  color: '#607D8B',
    svg: svg('M2 20h20v-2H2v2zm2-4h2v-6H4v6zm4 0h2v-8H8v8zm4 0h2V8h-2v8zm4 0h2v-6h-2v6zm4 0h2v-8h-2v8z') },

  // ─────────────────────────────────────
  //  🌲 自然地理 (nature)
  // ─────────────────────────────────────
  { id: 'tree',       name: '树木',     category: 'nature',    color: '#4CAF50',
    svg: svgMulti([{d:'M12 2L4 20h16L12 2z',fill:'#4CAF50'},{d:'M12 8l-4 8h8l-4-8z',fill:'#81C784'}]) },
  { id: 'pine',       name: '松树',     category: 'nature',    color: '#388E3C',
    svg: svgMulti([{d:'M12 2L4 12h3l-4 8h16l-4-8h3L12 2z',fill:'#388E3C'},{d:'M10 20h4v2h-4z',fill:'#795548'}]) },
  { id: 'mountain',   name: '山峰',     category: 'nature',    color: '#795548',
    svg: svgMulti([{d:'M14 6l-3.8 5-2.2-3-6.5 9h18L14 6z',fill:'#A1887F'},{d:'M22 17L14 6l-4.5 6L7 8l-5 9h20z',fill:'#8D6E63'}], '0 0 24 24') },
  { id: 'mountain-snow', name: '雪山',  category: 'nature',    color: '#90A4AE',
    svg: svgMulti([{d:'M14 6l-3.8 5-2.2-3-6.5 9h18L14 6z',fill:'#90A4AE'},{d:'M14 6l-2 2.7L10 6l-1.5 2L7 5l-3 5 2 2-4.5 7H22L14 6z',fill:'#ECEFF1'},{d:'M14 6l-3 4 2 3-5 4h18L14 6z',fill:'#B0BEC5'}], '0 0 24 24') },
  { id: 'water',      name: '水源',     category: 'nature',    color: '#03A9F4',
    svg: svg('M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2C20 10.48 17.33 6.55 12 2zm0 18c-3.35 0-6-2.57-6-6.2 0-2.34 1.95-5.44 6-9.14 4.05 3.7 6 6.79 6 9.14 0 3.63-2.65 6.2-6 6.2z') },
  { id: 'volcano',    name: '火山',     category: 'nature',    color: '#FF5722',
    svg: svgMulti([{d:'M12 2L2 20h20L12 2z',fill:'#FF7043'},{d:'M12 8l-5 8h10l-5-8z',fill:'#FFC107'},{d:'M12 12l-2 3h4l-2-3z',fill:'#FFF'}], '0 0 24 24') },
  { id: 'camping',    name: '露营',     category: 'nature',    color: '#8D6E63',
    svg: svgMulti([{d:'M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z',fill:'#8D6E63'},{d:'M13 15h-2v-2h2v2z',fill:'#FFC107'}], '0 0 24 24') },
  { id: 'sun',        name: '太阳',     category: 'nature',    color: '#FFC107',
    svg: svg('M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l-1.41 1.41 1.79 1.8 1.41-1.41-1.79-1.8z') },
  { id: 'cloud',      name: '多云',     category: 'nature',    color: '#90A4AE',
    svg: svgMulti([{d:'M19.35 10.04A7.49 7.49 0 0012 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 000 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z',fill:'#90A4AE'}]) },
  { id: 'wave',       name: '波浪',     category: 'nature',    color: '#03A9F4',
    svg: svg('M2 16c1.5 0 2.5-1.2 4-1.2s2.5 1.2 4 1.2 2.5-1.2 4-1.2 2.5 1.2 4 1.2v3c-1.5 0-2.5-1.2-4-1.2s-2.5 1.2-4 1.2-2.5-1.2-4-1.2-2.5 1.2-4 1.2v-3z') },
  { id: 'snowflake',  name: '雪花',     category: 'nature',    color: '#03A9F4',
    svg: svg('M22 11h-4.17l3.24-3.24-1.41-1.41L15 11h-2V9l4.66-4.66-1.42-1.41L13 6.17V2h-2v4.17L7.76 2.93 6.34 4.34 11 9v2H9L4.34 6.34 2.93 7.76 6.17 11H2v2h4.17l-3.24 3.24 1.41 1.41L9 13h2v2l-4.66 4.66 1.42 1.41L11 17.83V22h2v-4.17l3.24 3.24 1.41-1.41L13 15v-2h2l4.66 4.66 1.41-1.41L17.83 13H22z') },

  // ─────────────────────────────────────
  //  🔧 生活服务 (service)
  // ─────────────────────────────────────
  { id: 'restaurant', name: '餐厅',     category: 'service',   color: '#FF5722',
    svg: svgMulti([{d:'M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z',fill:'#FF5722'}]) },
  { id: 'coffee',     name: '咖啡',     category: 'service',   color: '#795548',
    svg: svg('M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.11 0 2-.9 2-2V5c0-1.11-.89-2-2-2zm0 5h-2V5h2v3zM2 21h18v-2H2v2z') },
  { id: 'shopping',   name: '购物',     category: 'service',   color: '#FF9800',
    svg: svg('M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm7 15H5V8h14v10zm-7-5c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z') },
  { id: 'gas',        name: '加油站',   category: 'service',   color: '#FF5722',
    svg: svg('M19.77 7.23l.01-.01-3.72-3.72L15 4.56l2.11 2.11c-.94.36-1.61 1.26-1.61 2.33 0 1.38 1.12 2.5 2.5 2.5.36 0 .69-.08 1-.21v7.21c0 .55-.45 1-1 1s-1-.45-1-1V14c0-1.1-.9-2-2-2h-1V5c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2v16h10v-7.5h1.5v5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V9c0-.69-.28-1.32-.73-1.77zM12 10H6V5h6v5zm0 6H6v-5h6v5z') },
  { id: 'phone',      name: '电话',     category: 'service',   color: '#4CAF50',
    svg: svg('M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z') },
  { id: 'atm',        name: '银行ATM',  category: 'service',   color: '#1976D2',
    svg: svgMulti([{d:'M11 17h2v-1h1c1.1 0 2-.9 2-2v-2c0-1.1-.9-2-2-2h-3V9h5V7h-6c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h3v1H9v2h2v2zm4-4h-3v-1h3v1z',fill:'#1976D2'},{d:'M3 4h18v16H3V4zm2 2v12h14V6H5z',fill:'#90A4AE'}]) },
  { id: 'hotel',      name: '酒店',     category: 'service',   color: '#009688',
    svg: svg('M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4zm0 8c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z') },
  { id: 'bed',        name: '住宿',     category: 'service',   color: '#9C27B0',
    svg: svg('M20 10V7c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2v3c-1.1 0-2 .9-2 2v5h1.33L4 19h1l.67-2h12.67l.66 2h1l.67-2H22v-5c0-1.1-.9-2-2-2zm-9 0H6V7h5v3zm7 0h-5V7h5v3z') },
  { id: 'camera',     name: '相机',     category: 'service',   color: '#607D8B',
    svg: svg('M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z') },
  { id: 'music',      name: '音乐',     category: 'service',   color: '#E91E63',
    svg: svg('M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 16.5S7.79 20 9.5 20s3.5-1.79 3.5-3.5V6h5V3h-6z') },
  { id: 'tv',         name: '电视',     category: 'service',   color: '#607D8B',
    svg: svg('M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z') },

  // ─────────────────────────────────────
  //  🔰 符号标注 (symbol)
  // ─────────────────────────────────────
  { id: 'info',       name: '信息',     category: 'symbol',    color: '#2196F3',
    svg: svg('M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z') },
  { id: 'question',   name: '疑问',     category: 'symbol',    color: '#FF9800',
    svg: svg('M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2c0-1.45.72-2.71 1.85-3.78l1.23-1.27c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z') },
  { id: 'warning',    name: '警告',     category: 'symbol',    color: '#FFC107',
    svg: svg('M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z') },
  { id: 'error',      name: '错误',     category: 'symbol',    color: '#F44336',
    svg: svg('M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z') },
  { id: 'check',      name: '对勾',     category: 'symbol',    color: '#4CAF50',
    svg: svg('M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z') },
  { id: 'star',       name: '五角星',   category: 'symbol',    color: '#FFC107',
    svg: svg('M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z') },
  { id: 'heart',      name: '爱心',     category: 'symbol',    color: '#E91E63',
    svg: svg('M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z') },
  { id: 'cross',      name: '十字',     category: 'symbol',    color: '#F44336',
    svg: svg('M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z') },
  { id: 'no-entry',   name: '禁止',     category: 'symbol',    color: '#F44336',
    svg: svg('M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z') },
  { id: 'arrow-down', name: '下箭头',   category: 'symbol',    color: '#607D8B',
    svg: svg('M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z') },
  { id: 'refresh',    name: '刷新',     category: 'symbol',    color: '#2196F3',
    svg: svg('M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z') },
  { id: 'speaker',    name: '喇叭',     category: 'symbol',    color: '#607D8B',
    svg: svg('M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z') },
  { id: 'mail',       name: '邮件',     category: 'symbol',    color: '#FF5722',
    svg: svg('M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z') },

  // ─────────────────────────────────────
  //  ⚽ 活动休闲 (activity)
  // ─────────────────────────────────────
  { id: 'golf',       name: '高尔夫',   category: 'activity',  color: '#4CAF50',
    svg: svgMulti([{d:'M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.56 3.61 2.56s2.98-1.06 3.61-2.56C17.08 12.63 19 10.55 19 8V7c0-1.1-.9-2-2-2zM7 10c-1.1 0-2-.9-2-2h2v2zm5 3c-1.48 0-2.75-.81-3.45-2h6.9c-.7 1.19-1.97 2-3.45 2zm5-3V8h2c0 1.1-.9 2-2 2z',fill:'#4CAF50'}]) },
  { id: 'run',        name: '跑步',     category: 'activity',  color: '#FF5722',
    svg: svg('M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13.5 19 13.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8.5z') },
  { id: 'group',      name: '人群',     category: 'activity',  color: '#3F51B5',
    svg: svg('M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z') },
  { id: 'picnic',     name: '野餐',     category: 'activity',  color: '#8D6E63',
    svg: svgMulti([{d:'M2 20h20v-2H2v2zm2-4h14v-2H4v2zm2-4h10v-2H6v2zm2-4h6V6H8v2z',fill:'#8D6E63'}]) },
  { id: 'fishing',    name: '钓鱼',     category: 'activity',  color: '#03A9F4',
    svg: svg('M20.26 2.74c-.35-.35-.92-.35-1.27 0l-2.83 2.83-5.66-5.66a1.5 1.5 0 00-2.12 0L6 2.29l8.48 8.48-1.41 1.42 1.41 1.41 1.42-1.41 2.12 2.12c.39.39 1.02.39 1.41 0l2.12-2.12a1 1 0 000-1.41l-2.12-2.12 2.83-2.83c.35-.35.35-.92 0-1.27zM6 21l4.24-4.24L6 12.52V21z') },

  // ─────────────────────────────────────
  //  🚨 紧急警示 (emergency)
  // ─────────────────────────────────────
  { id: 'fire',       name: '火灾',     category: 'emergency', color: '#FF5722',
    svg: svg('M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z') },
  { id: 'danger',     name: '危险',     category: 'emergency', color: '#F44336',
    svg: svg('M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z') },
  { id: 'first-aid', name: '急救',     category: 'emergency', color: '#FFFFFF',
    svg: svgMulti([{d:'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z',fill:'#F44336'},{d:'M10 13h4v-2h-4v2zm0-4h4V7h-4v2z',fill:'#FFF'}], '0 0 24 24') },
  { id: 'police',     name: '警务',     category: 'emergency', color: '#3F51B5',
    svg: svgMulti([{d:'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z',fill:'#3F51B5'}]) },
  { id: 'accessibility',name: '无障碍',category: 'emergency',color: '#009688',
    svg: svg('M12 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm9 7h-6v13h-2v-6h-2v6H9V9H1V7h2V4h2v3h2V4h2v3h2V4h2v3h2v2z') },

  // ─────────────────────────────────────
  //  ◆ 几何形状 (shape) — 用于自定义标注
  // ─────────────────────────────────────
  { id: 'circle',     name: '圆形',     category: 'shape',     color: '#2196F3',
    svg: svg('M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z') },
  { id: 'circle-fill',name: '实心圆',   category: 'shape',     color: '#2196F3',
    svg: svg('M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10S17.52 2 12 2z') },
  { id: 'square',     name: '方形',     category: 'shape',     color: '#9C27B0',
    svg: svg('M3 3h18v18H3z') },
  { id: 'square-fill',name: '实心方',   category: 'shape',     color: '#9C27B0',
    svg: svg('M3 3h18v18H3z') },
  { id: 'diamond',    name: '菱形',     category: 'shape',     color: '#FF5722',
    svg: svg('M12 2L2 12l10 10 10-10L12 2z') },
  { id: 'triangle',   name: '三角形',   category: 'shape',     color: '#FFC107',
    svg: svg('M12 2L2 22h20L12 2z') },
  { id: 'triangle-up',name: '上箭头',   category: 'shape',     color: '#4CAF50',
    svg: svg('M12 4l-8 16h16L12 4z') },
  { id: 'hexagon',    name: '六边形',   category: 'shape',     color: '#009688',
    svg: svg('M12 2l9 4.5v9L12 20l-9-4.5v-9L12 2z') },
  { id: 'star-outline',name: '空心星',  category: 'shape',     color: '#FFC107',
    svg: svg('M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 15.9 18.18 21l-1.64-7.03L22 9.24zM12 13.5l-2.12 2.12 1.41 6.06L12 18.9l.71 2.78 1.41-6.06L12 13.5z') },
  { id: 'target',     name: '靶心',     category: 'shape',     color: '#F44336',
    svg: svgMulti([{d:'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z',fill:'#F44336'},{d:'M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z',fill:'#F44336'},{d:'M12 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',fill:'#F44336'}]) },
  { id: 'dot',        name: '圆点',     category: 'shape',     color: '#F44336',
    svg: svg('M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2z') },

  // ─────────────────────────────────────
  //  💰 货币与工具
  // ─────────────────────────────────────
  { id: 'yen',        name: '人民币',   category: 'service',   color: '#4CAF50',
    svg: svg('M13.92 11h-2.58V8.5h2.58c.79 0 1.42-.63 1.42-1.42s-.63-1.42-1.42-1.42h-1.84l1.94-3.35c.39-.67.17-1.53-.5-1.92-.67-.39-1.53-.17-1.92.5L9.5 5.66 8.38 3.31c-.39-.67-1.25-.89-1.92-.5-.67.39-.89 1.25-.5 1.92L7.9 5.66H6.08c-.79 0-1.42.63-1.42 1.42s.63 1.42 1.42 1.42h2.58V11H6.08c-.79 0-1.42.63-1.42 1.42s.63 1.42 1.42 1.42h2.58V17h1.5v-4.16h2.58c.79 0 1.42-.63 1.42-1.42s-.63-1.42-1.42-1.42z') },
  { id: 'euro',       name: '欧元',     category: 'service',   color: '#2196F3',
    svg: svg('M15 18.5A2.5 2.5 0 0112.5 16h-1A3.5 3.5 0 0015 19.5a3.5 3.5 0 003.5-3.5h-1a2.5 2.5 0 01-2.5 2.5zM7.5 4H6v2H4v1.5h2v5c0 1.93 1.57 3.5 3.5 3.5h2v-1.5h-2A2 2 0 017.5 12V7.5H11V6H7.5V4zm9 0h-1.5A3.5 3.5 0 0012 7.5V9a2 2 0 012 2h2v1.5h-2A3.5 3.5 0 0015.5 16H17v1.5h-1.5A5 5 0 0110.5 12.5V10a3.5 3.5 0 013.5-3.5H16V5h-.5A5 5 0 0010.5 10v2.5A6.5 6.5 0 0017 19h1v-1.5a5 5 0 01-1.5-3.5z') },
  { id: 'dollar',     name: '美元',     category: 'service',   color: '#4CAF50',
    svg: svg('M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z') },
  { id: 'wrench',     name: '扳手',     category: 'service',   color: '#607D8B',
    svg: svg('M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z') },
  { id: 'basket',     name: '篮子',     category: 'service',   color: '#FF9800',
    svg: svg('M18 6h-2c0-2.21-1.79-4-4-4S8 3.79 8 6H6c-1.1 0-2 .9-2 2v1h16V8c0-1.1-.9-2-2-2zM4 19h16c1.1 0 2-.9 2-2v-5H2v5c0 1.1.9 2 2 2zm4.09-4.5L10.5 17h3l2.41-2.5H8.09z') },

  // ─────────────────────────────────────
  //  💬 对话气泡
  // ─────────────────────────────────────
  { id: 'bubble-pink',   name: '粉气泡',  category: 'symbol',  color: '#E91E63',
    svg: svgMulti([{d:'M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z',fill:'#E91E63'}]) },
  { id: 'bubble-blue',   name: '蓝气泡',  category: 'symbol',  color: '#2196F3',
    svg: svgMulti([{d:'M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z',fill:'#2196F3'}]) },
  { id: 'balloon-pink',  name: '粉气球',  category: 'symbol',  color: '#F06292',
    svg: svgMulti([{d:'M12 2c-2.76 0-5 2.24-5 5 0 2.4 1.68 4.4 3.93 4.9V16H9v2h2v2h2v-2h2v-2h-1.93v-4.1C17.32 11.4 19 9.4 19 7c0-2.76-2.24-5-5-5z',fill:'#F06292'},{d:'M12 4c-1.66 0-3 1.34-3 3 0 1.66 1.34 3 3 3s3-1.34 3-3-1.34-3-3-3z',fill:'#FCE4EC'}]) },
  { id: 'balloon-blue',  name: '蓝气球',  category: 'symbol',  color: '#64B5F6',
    svg: svgMulti([{d:'M12 2c-2.76 0-5 2.24-5 5 0 2.4 1.68 4.4 3.93 4.9V16H9v2h2v2h2v-2h2v-2h-1.93v-4.1C17.32 11.4 19 9.4 19 7c0-2.76-2.24-5-5-5z',fill:'#64B5F6'},{d:'M12 4c-1.66 0-3 1.34-3 3 0 1.66 1.34 3 3 3s3-1.34 3-3-1.34-3-3-3z',fill:'#E3F2FD'}]) },
  { id: 'balloon-green', name: '绿气球', category: 'symbol',  color: '#81C784',
    svg: svgMulti([{d:'M12 2c-2.76 0-5 2.24-5 5 0 2.4 1.68 4.4 3.93 4.9V16H9v2h2v2h2v-2h2v-2h-1.93v-4.1C17.32 11.4 19 9.4 19 7c0-2.76-2.24-5-5-5z',fill:'#81C784'},{d:'M12 4c-1.66 0-3 1.34-3 3 0 1.66 1.34 3 3 3s3-1.34 3-3-1.34-3-3-3z',fill:'#E8F5E9'}]) },

  // ─────────────────────────────────────
  //  特殊地标（截图末排）
  // ─────────────────────────────────────
  { id: 'building-red',   name: '红色大楼', category: 'building', color: '#E53935',
    svg: svg('M4 22h16V8l-8-4-8 4v14zm2-4h3v-3H6v3zm5 0h3v-3h-3v3zm5 0h3v-3h-3v3z') },
  { id: 'building-orange',name: '橙色大楼', category: 'building', color: '#FB8C00',
    svg: svg('M4 22h16V8l-8-4-8 4v14zm2-4h3v-3H6v3zm5 0h3v-3h-3v3zm5 0h3v-3h-3v3z') },
  { id: 'building-blue',  name: '蓝色大楼', category: 'building', color: '#1E88E5',
    svg: svg('M4 22h16V8l-8-4-8 4v14zm2-4h3v-3H6v3zm5 0h3v-3h-3v3zm5 0h3v-3h-3v3z') },
  { id: 'landmark-tower', name: '地标塔',  category: 'building', color: '#795548',
    svg: svgMulti([{d:'M12 2L4 6v2h16V6L12 2z',fill:'#795548'},{d:'M6 8v10h3V8H6zm4.5 0v10h3V8h-3zM17 8v10h3V8h-3z',fill:'#8D6E63'},{d:'M10 18h4v2h-4z',fill:'#5D4037'}]) },
  { id: 'temple',       name: '寺庙',     category: 'building', color: '#D32F2F',
    svg: svgMulti([{d:'M12 2L3 7v2h18V7L12 2zM5 9v10h3V9H5zm5.5 0v10h3V9h-3zM17 9v10h3V9h-3z',fill:'#D32F2F'},{d:'M10 19h4v2h-4z',fill:'#B71C1C'},{d:'M11 12h2v3h-2z',fill:'#FFC107'}], '0 0 24 24') },
  { id: 'bridge-red',  name: '红桥',     category: 'building', color: '#E53935',
    svg: svgMulti([{d:'M2 20h20v-2H2v2zm1-4h3V8H3v8zm5 0h3V6H8v12zm5 0h3V8h-3v12zm5 0h3V6h-3v12zm5 0h3V8h-3z',fill:'#E53935'}]) },
  { id: 'peak-red',    name: '红峰',     category: 'nature',   color: '#E53935',
    svg: svgMulti([{d:'M12 2L2 16h20L12 2z',fill:'#E53935'},{d:'M12 6L5 16h14L12 6z',fill:'#EF5350'}], '0 0 24 24') },
  { id: 'hospital-h',  name: '医院H',    category: 'building', color: '#FFFFFF',
    svg: svgMulti([{d:'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z',fill:'#F44336'},{d:'M11 7h2v4h4v2h-4v4h-2v-4H7v-2h4V7z',fill:'#FFF'}]) },
  { id: 'peak-triangle',name: '三角峰',   category: 'nature',   color: '#E53935',
    svg: svgMulti([{d:'M12 2L2 20h20L12 2z',fill:'#E53935'},{d:'M12 6l-7 11h14L12 6z',fill:'#FFC107'}], '0 0 24 24') },

  // ─────────────────────────────────────
  //  更多彩色定位标记（截图中各种颜色的菱形/星形标记）
  // ─────────────────────────────────────
  { id: 'marker-diamond-y', name: '黄菱标记', category: 'location', color: '#FFEB3B',
    svg: svgMulti([{d:'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',fill:'#FBC02D'},{d:'M12 6l4 5-4 5-4-5z',fill:'#FFEB3B'}]) },
  { id: 'marker-diamond-g',  name: '绿菱标记', category: 'location', color: '#4CAF50',
    svg: svgMulti([{d:'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',fill:'#388E3C'},{d:'M12 6l4 5-4 5-4-5z',fill:'#81C784'}]) },
  { id: 'marker-diamond-c',  name: '青菱标记', category: 'location', color: '#00BCD4',
    svg: svgMulti([{d:'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',fill:'#0097A7'},{d:'M12 6l4 5-4 5-4-5z',fill:'#4DD0E1'}]) },
  { id: 'marker-diamond-p',  name: '紫菱标记', category: 'location', color: '#9C27B0',
    svg: svgMulti([{d:'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',fill:'#7B1FA2'},{d:'M12 6l4 5-4 5-4-5z',fill:'#CE93D8'}]) },
  { id: 'marker-diamond-r',  name: '红菱标记', category: 'location', color: '#E91E63',
    svg: svgMulti([{d:'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',fill:'#C2185B'},{d:'M12 6l4 5-4 5-4-5z',fill:'#F06292'}]) },
  // 星内圈标记
  { id: 'marker-star-y', name: '黄星标记', category: 'location', color: '#FFC107',
    svg: svgMulti([{d:'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',fill:'#FF8F00'},{d:'M12 6l1.2 2.4 2.7.4-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.4z',fill:'#FFEB3B'}]) },
  { id: 'marker-star-g', name: '绿星标记', category: 'location', color: '#4CAF50',
    svg: svgMulti([{d:'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',fill:'#2E7D32'},{d:'M12 6l1.2 2.4 2.7.4-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.4z',fill:'#A5D6A7'}]) },
  { id: 'marker-star-b', name: '蓝星标记', category: 'location', color: '#2196F3',
    svg: svgMulti([{d:'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',fill:'#1565C0'},{d:'M12 6l1.2 2.4 2.7.4-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.4z',fill:'#90CAF9'}]) },
  { id: 'marker-star-p', name: '紫星标记', category: 'location', color: '#9C27B0',
    svg: svgMulti([{d:'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',fill:'#6A1B9A'},{d:'M12 6l1.2 2.4 2.7.4-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.4z',fill:'#E1BEE7'}]) },
  { id: 'marker-star-r', name: '红星标记', category: 'location', color: '#E91E63',
    svg: svgMulti([{d:'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',fill:'#AD1457'},{d:'M12 6l1.2 2.4 2.7.4-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.4z',fill:'#F8BBD0'}]) },
  // 白底定位标记（有颜色边框的白色水滴）
  { id: 'loc-white-r', name: '白边红心', category: 'location', color: '#E91E63',
    svg: svgMulti([{d:'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',fill:'#FFF'},{d:'M12 4.5c-2.48 0-4.5 2.02-4.5 4.5 0 3.5 4.5 9 4.5 9s4.5-5.5 4.5-9c0-2.48-2.02-4.5-4.5-4.5zm0 6.5c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z',fill:'#E91E63'}]) },
  { id: 'loc-white-g', name: '白边绿心', category: 'location', color: '#4CAF50',
    svg: svgMulti([{d:'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',fill:'#FFF'},{d:'M12 4.5c-2.48 0-4.5 2.02-4.5 4.5 0 3.5 4.5 9 4.5 9s4.5-5.5 4.5-9c0-2.48-2.02-4.5-4.5-4.5zm0 6.5c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z',fill:'#4CAF50'}]) },
  { id: 'loc-white-b', name: '白边蓝心', category: 'location', color: '#2196F3',
    svg: svgMulti([{d:'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',fill:'#FFF'},{d:'M12 4.5c-2.48 0-4.5 2.02-4.5 4.5 0 3.5 4.5 9 4.5 9s4.5-5.5 4.5-9c0-2.48-2.02-4.5-4.5-4.5zm0 6.5c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z',fill:'#2196F3'}]) },
  { id: 'loc-white-p', name: '白边紫心', category: 'location', color: '#9C27B0',
    svg: svgMulti([{d:'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',fill:'#FFF'},{d:'M12 4.5c-2.48 0-4.5 2.02-4.5 4.5 0 3.5 4.5 9 4.5 9s4.5-5.5 4.5-9c0-2.48-2.02-4.5-4.5-4.5zm0 6.5c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z',fill:'#9C27B0'}]) },
  { id: 'loc-white-o', name: '白边橙心', category: 'location', color: '#FF5722',
    svg: svgMulti([{d:'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',fill:'#FFF'},{d:'M12 4.5c-2.48 0-4.5 2.02-4.5 4.5 0 3.5 4.5 9 4.5 9s4.5-5.5 4.5-9c0-2.48-2.02-4.5-4.5-4.5zm0 6.5c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z',fill:'#FF5722'}]) },
  // 方形内标记
  { id: 'marker-square-y', name: '黄方标记', category: 'location', color: '#FFC107',
    svg: svgMulti([{d:'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',fill:'#FF8F00'},{d:'M9 7h6v6H9z',fill:'#FFEB3B'}]) },
  { id: 'marker-square-g', name: '绿方标记', category: 'location', color: '#4CAF50',
    svg: svgMulti([{d:'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',fill:'#2E7D32'},{d:'M9 7h6v6H9z',fill:'#A5D6A7'}]) },
  { id: 'marker-square-b', name: '蓝方标记', category: 'location', color: '#2196F3',
    svg: svgMulti([{d:'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',fill:'#1565C0'},{d:'M9 7h6v6H9z',fill:'#90CAF9'}]) },
  { id: 'marker-square-r', name: '红方标记', category: 'location', color: '#E91E63',
    svg: svgMulti([{d:'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',fill:'#AD1457'},{d:'M9 7h6v6H9z',fill:'#F8BBD0'}]) },
  { id: 'marker-square-p', name: '紫方标记', category: 'location', color: '#9C27B0',
    svg: svgMulti([{d:'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',fill:'#6A1B9A'},{d:'M9 7h6v6H9z',fill:'#E1BEE7'}]) },

  // 额外补充：方向箭头
  { id: 'arrow-up',     name: '上箭头',   category: 'symbol',    color: '#4CAF50',
    svg: svg('M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z') },
  { id: 'arrow-left',   name: '左箭头',   category: 'symbol',    color: '#FF5722',
    svg: svg('M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z') },
  { id: 'arrow-right',  name: '右箭头',   category: 'symbol',    color: '#2196F3',
    svg: svg('M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L20 12l-8-8z') },

  // 天气相关补充
  { id: 'rainy',      name: '雨天',     category: 'nature',    color: '#2196F3',
    svg: svg('M12 6c-2.67 0-8 1.34-8 4v2c0 .55.45 1 1 1h1v3c0 1.66 1.34 3 3 3h6c1.66 0 3-1.34 3-3v-3h1c.55 0 1-.45 1-1v-2c0-2.66-5.33-4-8-4zm-3.5 9c-.83 0-1.5-.67-1.5-1.5S7.67 12 8.5 12s1.5.67 1.5 1.5S9.33 15 8.5 15zm3 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5S12.33 15 11.5 15zm3 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5S15.33 15 14.5 15z') },
  { id: 'lightning',  name: '闪电',     category: 'nature',    color: '#FFC107',
    svg: svg('M7 2v11h3v9l7-12h-4l4-8z') },
  { id: 'thermometer',name: '温度计',   category: 'symbol',    color: '#F44336',
    svg: svg('M15 13V5c0-1.66-1.34-3-3-3S9 3.34 9 5v8c-1.21.91-2 2.37-2 4 0 2.76 2.24 5 5 5s5-2.24 5-5c0-1.63-.79-3.09-2-4zm-4-8c0-.55.45-1 1-1s1 .45 1 1v8h-2V5z') },
  { id: 'film',       name: '胶片',     category: 'service',   color: '#607D8B',
    svg: svg('M18 3v2h-2V3H8v2H6V3H4v18h2v-2h2v2h8v-2h2v2h2V3h-2zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z') },
  { id: 'mask',       name: '口罩',     category: 'emergency', color: '#607D8B',
    svg: svg('M19.5 6c-1.31 0-2.5.94-2.5 2.5 0 1.31.84 2.41 2 2.82V15c0 1.1-.9 2-2 2h-2v2h2c2.21 0 4-1.79 4-4v-3.68c1.16-.41 2-1.51 2-2.82 0-1.56-1.19-2.5-2.5-2.5zM4.5 6C3.19 6 2 6.94 2 8.5c0 1.31.84 2.41 2 2.82V15c0 2.21 1.79 4 4 4h2v-2h-2c-1.1 0-2-.9-2-2v-3.68c1.16-.41 2-1.51 2-2.82C8 6.94 6.81 6 5.5 6h-1zm8 2c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2s2-.9 2-2v-6c0-1.1-.9-2-2-2z') },
  { id: 'apple',      name: '苹果',     category: 'service',   color: '#4CAF50',
    svg: svg('M20 10c0-2.21-1.79-4-4-4h-2.5c-.55 0-1 .45-1 1v4h-1V7c0-.55-.45-1-1-1H8c-2.21 0-4 1.79-4 4v7c0 1.1.9 2 2 2h5v2h2v-2h5c1.1 0 2-.9 2-2v-7z') },
  { id: 'bottle',     name: '瓶子',     category: 'service',   color: '#03A9F4',
    svg: svg('M14.5 3c-.83 0-1.5.67-1.5 1.5v1.17l-2.41 2.41c-.38.38-.59.89-.59 1.42V20c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2V9.5c0-.53-.21-1.04-.59-1.42L17 5.67V4.5c0-.83-.67-1.5-1.5-1.5h-1zm0 2h1v1h-1V5zm-3 4.5L13.5 7H17l2.5 2.5V20h-9V9.5z') },
  { id: 'person',     name: '人物',     category: 'activity',  color: '#3F51B5',
    svg: svg('M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z') },
  { id: 'person-w',   name: '女厕',     category: 'building',  color: '#E91E63',
    svg: svg('M12 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-.9 2-2 2zm0 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z') },
  { id: 'person-m',   name: '男厕',     category: 'building',  color: '#2196F3',
    svg: svg('M12 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-.9 2-2 2zm0 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z') },
  { id: 'wc',         name: '卫生间',   category: 'building',  color: '#607D8B',
    svg: svgMulti([{d:'M7 3c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-2 7v10h4v-6h2v6h4V10H5z',fill:'#2196F3'},{d:'M15 3c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-2 7v10h4v-6h2v6h4V10H13z',fill:'#E91E63'}], '0 0 24 24') },
];

/** 默认图标 ID */
export const DEFAULT_ICON_ID = 'pin-red';

/** 按 ID 查找图标 */
export function getIconById(id) {
  return ICON_LIBRARY.find(i => i.id === id) || ICON_LIBRARY[0];
}

/** 按分类获取图标列表 */
export function getIconsByCategory(categoryId) {
  return ICON_LIBRARY.filter(i => i.category === categoryId);
}

/** 将 SVG 字符串转换为 OpenLayers Icon 可用的 data URI */
export function iconToDataUri(iconObj, size = 32) {
  if (!iconObj) return null;
  // 把 svg 中的 width/height 替换为实际尺寸，确保缩放正确
  const scaledSvg = iconObj.svg
    .replace(/width="\d+"/, `width="${size}"`)
    .replace(/height="\d+"/, `height="${size}"`);
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(scaledSvg)));
}
