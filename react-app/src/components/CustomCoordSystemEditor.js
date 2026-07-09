import React, { useState, useEffect } from 'react';
import {
  Box, Typography, TextField, Button, Paper, IconButton, Select, MenuItem,
  FormControl, InputLabel, Divider, Alert, Tabs, Tab, Chip
} from '@mui/material';
import {
  Close as CloseIcon, Save as SaveIcon, Delete as DeleteIcon,
  Add as AddIcon, Edit as EditIcon
} from '@mui/icons-material';
import { 
  saveCustomCoordSystem, deleteCustomCoordSystem, getCustomCoordSystems,
  transform4Param, transform7Param, transformSimple, transformFixed 
} from '../utils/coordSystems';

const PARAM_TYPES = [
  { value: 'fixed', label: '固定参数（平移）', description: '仅平移偏移量' },
  { value: 'simple', label: '简化参数', description: '平移+缩放' },
  { value: '4param', label: '四参数', description: '平移+缩放+旋转' },
  { value: '7param', label: '七参数', description: '布尔莎模型（完整转换）' }
];

function CustomCoordSystemEditor({ onSave, onDelete, onClose, editingSystem }) {
  const [activeTab, setActiveTab] = useState(0);
  const [systems, setSystems] = useState([]);
  
  // 编辑表单状态
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    nameCN: '',
    description: '',
    type: 'fixed',
    params: {
      dx: 0,
      dy: 0,
      scaleX: 1,
      scaleY: 1,
      scale: 1,
      rotation: 0,
      dz: 0,
      rx: 0,
      ry: 0,
      rz: 0
    }
  });

  // 测试坐标
  const [testCoord, setTestCoord] = useState({ x: '500000', y: '2500000' });
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    loadSystems();
    if (editingSystem) {
      setFormData(editingSystem);
      setActiveTab(1);
    }
  }, [editingSystem]);

  const loadSystems = () => {
    setSystems(getCustomCoordSystems());
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleParamChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      params: { ...prev.params, [field]: parseFloat(value) || 0 }
    }));
  };

  const handleSave = () => {
    if (!formData.id || !formData.nameCN) {
      alert('请填写坐标系ID和名称');
      return;
    }

    const system = {
      ...formData,
      custom: true,
      id: formData.id || `custom_${Date.now()}`
    };

    saveCustomCoordSystem(system);
    loadSystems();
    if (onSave) onSave(system);
    
    // 重置表单
    setFormData({
      id: '',
      name: '',
      nameCN: '',
      description: '',
      type: 'fixed',
      params: { dx: 0, dy: 0, scaleX: 1, scaleY: 1, scale: 1, rotation: 0, dz: 0, rx: 0, ry: 0, rz: 0 }
    });
  };

  const handleDelete = (id) => {
    if (window.confirm('确定删除此坐标系？')) {
      deleteCustomCoordSystem(id);
      loadSystems();
      if (onDelete) onDelete(id);
    }
  };

  const handleEdit = (system) => {
    setFormData(system);
    setActiveTab(1);
  };

  const handleTest = () => {
    const x = parseFloat(testCoord.x);
    const y = parseFloat(testCoord.y);
    
    if (isNaN(x) || isNaN(y)) {
      alert('请输入有效的坐标值');
      return;
    }

    let result;
    const params = formData.params;
    
    switch (formData.type) {
      case '4param':
        result = transform4Param(x, y, params);
        break;
      case '7param':
        result = transform7Param(x, y, 0, params);
        break;
      case 'simple':
        result = transformSimple(x, y, params);
        break;
      case 'fixed':
      default:
        result = transformFixed(x, y, params);
        break;
    }

    setTestResult({ x: result[0].toFixed(6), y: result[1].toFixed(6) });
  };

  const renderParamFields = () => {
    switch (formData.type) {
      case 'fixed':
        return (
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField size="small" label="X偏移量 (dx)" type="number"
              value={formData.params.dx} onChange={(e) => handleParamChange('dx', e.target.value)} sx={{ flex: 1 }} />
            <TextField size="small" label="Y偏移量 (dy)" type="number"
              value={formData.params.dy} onChange={(e) => handleParamChange('dy', e.target.value)} sx={{ flex: 1 }} />
          </Box>
        );
      
      case 'simple':
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField size="small" label="X偏移量 (dx)" type="number"
                value={formData.params.dx} onChange={(e) => handleParamChange('dx', e.target.value)} sx={{ flex: 1 }} />
              <TextField size="small" label="Y偏移量 (dy)" type="number"
                value={formData.params.dy} onChange={(e) => handleParamChange('dy', e.target.value)} sx={{ flex: 1 }} />
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField size="small" label="X缩放系数" type="number" step="0.000001"
                value={formData.params.scaleX} onChange={(e) => handleParamChange('scaleX', e.target.value)} sx={{ flex: 1 }} />
              <TextField size="small" label="Y缩放系数" type="number" step="0.000001"
                value={formData.params.scaleY} onChange={(e) => handleParamChange('scaleY', e.target.value)} sx={{ flex: 1 }} />
            </Box>
          </Box>
        );
      
      case '4param':
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField size="small" label="X偏移量 (dx)" type="number"
                value={formData.params.dx} onChange={(e) => handleParamChange('dx', e.target.value)} sx={{ flex: 1 }} />
              <TextField size="small" label="Y偏移量 (dy)" type="number"
                value={formData.params.dy} onChange={(e) => handleParamChange('dy', e.target.value)} sx={{ flex: 1 }} />
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField size="small" label="缩放系数 (scale)" type="number" step="0.000001"
                value={formData.params.scale} onChange={(e) => handleParamChange('scale', e.target.value)} sx={{ flex: 1 }} />
              <TextField size="small" label="旋转角度 (度)" type="number" step="0.0001"
                value={formData.params.rotation} onChange={(e) => handleParamChange('rotation', e.target.value)} sx={{ flex: 1 }} />
            </Box>
          </Box>
        );
      
      case '7param':
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="caption" color="text.secondary">平移参数</Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField size="small" label="dx" type="number"
                value={formData.params.dx} onChange={(e) => handleParamChange('dx', e.target.value)} sx={{ flex: 1 }} />
              <TextField size="small" label="dy" type="number"
                value={formData.params.dy} onChange={(e) => handleParamChange('dy', e.target.value)} sx={{ flex: 1 }} />
              <TextField size="small" label="dz" type="number"
                value={formData.params.dz} onChange={(e) => handleParamChange('dz', e.target.value)} sx={{ flex: 1 }} />
            </Box>
            <Typography variant="caption" color="text.secondary">旋转参数（秒）</Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField size="small" label="rx" type="number" step="0.0001"
                value={formData.params.rx} onChange={(e) => handleParamChange('rx', e.target.value)} sx={{ flex: 1 }} />
              <TextField size="small" label="ry" type="number" step="0.0001"
                value={formData.params.ry} onChange={(e) => handleParamChange('ry', e.target.value)} sx={{ flex: 1 }} />
              <TextField size="small" label="rz" type="number" step="0.0001"
                value={formData.params.rz} onChange={(e) => handleParamChange('rz', e.target.value)} sx={{ flex: 1 }} />
            </Box>
            <Typography variant="caption" color="text.secondary">缩放参数（ppm）</Typography>
            <TextField size="small" label="scale (ppm)" type="number" step="0.0001"
              value={formData.params.scale} onChange={(e) => handleParamChange('scale', e.target.value)} />
          </Box>
        );
      
      default:
        return null;
    }
  };

  return (
    <Paper sx={{
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      width: 600, maxHeight: '85vh', overflow: 'hidden', zIndex: 2000,
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
    }}>
      {/* 标题栏 */}
      <Box sx={{ p: 2, bgcolor: '#1976d2', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">自定义坐标系管理</Typography>
        <IconButton color="inherit" onClick={onClose}><CloseIcon /></IconButton>
      </Box>

      {/* 标签页 */}
      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="坐标系列表" />
        <Tab label="新建/编辑" />
      </Tabs>

      {/* 内容区 */}
      <Box sx={{ p: 2, overflow: 'auto', maxHeight: 'calc(85vh - 160px)' }}>
        {/* 坐标系列表 */}
        {activeTab === 0 && (
          <Box>
            {systems.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography color="text.secondary">暂无自定义坐标系</Typography>
                <Button startIcon={<AddIcon />} sx={{ mt: 2 }} onClick={() => setActiveTab(1)}>
                  创建新坐标系
                </Button>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {systems.map(system => (
                  <Box key={system.id} sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="subtitle2">{system.nameCN}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {system.description} | 类型: {PARAM_TYPES.find(t => t.value === system.type)?.label}
                      </Typography>
                    </Box>
                    <Box>
                      <IconButton size="small" onClick={() => handleEdit(system)}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDelete(system.id)}><DeleteIcon fontSize="small" /></IconButton>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        )}

        {/* 新建/编辑表单 */}
        {activeTab === 1 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField size="small" label="坐标系ID" value={formData.id}
                onChange={(e) => handleInputChange('id', e.target.value)} sx={{ flex: 1 }}
                placeholder="如: my_local_cs" />
              <TextField size="small" label="坐标系名称" value={formData.nameCN}
                onChange={(e) => handleInputChange('nameCN', e.target.value)} sx={{ flex: 1 }}
                placeholder="如: 我的本地坐标系" />
            </Box>
            
            <TextField size="small" label="描述" value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)} />

            <FormControl size="small">
              <InputLabel>转换类型</InputLabel>
              <Select value={formData.type} label="转换类型"
                onChange={(e) => handleInputChange('type', e.target.value)}>
                {PARAM_TYPES.map(type => (
                  <MenuItem key={type.value} value={type.value}>
                    <Box>
                      <Typography variant="body2">{type.label}</Typography>
                      <Typography variant="caption" color="text.secondary">{type.description}</Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Divider />

            <Typography variant="subtitle2">转换参数</Typography>
            {renderParamFields()}

            <Divider />

            {/* 测试区域 */}
            <Typography variant="subtitle2">参数测试</Typography>
            <Box sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <TextField size="small" label="输入X" value={testCoord.x}
                  onChange={(e) => setTestCoord({ ...testCoord, x: e.target.value })} sx={{ flex: 1 }} />
                <TextField size="small" label="输入Y" value={testCoord.y}
                  onChange={(e) => setTestCoord({ ...testCoord, y: e.target.value })} sx={{ flex: 1 }} />
                <Button variant="outlined" onClick={handleTest}>测试</Button>
              </Box>
              {testResult && (
                <Alert severity="success">
                  转换结果: X = {testResult.x}, Y = {testResult.y}
                </Alert>
              )}
            </Box>

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave}>
                保存坐标系
              </Button>
            </Box>
          </Box>
        )}
      </Box>
    </Paper>
  );
}

export default CustomCoordSystemEditor;