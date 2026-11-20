const { contextBridge, webFrame } = require('electron');

// Khoá zoom toàn trang của Chromium để tính năng pinch-to-zoom 2 ngón trên canvas luôn sắc nét
webFrame.setVisualZoomLevelLimits(1, 1);

contextBridge.exposeInMainWorld('chemnoteDesktop', {
  isElectron: true,
  platform: process.platform
});
