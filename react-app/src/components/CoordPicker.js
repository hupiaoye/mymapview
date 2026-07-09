import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, IconButton, Tooltip, Chip, Button,
  Switch, FormControlLabel, Divider
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Add as AddIcon,
  MyLocation as LocationIcon,
  Close as CloseIcon
} from '@mui/icons-material';

function CoordPicker({ 
  mousePosition, 
  coordSystem,
  onAddMarker,
  onClose 
}) {
  const [showDMS, setShowDMS] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState([]);

  // 十进制度转度分秒
  const toDMS = (decimal, type) => {
    if (!decimal) return '--';
    const num = parseFloat(decimal);
    const deg = Math.floor(Math.abs(num));
    const min = Math.floor((Math.abs(num) - deg) * 60);
    const sec = ((Math.abs(num) - deg - min / 60) * 3600).toFixed(2);
    const dir = type === 'lon' ? (num >= 0 ? 'E' : 'W') : (num >= 0 ? 'N' : 'S');
    return `${deg}°${min}'${sec}"${dir}`;
  };

  // 复制坐标
  const handleCopy = (format) => {
    if (!mousePosition) return;
    
    let text = '';
    switch (format) {
      case 'decimal':
        text = `${mousePosition.lon}, ${mousePosition.lat}`;
        break;
      case 'dms':
        text = `${toDMS(mousePosition.lon, 'lon')}, ${toDMS(mousePosition.lat, 'lat')}`;
        break;
      case 'xy':
        text = `${mousePosition.x}, ${mousePosition.y}`;
        break;
      default:
        text = `${mousePosition.lon}, ${mousePosition.lat}`;
    }
    
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    
    // 添加到历史记录
    setHistory(prev => [{
      lon: mousePosition.lon,
      lat: mousePosition.lat,
      x: mousePosition.x,
      y: mousePosition.y,
      time: new Date().toLocaleTimeString()
    }, ...prev.slice(0, 9)]);
  };

  // 添加为标注
  const handleAddMarker = () => {
    if (!mousePosition || !onAddMarker) return;
    onAddMarker({
      coordinates: [parseFloat(mousePosition.lon), parseFloat(mousePosition.lat)],
      name: `标注 ${Date.now()}`
    });
  };

  return (
    <Paper sx={{
      position: 'absolute',
      bottom: 40,
      left: 16,
      width: 320,
      zIndex: 1500,
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
    }}>
      {/* 标题栏 */}
      <Box sx={{ 
        p: 1.5, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        bgcolor: '#1976d2',
        color: 'white'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LocationIcon />
          <Typography variant="subtitle2">坐标拾取</Typography>
        </Box>
        <IconButton size="small" color="inherit" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* 坐标显示 */}
      <Box sx={{ p: 2 }}>
        {/* 经纬度 */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary">经纬度</Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
            <Box sx={{ flex: 1, p: 1, bgcolor: '#f5f5f5', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">经度</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 500 }}>
                {showDMS ? toDMS(mousePosition?.lon, 'lon') : (mousePosition?.lon || '--')}
              </Typography>
            </Box>
            <Box sx={{ flex: 1, p: 1, bgcolor: '#f5f5f5', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">纬度</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 500 }}>
                {showDMS ? toDMS(mousePosition?.lat, 'lat') : (mousePosition?.lat || '--')}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* 投影坐标 */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary">投影坐标（{coordSystem?.toUpperCase() || 'WGS84'}）</Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
            <Box sx={{ flex: 1, p: 1, bgcolor: '#f5f5f5', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">X</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 500 }}>
                {mousePosition?.x || '--'}
              </Typography>
            </Box>
            <Box sx={{ flex: 1, p: 1, bgcolor: '#f5f5f5', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">Y</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 500 }}>
                {mousePosition?.y || '--'}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* 格式切换 */}
        <FormControlLabel
          control={<Switch size="small" checked={showDMS} onChange={(e) => setShowDMS(e.target.checked)} />}
          label={<Typography variant="caption">度分秒格式</Typography>}
          sx={{ mb: 1.5 }}
        />

        {/* 操作按钮 */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button 
            size="small" 
            variant="outlined" 
            startIcon={<CopyIcon />}
            onClick={() => handleCopy(showDMS ? 'dms' : 'decimal')}
            sx={{ flex: 1 }}
          >
            {copied ? '已复制' : '复制经纬度'}
          </Button>
          <Button 
            size="small" 
            variant="outlined" 
            startIcon={<CopyIcon />}
            onClick={() => handleCopy('xy')}
            sx={{ flex: 1 }}
          >
            复制XY
          </Button>
          <Button 
            size="small" 
            variant="contained" 
            startIcon={<AddIcon />}
            onClick={handleAddMarker}
          >
            标注
          </Button>
        </Box>
      </Box>

      {/* 历史记录 */}
      {history.length > 0 && (
        <>
          <Divider />
          <Box sx={{ p: 1.5, maxHeight: 150, overflow: 'auto' }}>
            <Typography variant="caption" color="text.secondary">最近拾取</Typography>
            {history.map((item, index) => (
              <Box key={index} sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                py: 0.5,
                borderBottom: index < history.length - 1 ? '1px solid #eee' : 'none'
              }}>
                <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                  {item.lon}, {item.lat}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {item.time}
                </Typography>
              </Box>
            ))}
          </Box>
        </>
      )}
    </Paper>
  );
}

export default CoordPicker;