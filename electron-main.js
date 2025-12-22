const { app, BrowserWindow, Menu, ipcMain, protocol } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

// Get the path to our books library folder
function getLibraryPath() {
  return path.join(app.getPath('userData'), 'books');
}

// Ensure the library folder exists
async function ensureLibraryExists() {
  const libraryPath = getLibraryPath();
  try {
    await fs.mkdir(libraryPath, { recursive: true });
  } catch (error) {
    console.error('Error creating library folder:', error);
  }
  return libraryPath;
}

let mainWindow;
// Use app.isPackaged to detect production mode - more reliable than NODE_ENV
const isDev = !app.isPackaged;

// Register custom protocol for serving static files in production
// This handles the absolute paths (/_next/...) that Next.js generates
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

function createWindow() {
  // Create the browser window with Mac-friendly settings
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset', // Mac-style integrated title bar
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: !isDev, // Allow loading local files in dev
      preload: path.join(__dirname, 'electron-preload.js')
    },
    backgroundColor: '#f9fafb', // Match your app's background
    show: false // Don't show until ready
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, use custom app:// protocol to load the static export
    // This allows absolute paths (/_next/...) to resolve correctly
    mainWindow.loadURL('app://./index.html');
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create app menu for Mac
function createMenu() {
  const template = [
    {
      label: 'Simple Reader',
      submenu: [
        { label: 'About Simple Reader', role: 'about' },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'Command+Q', click: () => app.quit() }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'Command+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'Shift+Command+Z', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'Command+X', role: 'cut' },
        { label: 'Copy', accelerator: 'Command+C', role: 'copy' },
        { label: 'Paste', accelerator: 'Command+V', role: 'paste' },
        { label: 'Select All', accelerator: 'Command+A', role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Reload', accelerator: 'Command+R', role: 'reload' },
        { label: 'Toggle Developer Tools', accelerator: 'Alt+Command+I', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Toggle Fullscreen', accelerator: 'Control+Command+F', role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { label: 'Minimize', accelerator: 'Command+M', role: 'minimize' },
        { label: 'Close', accelerator: 'Command+W', role: 'close' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  // In production, register the app:// protocol to serve static files
  // This allows Next.js absolute paths (/_next/...) to work correctly
  if (!isDev) {
    protocol.handle('app', (request) => {
      // Convert app://./path to actual file path
      let url = request.url.replace('app://.', '');
      // Remove query strings and hash
      url = url.split('?')[0].split('#')[0];
      // Decode URI components (spaces, special chars)
      url = decodeURIComponent(url);
      // Build the full path to the file in the out directory
      const filePath = path.join(__dirname, 'out', url);
      // Return the file using Electron's net module
      return require('electron').net.fetch('file://' + filePath);
    });
  }

  createMenu();
  createWindow();

  app.on('activate', () => {
    // On macOS, re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers for file operations

// Read a file and return its contents as ArrayBuffer
ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const buffer = await fs.readFile(filePath);
    // Convert Node Buffer to ArrayBuffer for the renderer
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  } catch (error) {
    console.error('Error reading file:', error);
    throw new Error(`Failed to read file: ${error.message}`);
  }
});

// Check if a file exists
ipcMain.handle('file-exists', async (event, filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
});

// Get the library folder path
ipcMain.handle('get-library-path', async () => {
  return await ensureLibraryExists();
});

// Import a book into the library (copy from original location)
// Returns the new file path in the library
ipcMain.handle('import-book', async (event, originalPath) => {
  try {
    const libraryPath = await ensureLibraryExists();

    // Read the original file
    const fileBuffer = await fs.readFile(originalPath);

    // Generate a unique filename using hash of content + original name
    const hash = crypto.createHash('md5').update(fileBuffer).digest('hex').slice(0, 8);
    const ext = path.extname(originalPath);
    const baseName = path.basename(originalPath, ext);
    // Sanitize filename (remove special characters)
    const safeName = baseName.replace(/[^a-zA-Z0-9-_\s]/g, '').trim();
    const newFileName = `${safeName}-${hash}${ext}`;
    const newFilePath = path.join(libraryPath, newFileName);

    // Check if file already exists in library (same content)
    try {
      await fs.access(newFilePath);
      // File already exists, just return its path
      return newFilePath;
    } catch {
      // File doesn't exist, copy it
      await fs.writeFile(newFilePath, fileBuffer);
      return newFilePath;
    }
  } catch (error) {
    console.error('Error importing book:', error);
    throw new Error(`Failed to import book: ${error.message}`);
  }
});