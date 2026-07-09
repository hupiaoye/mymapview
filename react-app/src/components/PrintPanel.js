import React, { useState } from 'react';
import {
  Box, Typography, Paper, IconButton, Button, Select, MenuItem,
  FormControl, InputLabel, TextField, Divider, Checkbox,
  FormControlLabel, Radio, RadioGroup
} from '@mui/material';
import {
  Close as CloseIcon,
  Print as PrintIcon,
  Download as DownloadIcon,
  Image as ImageIcon,
  PictureAsPdf as PdfIcon
} from '@mui/icons-material';

const PAPER_SIZES = [
  { value: 'a4', label: 'A4 (210×297mm)', width: 210, height: 297 },
  { value: 'a3', label: 'A3 (297×420mm)', width: 297, height: 420 },
  { value: 'a2', label: 'A2 (420×594mm)', width: 420, height: 594 },
  { value: 'custom', label: '自定义', width: 0, height: 0 }
];

function PrintPanel({ mapInstance, onClose }) {
  const [paperSize, setPaperSize] = useState('a4');
  const [orientation, setOrientation] = useState('portrait');
  const [customWidth, setCustomWidth] = useState(210);
  const [customHeight, setCustomHeight] = useState(297);
  const [scale, setScale] = useState('fit'); // fit | custom
  const [customScale, setCustomScale] = useState(50000);
  const [includeTitle, setIncludeTitle] = useState(true);
  const [includeLegend, setIncludeLegend] = useState(false);
  const [includeScaleBar, setIncludeScaleBar] = useState(true);
  const [includeNorthArrow, setIncludeNorthArrow] = useState(true);
  const [title, setTitle] = useState('广勘智图 - 地图输出');
  const [format, setFormat] = useState('png');

  const getPaperDimensions = () => {
    const paper = PAPER_SIZES.find(p => p.value === paperSize);
    if (paperSize === 'custom') {
      return {
        width: orientation === 'landscape' ? customHeight : customWidth,
        height: orientation === 'landscape' ? customWidth : customHeight
      };
    }
    return {
      width: orientation === 'landscape' ? paper.height : paper.width,
      height: orientation === 'landscape' ? paper.width : paper.height
    };
  };

  const handlePrint = async () => {
    if (!mapInstance) return;

    try {
      // 获取地图canvas
      const mapCanvas = document.querySelector('.ol-unselectable');
      if (!mapCanvas) {
        alert('无法获取地图内容');
        return;
      }

      const dims = getPaperDimensions();
      const printWidth = dims.width * 3.78; // mm to px (96dpi)
      const printHeight = dims.height * 3.78;

      // 创建打印canvas
      const canvas = document.createElement('canvas');
      canvas.width = printWidth;
      canvas.height = printHeight;
      const ctx = canvas.getContext('2d');

      // 填充白色背景
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, printWidth, printHeight);

      // 计算地图区域
      const margin = 50;
      const titleHeight = includeTitle ? 60 : 0;
      const legendHeight = includeLegend ? 100 : 0;
      const scaleBarHeight = includeScaleBar ? 40 : 0;

      const mapArea = {
        x: margin,
        y: margin + titleHeight,
        width: printWidth - margin * 2,
        height: printHeight - margin * 2 - titleHeight - legendHeight - scaleBarHeight
      };

      // 绘制标题
      if (includeTitle) {
        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = '#333';
        ctx.textAlign = 'center';
        ctx.fillText(title, printWidth / 2, margin + 30);
      }

      // 绘制地图
      ctx.drawImage(mapCanvas, mapArea.x, mapArea.y, mapArea.width, mapArea.height);

      // 绘制比例尺
      if (includeScaleBar) {
        const scaleBarWidth = 100;
        const scaleBarX = mapArea.x;
        const scaleBarY = mapArea.y + mapArea.height + 10;
        
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(scaleBarX, scaleBarY);
        ctx.lineTo(scaleBarX + scaleBarWidth, scaleBarY);
        ctx.moveTo(scaleBarX, scaleBarY - 5);
        ctx.lineTo(scaleBarX, scaleBarY + 5);
        ctx.moveTo(scaleBarX + scaleBarWidth, scaleBarY - 5);
        ctx.lineTo(scaleBarX + scaleBarWidth, scaleBarY + 5);
        ctx.stroke();
        
        ctx.font = '12px Arial';
        ctx.fillStyle = '#333';
        ctx.textAlign = 'center';
        ctx.fillText(`${scale} m`, scaleBarX + scaleBarWidth / 2, scaleBarY + 15);
      }

      // 绘制指北针
      if (includeNorthArrow) {
        const northX = printWidth - margin - 30;
        const northY = margin + titleHeight + 30;
        
        ctx.fillStyle = '#1976d2';
        ctx.beginPath();
        ctx.moveTo(northX, northY - 20);
        ctx.lineTo(northX - 10, northY);
        ctx.lineTo(northX + 10, northY);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = '#ccc';
        ctx.beginPath();
        ctx.moveTo(northX, northY + 20);
        ctx.lineTo(northX - 10, northY);
        ctx.lineTo(northX + 10, northY);
        ctx.closePath();
        ctx.fill();
        
        ctx.font = 'bold 12px Arial';
        ctx.fillStyle = '#333';
        ctx.textAlign = 'center';
        ctx.fillText('N', northX, northY - 25);
      }

      // 绘制边框
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.strokeRect(margin / 2, margin / 2, printWidth - margin, printHeight - margin);

      // 输出
      if (format === 'png') {
        const link = document.createElement('a');
        link.download = `地图_${new Date().toISOString().slice(0, 10)}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } else if (format === 'pdf') {
        // 简化：直接打印
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
          <html>
          <head><title>打印地图</title></head>
          <body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;">
            <img src="${canvas.toDataURL('image/png')}" style="max-width:100%;max-height:100%;">
          </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }

      alert('导出成功！');
    } catch (error) {
      console.error('导出失败:', error);
      alert('导出失败: ' + error.message);
    }
  };

  return (
    <Paper sx={{
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      width: 500, maxHeight: '80vh', overflow: 'hidden', zIndex: 2000,
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
    }}>
      {/* 标题栏 */}
      <Box sx={{ p: 2, bgcolor: '#1976d2', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">打印输出</Typography>
        <IconButton color="inherit" onClick={onClose}><CloseIcon /></IconButton>
      </Box>

      <Box sx={{ p: 2, overflow: 'auto', maxHeight: 'calc(80vh - 100px)' }}>
        {/* 纸张大小 */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>纸张大小</Typography>
          <FormControl size="small" fullWidth>
            <Select value={paperSize} onChange={(e) => setPaperSize(e.target.value)}>
              {PAPER_SIZES.map(p => (
                <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* 方向 */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>方向</Typography>
          <RadioGroup row value={orientation} onChange={(e) => setOrientation(e.target.value)}>
            <FormControlLabel value="portrait" control={<Radio size="small" />} label="纵向" />
            <FormControlLabel value="landscape" control={<Radio size="small" />} label="横向" />
          </RadioGroup>
        </Box>

        {/* 比例尺 */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>比例尺</Typography>
          <RadioGroup row value={scale} onChange={(e) => setScale(e.target.value)}>
            <FormControlLabel value="fit" control={<Radio size="small" />} label="适合页面" />
            <FormControlLabel value="custom" control={<Radio size="small" />} label="自定义" />
          </RadioGroup>
          {scale === 'custom' && (
            <TextField 
              size="small" 
              type="number" 
              value={customScale}
              onChange={(e) => setCustomScale(e.target.value)}
              placeholder="如: 50000"
              sx={{ mt: 1 }}
              fullWidth
            />
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* 内容选项 */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>包含内容</Typography>
          <FormControlLabel
            control={<Checkbox size="small" checked={includeTitle} onChange={(e) => setIncludeTitle(e.target.checked)} />}
            label="标题"
          />
          <FormControlLabel
            control={<Checkbox size="small" checked={includeScaleBar} onChange={(e) => setIncludeScaleBar(e.target.checked)} />}
            label="比例尺"
          />
          <FormControlLabel
            control={<Checkbox size="small" checked={includeNorthArrow} onChange={(e) => setIncludeNorthArrow(e.target.checked)} />}
            label="指北针"
          />
          <FormControlLabel
            control={<Checkbox size="small" checked={includeLegend} onChange={(e) => setIncludeLegend(e.target.checked)} />}
            label="图例"
          />
        </Box>

        {includeTitle && (
          <Box sx={{ mb: 2 }}>
            <TextField 
              size="small" 
              fullWidth
              label="标题文字"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {/* 输出格式 */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>输出格式</Typography>
          <RadioGroup row value={format} onChange={(e) => setFormat(e.target.value)}>
            <FormControlLabel value="png" control={<Radio size="small" />} label="PNG图片" />
            <FormControlLabel value="pdf" control={<Radio size="small" />} label="PDF打印" />
          </RadioGroup>
        </Box>

        {/* 操作按钮 */}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button variant="outlined" onClick={onClose}>取消</Button>
          <Button 
            variant="contained" 
            startIcon={format === 'png' ? <ImageIcon /> : <PrintIcon />}
            onClick={handlePrint}
          >
            {format === 'png' ? '导出图片' : '打印'}
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}

export default PrintPanel;