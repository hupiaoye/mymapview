import React, { useState, useMemo } from 'react';
import {
  Box, Typography, TextField, InputAdornment, List, ListItem, ListItemIcon,
  ListItemText, IconButton, Chip, Paper, Divider, Button, Tooltip
} from '@mui/material';
import {
  Search as SearchIcon, Place as PlaceIcon, MyLocation as LocationIcon,
  Close as CloseIcon, ZoomIn as ZoomInIcon, ContentCopy as CopyIcon
} from '@mui/icons-material';

function SearchPanel({ markers, onFlyTo, onClose }) {
  const [query, setQuery] = useState('');
  const [coordInput, setCoordInput] = useState('');
  const [searchMode, setSearchMode] = useState('marker'); // marker | coord

  const filteredMarkers = useMemo(() => {
    if (!query) return markers;
    const q = query.toLowerCase();
    return markers.filter(m => 
      m.name.toLowerCase().includes(q) || 
      (m.description && m.description.toLowerCase().includes(q))
    );
  }, [markers, query]);

  const handleCoordSearch = () => {
    const parts = coordInput.split(/[,\s]+/);
    if (parts.length >= 2) {
      const lon = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);
      if (!isNaN(lon) && !isNaN(lat)) {
        onFlyTo({ coordinates: [lon, lat] });
      }
    }
  };

  const handleCopyCoord = (coord) => {
    navigator.clipboard.writeText(`${coord[0].toFixed(6)}, ${coord[1].toFixed(6)}`);
  };

  return (
    <Paper sx={{
      position: 'absolute', top: 60, left: '50%', transform: 'translateX(-50%)',
      width: 450, maxHeight: 500, zIndex: 1500, boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
    }}>
      {/* 标题栏 */}
      <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#1976d2', color: 'white' }}>
        <Typography variant="subtitle1">搜索</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button size="small" color="inherit" onClick={() => setSearchMode('marker')}
            sx={{ bgcolor: searchMode === 'marker' ? 'rgba(255,255,255,0.2)' : 'transparent' }}>
            标注搜索
          </Button>
          <Button size="small" color="inherit" onClick={() => setSearchMode('coord')}
            sx={{ bgcolor: searchMode === 'coord' ? 'rgba(255,255,255,0.2)' : 'transparent' }}>
            坐标定位
          </Button>
          <IconButton size="small" color="inherit" onClick={onClose}><CloseIcon /></IconButton>
        </Box>
      </Box>

      {/* 搜索内容 */}
      <Box sx={{ p: 2 }}>
        {searchMode === 'marker' ? (
          <>
            <TextField fullWidth size="small" placeholder="输入标注名称搜索..."
              value={query} onChange={(e) => setQuery(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
            />
            <List sx={{ maxHeight: 350, overflow: 'auto', mt: 1 }}>
              {filteredMarkers.map(marker => (
                <ListItem key={marker.id} sx={{ px: 1, '&:hover': { bgcolor: '#f5f5f5' } }}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <PlaceIcon sx={{ color: marker.color || '#1976d2' }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={marker.name}
                    secondary={`${marker.coordinates[0].toFixed(6)}, ${marker.coordinates[1].toFixed(6)}`}
                  />
                  <Tooltip title="定位">
                    <IconButton size="small" onClick={() => onFlyTo(marker)}>
                      <ZoomInIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="复制坐标">
                    <IconButton size="small" onClick={() => handleCopyCoord(marker.coordinates)}>
                      <CopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </ListItem>
              ))}
              {filteredMarkers.length === 0 && (
                <ListItem><ListItemText primary="无匹配结果" /></ListItem>
              )}
            </List>
          </>
        ) : (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              输入经度,纬度 或 经度 纬度（用逗号或空格分隔）
            </Typography>
            <TextField fullWidth size="small" placeholder="113.264, 23.129"
              value={coordInput} onChange={(e) => setCoordInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCoordSearch()}
            />
            <Button fullWidth variant="contained" sx={{ mt: 2 }} onClick={handleCoordSearch}>
              定位到坐标
            </Button>
          </Box>
        )}
      </Box>
    </Paper>
  );
}

export default SearchPanel;