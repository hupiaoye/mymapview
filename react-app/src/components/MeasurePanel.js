import React from 'react';
import { Box, Typography, IconButton, Paper } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

function MeasurePanel({ result, type, onClose }) {
  if (!result) return null;

  return (
    <Paper className="measure-panel" elevation={4}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {type === 'area' ? '面积:' : '距离:'}
        </Typography>
        <Typography className="measure-value">
          {result.displayValue || result.value}
        </Typography>
        <Typography className="measure-unit">
          {result.unit}
        </Typography>
      </Box>
      
      <IconButton size="small" onClick={onClose}>
        <CloseIcon fontSize="small" />
      </IconButton>
    </Paper>
  );
}

export default MeasurePanel;