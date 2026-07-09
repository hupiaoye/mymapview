import React from 'react';
import { Box, Typography, Tooltip, Chip } from '@mui/material';
import { 
  MyLocation as LocationIcon, 
  Save as SaveIcon, 
  CloudDone as SavedIcon,
  ZoomIn as ZoomIcon,
  Layers as LayersIcon,
  Place as MarkerIcon
} from '@mui/icons-material';

function StatusBar({ 
  mousePosition, 
  coordSystem, 
  projectName, 
  isSaving, 
  lastSaveTime,
  zoomLevel,
  selectedCount,
  layerCount,
  markerCount 
}) {
  const formatCoord = (value, type) => {
    if (!value) return '--';
    
    if (type === 'lon') {
      const num = parseFloat(value);
      const deg = Math.floor(Math.abs(num));
      const min = Math.floor((Math.abs(num) - deg) * 60);
      const sec = ((Math.abs(num) - deg - min / 60) * 3600).toFixed(2);
      return `${deg}°${min}'${sec}"${num >= 0 ? 'E' : 'W'}`;
    }
    
    if (type === 'lat') {
      const num = parseFloat(value);
      const deg = Math.floor(Math.abs(num));
      const min = Math.floor((Math.abs(num) - deg) * 60);
      const sec = ((Math.abs(num) - deg - min / 60) * 3600).toFixed(2);
      return `${deg}°${min}'${sec}"${num >= 0 ? 'N' : 'S'}`;
    }
    
    return value;
  };

  const formatSaveTime = (time) => {
    if (!time) return '';
    const date = new Date(time);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <Box className="status-bar">
      {/* 左侧：项目信息和保存状态 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        {projectName && (
          <>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'var(--gray-700)' }}>
              {projectName}
            </Typography>
            <Box className="status-divider" />
          </>
        )}

        {isSaving ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <SaveIcon sx={{ fontSize: 12, color: 'var(--warning)' }} className="animate-spin" />
            <Typography variant="caption" sx={{ color: 'var(--warning)' }}>保存中...</Typography>
          </Box>
        ) : lastSaveTime ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <SavedIcon sx={{ fontSize: 12, color: 'var(--success)' }} />
            <Typography variant="caption" sx={{ color: 'var(--gray-500)' }}>
              已保存 {formatSaveTime(lastSaveTime)}
            </Typography>
          </Box>
        ) : null}

        <Box className="status-divider" />

        {/* 图层和要素统计 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
            <LayersIcon sx={{ fontSize: 12, color: 'var(--gray-500)' }} />
            <Typography variant="caption">{layerCount || 0} 图层</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
            <MarkerIcon sx={{ fontSize: 12, color: 'var(--gray-500)' }} />
            <Typography variant="caption">{markerCount || 0} 标注</Typography>
          </Box>
          {selectedCount > 0 && (
            <Chip 
              size="small" 
              label={`已选 ${selectedCount}`} 
              sx={{ height: 18, fontSize: 10, bgcolor: 'var(--primary-100)', color: 'var(--primary-700)' }}
            />
          )}
        </Box>
      </Box>

      {/* 中间：坐标信息 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <LocationIcon sx={{ fontSize: 12, color: 'var(--gray-500)' }} />
          <Typography variant="caption" sx={{ fontFamily: 'var(--font-mono)' }}>
            {mousePosition ? `${mousePosition.lon}, ${mousePosition.lat}` : '--, --'}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="caption" sx={{ color: 'var(--gray-500)' }}>X:</Typography>
          <Typography variant="caption" sx={{ fontFamily: 'var(--font-mono)' }}>
            {mousePosition ? mousePosition.x : '--'}
          </Typography>
          <Typography variant="caption" sx={{ color: 'var(--gray-500)' }}>Y:</Typography>
          <Typography variant="caption" sx={{ fontFamily: 'var(--font-mono)' }}>
            {mousePosition ? mousePosition.y : '--'}
          </Typography>
        </Box>
      </Box>

      {/* 右侧：缩放和坐标系 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <ZoomIcon sx={{ fontSize: 12, color: 'var(--gray-500)' }} />
          <Typography variant="caption">
            缩放: {zoomLevel ? zoomLevel.toFixed(1) : '--'}
          </Typography>
        </Box>

        <Box className="status-divider" />

        <Tooltip title="当前坐标系">
          <Chip 
            size="small" 
            label={coordSystem ? coordSystem.toUpperCase() : 'WGS84'}
            sx={{ 
              height: 20, 
              fontSize: 10, 
              fontWeight: 600,
              bgcolor: 'var(--primary-100)', 
              color: 'var(--primary-700)' 
            }}
          />
        </Tooltip>
      </Box>
    </Box>
  );
}

export default StatusBar;