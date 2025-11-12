const { contextBridge, ipcRenderer } = require('electron');


contextBridge.exposeInMainWorld('electronAPI', {

  registerHotkey: (action, accelerator) => {
    ipcRenderer.send('register-hotkey', { action, accelerator });
  },


  onHotkeyRegistered: (callback) => {
    ipcRenderer.on('hotkey-registered', (event, result) => callback(result));
  },


  onHotkeyTriggered: (callback) => {
    ipcRenderer.on('hotkey-triggered', (event, action) => callback(action));
  },


  onOpenSettings: (callback) => {
    ipcRenderer.on('open-settings', () => callback());
  },


  onQuickReadClipboard: (callback) => {
    ipcRenderer.on('quick-read-clipboard', () => callback());
  },


  minimizeToTray: () => {
    ipcRenderer.send('minimize-to-tray');
  },


  quitApp: () => {
    ipcRenderer.send('quit-app');
  },

  checkAudioDevices: () => {
    return ipcRenderer.invoke('check-audio-devices');
  },

  // Engine download and management
  downloadEngine: (engineType) => {
    return ipcRenderer.invoke('download-engine', engineType);
  },

  checkEngineInstalled: (engineType) => {
    return ipcRenderer.invoke('check-engine-installed', engineType);
  },

  getInstalledEngines: () => {
    return ipcRenderer.invoke('get-installed-engines');
  },

  removeEngine: (engineType) => {
    return ipcRenderer.invoke('remove-engine', engineType);
  },

  switchEngine: (engineType) => {
    return ipcRenderer.invoke('switch-engine', engineType);
  },

  getCurrentEngine: () => {
    return ipcRenderer.invoke('get-current-engine');
  },

  restartEngine: () => {
    return ipcRenderer.invoke('restart-engine');
  },

  onEngineDownloadProgress: (callback) => {
    ipcRenderer.on('engine-download-progress', (event, progress) => callback(progress));
  },

  onEngineDownloadLog: (callback) => {
    ipcRenderer.on('engine-download-log', (event, log) => callback(log));
  },

  // VB-CABLE installer
  installVbCable: () => {
    return ipcRenderer.invoke('install-vbcable');
  },

  checkVbCableInstaller: () => {
    return ipcRenderer.invoke('check-vbcable-installer');
  },

  // Open external URL in default browser
  openExternal: (url) => {
    return ipcRenderer.invoke('open-external', url);
  },

  isElectron: true,

  platform: process.platform
});
