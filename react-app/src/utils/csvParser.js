import { Feature } from 'ol';
import { Point } from 'ol/geom';
import { fromLonLat } from 'ol/proj';
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style';
import { convertCoordinate, COORD_SYSTEMS } from './coordSystems';

/**
 * 解析 CSV/Excel 文件
 * @param {string|ArrayBuffer} content - 文件内容
 * @param {string} sourceCoordSystem - 源坐标系ID，默认wgs84
 */
export async function parseCSV(content, sourceCoordSystem = 'wgs84') {
  const features = [];
  
  try {
    let data;
    
    // 处理Electron IPC传输的数组格式
    if (Array.isArray(content)) {
      content = new Uint8Array(content);
    }
    
    // 判断是CSV还是Excel
    if (content instanceof ArrayBuffer || content instanceof Uint8Array) {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(content, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      data = XLSX.utils.sheet_to_json(firstSheet);
    } else {
      const Papa = await import('papaparse');
      const result = Papa.parse(content, {
        header: true,
        skipEmptyLines: true
      });
      data = result.data;
    }

    if (data.length === 0) {
      console.warn('CSV/Excel文件中没有数据');
      return features;
    }

    // 识别坐标列
    const columns = Object.keys(data[0]);
    const latCol = findColumn(columns, ['lat', 'latitude', '纬度', 'y', '纬', 'Y']);
    const lonCol = findColumn(columns, ['lon', 'lng', 'longitude', '经度', 'x', '经', 'X']);
    const nameCol = findColumn(columns, ['name', '名称', '标题', 'title', 'label']);
    const descCol = findColumn(columns, ['desc', 'description', '描述', '备注', 'remark']);
    const altCol = findColumn(columns, ['alt', 'altitude', 'elevation', '高程', '海拔', 'z']);

    if (!latCol || !lonCol) {
      throw new Error('未找到经纬度列，请确保CSV/Excel包含经度/纬度或x/y列');
    }

    // 判断是否是投影坐标系
    const sys = COORD_SYSTEMS[sourceCoordSystem];
    const isProjected = sys && (sys.type === 'projected' || sys.type === 'local' || sys.type === 'military');

    // 解析每一行
    for (let index = 0; index < data.length; index++) {
      try {
        const row = data[index];
        let x = parseFloat(row[lonCol]);
        let y = parseFloat(row[latCol]);
        
        if (isNaN(x) || isNaN(y)) {
          console.warn(`第 ${index + 1} 行坐标无效，跳过`);
          continue;
        }

        let lon, lat;
        
        // 根据坐标系转换
        if (sourceCoordSystem === 'wgs84') {
          lon = x;
          lat = y;
        } else {
          try {
            const converted = await convertCoordinate(x, y, sourceCoordSystem, 'wgs84');
            lon = converted[0];
            lat = converted[1];
          } catch (e) {
            console.warn(`坐标转换失败，使用原始值:`, e);
            lon = x;
            lat = y;
          }
        }

        if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
          console.warn(`第 ${index + 1} 行坐标超出范围，跳过`);
          continue;
        }

        const name = nameCol ? row[nameCol] : `点位 ${index + 1}`;
        const desc = descCol ? row[descCol] : '';
        const alt = altCol ? parseFloat(row[altCol]) : null;

        features.push(createPointFeature(lon, lat, name, desc, alt, row));
      } catch (e) {
        console.warn(`解析第 ${index + 1} 行失败:`, e);
      }
    }

  } catch (error) {
    console.error('CSV/Excel解析失败:', error);
    throw error;
  }

  return features;
}

function findColumn(columns, candidates) {
  for (const candidate of candidates) {
    const found = columns.find(col => col.toLowerCase().includes(candidate.toLowerCase()));
    if (found) return found;
  }
  return null;
}

function createPointFeature(lon, lat, name, desc, alt, rawData) {
  const feature = new Feature({
    geometry: new Point(fromLonLat([lon, lat])),
    name: name,
    description: desc,
    elevation: alt,
    rawData: rawData,
    type: 'csv_point'
  });
  
  feature.setStyle(new Style({
    image: new CircleStyle({
      radius: 8,
      fill: new Fill({ color: '#9c27b0' }),
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