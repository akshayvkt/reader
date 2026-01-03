// Type definitions for Electron API exposed via preload script

export interface ElectronAuthAPI {
  getToken: () => Promise<string | null>;
  setToken: (token: string) => Promise<boolean>;
  clearToken: () => Promise<boolean>;
  openLogin: () => Promise<boolean>;
  onAuthSuccess: (callback: (token: string) => void) => void;
}

export interface ElectronAPI {
  isElectron: boolean;
  getFilePath: (file: File) => string;
  readFile: (filePath: string) => Promise<ArrayBuffer>;
  fileExists: (filePath: string) => Promise<boolean>;
  getLibraryPath: () => Promise<string>;
  importBook: (originalPath: string) => Promise<string>;
  auth: ElectronAuthAPI;
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
