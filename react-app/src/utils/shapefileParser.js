import { Feature } from 'ol';
import { Point, LineString, Polygon } from 'ol/geom';
import { fromLonLat } from 'ol/proj';
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style';
import { convertCoordinate, COORD_SYSTEMS } from './coordSystems';

/**
 * 解析 Shapefile 文件
 * @param {ArrayBuffer} content - 文件内容
 * @param {string} sourceCoordSystem - 源坐标系ID，默认wgs84
 */
export async function parseShapefile(content, sourceCoordSystem = 'wgs84') {
  const features = [];
  
  try {
    const shpjs = await import('shpjs');
    
    // 处理Electron IPC传输的数组格式
    let buffer;
    if (Array.isArray(content)) {
      buffer = new Uint8Array(content).buffer;
    } else if (content instanceof ArrayBuffer) {
      buffer = content;
    } else if (content instanceof Uint8Array) {
      buffer = content.buffer;
    } else {
      throw new Error('不支持的文件格式');
    }
    
    // 解析Shapefile
    const geojson = await shpjs(buffer);
    
    // 转换为OL Features
    if (geojson.type === 'FeatureCollection') {
      for (const feature of geojson.features) {
        const parsed = await convertGeoJSONFeature(feature, sourceCoordSystem);
        if (parsed) features.push(parsed);
      }
    } else if (geojson.type === 'Feature') {
      const parsed = await convertGeoJSONFeature(geojson, sourceCoordSystem);
      if (parsed) features.push(parsed);
    }

  } catch (error) {
    console.error('Shapefile解析失败:', error);
    throw error;
  }

  return features;
}

/**
 * 转换GeoJSON Feature为OL Feature
 */
async function convertGeoJSONFeature(geojson, sourceCoordSystem) {
  if (!geojson.geometry) return null;
  
  const geometry = await convertGeoJSONGeometry(geojson.geometry, sourceCoordSystem);
  if (!geometry) return null;
  
  const properties = geojson.properties || {};
  
  const feature = new Feature({
    geometry: geometry,
    name: properties.name || properties.NAME || '未命名',
    description: properties.description || properties.DESC || '',
    properties: properties,
    type: geojson.geometry.type
  });
  
  const style = createFeatureStyle(geojson.geometry.type, properties);
  feature.setStyle(style);
  
  return feature;
}

/**
 * 转换坐标到WGS84
 */
async function convertToWGS84(x, y, sourceSystem) {
  if (sourceSystem === 'wgs84') return [x, y];
  
  try {
    const converted = await convertCoordinate(x, y, sourceSystem, 'wgs84');
    return converted;
  } catch (e) {
    return [x, y];
  }
}

/**
 * 转换GeoJSON几何体为OL几何体
 */
async function convertGeoJSONGeometry(geometry, sourceCoordSystem) {
  switch (geometry.type) {
    case 'Point': {
      const [lon, lat] = await convertToWGS84(geometry.coordinates[0], geometry.coordinates[1], sourceCoordSystem);
      return new Point(fromLonLat([lon, lat]));
    }
    
    case 'LineString': {
      const coords = [];
      for (const coord of geometry.coordinates) {
        const [lon, lat] = await convertToWGS84(coord[0], coord[1], sourceCoordSystem);
        coords.push(fromLonLat([lon, lat]));
      }
      return new LineString(coords);
    }
    
    case 'Polygon': {
      const coords = [];
      for (const coord of geometry.coordinates[0]) {
        const [lon, lat] = await convertToWGS84(coord[0], coord[1], sourceCoordSystem);
        coords.push(fromLonLat([lon, lat]));
      }
      return new Polygon([coords]);
    }
    
    default:
      console.warn(`不支持的几何类型: ${geometry.type}`);
      return null;
  }
}

/**
 * 创建Feature样式
 */
function createFeatureStyle(type, properties) {
  const color = properties.color || properties.COLOR || '#1976d2';
  
  switch (type) {
    case 'Point':
      return new Style({
        image: new CircleStyle({
          radius: 8,
          fill: new Fill({ color: color }),
          stroke: new Stroke({ color: 'white', width: 2 })
        }),
        text: new Text({
          text: properties.name || '',
          offsetY: -20,
          font: '12px Roboto, sans-serif',
          fill: new Fill({ color: '#333' }),
          stroke: new Stroke({ color: 'white', width: 3 })
        })
      });
    
    case 'LineString':
      return new Style({
        stroke: new Stroke({
          color: color,
          width: 3
        })
      });
    
    case 'Polygon':
      return new Style({
        fill: new Fill({
          color: `${color}33`
        }),
        stroke: new Stroke({
          color: color,
          width: 2
        })
      });
    
    default:
      return new Style({
        fill: new Fill({ color: 'rgba(25, 118, 210, 0.2)' }),
        stroke: new Stroke({ color: '#1976d2', width: 2 })
      });
  }
}