import React from 'react';
import { Menu, MenuItem, ListItemIcon, ListItemText, Divider } from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  ZoomIn as ZoomInIcon,
  Palette as ColorIcon,
  FileDownload as ExportIcon,
  Add as AddIcon,
  MyLocation as LocationIcon
} from '@mui/icons-material';

function ContextMenu({ 
  anchorEl, 
  open, 
  onClose, 
  position, 
  itemType, // 'map' | 'marker' | 'layer'
  itemData,
  onEdit,
  onDelete,
  onCopyCoord,
  onZoomTo,
  onAddMarker,
  onChangeColor,
  onExport
}) {
  const handleAction = (action) => {
    onClose();
    if (action) action();
  };

  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={position ? { top: position.y, left: position.x } : undefined}
    >
      {itemType === 'map' && (
        <>
          <MenuItem onClick={() => handleAction(() => onAddMarker && onAddMarker(position))}>
            <ListItemIcon><AddIcon fontSize="small" /></ListItemIcon>
            <ListItemText>在此添加标注</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => handleAction(() => onCopyCoord && onCopyCoord(position))}>
            <ListItemIcon><CopyIcon fontSize="small" /></ListItemIcon>
            <ListItemText>复制坐标</ListItemText>
          </MenuItem>
        </>
      )}

      {itemType === 'marker' && (
        <>
          <MenuItem onClick={() => handleAction(() => onEdit && onEdit(itemData))}>
            <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
            <ListItemText>编辑标注</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => handleAction(() => onZoomTo && onZoomTo(itemData))}>
            <ListItemIcon><ZoomInIcon fontSize="small" /></ListItemIcon>
            <ListItemText>定位到此处</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => handleAction(() => onCopyCoord && onCopyCoord(itemData.coordinates))}>
            <ListItemIcon><CopyIcon fontSize="small" /></ListItemIcon>
            <ListItemText>复制坐标</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => handleAction(() => onChangeColor && onChangeColor(itemData))}>
            <ListItemIcon><ColorIcon fontSize="small" /></ListItemIcon>
            <ListItemText>修改颜色</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => handleAction(() => onDelete && onDelete(itemData.id))}>
            <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
            <ListItemText>删除标注</ListItemText>
          </MenuItem>
        </>
      )}

      {itemType === 'layer' && (
        <>
          <MenuItem onClick={() => handleAction(() => onZoomTo && onZoomTo(itemData))}>
            <ListItemIcon><ZoomInIcon fontSize="small" /></ListItemIcon>
            <ListItemText>缩放到图层</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => handleAction(() => onExport && onExport(itemData))}>
            <ListItemIcon><ExportIcon fontSize="small" /></ListItemIcon>
            <ListItemText>导出图层</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => handleAction(() => onDelete && onDelete(itemData.id))}>
            <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
            <ListItemText>删除图层</ListItemText>
          </MenuItem>
        </>
      )}
    </Menu>
  );
}

export default ContextMenu;