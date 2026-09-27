// DESKTOP SHELL (Electron)
// Starts the embedded game server (which serves the client and hosts online rooms),
// then opens the game in a window. Saves live in the OS app-data folder.
import { app, BrowserWindow, ipcMain, Menu, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { startServer } from '../../server/src/app.js';

const PREFERRED_PORT = 3001;
let win = null;
let host = { port: 0, addresses: [] };

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  }
  return out;
}

const savePath = () => path.join(app.getPath('userData'), 'save.json');

ipcMain.on('save:load', (e) => {
  try {
    e.returnValue = fs.existsSync(savePath()) ? fs.readFileSync(savePath(), 'utf8') : null;
  } catch {
    e.returnValue = null;
  }
});
ipcMain.on('save:write', (_e, json) => {
  try {
    const tmp = `${savePath()}.tmp`;
    fs.writeFileSync(tmp, json);
    fs.renameSync(tmp, savePath());
  } catch (err) {
    console.error('save failed', err);
  }
});
ipcMain.on('host:info', (e) => {
  e.returnValue = host;
});
ipcMain.on('win:fullscreen', () => win?.setFullScreen(!win.isFullScreen()));
ipcMain.on('win:setFullscreen', (_e, on) => win?.setFullScreen(!!on));
ipcMain.on('app:quit', () => app.quit());

async function boot() {
  const distDir = path.join(app.getAppPath(), 'app');
  let server;
  try {
    server = await startServer({ port: PREFERRED_PORT, distDir });
  } catch {
    // Another program (or another copy of the game) owns the port: use any free one.
    server = await startServer({ port: 0, distDir });
  }
  host = { port: server.port, addresses: lanAddresses() };

  Menu.setApplicationMenu(null);
  win = new BrowserWindow({
    width: 1440,
    height: 810,
    minWidth: 480,
    minHeight: 270,
    backgroundColor: '#0d0b0a',
    title: 'The Undercrank',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(app.getAppPath(), 'build', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && (input.key === 'F11' || (input.alt && input.key === 'Enter'))) {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
  });
  await win.loadURL(`http://127.0.0.1:${server.port}/`);
  app.on('before-quit', () => server.close());
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.whenReady().then(boot).catch((err) => {
    dialog.showErrorBox('The Undercrank failed to start', String(err?.stack || err));
    app.quit();
  });
  app.on('window-all-closed', () => app.quit());
}
