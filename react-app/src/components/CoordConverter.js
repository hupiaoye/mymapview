import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Paper,
  IconButton,
  Divider,
  Alert
} from '@mui/material';
import { 
  Close as CloseIcon,
  SwapHoriz as SwapIcon,
  ContentCopy as CopyIcon
} from '@mui/icons-material';
import { convertCoord } from '../utils/coordConvert';

function CoordConverter({ onClose }) {
  const [sourceSystem, setSourceSystem] = useState('wgs84');
  const [targetSystem, setTargetSystem] = useState('gcj02');
  const [inputLon, setInputLon] = useState('');
  const [inputLat, setInputLat] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const coordSystems = [
    { value: 'wgs84', label: 'WGS84 (GPS)' },
    { value: 'gcj02', label: 'GCJ02 (高德/腾讯)' },
    { value: 'bd09', label: 'BD09 (百度)' }
  ];

  const handleConvert = () => {
    setError('');
    setResult(null);

    const lon = parseFloat(inputLon);
    const lat = parseFloat(inputLat);

    if (isNaN(lon) || isNaN(lat)) {
      setError('请输入有效的坐标值');
      return;
    }

    if (lon < -180 || lon > 180) {
      setError('经度范围应为 -180 到 180');
      return;
    }

    if (lat < -90 || lat > 90) {
      setError('纬度范围应为 -90 到 90');
      return;
    }

    try {
      const converted = convertCoord(lon, lat, sourceSystem, targetSystem);
      setResult({
        lon: converted[0],
        lat: converted[1]
      });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSwap = () => {
    setSourceSystem(targetSystem);
    setTargetSystem(sourceSystem);
    if (result) {
      setInputLon(result.lon.toFixed(6));
      setInputLat(result.lat.toFixed(6));
      setResult(null);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
  };

  const handleClear = () => {
    setInputLon('');
    setInputLat('');
    setResult(null);
    setError('');
  };

  return (
    <Paper sx={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: 400,
      p: 3,
      zIndex: 2000,
      boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
    }}>
      {/* 标题栏 */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        mb: 2
      }}>
        <Typography variant="h6">坐标转换</Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* 坐标系选择 */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
        <FormControl size="small" sx={{ flex: 1 }}>
          <InputLabel>源坐标系</InputLabel>
          <Select
            value={sourceSystem}
            label="源坐标系"
            onChange={(e) => setSourceSystem(e.target.value)}
          >
            {coordSystems.map(sys => (
              <MenuItem key={sys.value} value={sys.value}>
                {sys.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <IconButton onClick={handleSwap} color="primary">
          <SwapIcon />
        </IconButton>

        <FormControl size="small" sx={{ flex: 1 }}>
          <InputLabel>目标坐标系</InputLabel>
          <Select
            value={targetSystem}
            label="目标坐标系"
            onChange={(e) => setTargetSystem(e.target.value)}
          >
            {coordSystems.map(sys => (
              <MenuItem key={sys.value} value={sys.value}>
                {sys.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* 输入坐标 */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField
          size="small"
          label="经度 (Longitude)"
          value={inputLon}
          onChange={(e) => setInputLon(e.target.value)}
          placeholder="例: 116.397428"
          sx={{ flex: 1 }}
        />
        <TextField
          size="small"
          label="纬度 (Latitude)"
          value={inputLat}
          onChange={(e) => setInputLat(e.target.value)}
          placeholder="例: 39.90923"
          sx={{ flex: 1 }}
        />
      </Box>

      {/* 错误提示 */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* 转换结果 */}
      {result && (
        <Box sx={{ 
          p: 2, 
          bgcolor: '#e3f2fd', 
          borderRadius: 1, 
          mb: 2 
        }}>
          <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>
            转换结果
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary">
                经度
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {result.lon.toFixed(6)}
                </Typography>
                <IconButton 
                  size="small" 
                  onClick={() => handleCopy(result.lon.toFixed(6))}
                >
                  <CopyIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary">
                纬度
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {result.lat.toFixed(6)}
                </Typography>
                <IconButton 
                  size="small" 
                  onClick={() => handleCopy(result.lat.toFixed(6))}
                >
                  <CopyIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>
          </Box>
        </Box>
      )}

      {/* 按钮组 */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button 
          variant="contained" 
          fullWidth 
          onClick={handleConvert}
        >
          转换
        </Button>
        <Button 
          variant="outlined" 
          onClick={handleClear}
        >
          清除
        </Button>
      </Box>

      {/* 坐标系说明 */}
      <Box sx={{ mt: 2, p: 1.5, bgcolor: '#f5f5f5', borderRadius: 1 }}>
        <Typography variant="caption" color="text.secondary">
          <strong>WGS84:</strong> GPS原始坐标，国际标准<br />
          <strong>GCJ02:</strong> 国测局坐标，高德/腾讯地图使用<br />
          <strong>BD09:</strong> 百度坐标，在GCJ02基础上偏移
        </Typography>
      </Box>
    </Paper>
  );
}

export default CoordConverter;