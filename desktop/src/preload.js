// Small, explicit bridge between the game page and the desktop shell.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('undercrankDesktop', {
  loadSave: () => ipcRenderer.sendSync('save:load'),
  writeSave: (json) => ipcRenderer.send('save:write', json),
  hostInfo: () => ipcRenderer.sendSync('host:info'),
  toggleFullscreen: () => ipcRenderer.send('win:fullscreen'),
  setFullscreen: (on) => ipcRenderer.send('win:setFullscreen', !!on),
  quit: () => ipcRenderer.send('app:quit'),
});
