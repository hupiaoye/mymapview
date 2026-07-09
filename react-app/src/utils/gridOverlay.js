import React, { useState, useEffect, useRef } from 'react';
import { LineString, Point } from 'ol/geom';
import { Style, Stroke, Text as TextStyle, Fill } from 'ol/style';
import Feature from 'ol/Feature';

/**
 * 坐标网格组件
 * 在地图上显示经纬网或公里网
 */
class GridOverlay {
  constructor(map, options = {}) {
    this.map = map;
    this.options = {
      show: options.show || false,
      type: options.type || 'latlon', // 'latlon' | 'utm'
      color: options.color || 'rgba(0, 0, 0, 0.2)',
      labelColor: options.labelColor || 'rgba(0, 0, 0, 0.6)',
      labelFontSize: options.labelFontSize || 10,
      minZoom: options.minZoom || 8,
      maxZoom: options.maxZoom || 18,
      gridInterval: options.gridInterval || 1, // 度或公里
      showLabels: options.showLabels !== false
    };
    
    this.gridLayer = null;
    this.visible = this.options.show;
    
    if (this.options.show) {
      this.show();
    }
  }

  /**
   * 显示网格
   */
  show() {
    this.visible = true;
    this.updateGrid();
    
    // 监听缩放变化
    this.map.getView().on('change:resolution', () => {
      if (this.visible) {
        this.updateGrid();
      }
    });
  }

  /**
   * 隐藏网格
   */
  hide() {
    this.visible = false;
    if (this.gridLayer) {
      this.map.removeLayer(this.gridLayer);
      this.gridLayer = null;
    }
  }

  /**
   * 切换显示
   */
  toggle() {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
    return this.visible;
  }

  /**
   * 更新网格
   */
  updateGrid() {
    if (!this.visible) return;
    
    // 移除旧网格
    if (this.gridLayer) {
      this.map.removeLayer(this.gridLayer);
    }
    
    const view = this.map.getView();
    const zoom = view.getZoom();
    const extent = view.calculateExtent(this.map.getSize());
    
    if (zoom < this.options.minZoom || zoom > this.options.maxZoom) {
      return;
    }
    
    const features = [];
    
    if (this.options.type === 'latlon') {
      this.createLatLonGrid(extent, zoom, features);
    } else {
      this.createUTMGrid(extent, zoom, features);
    }
    
    if (features.length === 0) return;
    
    // 创建矢量图层
    const VectorSource = require('ol/source/Vector').default;
    const VectorLayer = require('ol/layer/Vector').default;
    
    const source = new VectorSource({ features });
    this.gridLayer = new VectorLayer({
      source,
      style: (feature) => {
        const isLabel = feature.get('isLabel');
        if (isLabel) {
          return new Style({
            text: new TextStyle({
              text: feature.get('label'),
              font: `${this.options.labelFontSize}px monospace`,
              fill: new Fill({ color: this.options.labelColor }),
              stroke: new Stroke({ color: 'white', width: 2 }),
              offsetY: -10
            })
          });
        }
        return new Style({
          stroke: new Stroke({
            color: this.options.color,
            width: 1,
            lineDash: [4, 4]
          })
        });
      }
    });
    
    this.gridLayer.setZIndex(1);
    this.map.addLayer(this.gridLayer);
  }

  /**
   * 创建经纬网
   */
  createLatLonGrid(extent, zoom, features) {
    const { fromLonLat, toLonLat } = require('ol/proj');
    
    const minCoord = toLonLat([extent[0], extent[1]]);
    const maxCoord = toLonLat([extent[2], extent[3]]);
    
    // 根据缩放级别确定网格间距
    let interval = 1; // 默认1度
    if (zoom >= 15) interval = 0.001; // 约100米
    else if (zoom >= 12) interval = 0.01; // 约1公里
    else if (zoom >= 10) interval = 0.1; // 约10公里
    else if (zoom >= 8) interval = 0.5; // 约50公里
    else if (zoom >= 6) interval = 2; // 约200公里
    
    // 经线
    const startLon = Math.floor(minCoord[0] / interval) * interval;
    const endLon = Math.ceil(maxCoord[0] / interval) * interval;
    
    for (let lon = startLon; lon <= endLon; lon += interval) {
      const line = new LineString([
        fromLonLat([lon, minCoord[1]]),
        fromLonLat([lon, maxCoord[1]])
      ]);
      
      const feature = new Feature({ geometry: line });
      feature.set('type', 'grid');
      features.push(feature);
      
      // 添加标签
      if (this.options.showLabels) {
        const labelCoord = fromLonLat([lon, minCoord[1]]);
        const labelFeature = new Feature({ geometry: new (require('ol/geom').Point)(labelCoord) });
        labelFeature.set('isLabel', true);
        labelFeature.set('label', `${lon.toFixed(interval < 1 ? 2 : 0)}°`);
        features.push(labelFeature);
      }
    }
    
    // 纬线
    const startLat = Math.floor(minCoord[1] / interval) * interval;
    const endLat = Math.ceil(maxCoord[1] / interval) * interval;
    
    for (let lat = startLat; lat <= endLat; lat += interval) {
      const line = new LineString([
        fromLonLat([minCoord[0], lat]),
        fromLonLat([maxCoord[0], lat])
      ]);
      
      const feature = new Feature({ geometry: line });
      feature.set('type', 'grid');
      features.push(feature);
      
      // 添加标签
      if (this.options.showLabels) {
        const labelCoord = fromLonLat([minCoord[0], lat]);
        const labelFeature = new Feature({ geometry: new (require('ol/geom').Point)(labelCoord) });
        labelFeature.set('isLabel', true);
        labelFeature.set('label', `${lat.toFixed(interval < 1 ? 2 : 0)}°`);
        features.push(labelFeature);
      }
    }
  }

  /**
   * 创建公里网
   */
  createUTMGrid(extent, zoom, features) {
    const { fromLonLat, toLonLat } = require('ol/proj');
    
    // 简化处理：在Web墨卡托投影上直接绘制网格
    const minCoord = [extent[0], extent[1]];
    const maxCoord = [extent[2], extent[3]];
    
    // 根据缩放级别确定网格间距（米）
    let interval = 1000; // 默认1公里
    if (zoom >= 16) interval = 100;
    else if (zoom >= 14) interval = 200;
    else if (zoom >= 12) interval = 500;
    else if (zoom >= 10) interval = 2000;
    else if (zoom >= 8) interval = 5000;
    else if (zoom >= 6) interval = 10000;
    
    // 垂直线
    const startX = Math.floor(minCoord[0] / interval) * interval;
    const endX = Math.ceil(maxCoord[0] / interval) * interval;
    
    for (let x = startX; x <= endX; x += interval) {
      const line = new LineString([
        [x, minCoord[1]],
        [x, maxCoord[1]]
      ]);
      
      const feature = new Feature({ geometry: line });
      feature.set('type', 'grid');
      features.push(feature);
      
      // 添加标签
      if (this.options.showLabels) {
        const labelFeature = new Feature({ 
          geometry: new (require('ol/geom').Point)([x, minCoord[1]])
        });
        labelFeature.set('isLabel', true);
        labelFeature.set('label', `${(x / 1000).toFixed(0)}km`);
        features.push(labelFeature);
      }
    }
    
    // 水平线
    const startY = Math.floor(minCoord[1] / interval) * interval;
    const endY = Math.ceil(maxCoord[1] / interval) * interval;
    
    for (let y = startY; y <= endY; y += interval) {
      const line = new LineString([
        [minCoord[0], y],
        [maxCoord[0], y]
      ]);
      
      const feature = new Feature({ geometry: line });
      feature.set('type', 'grid');
      features.push(feature);
      
      // 添加标签
      if (this.options.showLabels) {
        const labelFeature = new Feature({
          geometry: new (require('ol/geom').Point)([minCoord[0], y])
        });
        labelFeature.set('isLabel', true);
        labelFeature.set('label', `${(y / 1000).toFixed(0)}km`);
        features.push(labelFeature);
      }
    }
  }

  /**
   * 设置选项
   */
  setOptions(options) {
    Object.assign(this.options, options);
    if (this.visible) {
      this.updateGrid();
    }
  }

  /**
   * 销毁
   */
  destroy() {
    this.hide();
  }
}

// React组件封装
export function GridOverlayComponent({ map, show, gridType, onToggle }) {
  const gridRef = useRef(null);
  
  useEffect(() => {
    if (!map) return;
    
    gridRef.current = new GridOverlay(map, {
      show: show,
      type: gridType
    });
    
    return () => {
      if (gridRef.current) {
        gridRef.current.destroy();
      }
    };
  }, [map]);
  
  useEffect(() => {
    if (gridRef.current) {
      if (show) {
        gridRef.current.show();
      } else {
        gridRef.current.hide();
      }
    }
  }, [show, gridType]);
  
  return null;
}

export default GridOverlay;