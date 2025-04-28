// IPC Test Script
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  console.log('Creating test window');
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload', 'test-preload.js')
    }
  });

  const htmlPath = path.join(__dirname, 'renderer', 'test.html');
  console.log('Loading HTML file:', htmlPath);
  mainWindow.loadFile(htmlPath);
  mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  console.log('Electron app ready');
  createWindow();

  // Register test IPC handlers
  console.log('Registering test-ipc handler');
  ipcMain.handle('test-ipc', () => {
    console.log('Test IPC handler called from renderer');
    return 'IPC communication is working!';
  });

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
}); 