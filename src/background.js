'use strict'

import { app, BrowserWindow, Menu, Tray } from 'electron'
import path from 'path'
import { install } from './lib/event'
import { APP_INDEX_URL, registerAppProtocol, registerAppScheme } from './lib/app-protocol'

// 是否开发模式：以「是否打包」为准，不再依赖 NODE_ENV（打包后 NODE_ENV 未必存在）
const isDevelopment = !app.isPackaged

// 注册 app:// 协议的特权（必须在 app ready 之前，见 lib/app-protocol.js）
registerAppScheme()

let tray = null;
let win = null;

const gotTheLock = app.requestSingleInstanceLock();

async function createWindow() {
  // Create the browser window.
  win = new BrowserWindow({
    width: 1280,
    height: 900,
    center: true,
    title: '应用正在初始化...',
    webPreferences: {
      // 渲染层只通过 preload 暴露的 window.$ipcRenderer 与主进程通信
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  win.removeMenu();

  if (process.env.VITE_DEV_SERVER_URL) {
    // Load the url of the dev server if in development mode
    await win.loadURL(process.env.VITE_DEV_SERVER_URL)
    if (!process.env.IS_TEST) win.webContents.openDevTools()
  } else {
    // 生产：自定义 app:// 协议（资源用相对路径，见 vite.config.js 的 base: './'）
    await win.loadURL(APP_INDEX_URL)
  }

  if (process.platform === 'win32') {
    // eslint-disable-next-line no-undef
    tray = new Tray(path.join(__static, 'logo.png'));
    const contextMenu = Menu.buildFromTemplate([
      {
        label: '打开',
        click() {
          win.show();
        }
      },
      {
        label: '退出',
        click() {
          app.quit()
        }
      }
    ]);
    tray.setToolTip(win.getTitle());
    tray.setContextMenu(contextMenu);
    tray.on('click', () => {
      win.show();
    });
  }

  win.setTitle(`${win.getTitle()} v${app.getVersion()}`);
}

if (!gotTheLock) {
  app.quit()
}
else {
  app.on('second-instance', () => {
    // 有人试图运行第二个实例，我们应该关注我们的窗口
    if (win) {
      if (!win.isVisible()) {
        win.show();
      }
      if (win.isMinimized()) {
        win.restore()
      }
      win.focus()
    }
  });

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  // 不再自动安装 Vue Devtools：electron-devtools-installer 已移除，
  // 开发期调试由 Vite 侧的 vite-plugin-vue-devtools 提供。
  app.on('ready', () => {
    // app:// 的处理器要在 ready 之后注册，__dirname 是产物目录（打包后即 asar 内）
    registerAppProtocol(__dirname)
    createWindow()
  });

  // Quit when all windows are closed.
  app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  // Exit cleanly on request from parent process in development mode.
  if (isDevelopment) {
    if (process.platform === 'win32') {
      process.on('message', (data) => {
        if (data === 'graceful-exit') {
          app.quit()
        }
      })
    } else {
      process.on('SIGTERM', () => {
        app.quit()
      })
    }
  }

  app.setName('GEAK Audio');

  install();
}
