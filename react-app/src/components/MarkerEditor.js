import React, { useState } from 'react';
import {
  Box, Typography, TextField, Button, Paper, IconButton, Select, MenuItem,
  FormControl, InputLabel, Divider, Chip
} from '@mui/material';
import {
  Close as CloseIcon, Save as SaveIcon, Delete as DeleteIcon,
  ContentCopy as CopyIcon, Palette as ColorIcon
} from '@mui/icons-material';

const MARKER_COLORS = [
  '#1976d2', '#388e3c', '#f57c00', '#d32f2f', '#7b1fa2',
  '#00796b', '#c2185b', '#455a64', '#ff5722', '#607d8b'
];

const MARKER_ICONS = [
  { id: 'default', name: '默认', emoji: '📍' },
  { id: 'flag', name: '旗帜', emoji: '🚩' },
  { id: 'star', name: '星标', emoji: '⭐' },
  { id: 'house', name: '房屋', emoji: '🏠' },
  { id: 'office', name: '办公', emoji: '🏢' },
  { id: 'factory', name: '工厂', emoji: '🏭' },
  { id: 'tree', name: '树木', emoji: '🌳' },
  { id: 'water', name: '水源', emoji: '💧' },
  { id: 'warning', name: '警告', emoji: '⚠️' },
  { id: 'pin', name: '图钉', emoji: '📌' }
];

function MarkerEditor({ marker, onSave, onDelete, onClose }) {
  const [name, setName] = useState(marker.name || '');
  const [description, setDescription] = useState(marker.description || '');
  const [color, setColor] = useState(marker.color || '#1976d2');
  const [icon, setIcon] = useState(marker.icon || 'default');
  const [customFields, setCustomFields] = useState(marker.customFields || []);

  const handleAddField = () => {
    setCustomFields([...customFields, { key: '', value: '' }]);
  };

  const handleFieldChange = (index, field, value) => {
    const newFields = [...customFields];
    newFields[index] = { ...newFields[index], [field]: value };
    setCustomFields(newFields);
  };

  const handleRemoveField = (index) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onSave({
      ...marker,
      name,
      description,
      color,
      icon,
      customFields: customFields.filter(f => f.key || f.value)
    });
  };

  const handleCopyCoord = () => {
    const coord = marker.coordinates;
    const text = `${coord[0].toFixed(6)}, ${coord[1].toFixed(6)}`;
    navigator.clipboard.writeText(text);
  };

  return (
    <Paper sx={{
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      width: 450, maxHeight: '80vh', overflow: 'auto', zIndex: 2000,
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
    }}>
      {/* 标题栏 */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#1976d2', color: 'white' }}>
        <Typography variant="h6">编辑标注</Typography>
        <IconButton color="inherit" onClick={onClose}><CloseIcon /></IconButton>
      </Box>

      <Box sx={{ p: 2 }}>
        {/* 基本信息 */}
        <TextField fullWidth size="small" label="名称" value={name}
          onChange={(e) => setName(e.target.value)} sx={{ mb: 2 }} />
        <TextField fullWidth multiline rows={3} label="描述" value={description}
          onChange={(e) => setDescription(e.target.value)} sx={{ mb: 2 }} />

        {/* 坐标信息 */}
        <Box sx={{ p: 1.5, bgcolor: '#f5f5f5', borderRadius: 1, mb: 2 }}>
          <Typography variant="caption" color="text.secondary">坐标信息</Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
            <Chip label={`经度: ${marker.coordinates[0].toFixed(6)}`} size="small" />
            <Chip label={`纬度: ${marker.coordinates[1].toFixed(6)}`} size="small" />
            <IconButton size="small" onClick={handleCopyCoord}><CopyIcon fontSize="small" /></IconButton>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* 颜色选择 */}
        <Typography variant="subtitle2" sx={{ mb: 1 }}>颜色</Typography>
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          {MARKER_COLORS.map(c => (
            <Box key={c} onClick={() => setColor(c)} sx={{
              width: 32, height: 32, borderRadius: '50%', bgcolor: c, cursor: 'pointer',
              border: color === c ? '3px solid #333' : '2px solid #ddd',
              '&:hover': { transform: 'scale(1.1)' }
            }} />
          ))}
        </Box>

        {/* 图标选择 */}
        <Typography variant="subtitle2" sx={{ mb: 1 }}>图标</Typography>
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          {MARKER_ICONS.map(i => (
            <Chip key={i.id} label={`${i.emoji} ${i.name}`} size="small"
              onClick={() => setIcon(i.id)}
              sx={{ cursor: 'pointer', bgcolor: icon === i ? '#e3f2fd' : 'transparent' }} />
          ))}
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* 自定义字段 */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle2">自定义字段</Typography>
          <Button size="small" onClick={handleAddField}>+ 添加</Button>
        </Box>
        {customFields.map((field, index) => (
          <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <TextField size="small" placeholder="字段名" value={field.key}
              onChange={(e) => handleFieldChange(index, 'key', e.target.value)} sx={{ flex: 1 }} />
            <TextField size="small" placeholder="值" value={field.value}
              onChange={(e) => handleFieldChange(index, 'value', e.target.value)} sx={{ flex: 1 }} />
            <IconButton size="small" onClick={() => handleRemoveField(index)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}
      </Box>

      {/* 底部按钮 */}
      <Box sx={{ p: 2, display: 'flex', gap: 2, justifyContent: 'flex-end', borderTop: '1px solid #e0e0e0' }}>
        <Button color="error" startIcon={<DeleteIcon />} onClick={() => onDelete(marker.id)}>
          删除
        </Button>
        <Button variant="outlined" onClick={onClose}>取消</Button>
        <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave}>
          保存
        </Button>
      </Box>
    </Paper>
  );
}

export default MarkerEditor;