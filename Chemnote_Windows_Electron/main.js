const path = require('path');
const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');

let autoUpdater = null;
try {
  ({ autoUpdater } = require('electron-updater'));
} catch (_) {
  autoUpdater = null;
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

let mainWindow = null;
let updaterState = {
  status: 'idle',
  currentVersion: app.getVersion(),
  version: '',
  percent: 0,
  message: ''
};

function broadcastUpdateState(patch) {
  updaterState = Object.assign({}, updaterState, patch, { currentVersion: app.getVersion() });
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    try {
      mainWindow.webContents.send('chemnote:update-status', updaterState);
    } catch (_) {}
  }
}

function setupAutoUpdater() {
  if (!autoUpdater) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on('checking-for-update', () => {
    broadcastUpdateState({ status: 'checking', percent: 0, message: '' });
  });

  autoUpdater.on('update-available', (info) => {
    broadcastUpdateState({
      status: 'available',
      version: (info && info.version) ? String(info.version) : '',
      percent: 0,
      message: ''
    });
  });

  autoUpdater.on('download-progress', (prog) => {
    broadcastUpdateState({
      status: 'downloading',
      percent: prog && typeof prog.percent === 'number' ? Math.round(prog.percent) : 0
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    broadcastUpdateState({
      status: 'downloaded',
      version: (info && info.version) ? String(info.version) : updaterState.version,
      percent: 100
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    broadcastUpdateState({
      status: 'not-available',
      version: (info && info.version) ? String(info.version) : app.getVersion(),
      percent: 0
    });
  });

  autoUpdater.on('error', (err) => {
    broadcastUpdateState({
      status: 'error',
      message: err && err.message ? String(err.message) : String(err || 'Update error')
    });
  });
}

ipcMain.handle('chemnote:get-update-state', () => {
  return Object.assign({}, updaterState, { currentVersion: app.getVersion(), isPackaged: app.isPackaged });
});

ipcMain.handle('chemnote:check-for-updates', async () => {
  if (!autoUpdater) {
    broadcastUpdateState({ status: 'error', message: 'electron-updater unavailable' });
    return updaterState;
  }
  if (!app.isPackaged) {
    broadcastUpdateState({ status: 'not-available', version: app.getVersion(), message: 'dev-mode' });
    return updaterState;
  }
  try {
    await autoUpdater.checkForUpdates();
  } catch (err) {
    broadcastUpdateState({
      status: 'error',
      message: err && err.message ? String(err.message) : 'Check failed'
    });
  }
  return updaterState;
});

ipcMain.handle('chemnote:install-update', () => {
  if (autoUpdater && updaterState.status === 'downloaded') {
    setImmediate(() => {
      autoUpdater.quitAndInstall(false, true);
    });
    return { ok: true };
  }
  return { ok: false, status: updaterState.status };
});

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'ChemNote',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (app.isPackaged) {
    Menu.setApplicationMenu(null);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (app.isPackaged && autoUpdater) {
      setTimeout(() => {
        autoUpdater.checkForUpdates().catch(() => {});
      }, 3500);
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url && /^https?:\/\//i.test(url)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      event.preventDefault();
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'app', 'index.html'));
}

app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

app.whenReady().then(() => {
  setupAutoUpdater();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
