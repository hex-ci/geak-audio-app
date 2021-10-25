import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
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
