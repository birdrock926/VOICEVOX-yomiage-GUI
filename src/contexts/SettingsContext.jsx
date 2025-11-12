import { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext();

const defaultSettings = {
  voicevox: {
    url: 'http://127.0.0.1:50021',
    defaultSpeakerId: 3,
    speedScale: 1.0,
    pitchScale: 0.0,
    intonationScale: 1.0,
    volumeScale: 1.0,
    prePhonemeLength: 0.1,
    postPhonemeLength: 0.1,
    engineType: 'cuda' // cuda, directml, cpu
  },

  ui: {
    theme: 'dark',
    fontSize: 'medium',
    compactMode: false,
    showHistory: true,
    historyLimit: 10,
    autoMinimizeOnRead: false,
    startMinimized: false,
    minimizeToTray: true
  },

  presets: {
    enabled: true,
    items: [
      { id: 1, label: 'こんにちは', text: 'こんにちは' },
      { id: 2, label: 'ありがとう', text: 'ありがとうございます' },
      { id: 3, label: 'お疲れ様', text: 'お疲れ様でした' }
    ]
  },

  keybinds: {
    submit: 'Control+Enter',
    quickRead: 'Control+Shift+R',
    toggleWindow: 'Control+Shift+Z',
    clearText: 'Control+Shift+X',
    focusInput: 'Control+Shift+F'
  },

  audio: {
    autoPlay: true,
    fadeIn: false,
    fadeOut: false,
    normalization: false
  },

  advanced: {
    serverPort: 3001,
    reconnectAttempts: 5,
    reconnectDelay: 1000,
    requestTimeout: 10000,
    enableLogging: false,
    logLevel: 'info'
  },

  textProcessing: {
    autoReplaceEnabled: true,
    autoReplaceRules: [
      { from: 'www', to: 'ダブリュー ダブリュー ダブリュー' },
      { from: 'w', to: 'ワラ' },
      { from: '草', to: 'クサ' },
      { from: 'URL', to: 'ユーアールエル' }
    ],
    maxLength: 500,
    trimWhitespace: true
  },

  speakers: {
    favorites: [3, 1, 7],
    recentlyUsed: [],
    showOnlyFavorites: false
  },

  app: {
    hasCompletedSetup: false,
    lastVersion: '1.0.0'
  }
};

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  // Deep merge helper function
  const deepMerge = (target, source) => {
    const result = { ...target };
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  };

  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('zundamon-vc-settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings(deepMerge(defaultSettings, parsed));
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem('zundamon-vc-settings', JSON.stringify(settings));
      } catch (err) {
        console.error('Failed to save settings:', err);
      }
    }
  }, [settings, isLoading]);

  const updateSettings = (category, updates) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        ...updates
      }
    }));
  };

  const updateAllSettings = (newSettings) => {
    setSettings({ ...defaultSettings, ...newSettings });
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
    localStorage.removeItem('zundamon-vc-settings');
  };

  const exportSettings = () => {
    const dataStr = JSON.stringify(settings, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = 'zundamon-vc-settings.json';

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const importSettings = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          setSettings({ ...defaultSettings, ...imported });
          resolve();
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const value = {
    settings,
    updateSettings,
    updateAllSettings,
    resetSettings,
    exportSettings,
    importSettings,
    isLoading
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
