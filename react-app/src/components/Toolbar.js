import React, { useState } from 'react';
import {
  AppBar, Toolbar as MuiToolbar, Typography, IconButton, Select, MenuItem,
  FormControl, InputLabel, Tooltip, Box, Divider, Button, Chip
} from '@mui/material';
import {
  Map as MapIcon, Search as SearchIcon, SwapHoriz as CoordConvertIcon,
  CloudSync as SyncIcon, FileOpen as ImportIcon, FileDownload as ExportIcon,
  SquareFoot as AreaIcon, Timeline as DistanceIcon, Settings as SettingsIcon,
  Help as HelpIcon, BookmarkBorder as BookmarkIcon, Fullscreen as FullscreenIcon,
  ZoomIn as ZoomInIcon, ZoomOut as ZoomOutIcon, MyLocation as LocationIcon,
  Layers as LayersIcon, Straighten as MeasureIcon
} from '@mui/icons-material';

function Toolbar({
  mapSources, currentMapSource, onMapSourceChange,
  onMeasureArea, onMeasureDistance, measureType,
  onCoordConverter, onImport, onSync, isSyncing,
  onSearch, onFullscreen, onBookmarks, onExport, onHelp,
  onSettings, onCoordEditor, onCoordPicker, onBatchConverter,
  showGrid, onToggleGrid, onPrint
}) {
  return (
    <Box className="toolbar">
      {/* 左侧：Logo和工具 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
          <MapIcon sx={{ color: 'var(--primary-600)', fontSize: 24 }} />
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'var(--primary-700)', lineHeight: 1.2 }}>
              广勘智图
            </Typography>
            <Typography variant="caption" sx={{ color: 'var(--gray-500)', fontSize: 10 }}>
              v1.0 by 胡飘野
            </Typography>
          </Box>
        </Box>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        {/* 文件操作 */}
        <Tooltip title="导入数据 (Ctrl+O)">
          <IconButton size="small" onClick={onImport} sx={{ color: 'var(--gray-600)' }}>
            <ImportIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="导出数据 (Ctrl+S)">
          <IconButton size="small" onClick={onExport} sx={{ color: 'var(--gray-600)' }}>
            <ExportIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        {/* 测量工具 */}
        <Tooltip title="面积测量 (Ctrl+M)">
          <IconButton 
            size="small" 
            onClick={onMeasureArea}
            sx={{ 
              color: measureType === 'area' ? 'var(--primary-600)' : 'var(--gray-600)',
              bgcolor: measureType === 'area' ? 'var(--primary-50)' : 'transparent'
            }}
          >
            <AreaIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="距离测量 (Ctrl+D)">
          <IconButton 
            size="small" 
            onClick={onMeasureDistance}
            sx={{ 
              color: measureType === 'distance' ? 'var(--primary-600)' : 'var(--gray-600)',
              bgcolor: measureType === 'distance' ? 'var(--primary-50)' : 'transparent'
            }}
          >
            <DistanceIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        {/* 工具 */}
        <Tooltip title="坐标转换 (Ctrl+T)">
          <IconButton size="small" onClick={onCoordConverter} sx={{ color: 'var(--gray-600)' }}>
            <CoordConvertIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="搜索 (Ctrl+F)">
          <IconButton size="small" onClick={onSearch} sx={{ color: 'var(--gray-600)' }}>
            <SearchIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="书签 (Ctrl+B)">
          <IconButton size="small" onClick={onBookmarks} sx={{ color: 'var(--gray-600)' }}>
            <BookmarkIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="坐标拾取">
          <IconButton size="small" onClick={onCoordPicker} sx={{ color: 'var(--gray-600)' }}>
            <LocationIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="批量格式转换">
          <IconButton size="small" onClick={onBatchConverter} sx={{ color: 'var(--gray-600)' }}>
            <ImportIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="坐标网格">
          <IconButton 
            size="small" 
            onClick={onToggleGrid}
            sx={{ 
              color: showGrid ? 'var(--primary-600)' : 'var(--gray-600)',
              bgcolor: showGrid ? 'var(--primary-50)' : 'transparent'
            }}
          >
            <LayersIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="打印输出">
          <IconButton size="small" onClick={onPrint} sx={{ color: 'var(--gray-600)' }}>
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* 中间：搜索框 */}
      <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', mx: 2 }}>
        <Box className="search-box">
          <SearchIcon className="search-icon" sx={{ fontSize: 18 }} />
          <input
            className="input"
            placeholder="搜索地点、标注、坐标..."
            style={{ height: 32, fontSize: 13 }}
            onKeyDown={(e) => e.key === 'Enter' && onSearch && onSearch()}
          />
        </Box>
      </Box>

      {/* 右侧：设置 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <FormControl size="small" sx={{ minWidth: 100 }}>
          <Select
            value={currentMapSource}
            onChange={(e) => onMapSourceChange(e.target.value)}
            sx={{ 
              height: 32, 
              fontSize: 13,
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--gray-300)' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--gray-400)' }
            }}
          >
            {Object.entries(mapSources).map(([key, source]) => (
              <MenuItem key={key} value={key} sx={{ fontSize: 13 }}>{source.name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <Tooltip title="自定义坐标系">
          <IconButton size="small" onClick={onCoordEditor} sx={{ color: 'var(--gray-600)' }}>
            <CoordConvertIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="设置">
          <IconButton size="small" onClick={onSettings} sx={{ color: 'var(--gray-600)' }}>
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="全屏 (F11)">
          <IconButton size="small" onClick={onFullscreen} sx={{ color: 'var(--gray-600)' }}>
            <FullscreenIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="帮助 (F1)">
          <IconButton size="small" onClick={onHelp} sx={{ color: 'var(--gray-600)' }}>
            <HelpIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}

export default Toolbar;