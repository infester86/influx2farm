import { app, BrowserWindow, Menu, shell, type MenuItemConstructorOptions } from 'electron'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { registerIpcHandlers } from './ipc'
import { loadEnv } from './env'
import { IPC } from '../shared/ipc'

const __dirname = dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 780,
    show: false,
    autoHideMenuBar: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function installAppMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'Datei',
      submenu: [
        {
          label: 'Einstellungen…',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            // Explizites, klonbares Payload — leeres send() kann in Electron „could not be cloned“ auslösen
            mainWindow?.webContents.send(IPC.APP_OPEN_SETTINGS, {})
          }
        },
        { type: 'separator' },
        { role: 'quit', label: 'Beenden' }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(() => {
  try {
    loadEnv()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(msg)
  }

  registerIpcHandlers(() => mainWindow)
  installAppMenu()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
