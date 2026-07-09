/**
 * 地图性能优化工具
 * 支持大数据量渲染、聚合、抽稀等
 */

import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style';

/**
 * 点聚合算法
 * 将附近的点合并为一个聚合点
 */
export function clusterPoints(features, distance = 50, minZoom = 0, maxZoom = 19) {
  const clusters = [];
  const processed = new Set();
  
  features.forEach((feature, index) => {
    if (processed.has(index)) return;
    
    const coord = feature.getGeometry().getCoordinates();
    const cluster = {
      coordinate: [...coord],
      features: [feature],
      count: 1
    };
    
    // 查找附近的点
    features.forEach((other, otherIndex) => {
      if (index === otherIndex || processed.has(otherIndex)) return;
      
      const otherCoord = other.getGeometry().getCoordinates();
      const dx = coord[0] - otherCoord[0];
      const dy = coord[1] - otherCoord[1];
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < distance) {
        cluster.features.push(other);
        cluster.count++;
        processed.add(otherIndex);
      }
    });
    
    // 计算聚合中心
    if (cluster.count > 1) {
      let sumX = 0, sumY = 0;
      cluster.features.forEach(f => {
        const c = f.getGeometry().getCoordinates();
        sumX += c[0];
        sumY += c[1];
      });
      cluster.coordinate = [sumX / cluster.count, sumY / cluster.count];
    }
    
    processed.add(index);
    clusters.push(cluster);
  });
  
  return clusters;
}

/**
 * 创建聚合样式
 */
export function createClusterStyle(count) {
  const size = count > 100 ? 40 : count > 10 ? 32 : 24;
  const color = count > 100 ? '#d32f2f' : count > 10 ? '#f57c00' : '#1976d2';
  
  return new Style({
    image: new CircleStyle({
      radius: size / 2,
      fill: new Fill({ color: color }),
      stroke: new Stroke({ color: 'white', width: 2 })
    }),
    text: new Text({
      text: count.toString(),
      fill: new Fill({ color: 'white' }),
      font: 'bold 12px sans-serif'
    })
  });
}

/**
 * 道格拉斯-普克抽稀算法
 * 减少点数，保持形状
 */
export function douglasPeucker(points, epsilon = 0.0001) {
  if (points.length <= 2) return points;
  
  // 找到距离首尾连线最远的点
  let maxDist = 0;
  let maxIndex = 0;
  
  const start = points[0];
  const end = points[points.length - 1];
  
  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], start, end);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }
  
  // 如果最大距离大于阈值，递归处理
  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, maxIndex + 1), epsilon);
    const right = douglasPeucker(points.slice(maxIndex), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  
  return [start, end];
}

/**
 * 计算点到线段的垂直距离
 */
function perpendicularDistance(point, lineStart, lineEnd) {
  const dx = lineEnd[0] - lineStart[0];
  const dy = lineEnd[1] - lineStart[1];
  
  if (dx === 0 && dy === 0) {
    return Math.sqrt(
      Math.pow(point[0] - lineStart[0], 2) + 
      Math.pow(point[1] - lineStart[1], 2)
    );
  }
  
  const t = ((point[0] - lineStart[0]) * dx + (point[1] - lineStart[1]) * dy) / (dx * dx + dy * dy);
  
  let nearestX, nearestY;
  if (t < 0) {
    nearestX = lineStart[0];
    nearestY = lineStart[1];
  } else if (t > 1) {
    nearestX = lineEnd[0];
    nearestY = lineEnd[1];
  } else {
    nearestX = lineStart[0] + t * dx;
    nearestY = lineStart[1] + t * dy;
  }
  
  return Math.sqrt(
    Math.pow(point[0] - nearestX, 2) + 
    Math.pow(point[1] - nearestY, 2)
  );
}

/**
 * 根据缩放级别自适应聚合距离
 */
export function getClusterDistance(zoom) {
  if (zoom >= 15) return 20;
  if (zoom >= 12) return 40;
  if (zoom >= 10) return 60;
  if (zoom >= 8) return 80;
  return 100;
}

/**
 * 判断是否需要启用聚合
 */
export function shouldCluster(featureCount, zoom) {
  if (featureCount < 100) return false;
  if (zoom >= 15) return featureCount > 500;
  if (zoom >= 12) return featureCount > 200;
  return true;
}

/**
 * 批量添加要素到图层（分批处理，避免UI阻塞）
 */
export async function addFeaturesBatch(source, features, batchSize = 100) {
  return new Promise((resolve) => {
    let index = 0;
    
    function addBatch() {
      const end = Math.min(index + batchSize, features.length);
      for (let i = index; i < end; i++) {
        source.addFeature(features[i]);
      }
      index = end;
      
      if (index < features.length) {
        requestAnimationFrame(addBatch);
      } else {
        resolve();
      }
    }
    
    addBatch();
  });
}

/**
 * 优化后的要素样式
 */
export function getOptimizedStyle(feature, zoom) {
  const type = feature.get('type');
  const name = feature.get('name');
  const color = feature.get('color') || '#1976d2';
  
  // 根据缩放级别调整样式
  const showLabel = zoom >= 12;
  const pointRadius = zoom >= 14 ? 10 : zoom >= 10 ? 8 : 6;
  const strokeWidth = zoom >= 14 ? 3 : 2;
  
  switch (type) {
    case 'point':
    case 'csv_point':
    case 'dxf_point':
      return new Style({
        image: new CircleStyle({
          radius: pointRadius,
          fill: new Fill({ color }),
          stroke: new Stroke({ color: 'white', width: 2 })
        }),
        text: showLabel && name ? new Text({
          text: name,
          offsetY: -pointRadius - 8,
          font: '11px sans-serif',
          fill: new Fill({ color: '#333' }),
          stroke: new Stroke({ color: 'white', width: 2 })
        }) : undefined
      });
    
    case 'line':
    case 'dxf_line':
    case 'dxf_polyline':
      return new Style({
        stroke: new Stroke({ color, width: strokeWidth })
      });
    
    case 'polygon':
    case 'dxf_polygon':
    case 'dxf_circle':
      return new Style({
        fill: new Fill({ color: color + '33' }),
        stroke: new Stroke({ color, width: strokeWidth })
      });
    
    default:
      return new Style({
        image: new CircleStyle({
          radius: pointRadius,
          fill: new Fill({ color }),
          stroke: new Stroke({ color: 'white', width: 2 })
        })
      });
  }
}