import React from 'react';
import {
  Box, Typography, Paper, IconButton, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Divider
} from '@mui/material';
import { Close as CloseIcon, Keyboard as KeyboardIcon } from '@mui/icons-material';
import { getShortcutGroups } from '../utils/shortcuts';

function HelpPanel({ onClose }) {
  const shortcutGroups = getShortcutGroups();

  return (
    <Paper sx={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: 600,
      maxHeight: '80vh',
      overflow: 'hidden',
      zIndex: 2000,
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
    }}>
      {/* 标题栏 */}
      <Box sx={{ 
        p: 2, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        bgcolor: '#1976d2',
        color: 'white'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <KeyboardIcon />
          <Typography variant="h6">快捷键帮助</Typography>
        </Box>
        <IconButton color="inherit" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* 内容 */}
      <Box sx={{ p: 2, overflow: 'auto', maxHeight: 'calc(80vh - 80px)' }}>
        {shortcutGroups.map((group, index) => (
          <Box key={group.name} sx={{ mb: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 1 }}>
              {group.name}
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableBody>
                  {group.shortcuts.map((shortcut) => (
                    <TableRow key={shortcut.name}>
                      <TableCell sx={{ width: '60%' }}>{shortcut.label}</TableCell>
                      <TableCell align="right">
                        <Chip 
                          label={shortcut.description} 
                          size="small" 
                          variant="outlined"
                          sx={{ fontFamily: 'monospace' }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {index < shortcutGroups.length - 1 && <Divider sx={{ mt: 2 }} />}
          </Box>
        ))}

        {/* 使用说明 */}
        <Box sx={{ mt: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            使用说明
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • 快捷键在地图视图中有效，输入框中无效<br />
            • Ctrl 键在 Mac 上对应 Cmd 键<br />
            • 部分快捷键可能与浏览器冲突，会优先响应软件操作<br />
            • 按 Esc 可取消当前操作或关闭弹窗
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
}

export default HelpPanel;