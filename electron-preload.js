const { contextBridge, ipcRenderer, webUtils } = require('electron');

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Check if we're running in Electron
  isElectron: true,

  // Get the file path from a File object (Electron-specific)
  getFilePath: (file) => webUtils.getPathForFile(file),

  // Read a file by path and return its contents as ArrayBuffer
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),

  // Check if a file exists
  fileExists: (filePath) => ipcRenderer.invoke('file-exists', filePath),

  // Get the library folder path
  getLibraryPath: () => ipcRenderer.invoke('get-library-path'),

  // Import a book into the library (copy from original location)
  // Returns the new file path in the library
  importBook: (originalPath) => ipcRenderer.invoke('import-book', originalPath),

  // ========== Auth Methods ==========
  auth: {
    // Get stored auth token
    getToken: () => ipcRenderer.invoke('auth-get-token'),

    // Store auth token
    setToken: (token) => ipcRenderer.invoke('auth-set-token', token),

    // Clear auth token (logout)
    clearToken: () => ipcRenderer.invoke('auth-clear-token'),

    // Open login URL in system browser
    openLogin: () => ipcRenderer.invoke('auth-open-login'),

    // Listen for auth success from main process (after OAuth callback)
    onAuthSuccess: (callback) => {
      ipcRenderer.on('auth-success', (event, token) => callback(token));
    },
  },
});
