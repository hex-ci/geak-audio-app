import { contextBridge, ipcRenderer, webUtils } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
// Electron 32 起 <input type=file> 的 File.path 被移除，取真实路径必须走 webUtils.getPathForFile。
// contextBridge 的函数会把**原始 File 对象**透传给 preload，因此这样包装是官方推荐做法。
contextBridge.exposeInMainWorld('$electron', {
  getPathForFile(file) {
    return webUtils.getPathForFile(file);
  }
});

contextBridge.exposeInMainWorld('$ipcRenderer', {
  send(channel, ...args) {
    ipcRenderer.send(channel, ...args);
  },
  on(channel, func) {
    // Deliberately strip event as it includes `sender`
    ipcRenderer.on(channel, (event, ...args) => func(...args));
  },
  invoke(channel, ...args) {
    return ipcRenderer.invoke(channel, ...args);
  }
});
