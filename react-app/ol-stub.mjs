// 浏览器无关的 'ol' 桩模块，用于在 Node 下直接运行 dxfParser.js（不依赖 DOM）。
// 坐标转换已在 dxfParser 内部通过 coordSystems/proj4 完成，fromLonLat 这里保持恒等，
// 以便测试脚本直接读取要素中保存的经纬度。

class Geometry {
  constructor(coords) {
    this.coords = coords;
    this.typeName = 'Geometry';
  }
  getCoordinates() { return this.coords; }
  setCoordinates(c) { this.coords = c; }
  getType() { return this.typeName; }
}

export class Point extends Geometry {
  constructor(c) { super(c); this.typeName = 'Point'; }
}
export class LineString extends Geometry {
  constructor(c) { super(c); this.typeName = 'LineString'; }
}
export class Polygon extends Geometry {
  constructor(c) { super(c); this.typeName = 'Polygon'; }
}

export class Feature {
  constructor(props = {}) {
    this.properties = {};
    this.geometry = props.geometry || null;
    this.style = null;
    Object.assign(this.properties, props);
  }
  getGeometry() { return this.geometry; }
  setStyle(s) { this.style = s; }
  set(k, v) { this.properties[k] = v; }
  get(k) { return this.properties[k]; }
}

export function fromLonLat(coord) {
  // 恒等：直接保存经纬度，便于测试断言
  return coord;
}

export class Style { constructor(o) { this.o = o; } }
export class Fill { constructor(o) { this.o = o; } }
export class Stroke { constructor(o) { this.o = o; } }
export class Circle { constructor(o) { this.o = o; } }
export { Circle as CircleStyle };
export class Text { constructor(o) { this.o = o; } }
