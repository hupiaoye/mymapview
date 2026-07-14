const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

// 单实例锁：避免重复启动多个实例
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  // 图标路径
  const iconPath = path.join(__dirname, '../assets/icon.png');
  const hasIcon = fs.existsSync(iconPath);

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    icon: hasIcon ? iconPath : undefined,
    title: '广勘智图 v1.0',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // 仅开发环境打开 DevTools（生产环境不弹调试面板）
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // 生产环境彻底禁用开发者工具：拦截 F12 / Ctrl+Shift+I 快捷键，并强制关闭任何已打开的面板
  if (process.env.NODE_ENV !== 'development') {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12' || (input.control && input.shift && (input.key === 'I' || input.key === 'i'))) {
        event.preventDefault();
      }
    });
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow.webContents.closeDevTools();
    });
  }

  // 开发环境加载本地服务器，生产环境加载构建文件
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    // 打包后的路径 - 直接使用app.asar路径
    const indexPath = path.join(app.getAppPath(), 'react-app', 'build', 'index.html');
    console.log('Loading index from:', indexPath);
      mainWindow.loadFile(indexPath);
    }

  // 创建菜单
  const menuTemplate = [
    {
      label: '文件',
      submenu: [
        { label: '导入数据', accelerator: 'CmdOrCtrl+O', click: () => importData() },
        { label: '导出数据', accelerator: 'CmdOrCtrl+S', click: () => exportData() },
        { type: 'separator' },
        { label: '退出', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
      ]
    },
    {
      label: '工具',
      submenu: [
        { label: '坐标转换', click: () => mainWindow.webContents.send('open-coord-converter') },
        { label: '面积测量', click: () => mainWindow.webContents.send('start-measure-area') },
        { label: '距离测量', click: () => mainWindow.webContents.send('start-measure-distance') }
      ]
    },
    {
      label: '帮助',
      submenu: [
        { label: '关于', click: () => showAbout() }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
}

// 导入数据
async function importData() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '导入地图数据',
    filters: [
      { name: '支持的格式', extensions: ['kml', 'kmz', 'gpx', 'csv', 'xlsx', 'geojson', 'shp', 'dxf', 'dwg', 'ovobj', 'ovkml', 'ovkmz', 'gkzt'] },
      { name: 'KML/KMZ', extensions: ['kml', 'kmz'] },
      { name: '奥维KML(OVKML)', extensions: ['ovkml', 'ovkmz'] },
      { name: 'GPX', extensions: ['gpx'] },
      { name: 'CSV/Excel', extensions: ['csv', 'xlsx'] },
      { name: 'GeoJSON', extensions: ['geojson'] },
      { name: 'Shapefile', extensions: ['shp'] },
      { name: 'CAD文件', extensions: ['dxf', 'dwg'] },
      { name: '奥维对象', extensions: ['ovobj'] },
      { name: '工程分享包(.gkzt)', extensions: ['gkzt'] }
    ],
    properties: ['openFile', 'multiSelections']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const files = result.filePaths.map(filePath => {
      let buffer;
      try {
        buffer = fs.readFileSync(filePath);
      } catch (e) {
        console.error('读取文件失败:', filePath, e.message);
        return null;
      }
      const ext = path.extname(filePath).toLowerCase().replace('.', '');
      
      // DXF/DWG 等二进制格式：直接传递 Buffer（Uint8Array）。
      // 注意：之前用 Array.from(buffer) 会把整文件展开成「每个字节一个数字」的普通数组，
      // 例如 50MB 的 DXF 会变成约 5000 万个数字，经 IPC 结构化克隆传给渲染进程时内存暴涨，
      // 导致大文件导入时渲染进程 OGG/OOM 崩溃。直接传 Buffer(Uint8Array) 只占用一份连续内存，
      // 经 IPC 克隆效率极高。所有解析器（dxfParser/shapefileParser/kmlParser…）均已支持 Uint8Array。
      const binaryFormats = ['dxf', 'dwg', 'shp', 'kmz', 'ovobj'];
      const textFormats = ['kml', 'gpx', 'csv', 'geojson', 'xlsx', 'ovkml', 'ovkmz'];

      let content;
      let isBinary;

      if (binaryFormats.includes(ext)) {
        // 二进制格式：直接传 Buffer（Uint8Array），避免 Array.from 展开导致大文件崩溃
        content = buffer;
        isBinary = true;
      } else if (textFormats.includes(ext)) {
        // 文本格式：传递字符串
        content = buffer.toString('utf-8');
        isBinary = false;
      } else {
        // 其他格式：尝试UTF-8
        content = buffer.toString('utf-8');
        isBinary = false;
      }
      
      return {
        path: filePath,
        name: path.basename(filePath),
        content: content,
        isBinary: isBinary
      };
    }).filter(Boolean);
    if (files.length > 0) {
      mainWindow.webContents.send('import-data', files);
    }
  }
}

// 导出数据
async function exportData() {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '导出地图数据',
    filters: [
      { name: 'KML', extensions: ['kml'] },
      { name: 'GPX', extensions: ['gpx'] },
      { name: 'GeoJSON', extensions: ['geojson'] },
      { name: 'CSV', extensions: ['csv'] }
    ]
  });

  if (!result.canceled && result.filePath) {
    mainWindow.webContents.send('export-data-request', result.filePath);
  }
}

// 显示关于
function showAbout() {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '关于广勘智图',
    message: '广勘智图 v1.0.0',
    detail: '专业测绘看图软件\n开发者：胡飘野\n\n支持多种地图源、数据格式、坐标系转换\n无VIP限制，无数量限制'
  });
}

// IPC 事件处理
ipcMain.handle('import-data', async (event) => {
  // 调用导入函数，它会通过send发送数据给渲染进程
  await importData();
  return true; // 返回成功状态
});

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    console.error('read-file 失败:', e.message);
    throw e;
  }
});

ipcMain.handle('write-file', async (event, filePath, content) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch (e) {
    console.error('write-file 失败:', e.message);
    throw e;
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});