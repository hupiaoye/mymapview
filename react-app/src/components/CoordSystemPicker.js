import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Paper,
  IconButton,
  Divider,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  TextField,
  InputAdornment
} from '@mui/material';
import {
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  Search as SearchIcon,
  Map as MapIcon
} from '@mui/icons-material';
import { COORD_SYSTEMS, getCoordCategories, convertCoordinate } from '../utils/coordSystems';

function CoordSystemPicker({ onSelect, onClose, title = '选择坐标系' }) {
  const [selectedSystem, setSelectedSystem] = useState('wgs84');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPanel, setExpandedPanel] = useState('geographic');
  const [previewCoord, setPreviewCoord] = useState({ x: '113.264', y: '23.129' });
  const [convertedResult, setConvertedResult] = useState(null);

  const categories = useMemo(() => getCoordCategories(), []);

  // 过滤坐标系
  const filteredCategories = useMemo(() => {
    if (!searchQuery) return categories;
    
    const query = searchQuery.toLowerCase();
    const result = {};
    
    Object.entries(categories).forEach(([key, category]) => {
      const filtered = category.items.filter(sys => 
        sys.name.toLowerCase().includes(query) ||
        sys.nameCN.toLowerCase().includes(query) ||
        sys.description.toLowerCase().includes(query)
      );
      if (filtered.length > 0) {
        result[key] = { ...category, items: filtered };
      }
    });
    
    return result;
  }, [categories, searchQuery]);

  const handlePreview = async () => {
    try {
      const x = parseFloat(previewCoord.x);
      const y = parseFloat(previewCoord.y);
      if (isNaN(x) || isNaN(y)) {
        setConvertedResult({ error: '请输入有效的坐标值' });
        return;
      }
      
      const result = await convertCoordinate(x, y, selectedSystem, 'wgs84');
      setConvertedResult({
        success: true,
        lon: result[0].toFixed(6),
        lat: result[1].toFixed(6)
      });
    } catch (err) {
      setConvertedResult({ error: err.message });
    }
  };

  const handleConfirm = () => {
    const system = COORD_SYSTEMS[selectedSystem];
    if (onSelect) onSelect(system);
  };

  return (
    <Paper sx={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: 600,
      maxHeight: '80vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 2000,
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
    }}>
      {/* 标题栏 */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        p: 2,
        bgcolor: '#1976d2',
        color: 'white'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <MapIcon />
          <Typography variant="h6">{title}</Typography>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: 'white' }}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* 搜索框 */}
      <Box sx={{ p: 2, bgcolor: '#f5f5f5' }}>
        <TextField
          fullWidth
          size="small"
          placeholder="搜索坐标系..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            )
          }}
        />
      </Box>

      {/* 坐标系列表 */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {Object.entries(filteredCategories).map(([key, category]) => (
          <Accordion 
            key={key}
            expanded={expandedPanel === key}
            onChange={() => setExpandedPanel(expandedPanel === key ? false : key)}
            sx={{ mb: 1 }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                  {category.name}
                </Typography>
                <Chip size="small" label={category.items.length} />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {category.items.map(sys => (
                  <Box
                    key={sys.id}
                    onClick={() => setSelectedSystem(sys.id)}
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      cursor: 'pointer',
                      bgcolor: selectedSystem === sys.id ? '#e3f2fd' : 'transparent',
                      border: '1px solid',
                      borderColor: selectedSystem === sys.id ? '#1976d2' : '#e0e0e0',
                      '&:hover': { bgcolor: '#f5f5f5' }
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {sys.nameCN}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {sys.description}
                        </Typography>
                      </Box>
                      {sys.epsg && (
                        <Chip size="small" label={sys.epsg} variant="outlined" />
                      )}
                    </Box>
                  </Box>
                ))}
              </Box>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>

      {/* 坐标预览 */}
      <Box sx={{ p: 2, bgcolor: '#f5f5f5', borderTop: '1px solid #e0e0e0' }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          坐标预览
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 1 }}>
          <TextField
            size="small"
            label="X / 经度"
            value={previewCoord.x}
            onChange={(e) => setPreviewCoord({ ...previewCoord, x: e.target.value })}
            sx={{ width: 150 }}
          />
          <TextField
            size="small"
            label="Y / 纬度"
            value={previewCoord.y}
            onChange={(e) => setPreviewCoord({ ...previewCoord, y: e.target.value })}
            sx={{ width: 150 }}
          />
          <Button variant="outlined" onClick={handlePreview}>
            预览转换
          </Button>
        </Box>
        {convertedResult && (
          <Alert severity={convertedResult.error ? 'error' : 'success'} sx={{ mt: 1 }}>
            {convertedResult.error ? (
              convertedResult.error
            ) : (
              `转换为WGS84: 经度 ${convertedResult.lon}, 纬度 ${convertedResult.lat}`
            )}
          </Alert>
        )}
      </Box>

      {/* 底部按钮 */}
      <Box sx={{ p: 2, display: 'flex', gap: 2, justifyContent: 'flex-end', borderTop: '1px solid #e0e0e0' }}>
        <Button variant="outlined" onClick={onClose}>
          取消
        </Button>
        <Button variant="contained" onClick={handleConfirm}>
          确认选择
        </Button>
      </Box>
    </Paper>
  );
}

export default CoordSystemPicker;