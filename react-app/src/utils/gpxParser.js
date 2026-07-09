import { Feature } from 'ol';
import { Point, LineString } from 'ol/geom';
import { fromLonLat } from 'ol/proj';
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style';

/**
 * 解析 GPX 文件
 */
export async function parseGPX(content) {
  const features = [];
  
  try {
    // 处理Electron IPC传输的数组格式
    if (Array.isArray(content)) {
      content = new TextDecoder('utf-8').decode(new Uint8Array(content));
    }
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/xml');
    
    // 检查解析错误
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      throw new Error('GPX解析错误: ' + parseError.textContent);
    }

    // 解析所有wpt（路径点）
    const waypoints = doc.querySelectorAll('wpt');
    waypoints.forEach(wpt => {
      const lat = parseFloat(wpt.getAttribute('lat'));
      const lon = parseFloat(wpt.getAttribute('lon'));
      const name = wpt.querySelector('name')?.textContent || '未命名';
      const desc = wpt.querySelector('desc')?.textContent || '';
      const ele = wpt.querySelector('ele')?.textContent;
      
      features.push(createWaypointFeature(lon, lat, name, desc, ele ? parseFloat(ele) : null));
    });

    // 解析所有trk（轨迹）
    const tracks = doc.querySelectorAll('trk');
    tracks.forEach(trk => {
      const name = trk.querySelector('name')?.textContent || '未命名轨迹';
      const desc = trk.querySelector('desc')?.textContent || '';
      
      const trackpoints = trk.querySelectorAll('trkpt');
      if (trackpoints.length > 0) {
        const coords = [];
        trackpoints.forEach(trkpt => {
          const lat = parseFloat(trkpt.getAttribute('lat'));
          const lon = parseFloat(trkpt.getAttribute('lon'));
          const ele = trkpt.querySelector('ele')?.textContent;
          coords.push({
            lon,
            lat,
            ele: ele ? parseFloat(ele) : null
          });
        });
        
        features.push(createTrackFeature(coords, name, desc));
      }
    });

    // 解析所有rte（路线）
    const routes = doc.querySelectorAll('rte');
    routes.forEach(rte => {
      const name = rte.querySelector('name')?.textContent || '未命名路线';
      const desc = rte.querySelector('desc')?.textContent || '';
      
      const routepoints = rte.querySelectorAll('rtept');
      if (routepoints.length > 0) {
        const coords = [];
        routepoints.forEach(rtept => {
          const lat = parseFloat(rtept.getAttribute('lat'));
          const lon = parseFloat(rtept.getAttribute('lon'));
          coords.push({ lon, lat });
        });
        
        features.push(createRouteFeature(coords, name, desc));
      }
    });

  } catch (error) {
    console.error('GPX解析失败:', error);
    throw error;
  }

  return features;
}

/**
 * 创建路径点Feature
 */
function createWaypointFeature(lon, lat, name, desc, ele) {
  const feature = new Feature({
    geometry: new Point(fromLonLat([lon, lat])),
    name: name,
    description: desc,
    elevation: ele,
    type: 'waypoint'
  });
  
  feature.setStyle(new Style({
    image: new CircleStyle({
      radius: 8,
      fill: new Fill({ color: '#4caf50' }),
      stroke: new Stroke({ color: 'white', width: 2 })
    }),
    text: new Text({
      text: name,
      offsetY: -20,
      font: '12px Roboto, sans-serif',
      fill: new Fill({ color: '#333' }),
      stroke: new Stroke({ color: 'white', width: 3 })
    })
  }));
  
  return feature;
}

/**
 * 创建轨迹Feature
 */
function createTrackFeature(coords, name, desc) {
  const lineCoords = coords.map(c => fromLonLat([c.lon, c.lat]));
  
  const feature = new Feature({
    geometry: new LineString(lineCoords),
    name: name,
    description: desc,
    trackData: coords,
    type: 'track'
  });
  
  feature.setStyle(new Style({
    stroke: new Stroke({
      color: '#ff9800',
      width: 3
    })
  }));
  
  return feature;
}

/**
 * 创建路线Feature
 */
function createRouteFeature(coords, name, desc) {
  const lineCoords = coords.map(c => fromLonLat([c.lon, c.lat]));
  
  const feature = new Feature({
    geometry: new LineString(lineCoords),
    name: name,
    description: desc,
    type: 'route'
  });
  
  feature.setStyle(new Style({
    stroke: new Stroke({
      color: '#e91e63',
      width: 3,
      lineDash: [10, 5]
    })
  }));
  
  return feature;
}