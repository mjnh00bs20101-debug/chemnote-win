const { contextBridge, webFrame, ipcRenderer } = require('electron');

// Khoá zoom toàn trang của Chromium để tính năng pinch-to-zoom 2 ngón trên canvas luôn sắc nét
webFrame.setVisualZoomLevelLimits(1, 1);

contextBridge.exposeInMainWorld('chemnoteDesktop', {
  isElectron: true,
  platform: process.platform,
  getUpdateState: () => ipcRenderer.invoke('chemnote:get-update-state'),
  checkForUpdates: () => ipcRenderer.invoke('chemnote:check-for-updates'),
  installUpdateNow: () => ipcRenderer.invoke('chemnote:install-update'),
  onUpdateStatus: (cb) => {
    if (typeof cb !== 'function') return;
    ipcRenderer.on('chemnote:update-status', (_event, st) => {
      try { cb(st); } catch (_) {}
    });
  }
});
