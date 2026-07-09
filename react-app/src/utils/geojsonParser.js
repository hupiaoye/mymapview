import { Feature } from 'ol';
import { Point, LineString, Polygon } from 'ol/geom';
import { fromLonLat } from 'ol/proj';
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style';

/**
 * 解析 GeoJSON 文件
 */
export async function parseGeoJSON(content) {
  const features = [];
  
  try {
    let geojson;
    
    // 解析JSON
    if (typeof content === 'string') {
      geojson = JSON.parse(content);
    } else if (Array.isArray(content)) {
      const text = new TextDecoder().decode(new Uint8Array(content));
      geojson = JSON.parse(text);
    } else {
      const text = new TextDecoder().decode(content);
      geojson = JSON.parse(text);
    }

    // 处理FeatureCollection
    if (geojson.type === 'FeatureCollection') {
      geojson.features.forEach(feature => {
        const parsed = parseGeoJSONFeature(feature);
        if (parsed) features.push(parsed);
      });
    }
    // 处理单个Feature
    else if (geojson.type === 'Feature') {
      const parsed = parseGeoJSONFeature(geojson);
      if (parsed) features.push(parsed);
    }
    // 处理Geometry
    else if (geojson.type && geojson.coordinates) {
      const feature = new Feature({
        geometry: parseGeoJSONGeometry(geojson),
        type: geojson.type
      });
      features.push(feature);
    }

  } catch (error) {
    console.error('GeoJSON解析失败:', error);
    throw error;
  }

  return features;
}

/**
 * 解析GeoJSON Feature
 */
function parseGeoJSONFeature(geojson) {
  if (!geojson.geometry) return null;
  
  const geometry = parseGeoJSONGeometry(geojson.geometry);
  const properties = geojson.properties || {};
  
  const feature = new Feature({
    geometry: geometry,
    name: properties.name || properties.NAME || '未命名',
    description: properties.description || properties.DESC || '',
    properties: properties,
    type: geojson.geometry.type
  });
  
  // 根据几何类型设置样式
  const style = createFeatureStyle(geojson.geometry.type, properties);
  feature.setStyle(style);
  
  return feature;
}

/**
 * 解析GeoJSON几何体
 */
function parseGeoJSONGeometry(geometry) {
  switch (geometry.type) {
    case 'Point':
      return new Point(fromLonLat(geometry.coordinates));
    
    case 'MultiPoint':
      const multiPointCoords = geometry.coordinates.map(coord => fromLonLat(coord));
      // 将MultiPoint转换为多个Point
      return new Point(multiPointCoords[0]);
    
    case 'LineString':
      const lineCoords = geometry.coordinates.map(coord => fromLonLat(coord));
      return new LineString(lineCoords);
    
    case 'MultiLineString':
      const multiLineCoords = geometry.coordinates[0].map(coord => fromLonLat(coord));
      return new LineString(multiLineCoords);
    
    case 'Polygon':
      const polygonCoords = geometry.coordinates[0].map(coord => fromLonLat(coord));
      return new Polygon([polygonCoords]);
    
    case 'MultiPolygon':
      const multiPolygonCoords = geometry.coordinates[0][0].map(coord => fromLonLat(coord));
      return new Polygon([multiPolygonCoords]);
    
    default:
      console.warn(`不支持的几何类型: ${geometry.type}`);
      return null;
  }
}

/**
 * 创建Feature样式
 */
function createFeatureStyle(type, properties) {
  // 从属性中获取颜色（如果有）
  const color = properties.color || properties.COLOR || '#1976d2';
  
  switch (type) {
    case 'Point':
    case 'MultiPoint':
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
    case 'MultiLineString':
      return new Style({
        stroke: new Stroke({
          color: color,
          width: 3
        })
      });
    
    case 'Polygon':
    case 'MultiPolygon':
      return new Style({
        fill: new Fill({
          color: `${color}33` // 添加透明度
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

/**
 * 将Feature转换为GeoJSON格式
 */
export function featuresToGeoJSON(features) {
  const geojson = {
    type: 'FeatureCollection',
    features: []
  };
  
  features.forEach(feature => {
    const geom = feature.getGeometry();
    const type = geom.getType();
    
    let coordinates;
    switch (type) {
      case 'Point':
        coordinates = geom.getCoordinates();
        break;
      case 'LineString':
        coordinates = geom.getCoordinates();
        break;
      case 'Polygon':
        coordinates = geom.getCoordinates();
        break;
      default:
        coordinates = geom.getCoordinates();
    }
    
    geojson.features.push({
      type: 'Feature',
      geometry: {
        type: type,
        coordinates: coordinates
      },
      properties: {
        name: feature.get('name') || '',
        description: feature.get('description') || ''
      }
    });
  });
  
  return JSON.stringify(geojson, null, 2);
}