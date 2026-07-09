import { Feature } from 'ol';
import { Point, LineString, Polygon } from 'ol/geom';
import { fromLonLat } from 'ol/proj';
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style';

export async function parseKML(content) {
  const features = [];
  try {
    // 处理Electron IPC传输的数组格式
    if (Array.isArray(content)) {
      content = new Uint8Array(content);
    }
    
    if (content instanceof ArrayBuffer || content instanceof Uint8Array) {
      const JSZip = await import('jszip');
      const zip = await JSZip.loadAsync(content);
      const kmlFile = Object.keys(zip.files).find(name => name.endsWith('.kml'));
      if (kmlFile) {
        content = await zip.files[kmlFile].async('string');
      } else {
        throw new Error('KMZ文件中未找到KML文件');
      }
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/xml');
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      throw new Error('KML解析错误: ' + parseError.textContent);
    }

    const placemarks = doc.querySelectorAll('Placemark');
    placemarks.forEach(placemark => {
      const name = placemark.querySelector('name')?.textContent || '未命名';
      const description = placemark.querySelector('description')?.textContent || '';
      
      const point = placemark.querySelector('Point');
      if (point) {
        const coordsText = point.querySelector('coordinates')?.textContent;
        if (coordsText) {
          const coords = parseKMLCoordinates(coordsText);
          features.push(createPointFeature(coords, name, description));
        }
      }

      const lineString = placemark.querySelector('LineString');
      if (lineString) {
        const coordsText = lineString.querySelector('coordinates')?.textContent;
        if (coordsText) {
          const coords = parseKMLCoordinates(coordsText);
          features.push(createLineStringFeature(coords, name, description));
        }
      }

      const polygon = placemark.querySelector('Polygon');
      if (polygon) {
        const outerBoundary = polygon.querySelector('outerBoundaryIs LinearRing');
        if (outerBoundary) {
          const coordsText = outerBoundary.querySelector('coordinates')?.textContent;
          if (coordsText) {
            const coords = parseKMLCoordinates(coordsText);
            features.push(createPolygonFeature(coords, name, description));
          }
        }
      }
    });
  } catch (error) {
    console.error('KML解析失败:', error);
    throw error;
  }
  return features;
}

function parseKMLCoordinates(coordsText) {
  return coordsText.trim().split(/\s+/).map(coord => {
    const [lon, lat, alt] = coord.split(',').map(Number);
    return [lon, lat, alt || 0];
  });
}

function createPointFeature(coords, name, description) {
  const feature = new Feature({
    geometry: new Point(fromLonLat([coords[0][0], coords[0][1]])),
    name, description, type: 'point'
  });
  feature.setStyle(createPointStyle(name));
  return feature;
}

function createLineStringFeature(coords, name, description) {
  const lineCoords = coords.map(c => fromLonLat([c[0], c[1]]));
  const feature = new Feature({
    geometry: new LineString(lineCoords),
    name, description, type: 'line'
  });
  feature.setStyle(createLineStyle());
  return feature;
}

function createPolygonFeature(coords, name, description) {
  const polygonCoords = coords.map(c => fromLonLat([c[0], c[1]]));
  const feature = new Feature({
    geometry: new Polygon([polygonCoords]),
    name, description, type: 'polygon'
  });
  feature.setStyle(createPolygonStyle());
  return feature;
}

function createPointStyle(name) {
  return [new Style({
    image: new CircleStyle({ radius: 10, fill: new Fill({ color: '#1976d2' }), stroke: new Stroke({ color: 'white', width: 2 }) }),
    text: new Text({ text: name, offsetY: -20, font: '12px Roboto, sans-serif', fill: new Fill({ color: '#333' }), stroke: new Stroke({ color: 'white', width: 3 }) })
  })];
}

function createLineStyle() {
  return new Style({ stroke: new Stroke({ color: '#1976d2', width: 3 }) });
}

function createPolygonStyle() {
  return new Style({ fill: new Fill({ color: 'rgba(25, 118, 210, 0.2)' }), stroke: new Stroke({ color: '#1976d2', width: 2 }) });
}