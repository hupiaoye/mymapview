import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Collapse,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Checkbox,
  Chip,
  Divider,
  Button
} from '@mui/material';
import {
  Layers as LayersIcon,
  Place as MarkerIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Delete as DeleteIcon,
  Visibility as VisibleIcon,
  VisibilityOff as HiddenIcon,
  CenterFocusStrong as FlyToIcon,
  Add as AddIcon,
  FolderOpen as OpenIcon
} from '@mui/icons-material';
import LayerFilter from './LayerFilter';

function Sidebar({
  layers,
  markers,
  onToggleLayer,
  onDeleteLayer,
  onDeleteMarker,
  onFlyToMarker,
  onImport,
  onEditMarker,
  onZoomToLayer
}) {
  const [activeTab, setActiveTab] = useState(0);
  const [expandedSections, setExpandedSections] = useState({
    baseLayers: true,
    importedLayers: true,
    markers: true
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleFileImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.kml,.kmz,.gpx,.csv,.xlsx,.geojson,.shp,.dxf,.dwg';
    input.onchange = (e) => {
      const files = Array.from(e.target.files);
      if (files.length > 0) {
        // 转换为Electron可以处理的格式
        const fileData = files.map(file => ({
          name: file.name,
          path: file.path || file.name,
          content: file
        }));
        onImport(fileData);
      }
    };
    input.click();
  }, [onImport]);

  return (
    <Box className="sidebar">
      {/* 标签页 */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs 
          value={activeTab} 
          onChange={(_, v) => setActiveTab(v)}
          variant="fullWidth"
          sx={{ minHeight: 48 }}
        >
          <Tab icon={<LayersIcon />} iconPosition="start" label="图层" sx={{ minHeight: 48 }} />
          <Tab icon={<MarkerIcon />} iconPosition="start" label="标注" sx={{ minHeight: 48 }} />
        </Tabs>
      </Box>

      {/* 图层面板 */}
      {activeTab === 0 && (
        <Box className="sidebar-content">
          {/* 底图图层 */}
          <Box sx={{ mb: 2 }}>
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                cursor: 'pointer',
                p: 1,
                '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' }
              }}
              onClick={() => toggleSection('baseLayers')}
            >
              {expandedSections.baseLayers ? <CollapseIcon /> : <ExpandIcon />}
              <Typography variant="subtitle2" sx={{ ml: 1, flex: 1 }}>
                底图图层
              </Typography>
              <Chip size="small" label="1" />
            </Box>
            
            <Collapse in={expandedSections.baseLayers}>
              <List dense sx={{ pl: 2 }}>
                <ListItem>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <Box sx={{ 
                      width: 24, 
                      height: 24, 
                      borderRadius: 1,
                      bgcolor: '#e3f2fd',
                      border: '2px solid #1976d2'
                    }} />
                  </ListItemIcon>
                  <ListItemText 
                    primary="高德地图" 
                    secondary="卫星影像"
                    primaryTypographyProps={{ variant: 'body2' }}
                  />
                  <ListItemSecondaryAction>
                    <Checkbox defaultChecked size="small" />
                  </ListItemSecondaryAction>
                </ListItem>
              </List>
            </Collapse>
          </Box>

          <Divider sx={{ my: 1 }} />

          {/* 图层管理（带搜索过滤） */}
          <Box sx={{ mb: 2 }}>
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                cursor: 'pointer',
                p: 1,
                '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' }
              }}
              onClick={() => toggleSection('importedLayers')}
            >
              {expandedSections.importedLayers ? <CollapseIcon /> : <ExpandIcon />}
              <Typography variant="subtitle2" sx={{ ml: 1, flex: 1 }}>
                图层管理
              </Typography>
              <Chip size="small" label={layers.length} />
            </Box>
            
            <Collapse in={expandedSections.importedLayers}>
              {layers.length === 0 ? (
                <Box sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    暂无导入的图层
                  </Typography>
                  <Button 
                    variant="outlined" 
                    size="small" 
                    startIcon={<OpenIcon />}
                    onClick={handleFileImport}
                  >
                    导入数据
                  </Button>
                </Box>
              ) : (
                <Box sx={{ pl: 2 }}>
                  <LayerFilter
                    layers={layers}
                    markers={markers}
                    onToggleLayer={onToggleLayer}
                    onDeleteLayer={onDeleteLayer}
                    onZoomToLayer={onZoomToLayer}
                  />
                </Box>
              )}
            </Collapse>
          </Box>

          <Divider sx={{ my: 1 }} />

          {/* 工具面板 */}
          <Box className="tool-panel">
            <Typography variant="subtitle2" sx={{ mb: 1, color: '#666' }}>
              快速操作
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Tooltip title="导入KML">
                <Button size="small" variant="outlined" onClick={handleFileImport}>
                  KML
                </Button>
              </Tooltip>
              <Tooltip title="导入GPX">
                <Button size="small" variant="outlined" onClick={handleFileImport}>
                  GPX
                </Button>
              </Tooltip>
              <Tooltip title="导入Excel">
                <Button size="small" variant="outlined" onClick={handleFileImport}>
                  Excel
                </Button>
              </Tooltip>
              <Tooltip title="导入Shapefile">
                <Button size="small" variant="outlined" onClick={handleFileImport}>
                  SHP
                </Button>
              </Tooltip>
            </Box>
          </Box>
        </Box>
      )}

      {/* 标注面板 */}
      {activeTab === 1 && (
        <Box className="sidebar-content">
          <Box sx={{ mb: 2 }}>
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                cursor: 'pointer',
                p: 1,
                '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' }
              }}
              onClick={() => toggleSection('markers')}
            >
              {expandedSections.markers ? <CollapseIcon /> : <ExpandIcon />}
              <Typography variant="subtitle2" sx={{ ml: 1, flex: 1 }}>
                标注点
              </Typography>
              <Chip size="small" label={markers.length} />
            </Box>
            
            <Collapse in={expandedSections.markers}>
              {markers.length === 0 ? (
                <Box sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    点击地图添加标注
                  </Typography>
                </Box>
              ) : (
                <List dense sx={{ pl: 2 }} className="markers-list">
                  {markers.map(marker => (
                    <ListItem
                      key={marker.id}
                      sx={{ px: 1, cursor: 'pointer', '&:hover': { bgcolor: '#f5f5f5' } }}
                      onDoubleClick={() => onEditMarker && onEditMarker(marker)}
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <Box
                          className="marker-color"
                          sx={{ bgcolor: marker.color || '#1976d2' }}
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="body2" noWrap>
                            {marker.name}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {marker.coordinates[0].toFixed(4)}, {marker.coordinates[1].toFixed(4)}
                          </Typography>
                        }
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                      <ListItemSecondaryAction>
                        <Tooltip title="定位">
                          <IconButton
                            size="small"
                            onClick={() => onFlyToMarker(marker)}
                          >
                            <FlyToIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="删除">
                          <IconButton
                            size="small"
                            onClick={() => onDeleteMarker(marker.id)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              )}
            </Collapse>
          </Box>
        </Box>
      )}
    </Box>
  );
}

export default Sidebar;