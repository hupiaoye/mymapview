// 临时测试：确认 OpenLayers 子模块可在 Node 中直接导入
const mods = ['ol/Feature.js', 'ol/geom.js', 'ol/proj.js', 'ol/style.js'];
for (const p of mods) {
  try {
    const m = await import(p);
    console.log('OK', p, Object.keys(m).slice(0, 6).join(','));
  } catch (e) {
    console.log('ERR', p, e.message);
  }
}
