import React, { useState, useMemo } from 'react';
import {
  Box, Typography, TextField, InputAdornment, IconButton, Tooltip,
  Chip, Select, MenuItem, FormControl, InputLabel, Switch, FormControlLabel,
  Collapse, List, ListItem, ListItemIcon, ListItemText, ListItemSecondaryAction,
  Divider, Badge
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Visibility as VisibleIcon,
  VisibilityOff as HiddenIcon,
  ZoomIn as ZoomInIcon,
  Delete as DeleteIcon,
  Palette as ColorIcon,
  Layers as LayersIcon
} from '@mui/icons-material';

const FILTER_TYPES = [
  { value: 'all', label: '全部类型' },
  { value: 'point', label: '点' },
  { value: 'line', label: '线' },
  { value: 'polygon', label: '面' },
  { value: 'dxf_point', label: 'DXF点' },
  { value: 'dxf_line', label: 'DXF线' },
  { value: 'dxf_polyline', label: 'DXF折线' },
  { value: 'dxf_polygon', label: 'DXF多边形' },
  { value: 'dxf_circle', label: 'DXF圆' },
  { value: 'csv_point', label: 'CSV点' },
  { value: 'waypoint', label: '航点' },
  { value: 'track', label: '轨迹' },
  { value: 'route', label: '路线' }
];

function LayerFilter({ 
  layers, 
  markers,
  onToggleLayer, 
  onDeleteLayer, 
  onZoomToLayer,
  onFilterChange 
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [showOnlyVisible, setShowOnlyVisible] = useState(false);
  const [expandedLayers, setExpandedLayers] = useState(new Set());
  const [showFilters, setShowFilters] = useState(false);

  // 过滤图层
  const filteredLayers = useMemo(() => {
    let result = layers;

    // 按名称搜索
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(layer => 
        layer.name.toLowerCase().includes(query)
      );
    }

    // 按类型过滤
    if (selectedType !== 'all') {
      result = result.filter(layer => 
        layer.features.some(f => f.get('type') === selectedType)
      );
    }

    // 只显示可见图层
    if (showOnlyVisible) {
      result = result.filter(layer => layer.visible);
    }

    return result;
  }, [layers, searchQuery, selectedType, showOnlyVisible]);

  // 统计信息
  const stats = useMemo(() => {
    const totalFeatures = layers.reduce((sum, l) => sum + l.features.length, 0);
    const visibleFeatures = layers
      .filter(l => l.visible)
      .reduce((sum, l) => sum + l.features.length, 0);
    return { total: totalFeatures, visible: visibleFeatures };
  }, [layers]);

  // 切换图层展开
  const toggleExpand = (layerId) => {
    setExpandedLayers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(layerId)) {
        newSet.delete(layerId);
      } else {
        newSet.add(layerId);
      }
      return newSet;
    });
  };

  // 通知过滤变化
  const handleFilterChange = (newType) => {
    setSelectedType(newType);
    if (onFilterChange) {
      onFilterChange({ type: newType, search: searchQuery, onlyVisible: showOnlyVisible });
    }
  };

  return (
    <Box sx={{ mb: 2 }}>
      {/* 搜索框 */}
      <TextField
        fullWidth
        size="small"
        placeholder="搜索图层..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              <Tooltip title="高级过滤">
                <IconButton size="small" onClick={() => setShowFilters(!showFilters)}>
                  <Badge badgeContent={selectedType !== 'all' ? 1 : 0} color="primary">
                    <FilterIcon fontSize="small" />
                  </Badge>
                </IconButton>
              </Tooltip>
            </InputAdornment>
          )
        }}
        sx={{ mb: 1 }}
      />

      {/* 高级过滤 */}
      <Collapse in={showFilters}>
        <Box sx={{ p: 1.5, bgcolor: '#f5f5f5', borderRadius: 1, mb: 1 }}>
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>要素类型</InputLabel>
            <Select
              value={selectedType}
              label="要素类型"
              onChange={(e) => handleFilterChange(e.target.value)}
            >
              {FILTER_TYPES.map(type => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={showOnlyVisible}
                onChange={(e) => setShowOnlyVisible(e.target.checked)}
              />
            }
            label={<Typography variant="caption">只显示可见图层</Typography>}
          />
        </Box>
      </Collapse>

      {/* 统计信息 */}
      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
        <Chip 
          size="small" 
          label={`${filteredLayers.length} 个图层`} 
          icon={<LayersIcon />}
        />
        <Chip 
          size="small" 
          label={`${stats.visible}/${stats.total} 个要素`} 
          variant="outlined"
        />
      </Box>

      {/* 图层列表 */}
      <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
        {filteredLayers.length === 0 ? (
          <ListItem>
            <ListItemText 
              primary="无匹配图层" 
              secondary={searchQuery ? '尝试修改搜索条件' : '导入数据后显示'} 
            />
          </ListItem>
        ) : (
          filteredLayers.map(layer => (
            <React.Fragment key={layer.id}>
              <ListItem 
                sx={{ 
                  px: 1, 
                  bgcolor: expandedLayers.has(layer.id) ? '#f5f5f5' : 'transparent',
                  '&:hover': { bgcolor: '#f5f5f5' }
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <IconButton size="small" onClick={() => onToggleLayer(layer.id)}>
                    {layer.visible ? <VisibleIcon color="primary" /> : <HiddenIcon />}
                  </IconButton>
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                        {layer.name}
                      </Typography>
                      <Chip 
                        size="small" 
                        label={layer.features.length} 
                        sx={{ height: 18, fontSize: 10 }}
                      />
                    </Box>
                  }
                  secondary={layer.coordSystem ? `坐标系: ${layer.coordSystem}` : null}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
                <ListItemSecondaryAction>
                  <Tooltip title="缩放到图层">
                    <IconButton size="small" onClick={() => onZoomToLayer && onZoomToLayer(layer)}>
                      <ZoomInIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="删除">
                    <IconButton size="small" onClick={() => onDeleteLayer(layer.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </ListItemSecondaryAction>
              </ListItem>

              {/* 展开显示要素详情 */}
              {expandedLayers.has(layer.id) && (
                <Box sx={{ pl: 6, pr: 2, pb: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    包含要素:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                    {layer.features.slice(0, 10).map((f, i) => (
                      <Chip 
                        key={i}
                        size="small" 
                        label={f.get('name') || `要素 ${i + 1}`}
                        sx={{ height: 20, fontSize: 10 }}
                      />
                    ))}
                    {layer.features.length > 10 && (
                      <Chip 
                        size="small" 
                        label={`+${layer.features.length - 10}`}
                        sx={{ height: 20, fontSize: 10 }}
                      />
                    )}
                  </Box>
                </Box>
              )}
            </React.Fragment>
          ))
        )}
      </List>
    </Box>
  );
}

export default LayerFilter;