/**
 * 快捷键配置和处理
 */

export const SHORTCUTS = {
  // 文件操作
  IMPORT: { key: 'o', ctrl: true, label: '导入数据', description: 'Ctrl+O' },
  EXPORT: { key: 's', ctrl: true, label: '导出数据', description: 'Ctrl+S' },
  
  // 编辑操作
  DELETE: { key: 'Delete', label: '删除选中', description: 'Delete' },
  SELECT_ALL: { key: 'a', ctrl: true, label: '全选', description: 'Ctrl+A' },
  DESELECT: { key: 'Escape', label: '取消选择', description: 'Esc' },
  
  // 视图操作
  FULLSCREEN: { key: 'F11', label: '全屏切换', description: 'F11' },
  ZOOM_IN: { key: '+', ctrl: true, label: '放大', description: 'Ctrl++' },
  ZOOM_OUT: { key: '-', ctrl: true, label: '缩小', description: 'Ctrl+-' },
  ZOOM_FIT: { key: '0', ctrl: true, label: '缩放至适合', description: 'Ctrl+0' },
  
  // 测量工具
  MEASURE_AREA: { key: 'm', ctrl: true, label: '面积测量', description: 'Ctrl+M' },
  MEASURE_DISTANCE: { key: 'd', ctrl: true, label: '距离测量', description: 'Ctrl+D' },
  
  // 工具
  SEARCH: { key: 'f', ctrl: true, label: '搜索', description: 'Ctrl+F' },
  COORD_CONVERT: { key: 't', ctrl: true, label: '坐标转换', description: 'Ctrl+T' },
  BOOKMARK: { key: 'b', ctrl: true, label: '书签', description: 'Ctrl+B' },
  
  // 其他
  HELP: { key: 'F1', label: '帮助', description: 'F1' }
};

/**
 * 检查快捷键是否匹配
 */
export function matchShortcut(event, shortcut) {
  const { key, ctrl, shift, alt } = shortcut;
  
  const keyMatch = event.key.toLowerCase() === key.toLowerCase() || event.code === key;
  const ctrlMatch = ctrl ? (event.ctrlKey || event.metaKey) : !(event.ctrlKey || event.metaKey);
  const shiftMatch = shift ? event.shiftKey : !event.shiftKey;
  const altMatch = alt ? event.altKey : !event.altKey;
  
  return keyMatch && ctrlMatch && shiftMatch && altMatch;
}

/**
 * 快捷键处理器Hook
 */
export function useKeyboardShortcuts(handlers) {
  const handleKeyDown = (event) => {
    // 忽略输入框中的快捷键
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
      return;
    }
    
    // 检查每个快捷键
    Object.entries(SHORTCUTS).forEach(([name, shortcut]) => {
      if (matchShortcut(event, shortcut) && handlers[name]) {
        event.preventDefault();
        event.stopPropagation();
        handlers[name](event);
      }
    });
  };
  
  return handleKeyDown;
}

/**
 * 获取快捷键提示文本
 */
export function getShortcutText(shortcutName) {
  const shortcut = SHORTCUTS[shortcutName];
  return shortcut ? shortcut.description : '';
}

/**
 * 快捷键帮助面板数据
 */
export function getShortcutGroups() {
  return [
    {
      name: '文件操作',
      shortcuts: [
        { ...SHORTCUTS.IMPORT, name: 'IMPORT' },
        { ...SHORTCUTS.EXPORT, name: 'EXPORT' }
      ]
    },
    {
      name: '编辑操作',
      shortcuts: [
        { ...SHORTCUTS.DELETE, name: 'DELETE' },
        { ...SHORTCUTS.SELECT_ALL, name: 'SELECT_ALL' },
        { ...SHORTCUTS.DESELECT, name: 'DESELECT' }
      ]
    },
    {
      name: '视图操作',
      shortcuts: [
        { ...SHORTCUTS.FULLSCREEN, name: 'FULLSCREEN' },
        { ...SHORTCUTS.ZOOM_IN, name: 'ZOOM_IN' },
        { ...SHORTCUTS.ZOOM_OUT, name: 'ZOOM_OUT' },
        { ...SHORTCUTS.ZOOM_FIT, name: 'ZOOM_FIT' }
      ]
    },
    {
      name: '测量工具',
      shortcuts: [
        { ...SHORTCUTS.MEASURE_AREA, name: 'MEASURE_AREA' },
        { ...SHORTCUTS.MEASURE_DISTANCE, name: 'MEASURE_DISTANCE' }
      ]
    },
    {
      name: '工具',
      shortcuts: [
        { ...SHORTCUTS.SEARCH, name: 'SEARCH' },
        { ...SHORTCUTS.COORD_CONVERT, name: 'COORD_CONVERT' },
        { ...SHORTCUTS.BOOKMARK, name: 'BOOKMARK' }
      ]
    }
  ];
}