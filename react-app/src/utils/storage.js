/**
 * IndexedDB 数据持久化存储
 * 支持项目数据、图层、标注、设置的本地存储
 */

const DB_NAME = 'MyMapViewer';
const DB_VERSION = 1;

// 存储对象名称
const STORES = {
  PROJECTS: 'projects',
  LAYERS: 'layers',
  MARKERS: 'markers',
  SETTINGS: 'settings',
  BOOKMARKS: 'bookmarks'
};

let db = null;

/**
 * 初始化数据库
 */
export async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      
      // 创建项目存储
      if (!database.objectStoreNames.contains(STORES.PROJECTS)) {
        const projectStore = database.createObjectStore(STORES.PROJECTS, { keyPath: 'id' });
        projectStore.createIndex('name', 'name', { unique: false });
        projectStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      
      // 创建图层存储
      if (!database.objectStoreNames.contains(STORES.LAYERS)) {
        const layerStore = database.createObjectStore(STORES.LAYERS, { keyPath: 'id' });
        layerStore.createIndex('projectId', 'projectId', { unique: false });
        layerStore.createIndex('order', 'order', { unique: false });
      }
      
      // 创建标注存储
      if (!database.objectStoreNames.contains(STORES.MARKERS)) {
        const markerStore = database.createObjectStore(STORES.MARKERS, { keyPath: 'id' });
        markerStore.createIndex('projectId', 'projectId', { unique: false });
        markerStore.createIndex('layerId', 'layerId', { unique: false });
      }
      
      // 创建设置存储
      if (!database.objectStoreNames.contains(STORES.SETTINGS)) {
        database.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }
      
      // 创建书签存储
      if (!database.objectStoreNames.contains(STORES.BOOKMARKS)) {
        const bookmarkStore = database.createObjectStore(STORES.BOOKMARKS, { keyPath: 'id' });
        bookmarkStore.createIndex('projectId', 'projectId', { unique: false });
      }
    };
  });
}

/**
 * 确保数据库已初始化
 */
async function ensureDB() {
  if (!db) await initDB();
  return db;
}

/**
 * 通用增删改查操作
 */
async function add(storeName, data) {
  const database = await ensureDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.add(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function put(storeName, data) {
  const database = await ensureDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function get(storeName, key) {
  const database = await ensureDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAll(storeName) {
  const database = await ensureDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deleteItem(storeName, key) {
  const database = await ensureDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function clear(storeName) {
  const database = await ensureDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getByIndex(storeName, indexName, value) {
  const database = await ensureDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ==================== 项目操作 ====================

export async function saveProject(project) {
  const data = {
    ...project,
    updatedAt: Date.now()
  };
  return put(STORES.PROJECTS, data);
}

export async function getProject(id) {
  return get(STORES.PROJECTS, id);
}

export async function getAllProjects() {
  const projects = await getAll(STORES.PROJECTS);
  return projects.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function deleteProject(id) {
  // 删除项目时同时删除相关的图层和标注
  const layers = await getLayersByProject(id);
  const markers = await getMarkersByProject(id);
  
  for (const layer of layers) {
    await deleteLayer(layer.id);
  }
  for (const marker of markers) {
    await deleteMarker(marker.id);
  }
  
  return deleteItem(STORES.PROJECTS, id);
}

export async function updateProjectTime(id) {
  const project = await getProject(id);
  if (project) {
    project.updatedAt = Date.now();
    return put(STORES.PROJECTS, project);
  }
}

// ==================== 图层操作 ====================

export async function saveLayer(layer) {
  return put(STORES.LAYERS, layer);
}

export async function getLayer(id) {
  return get(STORES.LAYERS, id);
}

export async function getLayersByProject(projectId) {
  return getByIndex(STORES.LAYERS, 'projectId', projectId);
}

export async function deleteLayer(id) {
  // 删除图层时同时删除相关的标注
  const markers = await getMarkersByLayer(id);
  for (const marker of markers) {
    await deleteMarker(marker.id);
  }
  return deleteItem(STORES.LAYERS, id);
}

export async function clearLayers(projectId) {
  const layers = await getLayersByProject(projectId);
  for (const layer of layers) {
    await deleteLayer(layer.id);
  }
}

// ==================== 标注操作 ====================

export async function saveMarker(marker) {
  return put(STORES.MARKERS, marker);
}

export async function getMarker(id) {
  return get(STORES.MARKERS, id);
}

export async function getMarkersByProject(projectId) {
  return getByIndex(STORES.MARKERS, 'projectId', projectId);
}

export async function getMarkersByLayer(layerId) {
  return getByIndex(STORES.MARKERS, 'layerId', layerId);
}

export async function deleteMarker(id) {
  return deleteItem(STORES.MARKERS, id);
}

export async function clearMarkers(projectId) {
  const markers = await getMarkersByProject(projectId);
  for (const marker of markers) {
    await deleteMarker(marker.id);
  }
}

// ==================== 设置操作 ====================

export async function saveSetting(key, value) {
  return put(STORES.SETTINGS, { key, value, updatedAt: Date.now() });
}

export async function getSetting(key) {
  const result = await get(STORES.SETTINGS, key);
  return result ? result.value : null;
}

export async function getAllSettings() {
  const settings = await getAll(STORES.SETTINGS);
  const result = {};
  settings.forEach(s => { result[s.key] = s.value; });
  return result;
}

// ==================== 书签操作 ====================

export async function saveBookmark(bookmark) {
  return put(STORES.BOOKMARKS, bookmark);
}

export async function getBookmark(id) {
  return get(STORES.BOOKMARKS, id);
}

export async function getBookmarksByProject(projectId) {
  return getByIndex(STORES.BOOKMARKS, 'projectId', projectId);
}

export async function deleteBookmark(id) {
  return deleteItem(STORES.BOOKMARKS, id);
}

// ==================== 项目保存/加载 ====================

/**
 * 保存整个项目（包含所有图层和标注）
 */
export async function saveFullProject(project, layers, markers) {
  // 保存项目
  await saveProject({
    ...project,
    layerCount: layers.length,
    markerCount: markers.length,
    updatedAt: Date.now()
  });
  
  // 保存图层
  for (const layer of layers) {
    await saveLayer({
      ...layer,
      projectId: project.id
    });
  }
  
  // 保存标注
  for (const marker of markers) {
    await saveMarker({
      ...marker,
      projectId: project.id
    });
  }
  
  return project.id;
}

/**
 * 加载整个项目
 */
export async function loadFullProject(projectId) {
  const project = await getProject(projectId);
  if (!project) return null;
  
  const layers = await getLayersByProject(projectId);
  const markers = await getMarkersByProject(projectId);
  
  return { project, layers, markers };
}

/**
 * 获取最近的项目
 */
export async function getRecentProject() {
  const projects = await getAllProjects();
  return projects.length > 0 ? projects[0] : null;
}

// ==================== 自动保存 ====================

let autoSaveTimer = null;

export function startAutoSave(callback, interval = 30000) {
  stopAutoSave();
  autoSaveTimer = setInterval(() => {
    if (callback) callback();
  }, interval);
}

export function stopAutoSave() {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer);
    autoSaveTimer = null;
  }
}

// 初始化数据库
initDB().catch(console.error);