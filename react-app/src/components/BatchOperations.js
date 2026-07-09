import React, { useState, useCallback } from 'react';
import {
  Box, Typography, Paper, IconButton, Button, Checkbox, Tooltip,
  Divider, Chip, Menu, MenuItem, ListItemIcon, ListItemText
} from '@mui/material';
import {
  Delete as DeleteIcon,
  FileDownload as ExportIcon,
  SelectAll as SelectAllIcon,
  Deselect as DeselectIcon,
  ContentCopy as CopyIcon,
  Visibility as VisibleIcon,
  VisibilityOff as HiddenIcon,
  MoreVert as MoreIcon
} from '@mui/icons-material';

function BatchOperations({ 
  markers, 
  layers, 
  onDeleteMarkers, 
  onDeleteLayers, 
  onExportSelected,
  onToggleVisibility 
}) {
  const [selectedMarkers, setSelectedMarkers] = useState(new Set());
  const [selectedLayers, setSelectedLayers] = useState(new Set());
  const [anchorEl, setAnchorEl] = useState(null);

  // 切换标注选中状态
  const toggleMarkerSelection = (id) => {
    setSelectedMarkers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // 切换图层选中状态
  const toggleLayerSelection = (id) => {
    setSelectedLayers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // 全选标注
  const selectAllMarkers = () => {
    setSelectedMarkers(new Set(markers.map(m => m.id)));
  };

  // 全选图层
  const selectAllLayers = () => {
    setSelectedLayers(new Set(layers.map(l => l.id)));
  };

  // 取消全选
  const deselectAll = () => {
    setSelectedMarkers(new Set());
    setSelectedLayers(new Set());
  };

  // 删除选中标注
  const handleDeleteSelectedMarkers = () => {
    if (selectedMarkers.size === 0) return;
    if (window.confirm(`确定删除 ${selectedMarkers.size} 个标注？`)) {
      onDeleteMarkers(Array.from(selectedMarkers));
      setSelectedMarkers(new Set());
    }
  };

  // 删除选中图层
  const handleDeleteSelectedLayers = () => {
    if (selectedLayers.size === 0) return;
    if (window.confirm(`确定删除 ${selectedLayers.size} 个图层及其所有数据？`)) {
      onDeleteLayers(Array.from(selectedLayers));
      setSelectedLayers(new Set());
    }
  };

  // 导出选中数据
  const handleExportSelected = (format) => {
    const selectedMarkerData = markers.filter(m => selectedMarkers.has(m.id));
    if (selectedMarkerData.length === 0) {
      alert('请先选择要导出的标注');
      return;
    }
    onExportSelected(selectedMarkerData, format);
    setAnchorEl(null);
  };

  // 复制选中标注坐标
  const handleCopyCoordinates = () => {
    const selectedMarkerData = markers.filter(m => selectedMarkers.has(m.id));
    const coordsText = selectedMarkerData.map(m => 
      `${m.name}: ${m.coordinates[0].toFixed(6)}, ${m.coordinates[1].toFixed(6)}`
    ).join('\n');
    navigator.clipboard.writeText(coordsText);
    alert('已复制到剪贴板');
  };

  const hasSelection = selectedMarkers.size > 0 || selectedLayers.size > 0;

  return (
    <Paper sx={{ mb: 2, overflow: 'hidden' }}>
      {/* 批量操作工具栏 */}
      <Box sx={{ 
        p: 1, 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1, 
        bgcolor: '#f5f5f5',
        borderBottom: '1px solid #e0e0e0'
      }}>
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          批量操作
          {hasSelection && (
            <Chip 
              size="small" 
              label={`已选: ${selectedMarkers.size + selectedLayers.size}`} 
              sx={{ ml: 1 }} 
            />
          )}
        </Typography>

        <Tooltip title="全选标注">
          <IconButton size="small" onClick={selectAllMarkers}>
            <SelectAllIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="全选图层">
          <IconButton size="small" onClick={selectAllLayers}>
            <SelectAllIcon fontSize="small" color="primary" />
          </IconButton>
        </Tooltip>

        <Tooltip title="取消全选">
          <IconButton size="small" onClick={deselectAll}>
            <DeselectIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem />

        <Tooltip title="删除选中">
          <span>
            <IconButton 
              size="small" 
              color="error"
              disabled={!hasSelection}
              onClick={() => {
                if (selectedMarkers.size > 0) handleDeleteSelectedMarkers();
                if (selectedLayers.size > 0) handleDeleteSelectedLayers();
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="复制坐标">
          <span>
            <IconButton 
              size="small" 
              disabled={selectedMarkers.size === 0}
              onClick={handleCopyCoordinates}
            >
              <CopyIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="导出选中">
          <span>
            <IconButton 
              size="small" 
              disabled={selectedMarkers.size === 0}
              onClick={(e) => setAnchorEl(e.currentTarget)}
            >
              <ExportIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        {/* 导出菜单 */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
        >
          <MenuItem onClick={() => handleExportSelected('kml')}>
            <ListItemIcon><ExportIcon fontSize="small" /></ListItemIcon>
            <ListItemText>导出为 KML</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => handleExportSelected('geojson')}>
            <ListItemIcon><ExportIcon fontSize="small" /></ListItemIcon>
            <ListItemText>导出为 GeoJSON</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => handleExportSelected('csv')}>
            <ListItemIcon><ExportIcon fontSize="small" /></ListItemIcon>
            <ListItemText>导出为 CSV</ListItemText>
          </MenuItem>
        </Menu>
      </Box>

      {/* 选中标注列表 */}
      {selectedMarkers.size > 0 && (
        <Box sx={{ p: 1, maxHeight: 150, overflow: 'auto' }}>
          <Typography variant="caption" color="text.secondary">
            已选中标注:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
            {markers.filter(m => selectedMarkers.has(m.id)).map(marker => (
              <Chip
                key={marker.id}
                size="small"
                label={marker.name}
                onDelete={() => toggleMarkerSelection(marker.id)}
                sx={{ maxWidth: 150 }}
              />
            ))}
          </Box>
        </Box>
      )}
    </Paper>
  );
}

export default BatchOperations;