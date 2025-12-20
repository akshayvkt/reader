const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Check if we're running in Electron
  isElectron: true,

  // Read a file by path and return its contents as ArrayBuffer
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),

  // Check if a file exists
  fileExists: (filePath) => ipcRenderer.invoke('file-exists', filePath),
});
