const { app, BrowserWindow, Menu, ipcMain, Tray } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');

let mainWindow;
let tray = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 440,
    height: 720,
    frame: false,             // Frameless for a clean widget look
    transparent: true,         // Allows glassmorphism transparent borders
    alwaysOnTop: true,         // Keeps the widget floating
    resizable: false,
    maximizable: false,
    title: "Rexermi Server Monitor",
    webPreferences: {
      nodeIntegration: true,   // Enabled for local file operations and IPC
      contextIsolation: false, // Disabled to allow direct require in index.html
      enableRemoteModule: false,
      webSecurity: false      // Bypasses CORS policy blocks for local file:// calls
    }
  });

  // Remove default menus
  Menu.setApplicationMenu(null);

  // Load the local HTML file
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open Developer Tools to debug login responses
  // mainWindow.webContents.openDevTools({ mode: 'detach' });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Helper functions to find and show/hide the console windows in Windows
const showTerminals = () => {
  const psCmd = `powershell -WindowStyle Hidden -Command "Add-Type -Name Window -Namespace Win32 -MemberDefinition '[DllImport(\\\"user32.dll\\\")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);'; $handles = @( (Get-Process | Where-Object MainWindowTitle -like '*next-server*').MainWindowHandle ) + @( (Get-Process | Where-Object MainWindowTitle -like '*Rexermi*').MainWindowHandle ) | Where-Object { $_ -ne $null -and $_ -ne 0 }; foreach ($h in $handles) { [Win32.Window]::ShowWindow($h, 5) }"`;
  exec(psCmd);
};

const hideTerminals = () => {
  const psCmd = `powershell -WindowStyle Hidden -Command "Add-Type -Name Window -Namespace Win32 -MemberDefinition '[DllImport(\\\"user32.dll\\\")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);'; $handles = @( (Get-Process | Where-Object MainWindowTitle -like '*next-server*').MainWindowHandle ) + @( (Get-Process | Where-Object MainWindowTitle -like '*Rexermi*').MainWindowHandle ) | Where-Object { $_ -ne $null -and $_ -ne 0 }; foreach ($h in $handles) { [Win32.Window]::ShowWindow($h, 0) }"`;
  exec(psCmd);
};

function showApp() {
  if (mainWindow) {
    mainWindow.show();
  }
  if (process.platform === 'win32') {
    showTerminals();
  }
}

function hideApp() {
  if (mainWindow) {
    if (mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.webContents.closeDevTools();
    }
    mainWindow.hide();
  }
  if (process.platform === 'win32') {
    hideTerminals();
  }
}

// IPC listener to turn on the local server directly (runs npm run dev)
ipcMain.on('start-server', (event) => {
  console.log('IPC: start-server requested.');
  const platform = process.platform;
  let cmd = '';
  const rootDir = path.join(__dirname, '..');

  if (platform === 'win32') {
    // Run npm run dev in a new command window titled "Rexermi Server Terminal"
    cmd = 'start "Rexermi Server Terminal" cmd /k "npm run dev"';
  } else {
    // On Linux/macOS
    cmd = 'x-terminal-emulator -T "Rexermi Server Terminal" -e npm run dev || gnome-terminal --title="Rexermi Server Terminal" -- npm run dev || xterm -T "Rexermi Server Terminal" -e npm run dev || npm run dev';
  }

  exec(cmd, { cwd: rootDir }, (error) => {
    if (error) {
      console.error('IPC start-server failed:', error);
      event.reply('start-server-response', { success: false, error: error.message });
    } else {
      console.log('IPC start-server command executed.');
      event.reply('start-server-response', { success: true });
    }
  });
});

// IPC listener to hide the app/terminal in tray
ipcMain.on('hide-app', () => {
  console.log('IPC: hide-app requested.');
  hideApp();
});

// IPC listener to minimize the app window to the taskbar
ipcMain.on('minimize-app', () => {
  if (mainWindow) mainWindow.minimize();
});

// Function to check connected keyboards/HID devices to find barcode scanner
const checkBarcodeScanner = (callback) => {
  const platform = process.platform;
  if (platform !== 'win32') {
    // Basic fallback for non-Windows platforms
    callback({
      success: true,
      connected: false,
      devices: [],
      errors: []
    });
    return;
  }

  // Query present keyboards and HID devices in Windows
  const cmd = `powershell -WindowStyle Hidden -Command "Get-PnpDevice -Class Keyboard,HIDClass -PresentOnly | Select-Object FriendlyName, InstanceId, Status | ConvertTo-Json"`;
  
  exec(cmd, (error, stdout) => {
    if (error) {
      console.error('checkBarcodeScanner cmd failed:', error);
      callback({ success: false, error: error.message });
      return;
    }
    try {
      if (!stdout.trim()) {
        callback({ success: true, connected: false, devices: [], errors: [] });
        return;
      }
      const devices = JSON.parse(stdout) || [];
      const deviceList = Array.isArray(devices) ? devices : [devices];
      
      // Filter out null/undefined devices
      const cleanList = deviceList.filter(d => d && (d.FriendlyName || d.InstanceId));
      
      // Determine if a barcode scanner is connected
      const hasScanner = cleanList.some(d => {
        const name = (d.FriendlyName || '').toLowerCase();
        const id = (d.InstanceId || '').toLowerCase();
        return name.includes('scan') || name.includes('bar') || name.includes('symbol') || 
               name.includes('zebra') || name.includes('honeywell') || name.includes('datalogic') || 
               name.includes('motorola') || id.includes('vid_05e0') || id.includes('vid_0c2e') || 
               id.includes('vid_05f9');
      });
      
      // Find devices with non-OK status
      const errors = cleanList.filter(d => d.Status && d.Status !== 'OK' && d.Status !== 'Unknown');

      callback({
        success: true,
        connected: hasScanner || cleanList.some(d => d.FriendlyName && d.FriendlyName.toLowerCase().includes('teclado hid')),
        devices: cleanList,
        errors: errors
      });
    } catch (err) {
      console.error('checkBarcodeScanner parsing failed:', err);
      callback({ success: false, error: err.message });
    }
  });
};

// IPC listener to check barcode scanner status
ipcMain.on('get-scanner-status', (event) => {
  checkBarcodeScanner((result) => {
    event.reply('get-scanner-status-response', result);
  });
});

app.whenReady().then(() => {
  createWindow();

  // Create Tray Icon
  try {
    const iconPath = path.join(__dirname, 'icon.png');
    const publicIconPath = path.join(__dirname, '..', 'public', 'icon-192x192.png');
    if (!fs.existsSync(iconPath) && fs.existsSync(publicIconPath)) {
      fs.copyFileSync(publicIconPath, iconPath);
    }
    
    tray = new Tray(fs.existsSync(iconPath) ? iconPath : publicIconPath);
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Mostrar Widget y Terminal', click: () => { showApp(); } },
      { label: 'Ocultar en Segundo Plano', click: () => { hideApp(); } },
      { type: 'separator' },
      { label: 'Salir Completo', click: () => { app.quit(); } }
    ]);
    
    tray.setToolTip('Rexermi Server Control');
    tray.setContextMenu(contextMenu);

    // Clicking tray icon toggles app visibility
    tray.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          hideApp();
        } else {
          showApp();
        }
      }
    });
  } catch (err) {
    console.error('Failed to create tray icon:', err);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
