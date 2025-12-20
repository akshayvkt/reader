// Type definitions for Electron API exposed via preload script

export interface ElectronAPI {
  isElectron: boolean;
  readFile: (filePath: string) => Promise<ArrayBuffer>;
  fileExists: (filePath: string) => Promise<boolean>;
}

// Extend the Window interface to include electronAPI
declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

// Extend the File interface to include path (Electron-specific)
declare global {
  interface File {
    path?: string; // Only available in Electron
  }
}

export {};
