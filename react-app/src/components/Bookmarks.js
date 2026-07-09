import React, { useState, useEffect } from 'react';
import { toLonLat, fromLonLat } from 'ol/proj';
import {
  Box, Typography, Paper, List, ListItem, ListItemIcon, ListItemText,
  IconButton, Button, TextField, Tooltip, Divider
} from '@mui/material';
import {
  BookmarkBorder as BookmarkIcon, Add as AddIcon, Delete as DeleteIcon,
  ZoomIn as ZoomInIcon, Edit as EditIcon
} from '@mui/icons-material';

const STORAGE_KEY = 'mymap_bookmarks';

function Bookmarks({ mapInstance, onFlyTo, onClose }) {
  const [bookmarks, setBookmarks] = useState([]);
  const [newName, setNewName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // 加载书签
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setBookmarks(JSON.parse(saved));
      } catch (e) {
        console.error('加载书签失败:', e);
      }
    }
  }, []);

  // 保存书签到本地存储
  const saveBookmarks = (newBookmarks) => {
    setBookmarks(newBookmarks);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newBookmarks));
  };

  // 添加当前视图为书签
  const handleAddBookmark = () => {
    if (!mapInstance || !newName.trim()) return;
    
    const view = mapInstance.getView();
    const center = view.getCenter();
    const zoom = view.getZoom();
    
    // 转换为经纬度
    const lonLat = toLonLat(center);
    
    const newBookmark = {
      id: Date.now(),
      name: newName.trim(),
      center: lonLat,
      zoom: zoom,
      createdAt: new Date().toISOString()
    };
    
    saveBookmarks([...bookmarks, newBookmark]);
    setNewName('');
    setIsAdding(false);
  };

  // 定位到书签
  const handleGoToBookmark = (bookmark) => {
    if (!mapInstance) return;
    
    const view = mapInstance.getView();
    const center = fromLonLat(bookmark.center);
    
    view.animate({
      center: center,
      zoom: bookmark.zoom,
      duration: 1000
    });
  };

  // 删除书签
  const handleDeleteBookmark = (id) => {
    saveBookmarks(bookmarks.filter(b => b.id !== id));
  };

  return (
    <Paper sx={{
      position: 'absolute', top: 60, right: 20, width: 280, maxHeight: 400,
      zIndex: 1500, boxShadow: '0 4px 20px rgba(0,0,0,0.2)', overflow: 'hidden'
    }}>
      <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#1976d2', color: 'white' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BookmarkIcon />
          <Typography variant="subtitle1">书签</Typography>
        </Box>
        <IconButton size="small" color="inherit" onClick={() => setIsAdding(true)}>
          <AddIcon />
        </IconButton>
      </Box>

      {/* 添加书签 */}
      {isAdding && (
        <Box sx={{ p: 2, bgcolor: '#f5f5f5' }}>
          <TextField fullWidth size="small" placeholder="书签名称" value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddBookmark()}
            sx={{ mb: 1 }}
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" variant="contained" onClick={handleAddBookmark}>保存</Button>
            <Button size="small" onClick={() => setIsAdding(false)}>取消</Button>
          </Box>
        </Box>
      )}

      {/* 书签列表 */}
      <List sx={{ maxHeight: 300, overflow: 'auto' }}>
        {bookmarks.length === 0 ? (
          <ListItem>
            <ListItemText primary="暂无书签" secondary="点击右上角+添加" />
          </ListItem>
        ) : (
          bookmarks.map(bookmark => (
            <ListItem key={bookmark.id} sx={{ '&:hover': { bgcolor: '#f5f5f5' } }}>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <BookmarkIcon color="primary" />
              </ListItemIcon>
              <ListItemText
                primary={bookmark.name}
                secondary={`缩放: ${bookmark.zoom.toFixed(1)}`}
              />
              <Tooltip title="定位">
                <IconButton size="small" onClick={() => handleGoToBookmark(bookmark)}>
                  <ZoomInIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="删除">
                <IconButton size="small" onClick={() => handleDeleteBookmark(bookmark.id)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </ListItem>
          ))
        )}
      </List>
    </Paper>
  );
}

export default Bookmarks;