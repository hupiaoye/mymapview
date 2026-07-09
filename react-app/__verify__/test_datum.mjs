// 验证基准面变换在真实 OL 几何上的往返正确性（对应 App.js 的 shiftFeaturesDatum）。
import Feature from 'ol/Feature.js';
import { Point } from 'ol/geom.js';
import { fromLonLat, toLonLat } from 'ol/proj.js';
import { wgs84togcj02, gcj02towgs84 } from './coordSystems.mjs';

function applyFn(coord, fn) {
  const ll = toLonLat(coord);
  return fromLonLat(fn(ll[0], ll[1]));
}

const f = new Feature({ geometry: new Point(fromLonLat([113.264, 23.129])) });
f.set('datum', 'wgs84');

const g = f.getGeometry();
const before = toLonLat(g.getCoordinates());

// WGS84 -> GCJ-02（高德底图）
g.setCoordinates(applyFn(g.getCoordinates(), wgs84togcj02));
f.set('datum', 'gcj02');
const after = toLonLat(g.getCoordinates());

// GCJ-02 -> WGS84（切回天地图/WGS84 底图）
g.setCoordinates(applyFn(g.getCoordinates(), gcj02towgs84));
f.set('datum', 'wgs84');
const back = toLonLat(g.getCoordinates());

const err = Math.hypot(back[0] - before[0], back[1] - before[1]);
const shiftLon = after[0] - before[0];
const shiftLat = after[1] - before[1];
console.log('变换前:', before.map(n => n.toFixed(6)).join(','));
console.log('变换后(GCJ-02):', after.map(n => n.toFixed(6)).join(','));
console.log('偏移量(度):', shiftLon.toExponential(3), shiftLat.toExponential(3), '≈', (shiftLon * 111000).toFixed(0) + 'm 东,', (shiftLat * 110000).toFixed(0) + 'm 北');
console.log('往返误差(度):', err.toExponential(3));
console.log(err < 1e-6 ? 'DATUM_OK' : 'DATUM_FAIL');
process.exit(err < 1e-6 ? 0 : 1);
