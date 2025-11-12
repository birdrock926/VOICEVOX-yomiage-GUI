const { app, BrowserWindow, ipcMain, globalShortcut, Menu, Tray, dialog, shell } = require('electron');
const path = require('path');
const { spawn, exec, fork } = require('child_process');
const fs = require('fs');
const { EngineDownloader, ENGINE_TYPES } = require('./engineDownloader.cjs');

let mainWindow = null;
let serverProcess = null;
let voicevoxProcess = null;
let tray = null;
let httpServer = null;
let currentEngineType = null; // Track which engine is currently in use

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Setup logging to file
let logPath;
try {
  logPath = isDev
    ? path.join(__dirname, '../app.log')
    : path.join(app.getPath('userData'), 'app.log');
} catch (err) {
  // Fallback if app is not ready yet
  logPath = path.join(__dirname, '../app.log');
}

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(message);
  try {
    fs.appendFileSync(logPath, logMessage);
  } catch (err) {
    console.error('Failed to write log:', err);
  }
}

log('Application starting...');
log('isDev: ' + isDev);
log('Log path: ' + logPath);

// Single instance lock - must be before app.whenReady()
const gotTheLock = app.requestSingleInstanceLock();
log('Single instance lock: ' + gotTheLock);
if (!gotTheLock) {
  log('Another instance is already running, quitting...');
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});



// Get the base path for VOICEVOX engine installation
// Always use userData for writable location, avoiding Program Files permission issues
function getEngineBasePath() {
  if (isDev) {
    return path.join(__dirname, '../voicevox-engine');
  } else {
    // Use userData directory for production (writable location)
    return path.join(app.getPath('userData'), 'voicevox-engine');
  }
}

// Fix nested engine directory structure (for engines downloaded with older code)
function fixEngineDirectoryStructure(enginePath) {
  try {
    log('Checking engine directory structure: ' + enginePath);

    if (!fs.existsSync(enginePath)) {
      return false;
    }

    // Check if run.exe exists at the expected location
    const runExe = path.join(enginePath, 'run.exe');
    if (fs.existsSync(runExe)) {
      log('Engine directory structure is correct');
      // IMPORTANT: Do NOT delete subdirectories like engine_internal, model, resources
      // These are required for the engine to run!
      return true;
    }

    // If run.exe doesn't exist, check for nested directory
    const items = fs.readdirSync(enginePath);
    log('Items in engine directory: ' + items.join(', '));

    // Look for a single nested directory
    if (items.length === 1) {
      const nestedPath = path.join(enginePath, items[0]);
      const stat = fs.statSync(nestedPath);

      if (stat.isDirectory()) {
        const nestedRunExe = path.join(nestedPath, 'run.exe');

        if (fs.existsSync(nestedRunExe)) {
          log('Found nested directory structure, fixing...');
          log('Moving contents from: ' + nestedPath);

          // Move all contents from nested directory to parent
          const contents = fs.readdirSync(nestedPath);
          for (const item of contents) {
            const srcPath = path.join(nestedPath, item);
            const destPath = path.join(enginePath, item);

            try {
              fs.renameSync(srcPath, destPath);
            } catch (err) {
              log('Error moving ' + item + ': ' + err.message);
            }
          }

          // Remove empty nested directory
          try {
            fs.rmdirSync(nestedPath);
            log('Successfully fixed engine directory structure');
            return true;
          } catch (err) {
            log('Error removing nested directory: ' + err.message);
          }
        }
      }
    }

    return false;
  } catch (error) {
    log('Error fixing engine directory structure: ' + error.message);
    return false;
  }
}

// Helper function to recursively remove a directory
function removeDirectory(dirPath) {
  if (fs.existsSync(dirPath)) {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        removeDirectory(filePath);
      } else {
        fs.unlinkSync(filePath);
      }
    }
    fs.rmdirSync(dirPath);
  }
}

// Detect which engine is installed (prefer CUDA > DirectML > CPU)
async function detectInstalledEngine() {
  const engineBasePath = getEngineBasePath();

  const downloader = new EngineDownloader(engineBasePath);
  const engineOrder = ['cuda', 'directml', 'cpu']; // Preference order

  for (const engineType of engineOrder) {
    try {
      const isInstalled = await downloader.checkEngineInstalled(engineType);
      if (isInstalled) {
        log(`Detected installed engine: ${engineType}`);
        return engineType;
      }
    } catch (err) {
      // Continue to next engine type
    }
  }

  log('No engine detected, will use default');
  return null;
}

// Start bundled VOICEVOX Engine
async function startVoicevoxEngine(engineType) {
  log('Starting VOICEVOX Engine...');

  try {
    // Detect installed engine if not specified
    let engineToUse = engineType || currentEngineType;

    if (!engineToUse) {
      log('No engine type specified, detecting installed engine...');
      engineToUse = await detectInstalledEngine();
    }

    // Final fallback to 'cuda' (user should have downloaded one during setup)
    engineToUse = engineToUse || 'cuda';
    log('Using engine type: ' + engineToUse);

    // Determine engine base path (uses userData for writable location)
    const engineBasePath = getEngineBasePath();

    // Engine path includes the type subdirectory
    const enginePath = path.join(engineBasePath, engineToUse);

    log('Engine directory: ' + enginePath);
    log('Engine directory exists: ' + fs.existsSync(enginePath));

    if (!fs.existsSync(enginePath)) {
      log('ERROR: VOICEVOX Engine directory not found!');
      throw new Error('VOICEVOX Engine not found in: ' + enginePath);
    }

    // Fix directory structure if needed (for engines downloaded with older code)
    fixEngineDirectoryStructure(enginePath);

    // Store the current engine type
    currentEngineType = engineToUse;

    // Find the run executable
    let runExecutable;
    const platform = process.platform;

    if (platform === 'win32') {
      // Windows: Look for run.exe
      const runExe = path.join(enginePath, 'run.exe');
      if (fs.existsSync(runExe)) {
        runExecutable = runExe;
      } else {
        // Fallback: look for any .exe file
        const files = fs.readdirSync(enginePath);
        const exeFile = files.find(f => f.endsWith('.exe') && f.toLowerCase().includes('run'));
        if (exeFile) {
          runExecutable = path.join(enginePath, exeFile);
        }
      }
    } else if (platform === 'darwin') {
      // macOS: Look for run script
      runExecutable = path.join(enginePath, 'run');
    } else {
      // Linux: Look for run script
      runExecutable = path.join(enginePath, 'run');
    }

    if (!runExecutable || !fs.existsSync(runExecutable)) {
      log('ERROR: VOICEVOX Engine executable not found in: ' + enginePath);
      log('Please extract the VOICEVOX Engine to: ' + enginePath);
      throw new Error('VOICEVOX Engine executable not found');
    }

    log('Starting engine: ' + runExecutable);

    // Start the engine process with appropriate flags
    const args = ['--host', '127.0.0.1', '--port', '50021'];

    // Add GPU flag for CUDA and DirectML engines
    if (engineToUse === 'cuda' || engineToUse === 'directml') {
      args.push('--use_gpu');
      log('GPU mode enabled for ' + engineToUse);
    }

    voicevoxProcess = spawn(runExecutable, args, {
      cwd: enginePath,
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Log engine output
    voicevoxProcess.stdout.on('data', (data) => {
      log('[Engine STDOUT] ' + data.toString().trim());
    });

    voicevoxProcess.stderr.on('data', (data) => {
      log('[Engine STDERR] ' + data.toString().trim());
    });

    voicevoxProcess.on('error', (error) => {
      log('[Engine Error] ' + error.message);
    });

    voicevoxProcess.on('exit', (code, signal) => {
      log('[Engine Exit] Code: ' + code + ', Signal: ' + signal);
      voicevoxProcess = null;
    });

    log('VOICEVOX Engine started successfully');

    // Wait a bit for engine to initialize
    await new Promise(resolve => setTimeout(resolve, 3000));

  } catch (err) {
    log('Failed to start VOICEVOX Engine: ' + err.message);
    log('Stack trace: ' + err.stack);
    // Don't show error dialog for engine failure - just log it
    // The app can still run without the engine
  }
}


async function startServer() {
  log('Starting server...');
  try {
    // Import server modules in main process
    log('Importing express modules...');
    const express = require('express');
    const { createServer } = require('http');
    const { Server } = require('socket.io');
    const cors = require('cors');

    const serverApp = express();
    httpServer = createServer(serverApp);
    const io = new Server(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    const PORT = process.env.PORT || 3001;
    log('Server port: ' + PORT);

    // Load VoiceVox client
    const voicevoxPath = isDev
      ? path.join(__dirname, '../server/voicevox.cjs')
      : path.join(process.resourcesPath, 'app.asar.unpacked', 'server', 'voicevox.cjs');

    log('VoiceVox path: ' + voicevoxPath);
    log('VoiceVox path exists: ' + fs.existsSync(voicevoxPath));

    let VoiceVoxClient;
    try {
      // Use require for CommonJS modules
      log('Attempting to load VoiceVox client...');
      VoiceVoxClient = require(voicevoxPath);
      log('VoiceVox client loaded successfully');
    } catch (err) {
      log('Failed to load VoiceVox client, using mock: ' + err.message);
      // Fallback mock client
      VoiceVoxClient = class {
        async checkHealth() { return false; }
        async getSpeakers() { return []; }
        async synthesize() { return Buffer.from(''); }
      };
    }

    const voicevox = new VoiceVoxClient();

    serverApp.use(cors());
    serverApp.use(express.json());

    // Health check endpoint
    serverApp.get('/api/health', async (req, res) => {
      const isVoicevoxHealthy = await voicevox.checkHealth();
      res.json({
        status: 'ok',
        voicevox: isVoicevoxHealthy ? 'connected' : 'disconnected'
      });
    });

    // Get speakers endpoint
    serverApp.get('/api/speakers', async (req, res) => {
      try {
        const speakers = await voicevox.getSpeakers();
        res.json(speakers);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // WebSocket connection handler
    io.on('connection', (socket) => {
      log('Client connected: ' + socket.id);

      socket.on('check_voicevox', async (callback) => {
        try {
          log('Checking VOICEVOX connection...');
          const isConnected = await voicevox.checkHealth();
          log('VOICEVOX connection status: ' + isConnected);
          if (callback) callback({ connected: isConnected });
        } catch (error) {
          log('Error checking VOICEVOX: ' + error.message);
          if (callback) callback({ connected: false });
        }
      });

      socket.on('get_speakers', async (callback) => {
        try {
          log('Getting speakers from VOICEVOX...');
          const speakers = await voicevox.getSpeakers();
          log('Loaded ' + speakers.length + ' speakers');
          if (callback) callback({ success: true, speakers: speakers });
        } catch (error) {
          log('Error getting speakers: ' + error.message);
          if (callback) callback({ success: false, speakers: [] });
        }
      });

      socket.on('synthesize', async (data, callback) => {
        try {
          log('Synthesizing text: ' + data.text.substring(0, 50) + '...');
          const startTime = Date.now();
          const audioBuffer = await voicevox.synthesize(data.text, data.speakerId, data.options);
          const elapsed = Date.now() - startTime;
          const audioBase64 = audioBuffer.toString('base64');

          log('Synthesis completed in ' + elapsed + 'ms, size: ' + audioBuffer.length + ' bytes');

          if (callback) {
            callback({
              success: true,
              audio: audioBase64,
              elapsed: elapsed,
              size: audioBuffer.length
            });
          }
        } catch (error) {
          log('Error synthesizing: ' + error.message);
          if (callback) {
            callback({
              success: false,
              error: error.message
            });
          }
        }
      });

      socket.on('disconnect', () => {
        log('Client disconnected: ' + socket.id);
      });
    });

    // Start server
    httpServer.listen(PORT, () => {
      log('Server running on port ' + PORT);
    });

  } catch (err) {
    log('Failed to start server: ' + err.message);
    log('Stack trace: ' + err.stack);
    dialog.showErrorBox('Server Error', `Failed to start internal server: ${err.message}\n\nCheck log file at: ${logPath}`);
  }
}


function createWindow() {
  log('Creating window...');

  // Determine icon path based on environment
  const iconPath = isDev
    ? path.join(__dirname, '../build/icon.png')
    : path.join(process.resourcesPath, 'icon.png');

  log('Icon path: ' + iconPath);
  log('Icon exists: ' + fs.existsSync(iconPath));

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'ずんだもんVC読み上げ',
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    backgroundColor: '#1a1a1a',
    show: false,
    autoHideMenuBar: true
  });


  mainWindow.once('ready-to-show', () => {
    log('Window ready to show');
    mainWindow.show();
  });

  // Handle renderer process crashes
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    log('CRITICAL: Renderer process crashed!');
    log('Reason: ' + details.reason);
    log('Exit code: ' + details.exitCode);

    // Show error dialog
    const { dialog } = require('electron');
    dialog.showErrorBox(
      'アプリケーションエラー',
      `レンダラープロセスがクラッシュしました。\n\n理由: ${details.reason}\n終了コード: ${details.exitCode}\n\nアプリを再起動してください。`
    );
  });

  // Handle unresponsive renderer
  mainWindow.on('unresponsive', () => {
    log('WARNING: Window became unresponsive');
  });

  mainWindow.on('responsive', () => {
    log('Window became responsive again');
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    log('Opening external URL in browser: ' + url);
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });

  // Prevent navigation to external URLs within the app
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Allow navigation within the app
    const appUrl = isDev ? 'http://localhost:3000' : 'file://';
    if (!url.startsWith(appUrl)) {
      event.preventDefault();
      log('Preventing navigation, opening in browser: ' + url);
      require('electron').shell.openExternal(url);
    }
  });

  // Log all console messages from renderer process
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    log(`Renderer console [${level}]: ${message} (${sourceId}:${line})`);
  });

  // Log page load failures
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    log(`Failed to load: ${validatedURL}`);
    log(`Error code: ${errorCode}`);
    log(`Error: ${errorDescription}`);
  });

  // Log when page finishes loading
  mainWindow.webContents.on('did-finish-load', () => {
    log('Page finished loading');
  });

  // Enable F12 to toggle DevTools
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools();
      }
    }
  });

  // Log navigation events
  mainWindow.webContents.on('did-start-loading', () => {
    log('Page started loading');
  });

  if (isDev) {
    log('Loading dev URL: http://localhost:3000');
    mainWindow.loadURL('http://localhost:3000');
  } else {
    // Load from unpacked dist directory
    const distPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'index.html');
    log('Dist path: ' + distPath);
    log('Dist exists: ' + fs.existsSync(distPath));

    if (!fs.existsSync(distPath)) {
      log('ERROR: dist directory not found!');
      dialog.showErrorBox(
        'Build Error',
        'The application has not been built properly.\n\n' +
        'Please run "npm run build" before building the executable.\n\n' +
        'Missing file: ' + distPath + '\n\n' +
        'Log file: ' + logPath
      );
      app.quit();
      return;
    }
    log('Loading dist file: ' + distPath);

    // Check if dist directory has expected files
    const distDir = path.join(process.resourcesPath, 'app.asar.unpacked', 'dist');
    try {
      const files = fs.readdirSync(distDir);
      log('Dist directory contents: ' + files.join(', '));
    } catch (err) {
      log('Failed to read dist directory: ' + err.message);
    }

    mainWindow.loadFile(distPath);
  }


  mainWindow.on('closed', () => {
    log('Window closed');
    mainWindow = null;
  });

  // Create tray with error handling
  try {
    createTray();
  } catch (err) {
    log('Failed to create tray, continuing without it: ' + err.message);
  }
}


function createTray() {
  // Use .ico file for Windows
  const iconPath = isDev
    ? path.join(__dirname, '../build/icon.ico')
    : path.join(process.resourcesPath, 'icon.ico');

  log('Tray icon path: ' + iconPath);
  log('Tray icon exists: ' + fs.existsSync(iconPath));

  if (!fs.existsSync(iconPath)) {
    log('Tray icon not found, skipping tray creation');
    return;
  }

  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '表示',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: '設定',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send('open-settings');
        }
      }
    },
    {
      label: '開発者ツール',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          if (mainWindow.webContents.isDevToolsOpened()) {
            mainWindow.webContents.closeDevTools();
          } else {
            mainWindow.webContents.openDevTools();
          }
        }
      }
    },
    { type: 'separator' },
    {
      label: '終了',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setToolTip('VOICEVOX VC読み上げ');
  tray.setContextMenu(contextMenu);


  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}


function registerGlobalHotkeys() {

  const hotkeys = {
    toggleWindow: 'CommandOrControl+Shift+Z',
    quickRead: 'CommandOrControl+Shift+R'
  };

  try {

    const toggleRegistered = globalShortcut.register(hotkeys.toggleWindow, () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });

    const quickReadRegistered = globalShortcut.register(hotkeys.quickRead, () => {
      if (mainWindow) {
        mainWindow.webContents.send('quick-read-clipboard');
      }
    });

    log('Global hotkeys registered: toggle=' + toggleRegistered + ', quickRead=' + quickReadRegistered);
  } catch (err) {
    log('Failed to register global hotkeys: ' + err.message);
  }
}


ipcMain.on('register-hotkey', (event, { action, accelerator }) => {
  try {
    // Don't unregister all - this would remove global hotkeys!
    // Only unregister this specific accelerator if it exists
    if (globalShortcut.isRegistered(accelerator)) {
      globalShortcut.unregister(accelerator);
    }

    // Register the new hotkey
    const registered = globalShortcut.register(accelerator, () => {
      mainWindow.webContents.send('hotkey-triggered', action);
    });

    log('Hotkey registered: ' + action + ' = ' + accelerator + ' (success: ' + registered + ')');
    event.reply('hotkey-registered', { success: registered });
  } catch (err) {
    log('Failed to register hotkey: ' + err.message);
    event.reply('hotkey-registered', { success: false, error: err.message });
  }
});

ipcMain.on('minimize-to-tray', () => {
  if (mainWindow) {
    mainWindow.minimize();
    log('Window minimized');
  }
});

ipcMain.on('quit-app', () => {
  app.quit();
});

// Check for audio devices
ipcMain.handle('check-audio-devices', async () => {
  try {
    log('Checking audio devices...');
    const platform = process.platform;

    if (platform === 'win32') {
      // Windows: Use PowerShell to list audio devices
      return new Promise((resolve) => {
        exec('powershell -Command "Get-WmiObject Win32_SoundDevice | Select-Object Name | Format-Table -HideTableHeaders"',
          { encoding: 'utf8' },
          (error, stdout, stderr) => {
            if (error) {
              log('Error getting audio devices: ' + error.message);
              resolve({ hasVirtualAudio: false, devices: [] });
              return;
            }

            const devices = stdout.split('\n')
              .map(line => line.trim())
              .filter(line => line.length > 0);

            log('Found audio devices: ' + devices.join(', '));

            // Exclude devices that are not true virtual audio cables
            const excludeKeywords = [
              'Steam Streaming',
              'SteelSeries',
              'NVIDIA Virtual Audio',
              'Realtek',
              'High Definition Audio'
            ];

            // Check for VB-Cable specific device names
            const virtualAudioKeywords = [
              'CABLE Input',
              'CABLE Output',
              'VB-Audio',
              'VB-Cable',
              'VoiceMeeter',
              'VAC'
            ];

            const hasVirtualAudio = devices.some(device => {
              const deviceLower = device.toLowerCase();

              // Exclude specific devices
              if (excludeKeywords.some(keyword => deviceLower.includes(keyword.toLowerCase()))) {
                return false;
              }

              // Check for virtual audio keywords
              return virtualAudioKeywords.some(keyword =>
                deviceLower.includes(keyword.toLowerCase())
              );
            });

            log('Virtual audio device detected: ' + hasVirtualAudio);
            resolve({ hasVirtualAudio, devices });
          }
        );
      });
    } else if (platform === 'darwin') {
      // macOS: Check using system_profiler
      return new Promise((resolve) => {
        exec('system_profiler SPAudioDataType', { encoding: 'utf8' }, (error, stdout) => {
          if (error) {
            log('Error getting audio devices: ' + error.message);
            resolve({ hasVirtualAudio: false, devices: [] });
            return;
          }

          const hasVirtualAudio = stdout.toLowerCase().includes('soundflower') ||
                                  stdout.toLowerCase().includes('blackhole');
          log('Virtual audio device detected: ' + hasVirtualAudio);
          resolve({ hasVirtualAudio, devices: [] });
        });
      });
    } else {
      // Linux or other platforms
      log('Audio device detection not implemented for this platform');
      resolve({ hasVirtualAudio: false, devices: [] });
    }
  } catch (error) {
    log('Error checking audio devices: ' + error.message);
    return { hasVirtualAudio: false, devices: [] };
  }
});

// Engine download and management IPC handlers
ipcMain.handle('download-engine', async (event, engineType) => {
  try {
    log(`Starting engine download: ${engineType}`);

    const engineBasePath = getEngineBasePath();

    // Use system temp directory to avoid permission issues with Program Files
    const tempDirPath = app.getPath('temp');

    const downloader = new EngineDownloader(
      engineBasePath,
      (progress) => {
        // Send progress updates to renderer
        if (mainWindow) {
          mainWindow.webContents.send('engine-download-progress', progress);
        }
      },
      (logMessage) => {
        // Send log messages to renderer
        log('[Engine Download] ' + logMessage);
        if (mainWindow) {
          mainWindow.webContents.send('engine-download-log', logMessage);
        }
      },
      tempDirPath
    );

    const result = await downloader.downloadAndInstallEngine(engineType);

    // Save the engine type to settings
    currentEngineType = engineType;

    return result;
  } catch (error) {
    log('Engine download error: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('check-engine-installed', async (event, engineType) => {
  try {
    const engineBasePath = getEngineBasePath();

    const enginePath = path.join(engineBasePath, engineType);

    // Fix directory structure if needed before checking
    if (fs.existsSync(enginePath)) {
      fixEngineDirectoryStructure(enginePath);
    }

    const downloader = new EngineDownloader(engineBasePath);
    const isInstalled = await downloader.checkEngineInstalled(engineType);

    return { installed: isInstalled };
  } catch (error) {
    log('Check engine error: ' + error.message);
    return { installed: false };
  }
});

ipcMain.handle('get-installed-engines', async () => {
  try {
    const engineBasePath = getEngineBasePath();

    const downloader = new EngineDownloader(engineBasePath);
    const installed = await downloader.getInstalledEngines();

    return installed; // Return array directly, not wrapped in object
  } catch (error) {
    log('Get installed engines error: ' + error.message);
    return []; // Return empty array, not object
  }
});

ipcMain.handle('remove-engine', async (event, engineType) => {
  try {
    log(`Removing engine: ${engineType}`);

    const engineBasePath = getEngineBasePath();

    const downloader = new EngineDownloader(engineBasePath);
    const removed = await downloader.removeEngine(engineType);

    return { success: removed };
  } catch (error) {
    log('Remove engine error: ' + error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('switch-engine', async (event, engineType) => {
  try {
    log(`Switching to engine: ${engineType}`);

    // Stop current engine
    if (voicevoxProcess) {
      log('Stopping current engine...');
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', voicevoxProcess.pid, '/f', '/t']);
      } else {
        voicevoxProcess.kill('SIGTERM');
      }
      voicevoxProcess = null;

      // Wait a bit for the process to stop
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Start new engine
    await startVoicevoxEngine(engineType);

    return { success: true, engineType };
  } catch (error) {
    log('Switch engine error: ' + error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-current-engine', async () => {
  // If currentEngineType is not set, detect which engine is actually installed
  if (!currentEngineType) {
    log('currentEngineType not set, detecting installed engine...');
    currentEngineType = await detectInstalledEngine();

    if (currentEngineType) {
      log('Auto-detected engine type: ' + currentEngineType);
    } else {
      log('No engine installed yet');
      return { engineType: null }; // Return null instead of defaulting to 'cpu'
    }
  }

  return { engineType: currentEngineType };
});

// Restart engine with detected type (called after engine installation)
ipcMain.handle('restart-engine', async () => {
  try {
    log('Restarting engine...');

    // Stop current engine if running
    if (voicevoxProcess) {
      log('Stopping current engine...');
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', voicevoxProcess.pid, '/f', '/t']);
      } else {
        voicevoxProcess.kill('SIGTERM');
      }
      voicevoxProcess = null;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Detect installed engine
    const engineType = await detectInstalledEngine();
    if (!engineType) {
      throw new Error('No engine installed');
    }

    log('Detected engine type: ' + engineType);
    currentEngineType = engineType;

    // Start engine
    await startVoicevoxEngine(engineType);

    return { success: true, engineType };
  } catch (error) {
    log('Restart engine error: ' + error.message);
    return { success: false, error: error.message };
  }
});

// VB-CABLE installer handler
ipcMain.handle('install-vbcable', async () => {
  try {
    log('Installing VB-CABLE...');

    // Only support Windows
    if (process.platform !== 'win32') {
      return {
        success: false,
        error: 'VB-CABLEはWindows専用です'
      };
    }

    // Determine the correct installer based on architecture
    const is64Bit = process.arch === 'x64';
    const installerName = is64Bit ? 'VBCABLE_Setup_x64.exe' : 'VBCABLE_Setup.exe';

    // Try multiple possible locations for the installer
    const possiblePaths = [
      // Development paths
      path.join(__dirname, '../build/vbcable', installerName),
      path.join(__dirname, '../resources', installerName),
      // Built release paths (from app.asar/electron to source build folder)
      path.join(__dirname, '../../../../../build/vbcable', installerName),
      // Production paths
      path.join(process.resourcesPath, 'vbcable', installerName),
      path.join(process.resourcesPath, installerName),
      path.join(app.getAppPath(), 'resources', installerName),
      path.join(app.getAppPath(), 'build', 'vbcable', installerName),
      // Check relative to the executable
      path.join(process.cwd(), 'build', 'vbcable', installerName),
      path.join(process.cwd(), 'resources', installerName)
    ];

    let installerPath = null;
    for (const testPath of possiblePaths) {
      log(`Checking for installer at: ${testPath}`);
      if (fs.existsSync(testPath)) {
        installerPath = testPath;
        log(`Found installer at: ${installerPath}`);
        break;
      }
    }

    if (!installerPath) {
      log('VB-CABLE installer not found in any expected location');
      return {
        success: false,
        error: 'VB-Cableインストーラーが見つかりません。\nresourcesフォルダに配置してください。\n\n公式サイト: https://vb-audio.com/Cable/'
      };
    }

    // Save current default audio device ID before installation
    const getDefaultAudioDeviceId = () => {
      return new Promise((resolve) => {
        const psScript = `
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
Function Await($WinRtTask, $ResultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    $netTask.Result
}

# Get default audio render device
[Windows.Media.Devices.MediaDevice,Windows.Media,ContentType=WindowsRuntime] | Out-Null
$defaultDeviceId = [Windows.Media.Devices.MediaDevice]::GetDefaultAudioRenderId([Windows.Media.Devices.AudioDeviceRole]::Default)
Write-Output $defaultDeviceId
        `;

        exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psScript.replace(/\n/g, '; ')}"`, (error, stdout) => {
          if (error) {
            log('Failed to get default audio device ID: ' + error.message);
            resolve(null);
          } else {
            const deviceId = stdout.trim();
            log('Current default audio device ID: ' + deviceId);
            resolve(deviceId || null);
          }
        });
      });
    };

    // Restore default audio device after installation using Windows API
    const restoreDefaultAudioDeviceId = (deviceId) => {
      if (!deviceId) {
        log('No device ID to restore');
        return Promise.resolve(false);
      }

      return new Promise((resolve) => {
        const psScript = `
# Import Windows Runtime assemblies
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
Function Await($WinRtTask, $ResultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    $netTask.Result
}

try {
    [Windows.Media.Devices.MediaDevice,Windows.Media,ContentType=WindowsRuntime] | Out-Null
    # Set default audio render device
    Await ([Windows.Media.Devices.MediaDevice]::SetDefaultAudioRenderDeviceAsync("${deviceId}")) ([System.Boolean])
    Write-Output "Restored"
} catch {
    Write-Output "Failed: $($_.Exception.Message)"
}
        `;

        exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psScript.replace(/\n/g, '; ')}"`, (error, stdout) => {
          if (error) {
            log('Failed to restore audio device: ' + error.message);
            resolve(false);
          } else {
            const result = stdout.trim();
            log('Audio device restoration result: ' + result);
            resolve(result === 'Restored');
          }
        });
      });
    };

    // Get current default device ID
    const originalDeviceId = await getDefaultAudioDeviceId();
    log('Original audio device ID saved: ' + originalDeviceId);

    // Run installer with administrator privileges
    return new Promise((resolve) => {
      log('Running VB-CABLE installer with admin privileges...');

      // Use PowerShell to run as administrator
      const psCommand = `Start-Process -FilePath "${installerPath}" -Verb RunAs -Wait`;

      exec(`powershell -Command "${psCommand}"`, async (error, stdout, stderr) => {
        if (error) {
          log('VB-CABLE installation error: ' + error.message);
          // User may have cancelled UAC prompt
          if (error.message.includes('operation was canceled')) {
            resolve({
              success: false,
              error: 'インストールがキャンセルされました',
              cancelled: true
            });
          } else {
            resolve({
              success: false,
              error: error.message
            });
          }
          return;
        }

        log('VB-CABLE installer executed');
        log('stdout: ' + stdout);
        if (stderr) log('stderr: ' + stderr);

        // Wait a bit for device enumeration to complete
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Restore original default audio device
        if (originalDeviceId) {
          log('Attempting to restore original audio device...');
          const restored = await restoreDefaultAudioDeviceId(originalDeviceId);

          if (restored) {
            log('Successfully restored original audio device');
            resolve({
              success: true,
              message: 'VB-Cableのインストールが完了しました。\n元の音声出力デバイスを復元しました。'
            });
          } else {
            log('Failed to restore original audio device');
            resolve({
              success: true,
              message: 'VB-Cableのインストールが完了しました。\n音声出力デバイスの設定を確認してください。',
              warning: 'audio_device_not_restored'
            });
          }
        } else {
          resolve({
            success: true,
            message: 'VB-Cableインストーラーを起動しました。\n管理者権限を求められた場合は「はい」を選択してください。'
          });
        }
      });
    });
  } catch (error) {
    log('VB-CABLE installation error: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('check-vbcable-installer', async () => {
  try {
    // Only support Windows
    if (process.platform !== 'win32') {
      return { exists: false, reason: 'windows_only' };
    }

    const is64Bit = process.arch === 'x64';
    const installerName = is64Bit ? 'VBCABLE_Setup_x64.exe' : 'VBCABLE_Setup.exe';

    log(`[VB-Cable] Checking for installer: ${installerName}`);
    log(`[VB-Cable] __dirname: ${__dirname}`);
    log(`[VB-Cable] process.resourcesPath: ${process.resourcesPath}`);
    log(`[VB-Cable] app.getAppPath(): ${app.getAppPath()}`);

    const possiblePaths = [
      path.join(__dirname, '../build/vbcable', installerName),
      path.join(__dirname, '../resources', installerName),
      path.join(__dirname, '../../../../../build/vbcable', installerName), // Built release to source
      path.join(process.resourcesPath, 'vbcable', installerName),
      path.join(process.resourcesPath, installerName),
      path.join(app.getAppPath(), 'resources', installerName),
      path.join(app.getAppPath(), 'build', 'vbcable', installerName),
      path.join(process.cwd(), 'build', 'vbcable', installerName),
      path.join(process.cwd(), 'resources', installerName)
    ];

    for (const testPath of possiblePaths) {
      log(`[VB-Cable] Checking path: ${testPath}`);
      if (fs.existsSync(testPath)) {
        log('[VB-Cable] ✓ Installer found at: ' + testPath);
        return { exists: true, path: testPath };
      } else {
        log('[VB-Cable] ✗ Not found at: ' + testPath);
      }
    }

    log('[VB-Cable] Installer not found in any location');
    return { exists: false, reason: 'not_found' };
  } catch (error) {
    log('Error checking VB-CABLE installer: ' + error.message);
    return { exists: false, reason: 'error', error: error.message };
  }
});

// Open external URL
ipcMain.handle('open-external', async (event, url) => {
  try {
    log(`[OpenExternal] Opening URL: ${url}`);
    await require('electron').shell.openExternal(url);
    return { success: true };
  } catch (error) {
    log(`[OpenExternal] Error: ${error.message}`);
    return { success: false, error: error.message };
  }
});


app.whenReady().then(async () => {
  log('App ready');

  // Start VOICEVOX Engine first
  try {
    await startVoicevoxEngine();
    log('Engine startup completed');
  } catch (err) {
    log('Engine startup error: ' + err.message);
  }

  // Then start the internal server
  try {
    await startServer();
    log('Server started successfully');
  } catch (err) {
    log('Server startup error: ' + err.message);
  }

  // Finally create the window
  setTimeout(() => {
    try {
      createWindow();
      registerGlobalHotkeys();
    } catch (err) {
      log('Window creation error: ' + err.message);
      log('Stack: ' + err.stack);
    }
  }, 2000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}).catch(err => {
  log('App ready error: ' + err.message);
  log('Stack: ' + err.stack);
});


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});


app.on('will-quit', () => {
  log('App quitting...');

  // Only unregister shortcuts if app is ready
  if (app.isReady()) {
    globalShortcut.unregisterAll();
  }

  // Close HTTP server
  if (httpServer) {
    log('Closing HTTP server...');
    httpServer.close();
  }

  // Stop VOICEVOX Engine
  if (voicevoxProcess) {
    log('Stopping VOICEVOX Engine...');
    try {
      if (process.platform === 'win32') {
        // On Windows, kill the process tree
        spawn('taskkill', ['/pid', voicevoxProcess.pid, '/f', '/t']);
      } else {
        // On Unix-like systems, kill the process
        voicevoxProcess.kill('SIGTERM');
      }
      voicevoxProcess = null;
    } catch (err) {
      log('Error stopping engine: ' + err.message);
    }
  }
});
