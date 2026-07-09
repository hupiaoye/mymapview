import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, IconButton, Button, Select, MenuItem,
  FormControl, InputLabel, Divider, Switch, FormControlLabel, Alert
} from '@mui/material';
import {
  Close as CloseIcon, Save as SaveIcon, Settings as SettingsIcon,
  Map as MapIcon, Palette as ThemeIcon
} from '@mui/icons-material';
import { 
  getAllCoordSystems, getDefaultCoordSystem, setDefaultCoordSystem,
  getCustomCoordSystems 
} from '../utils/coordSystems';

function SettingsPanel({ onClose, onSave }) {
  const [defaultCoordSystem, setDefaultCoordSystemState] = useState('wgs84');
  const [autoSave, setAutoSave] = useState(true);
  const [autoSaveInterval, setAutoSaveInterval] = useState(30);
  const [showGrid, setShowGrid] = useState(false);
  const [coordDisplayFormat, setCoordDisplayFormat] = useState('decimal'); // decimal | dms

  useEffect(() => {
    // 加载设置
    const savedDefaultCS = getDefaultCoordSystem();
    setDefaultCoordSystemState(savedDefaultCS);

    const savedAutoSave = localStorage.getItem('auto_save');
    setAutoSave(savedAutoSave !== 'false');

    const savedInterval = localStorage.getItem('auto_save_interval');
    setAutoSaveInterval(savedInterval ? parseInt(savedInterval) : 30);

    const savedShowGrid = localStorage.getItem('show_grid');
    setShowGrid(savedShowGrid === 'true');

    const savedFormat = localStorage.getItem('coord_display_format');
    setCoordDisplayFormat(savedFormat || 'decimal');
  }, []);

  const handleSave = () => {
    setDefaultCoordSystem(defaultCoordSystem);
    localStorage.setItem('auto_save', autoSave.toString());
    localStorage.setItem('auto_save_interval', autoSaveInterval.toString());
    localStorage.setItem('show_grid', showGrid.toString());
    localStorage.setItem('coord_display_format', coordDisplayFormat);

    if (onSave) onSave({
      defaultCoordSystem,
      autoSave,
      autoSaveInterval,
      showGrid,
      coordDisplayFormat
    });

    alert('设置已保存');
  };

  const allSystems = getAllCoordSystems();

  return (
    <Paper sx={{
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      width: 500, maxHeight: '80vh', overflow: 'hidden', zIndex: 2000,
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
    }}>
      {/* 标题栏 */}
      <Box sx={{ p: 2, bgcolor: '#1976d2', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SettingsIcon />
          <Typography variant="h6">全局设置</Typography>
        </Box>
        <IconButton color="inherit" onClick={onClose}><CloseIcon /></IconButton>
      </Box>

      {/* 内容 */}
      <Box sx={{ p: 3, overflow: 'auto', maxHeight: 'calc(80vh - 120px)' }}>
        {/* 坐标系设置 */}
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          坐标系设置
        </Typography>
        
        <FormControl fullWidth size="small" sx={{ mb: 3 }}>
          <InputLabel>默认坐标系</InputLabel>
          <Select
            value={defaultCoordSystem}
            label="默认坐标系"
            onChange={(e) => setDefaultCoordSystemState(e.target.value)}
          >
            {allSystems.map(sys => (
              <MenuItem key={sys.id} value={sys.id}>
                <Box>
                  <Typography variant="body2">{sys.nameCN}</Typography>
                  <Typography variant="caption" color="text.secondary">{sys.description}</Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Alert severity="info" sx={{ mb: 3 }}>
          默认坐标系将用于新导入的数据和坐标显示
        </Alert>

        <Divider sx={{ my: 2 }} />

        {/* 坐标显示格式 */}
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          坐标显示格式
        </Typography>

        <FormControl fullWidth size="small" sx={{ mb: 3 }}>
          <InputLabel>坐标格式</InputLabel>
          <Select
            value={coordDisplayFormat}
            label="坐标格式"
            onChange={(e) => setCoordDisplayFormat(e.target.value)}
          >
            <MenuItem value="decimal">十进制度（113.264321, 23.129876）</MenuItem>
            <MenuItem value="dms">度分秒（113°15'51.55"E, 23°7'47.55"N）</MenuItem>
          </Select>
        </FormControl>

        <Divider sx={{ my: 2 }} />

        {/* 自动保存设置 */}
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          自动保存
        </Typography>

        <FormControlLabel
          control={<Switch checked={autoSave} onChange={(e) => setAutoSave(e.target.checked)} />}
          label="启用自动保存"
          sx={{ mb: 2 }}
        />

        {autoSave && (
          <FormControl fullWidth size="small" sx={{ mb: 3 }}>
            <InputLabel>保存间隔</InputLabel>
            <Select
              value={autoSaveInterval}
              label="保存间隔"
              onChange={(e) => setAutoSaveInterval(e.target.value)}
            >
              <MenuItem value={10}>每10秒</MenuItem>
              <MenuItem value={30}>每30秒</MenuItem>
              <MenuItem value={60}>每1分钟</MenuItem>
              <MenuItem value={300}>每5分钟</MenuItem>
            </Select>
          </FormControl>
        )}

        <Divider sx={{ my: 2 }} />

        {/* 地图显示设置 */}
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          地图显示
        </Typography>

        <FormControlLabel
          control={<Switch checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />}
          label="显示坐标网格"
        />
      </Box>

      {/* 底部按钮 */}
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end', gap: 2, borderTop: '1px solid #e0e0e0' }}>
        <Button variant="outlined" onClick={onClose}>取消</Button>
        <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave}>保存设置</Button>
      </Box>
    </Paper>
  );
}

export default SettingsPanel;