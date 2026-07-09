import React, { useState } from 'react';
import {
  Box, Typography, Paper, IconButton, Button, Select, MenuItem,
  FormControl, InputLabel, Checkbox, FormControlLabel, LinearProgress,
  List, ListItem, ListItemIcon, ListItemText, ListItemSecondaryAction,
  Chip, Alert
} from '@mui/material';
import {
  Close as CloseIcon,
  FileOpen as FileIcon,
  Convert as ConvertIcon,
  FolderOpen as FolderIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon
} from '@mui/icons-material';

const FORMATS = [
  { value: 'kml', label: 'KML', ext: '.kml' },
  { value: 'gpx', label: 'GPX', ext: '.gpx' },
  { value: 'geojson', label: 'GeoJSON', ext: '.geojson' },
  { value: 'csv', label: 'CSV', ext: '.csv' },
  { value: 'dxf', label: 'DXF', ext: '.dxf' }
];

function BatchConverter({ onClose }) {
  const [files, setFiles] = useState([]);
  const [targetFormat, setTargetFormat] = useState('kml');
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState([]);

  // 选择文件
  const handleSelectFiles = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.kml,.kmz,.gpx,.csv,.xlsx,.geojson,.shp,.dxf';
    input.onchange = (e) => {
      const selected = Array.from(e.target.files).map(f => ({
        file: f,
        name: f.name,
        size: f.size,
        status: 'pending'
      }));
      setFiles(prev => [...prev, ...selected]);
    };
    input.click();
  };

  // 选择文件夹
  const handleSelectFolder = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;
    input.onchange = (e) => {
      const selected = Array.from(e.target.files)
        .filter(f => /\.(kml|kmz|gpx|csv|xlsx|geojson|shp|dxf)$/i.test(f.name))
        .map(f => ({
          file: f,
          name: f.name,
          size: f.size,
          status: 'pending'
        }));
      setFiles(prev => [...prev, ...selected]);
    };
    input.click();
  };

  // 移除文件
  const handleRemoveFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // 清空文件
  const handleClear = () => {
    setFiles([]);
    setResults([]);
    setProgress(0);
  };

  // 开始转换
  const handleConvert = async () => {
    if (files.length === 0) {
      alert('请先选择文件');
      return;
    }

    setConverting(true);
    setProgress(0);
    setResults([]);

    const total = files.length;
    const converted = [];

    for (let i = 0; i < total; i++) {
      const file = files[i];
      try {
        // 读取文件内容
        const content = await readFileContent(file.file);
        
        // 转换格式
        const result = await convertFile(content, file.name, targetFormat);
        
        // 下载转换后的文件
        downloadFile(result.content, result.filename, result.mimeType);
        
        converted.push({
          name: file.name,
          status: 'success',
          output: result.filename
        });
        
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'success' } : f
        ));
      } catch (error) {
        converted.push({
          name: file.name,
          status: 'error',
          error: error.message
        });
        
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'error' } : f
        ));
      }
      
      setProgress(((i + 1) / total) * 100);
    }

    setResults(converted);
    setConverting(false);
  };

  // 读取文件内容
  const readFileContent = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('文件读取失败'));
      
      const ext = file.name.split('.').pop().toLowerCase();
      if (['shp', 'kmz', 'xlsx'].includes(ext)) {
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsText(file);
      }
    });
  };

  // 转换文件
  const convertFile = async (content, filename, targetFormat) => {
    const sourceExt = filename.split('.').pop().toLowerCase();
    
    // 解析源文件
    let features = [];
    switch (sourceExt) {
      case 'kml':
      case 'kmz':
        const kmlParser = await import('../utils/kmlParser');
        features = await kmlParser.parseKML(content);
        break;
      case 'gpx':
        const gpxParser = await import('../utils/gpxParser');
        features = await gpxParser.parseGPX(content);
        break;
      case 'csv':
      case 'xlsx':
        const csvParser = await import('../utils/csvParser');
        features = await csvParser.parseCSV(content);
        break;
      case 'geojson':
        const geojsonParser = await import('../utils/geojsonParser');
        features = await geojsonParser.parseGeoJSON(content);
        break;
      case 'dxf':
        const dxfParser = await import('../utils/dxfParser');
        features = await dxfParser.parseDXF(content);
        break;
      default:
        throw new Error(`不支持的源格式: ${sourceExt}`);
    }

    // 导出为目标格式
    const { toLonLat } = await import('ol/proj');
    let outputContent = '';
    let outputFilename = filename.replace(/\.[^/.]+$/, `.${targetFormat}`);
    let mimeType = 'text/plain';

    switch (targetFormat) {
      case 'kml':
        outputContent = exportToKML(features, toLonLat);
        mimeType = 'application/vnd.google-earth.kml+xml';
        break;
      case 'gpx':
        outputContent = exportToGPX(features, toLonLat);
        mimeType = 'application/gpx+xml';
        break;
      case 'geojson':
        outputContent = exportToGeoJSON(features, toLonLat);
        mimeType = 'application/json';
        break;
      case 'csv':
        outputContent = exportToCSV(features, toLonLat);
        mimeType = 'text/csv';
        break;
      default:
        throw new Error(`不支持的目标格式: ${targetFormat}`);
    }

    return { content: outputContent, filename: outputFilename, mimeType };
  };

  // 导出为KML
  const exportToKML = (features, toLonLat) => {
    let kml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    kml += '<kml xmlns="http://www.opengis.net/kml/2.2">\n  <Document>\n';
    features.forEach((f, i) => {
      const coords = toLonLat(f.getGeometry().getCoordinates());
      kml += `    <Placemark>\n      <name>${f.get('name') || `要素 ${i+1}`}</name>\n`;
      kml += `      <Point>\n        <coordinates>${coords[0]},${coords[1]}</coordinates>\n      </Point>\n    </Placemark>\n`;
    });
    kml += '  </Document>\n</kml>';
    return kml;
  };

  // 导出为GPX
  const exportToGPX = (features, toLonLat) => {
    let gpx = '<?xml version="1.0" encoding="UTF-8"?>\n';
    gpx += '<gpx version="1.1">\n';
    features.forEach((f, i) => {
      const coords = toLonLat(f.getGeometry().getCoordinates());
      gpx += `  <wpt lat="${coords[1]}" lon="${coords[0]}">\n    <name>${f.get('name') || `要素 ${i+1}`}</name>\n  </wpt>\n`;
    });
    gpx += '</gpx>';
    return gpx;
  };

  // 导出为GeoJSON
  const exportToGeoJSON = (features, toLonLat) => {
    const geojson = {
      type: 'FeatureCollection',
      features: features.map((f, i) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: toLonLat(f.getGeometry().getCoordinates()) },
        properties: { name: f.get('name') || `要素 ${i+1}` }
      }))
    };
    return JSON.stringify(geojson, null, 2);
  };

  // 导出为CSV
  const exportToCSV = (features, toLonLat) => {
    let csv = '名称,经度,纬度\n';
    features.forEach((f, i) => {
      const coords = toLonLat(f.getGeometry().getCoordinates());
      csv += `"${f.get('name') || `要素 ${i+1}`}",${coords[0]},${coords[1]}\n`;
    });
    return csv;
  };

  // 下载文件
  const downloadFile = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;

  return (
    <Paper sx={{
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      width: 600, maxHeight: '80vh', overflow: 'hidden', zIndex: 2000,
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
    }}>
      {/* 标题栏 */}
      <Box sx={{ p: 2, bgcolor: '#1976d2', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">批量格式转换</Typography>
        <IconButton color="inherit" onClick={onClose}><CloseIcon /></IconButton>
      </Box>

      <Box sx={{ p: 2, overflow: 'auto', maxHeight: 'calc(80vh - 140px)' }}>
        {/* 目标格式选择 */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>目标格式</InputLabel>
            <Select value={targetFormat} label="目标格式" onChange={(e) => setTargetFormat(e.target.value)}>
              {FORMATS.map(f => (
                <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button variant="outlined" startIcon={<FileIcon />} onClick={handleSelectFiles}>
            选择文件
          </Button>
          <Button variant="outlined" startIcon={<FolderIcon />} onClick={handleSelectFolder}>
            选择文件夹
          </Button>
          <Button color="error" onClick={handleClear}>清空</Button>
        </Box>

        {/* 文件列表 */}
        {files.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              已选择 {files.length} 个文件
            </Typography>
            <List dense sx={{ maxHeight: 200, overflow: 'auto', bgcolor: '#f5f5f5', borderRadius: 1 }}>
              {files.map((file, index) => (
                <ListItem key={index}>
                  <ListItemIcon>
                    {file.status === 'success' ? <SuccessIcon color="success" /> :
                     file.status === 'error' ? <ErrorIcon color="error" /> :
                     <FileIcon />}
                  </ListItemIcon>
                  <ListItemText 
                    primary={file.name}
                    secondary={formatFileSize(file.size)}
                  />
                  <ListItemSecondaryAction>
                    <Chip 
                      size="small" 
                      label={file.status === 'success' ? '完成' : file.status === 'error' ? '失败' : '等待'}
                      color={file.status === 'success' ? 'success' : file.status === 'error' ? 'error' : 'default'}
                    />
                    <IconButton size="small" onClick={() => handleRemoveFile(index)}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {/* 进度条 */}
        {converting && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption">转换中... {Math.round(progress)}%</Typography>
            <LinearProgress variant="determinate" value={progress} sx={{ mt: 0.5 }} />
          </Box>
        )}

        {/* 转换结果 */}
        {results.length > 0 && !converting && (
          <Alert severity={errorCount > 0 ? 'warning' : 'success'} sx={{ mb: 2 }}>
            转换完成：成功 {successCount} 个，失败 {errorCount} 个
          </Alert>
        )}

        {/* 操作按钮 */}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button variant="outlined" onClick={onClose}>取消</Button>
          <Button 
            variant="contained" 
            onClick={handleConvert}
            disabled={files.length === 0 || converting}
          >
            开始转换
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}

export default BatchConverter;