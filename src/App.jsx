import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import AudioPlayer from './components/AudioPlayer';
import SettingsModal from './components/SettingsModal';
import SpeakerSelector from './components/SpeakerSelector';
import SetupWizard from './components/SetupWizard';
import EngineSetup from './components/EngineSetup';
import ErrorBoundary from './components/ErrorBoundary';
import { useSettings } from './contexts/SettingsContext';

const SOCKET_URL = 'http://localhost:3001';

function App() {
  const { settings, updateSettings, isLoading: settingsLoading } = useSettings();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [voicevoxConnected, setVoicevoxConnected] = useState(false);
  const [text, setText] = useState('');
  const [speakerId, setSpeakerId] = useState(settings.voicevox.defaultSpeakerId);
  const [speakers, setSpeakers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [audioData, setAudioData] = useState(null);
  const [stats, setStats] = useState({ elapsed: 0, size: 0 });
  const [history, setHistory] = useState([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSetupWizardOpen, setIsSetupWizardOpen] = useState(false);
  const [audioDeviceStatus, setAudioDeviceStatus] = useState({ checked: false, hasVirtualAudio: false });
  const [showEngineSetup, setShowEngineSetup] = useState(false);
  const [engineCheckDone, setEngineCheckDone] = useState(false);
  const [presetEditMode, setPresetEditMode] = useState(false);
  const [editingPreset, setEditingPreset] = useState(null);
  const [newPreset, setNewPreset] = useState({ label: '', text: '' });
  const [vbCableInstallerAvailable, setVbCableInstallerAvailable] = useState(false);
  const textareaRef = useRef(null);
  const handleSynthesizeRef = useRef(null);

  // Set setup wizard state after settings are loaded
  useEffect(() => {
    if (!settingsLoading) {
      if (!settings.app?.hasCompletedSetup) {
        setIsSetupWizardOpen(true);
      }
    }
  }, [settingsLoading, settings.app?.hasCompletedSetup]);


  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      reconnectionAttempts: settings.advanced.reconnectAttempts,
      reconnectionDelay: settings.advanced.reconnectDelay,
      timeout: settings.advanced.requestTimeout
    });

    newSocket.on('connect', () => {
      setConnected(true);
      checkVoicevox(newSocket);
      loadSpeakers(newSocket);
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [settings.advanced]);


  useEffect(() => {
    if (window.electronAPI) {
      // Skip engine check if we just completed setup
      const justCompletedSetup = sessionStorage.getItem('engine-setup-completed');
      if (justCompletedSetup) {
        sessionStorage.removeItem('engine-setup-completed');
        setEngineCheckDone(true);
        return;
      }

      // Check if engine is installed on first mount
      window.electronAPI.getCurrentEngine().then(result => {
        // If no engine is detected, show setup
        if (!result.engineType) {
          setShowEngineSetup(true);
          setEngineCheckDone(true);
          return;
        }

        const engineType = result.engineType;

        window.electronAPI.checkEngineInstalled(engineType).then(checkResult => {
          if (!checkResult.installed) {
            // No engine installed, show setup
            setShowEngineSetup(true);
          }
          setEngineCheckDone(true);
        }).catch(err => {
          console.error('Failed to check engine:', err);
          setEngineCheckDone(true);
        });
      }).catch(err => {
        console.error('Failed to get current engine:', err);
        setEngineCheckDone(true);
      });

      // Check audio devices on mount
      window.electronAPI.checkAudioDevices().then(result => {
        setAudioDeviceStatus({ checked: true, hasVirtualAudio: result.hasVirtualAudio });
      }).catch(err => {
        console.error('Failed to check audio devices:', err);
        setAudioDeviceStatus({ checked: true, hasVirtualAudio: false });
      });

      window.electronAPI.onOpenSettings(() => {
        setIsSettingsOpen(true);
      });


      window.electronAPI.onQuickReadClipboard(async () => {
        try {
          const clipboardText = await navigator.clipboard.readText();
          if (clipboardText) {
            setText(clipboardText);
            handleSynthesize(clipboardText);
          }
        } catch (err) {
          console.error('Failed to read clipboard:', err);
        }
      });


      window.electronAPI.onHotkeyTriggered((action) => {
        // Hotkey handling
      });
    }
  }, []);

  // Check VB-Cable installer availability
  useEffect(() => {
    if (window.electronAPI && window.electronAPI.checkVbCableInstaller) {
      window.electronAPI.checkVbCableInstaller()
        .then(result => {
          setVbCableInstallerAvailable(result.exists || false);
        })
        .catch(err => {
          console.error('Error checking VB-Cable installer:', err);
        });
    }
  }, []);

  useEffect(() => {
    const handleKeyPress = (e) => {
      const { keybinds } = settings;

      // Normalize key name (e.g., "Enter" -> "Enter", not "ENTER")
      let keyName = e.key;
      // Special keys should be capitalized in a specific way
      const specialKeyMap = {
        'enter': 'Enter',
        'escape': 'Escape',
        'tab': 'Tab',
        'space': 'Space',
        'backspace': 'Backspace',
        'delete': 'Delete',
        'insert': 'Insert',
        'home': 'Home',
        'end': 'End',
        'pageup': 'PageUp',
        'pagedown': 'PageDown',
        'arrowup': 'ArrowUp',
        'arrowdown': 'ArrowDown',
        'arrowleft': 'ArrowLeft',
        'arrowright': 'ArrowRight'
      };

      const lowerKey = keyName.toLowerCase();
      if (specialKeyMap[lowerKey]) {
        keyName = specialKeyMap[lowerKey];
      } else if (keyName.length === 1) {
        // Single character keys should be uppercase
        keyName = keyName.toUpperCase();
      }

      const pressedKey = [
        e.ctrlKey && 'Control',
        e.shiftKey && 'Shift',
        e.altKey && 'Alt',
        e.metaKey && 'Command',
        keyName
      ].filter(Boolean).join('+');

      if (pressedKey === keybinds.submit) {
        e.preventDefault();
        // Call synthesize via ref
        if (handleSynthesizeRef.current) {
          handleSynthesizeRef.current();
        }
      } else if (pressedKey === keybinds.clearText) {
        e.preventDefault();
        setText('');
      } else if (pressedKey === keybinds.focusInput) {
        e.preventDefault();
        textareaRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [settings.keybinds]);

  const checkVoicevox = (socketInstance) => {
    const s = socketInstance || socket;
    if (!s) return;

    s.emit('check_voicevox', (response) => {
      setVoicevoxConnected(response.connected);
    });
  };

  const loadSpeakers = (socketInstance) => {
    const s = socketInstance || socket;
    if (!s) return;

    s.emit('get_speakers', (response) => {
      if (response.success) {
        setSpeakers(response.speakers);
      }
    });
  };


  const toggleFavorite = (id) => {
    const favorites = settings.speakers.favorites || [];
    const newFavorites = favorites.includes(id)
      ? favorites.filter(fav => fav !== id)
      : [...favorites, id];

    updateSettings('speakers', { favorites: newFavorites });
  };


  const handleSetupComplete = () => {
    updateSettings('app', { hasCompletedSetup: true });
    setIsSetupWizardOpen(false);
  };


  const processText = (inputText) => {
    let processed = inputText;

    if (settings.textProcessing.autoReplaceEnabled) {
      settings.textProcessing.autoReplaceRules.forEach(rule => {
        const regex = new RegExp(rule.from, 'g');
        processed = processed.replace(regex, rule.to);
      });
    }

    if (settings.textProcessing.trimWhitespace) {
      processed = processed.trim();
    }


    if (processed.length > settings.textProcessing.maxLength) {
      processed = processed.substring(0, settings.textProcessing.maxLength);
    }

    return processed;
  };

  const handleSynthesize = useCallback((customText = null, addToHistory = true) => {
    const textToSynthesize = customText || text;
    if (!textToSynthesize.trim() || !socket || isLoading) return;

    setIsLoading(true);


    const processedText = processText(textToSynthesize);

    const startTime = Date.now();


    const options = {
      speedScale: settings.voicevox.speedScale,
      pitchScale: settings.voicevox.pitchScale,
      intonationScale: settings.voicevox.intonationScale,
      volumeScale: settings.voicevox.volumeScale,
      prePhonemeLength: settings.voicevox.prePhonemeLength,
      postPhonemeLength: settings.voicevox.postPhonemeLength
    };

    socket.emit('synthesize', { text: processedText, speakerId, options }, (response) => {
      setIsLoading(false);

      if (response.success) {
        // Add timestamp to force AudioPlayer to re-render even with same audio data
        setAudioData({ data: response.audio, timestamp: Date.now() });
        setStats({
          elapsed: response.elapsed,
          size: response.size
        });

        // 履歴に追加 (addToHistory=trueの時のみ)
        if (settings.ui.showHistory && addToHistory) {
          setHistory(prev => [
            {
              text: processedText,
              timestamp: new Date().toLocaleTimeString('ja-JP'),
              elapsed: response.elapsed
            },
            ...prev.slice(0, settings.ui.historyLimit - 1)
          ]);
        }

        if (settings.ui.autoMinimizeOnRead && window.electronAPI) {
          window.electronAPI.minimizeToTray();
        }
      } else {
        alert(`エラー: ${response.error}`);
      }
    });
  }, [text, socket, isLoading, speakerId, settings]);

  // Store handleSynthesize in ref so it can be accessed before definition
  useEffect(() => {
    handleSynthesizeRef.current = handleSynthesize;
  }, [handleSynthesize]);

  // Preset management functions
  const handleAddPreset = () => {
    if (!newPreset.label.trim() || !newPreset.text.trim()) {
      alert('ラベルとテキストを入力してください');
      return;
    }

    const newId = settings.presets.items.length > 0
      ? Math.max(...settings.presets.items.map(p => p.id)) + 1
      : 1;

    const updated = {
      ...settings.presets,
      items: [...settings.presets.items, { id: newId, label: newPreset.label, text: newPreset.text }]
    };

    updateSettings('presets', updated);
    setNewPreset({ label: '', text: '' });
  };

  const handleUpdatePreset = (id) => {
    if (!editingPreset || !editingPreset.label.trim() || !editingPreset.text.trim()) {
      alert('ラベルとテキストを入力してください');
      return;
    }

    const updated = {
      ...settings.presets,
      items: settings.presets.items.map(p =>
        p.id === id ? { ...p, label: editingPreset.label, text: editingPreset.text } : p
      )
    };

    updateSettings('presets', updated);
    setEditingPreset(null);
  };

  const handleDeletePreset = (id) => {
    if (!confirm('このプリセットを削除しますか？')) return;

    const updated = {
      ...settings.presets,
      items: settings.presets.items.filter(p => p.id !== id)
    };

    updateSettings('presets', updated);
    if (editingPreset && editingPreset.id === id) {
      setEditingPreset(null);
    }
  };

  // VB-Cable installer launcher
  const handleLaunchVbCableSetup = async () => {
    if (!window.electronAPI || !window.electronAPI.installVbCable) {
      alert('Electron APIが利用できません');
      return;
    }

    try {
      const result = await window.electronAPI.installVbCable();

      if (result.success) {
        alert(result.message || 'VB-Cableインストーラーを起動しました');
      } else {
        alert(result.error || 'インストーラーの起動に失敗しました');
      }
    } catch (err) {
      alert('エラー: ' + err.message);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Handle engine setup completion
  const handleEngineSetupComplete = async (result) => {
    // Update settings with selected engine type
    if (result.engineType) {
      // updateSettings expects (category, updates) not a full object
      updateSettings('voicevox', {
        engineType: result.engineType
      });

      // Also save to localStorage immediately to ensure persistence
      try {
        const currentSettings = JSON.parse(localStorage.getItem('zundamon-vc-settings') || '{}');
        currentSettings.voicevox = {
          ...(currentSettings.voicevox || {}),
          engineType: result.engineType
        };
        localStorage.setItem('zundamon-vc-settings', JSON.stringify(currentSettings));
      } catch (err) {
        console.error('Failed to save to localStorage:', err);
      }
    }

    // Set flag to skip engine check after reload
    sessionStorage.setItem('engine-setup-completed', 'true');

    // Hide engine setup and mark check as done to prevent loop
    setShowEngineSetup(false);
    setEngineCheckDone(true);

    // Restart the engine directly instead of reloading the page
    if (window.electronAPI && window.electronAPI.restartEngine) {
      setTimeout(async () => {
        try {
          const restartResult = await window.electronAPI.restartEngine();
          if (restartResult.success) {
            // Force VOICEVOX connection check
            if (socket) {
              checkVoicevox(socket);
              loadSpeakers(socket);
            }
          } else {
            console.error('Failed to restart engine:', restartResult.error);
          }
        } catch (err) {
          console.error('Engine restart error:', err);
        }
      }, 1500);
    }
  };

  // Show engine setup if needed
  if (showEngineSetup && engineCheckDone) {
    return <EngineSetup onComplete={handleEngineSetupComplete} />;
  }

  // Show loading while checking engine
  if (!engineCheckDone) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-zundamon-500 mx-auto mb-4"></div>
          <p className="text-gray-400">初期化中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-zundamon-400 to-emerald-400 bg-clip-text text-transparent">
            VOICEVOX VC読み上げツール
          </h1>
          <p className="text-gray-400 text-lg">
            音声合成 × ゲームボイスチャット連携
          </p>
        </div>

        <div className="card mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span className="text-sm">サーバー: {connected ? '接続中' : '切断'}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${voicevoxConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span className="text-sm">VOICEVOX: {voicevoxConnected ? '接続中' : '切断'}</span>
              </div>
              {audioDeviceStatus.checked && (
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${audioDeviceStatus.hasVirtualAudio ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></div>
                  <span className="text-sm">仮想デバイス: {audioDeviceStatus.hasVirtualAudio ? '検出' : '未検出'}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              {stats.elapsed > 0 && (
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <span>処理時間: {stats.elapsed}ms</span>
                  <span>サイズ: {formatFileSize(stats.size)}</span>
                </div>
              )}
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="btn-secondary text-sm flex items-center gap-2"
              >
                <span>⚙️</span>
                <span>設定</span>
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="card">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <span className="text-zundamon-500">💬</span>
                読み上げテキスト
              </h2>

              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`読み上げたいテキストを入力してください... (${settings.keybinds.submit} で送信)`}
                className="textarea h-32 mb-4"
                disabled={!connected || !voicevoxConnected || isLoading}
              />

              <div className="mb-4">
                <label className="text-sm font-semibold mb-2 block">話者:</label>
                <SpeakerSelector
                  speakers={speakers}
                  selectedId={speakerId}
                  onChange={setSpeakerId}
                  favorites={settings.speakers.favorites || []}
                  onToggleFavorite={toggleFavorite}
                />
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={() => handleSynthesize()}
                  disabled={!text.trim() || !connected || !voicevoxConnected || isLoading}
                  className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>生成中...</span>
                    </>
                  ) : (
                    <>
                      <span>🎤</span>
                      <span>読み上げ</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setText('')}
                  className="btn-secondary"
                  disabled={!text || isLoading}
                >
                  クリア
                </button>
              </div>

              <div className="mt-2 text-xs text-gray-500 space-y-1">
                <p>ヒント: {settings.keybinds.submit} で送信</p>
                <p>テキストクリア: {settings.keybinds.clearText}</p>
              </div>

              {/* プリセットボタン */}
              {settings.presets.enabled && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-gray-400">クイックプリセット</h4>
                    <button
                      onClick={() => setPresetEditMode(!presetEditMode)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        presetEditMode
                          ? 'bg-zundamon-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {presetEditMode ? '✓ 完了' : '✏️ 編集'}
                    </button>
                  </div>

                  {!presetEditMode ? (
                    // 通常モード: 再生ボタン
                    settings.presets.items.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {settings.presets.items.map((preset) => (
                          <button
                            key={preset.id}
                            onClick={() => {
                              setText(preset.text);
                              if (handleSynthesizeRef.current) {
                                handleSynthesizeRef.current(preset.text);
                              }
                            }}
                            className="px-3 py-1.5 bg-zundamon-600 hover:bg-zundamon-700 text-white text-sm rounded-lg transition-colors flex items-center gap-1"
                            disabled={isLoading}
                          >
                            <span>▶️</span>
                            <span>{preset.label}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">
                        プリセットがありません。「編集」ボタンから追加してください。
                      </p>
                    )
                  ) : (
                    // 編集モード
                    <div className="space-y-3">
                      {/* 新規追加フォーム */}
                      <div className="p-3 bg-gray-700 rounded-lg space-y-2">
                        <p className="text-xs font-semibold text-zundamon-400">新しいプリセットを追加</p>
                        <input
                          type="text"
                          value={newPreset.label}
                          onChange={(e) => setNewPreset({ ...newPreset, label: e.target.value })}
                          placeholder="ラベル (例: こんにちは)"
                          className="input w-full text-sm"
                        />
                        <textarea
                          value={newPreset.text}
                          onChange={(e) => setNewPreset({ ...newPreset, text: e.target.value })}
                          placeholder="テキスト (例: こんにちは、ずんだもんなのだ！)"
                          className="input w-full text-sm h-16 resize-none"
                        />
                        <button
                          onClick={handleAddPreset}
                          className="btn-primary w-full text-sm"
                        >
                          ➕ 追加
                        </button>
                      </div>

                      {/* 既存プリセット一覧 */}
                      {settings.presets.items.length > 0 && (
                        <div className="space-y-2">
                          {settings.presets.items.map((preset) => (
                            <div key={preset.id} className="p-3 bg-gray-700 rounded-lg">
                              {editingPreset && editingPreset.id === preset.id ? (
                                // 編集中
                                <div className="space-y-2">
                                  <input
                                    type="text"
                                    value={editingPreset.label}
                                    onChange={(e) =>
                                      setEditingPreset({ ...editingPreset, label: e.target.value })
                                    }
                                    className="input w-full text-sm"
                                  />
                                  <textarea
                                    value={editingPreset.text}
                                    onChange={(e) =>
                                      setEditingPreset({ ...editingPreset, text: e.target.value })
                                    }
                                    className="input w-full text-sm h-16 resize-none"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleUpdatePreset(preset.id)}
                                      className="btn-primary flex-1 text-sm"
                                    >
                                      ✓ 保存
                                    </button>
                                    <button
                                      onClick={() => setEditingPreset(null)}
                                      className="btn-secondary flex-1 text-sm"
                                    >
                                      ✗ キャンセル
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                // 表示モード
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="px-2 py-1 bg-zundamon-600 text-white text-xs font-bold rounded">
                                      {preset.label}
                                    </span>
                                    <div className="flex gap-1">
                                      <button
                                        onClick={() => setEditingPreset({ ...preset })}
                                        className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                                      >
                                        ✏️
                                      </button>
                                      <button
                                        onClick={() => handleDeletePreset(preset.id)}
                                        className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
                                      >
                                        🗑️
                                      </button>
                                    </div>
                                  </div>
                                  <p className="text-gray-300 text-xs">{preset.text}</p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 履歴 */}
            {settings.ui.showHistory && (
              <div className="card">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <span className="text-zundamon-500">📝</span>
                  履歴
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {history.length === 0 ? (
                    <p className="text-sm text-gray-500">まだ履歴がありません</p>
                  ) : (
                    history.map((item, index) => (
                      <div
                        key={index}
                        className="p-3 bg-gray-700 rounded-lg hover:bg-gray-600 cursor-pointer transition-colors group"
                        onClick={() => {
                          setText(item.text);
                          // Immediately play the text (don't add to history again)
                          if (handleSynthesizeRef.current) {
                            handleSynthesizeRef.current(item.text, false);
                          }
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg opacity-0 group-hover:opacity-100 transition-opacity">▶️</span>
                          <p className="text-sm truncate mb-1 flex-1">{item.text}</p>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-400">
                          <span>{item.timestamp}</span>
                          <span>{item.elapsed}ms</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {/* 音声プレイヤー */}
            <div className="card">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <span className="text-zundamon-500">🔊</span>
                音声プレイヤー
              </h2>

              <div className="flex items-center justify-center min-h-[100px]">
                <ErrorBoundary>
                  <AudioPlayer
                    audioData={audioData}
                    onPlayStart={() => {}}
                    onPlayEnd={() => {}}
                  />
                </ErrorBoundary>
              </div>

              {!audioData && (
                <p className="text-center text-gray-500">
                  テキストを入力して「読み上げ」ボタンを押すと、音声が再生されます
                </p>
              )}
            </div>

            <div className="card">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span className="text-zundamon-500">⚡</span>
                クイックアクション
              </h3>
              <div className="space-y-2">
                <button
                  onClick={() => checkVoicevox()}
                  className="btn-secondary w-full text-sm"
                >
                  VOICEVOX接続確認
                </button>
                <button
                  onClick={() => loadSpeakers()}
                  className="btn-secondary w-full text-sm"
                >
                  話者リスト更新
                </button>
                <button
                  onClick={() => setIsSetupWizardOpen(true)}
                  className="btn-secondary w-full text-sm"
                >
                  セットアップガイド
                </button>
                {vbCableInstallerAvailable && window.electronAPI && window.electronAPI.platform === 'win32' && (
                  <button
                    onClick={handleLaunchVbCableSetup}
                    className="btn-secondary w-full text-sm bg-gradient-to-r from-purple-800 to-blue-800 hover:from-purple-700 hover:to-blue-700"
                  >
                    🎧 VB-Cableセットアップ
                  </button>
                )}
              </div>
            </div>

            <div className="card">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span className="text-zundamon-500">📖</span>
                使い方
              </h3>
              <ol className="text-sm space-y-2 text-gray-300">
                <li>1. VB-CABLE などの仮想オーディオデバイスを設定</li>
                <li>2. Discord/ゲームのマイク入力を CABLE Output に設定</li>
                <li>3. テキストを入力して読み上げ！</li>
              </ol>
              <p className="text-xs text-gray-400 mt-3">
                ※ VOICEVOX Engine はアプリに同梱されており、自動的に起動します
              </p>
            </div>

            <div className="card border-2 border-red-600">
              <h3 className="text-xl font-bold mb-3 flex items-center gap-2 text-red-400">
                <span>⚠️</span>
                Discord使用時の必須設定
              </h3>
              <div className="space-y-2 text-sm">
                <p className="text-red-200 font-bold text-base">
                  Discordのノイズキャンセルを必ず無効化してください！
                </p>
                <p className="text-gray-300 font-semibold">
                  ノイズ抑制が有効だと、音声合成の声が完全にカットされて相手に届きません。この設定は必須です。
                </p>
                <div className="bg-black bg-opacity-30 p-3 rounded mt-2">
                  <p className="text-xs text-green-400 mb-2 font-bold">✅ 推奨設定（最も簡単）：</p>
                  <ol className="text-xs text-gray-300 space-y-1 list-decimal list-inside mb-3">
                    <li>Discord設定 → 音声・ビデオ</li>
                    <li>入力デバイス: CABLE Output を選択</li>
                    <li className="font-bold text-green-300">プリセットを「スタジオ」に変更</li>
                  </ol>
                  <p className="text-xs text-gray-400 mb-1">または、手動で設定：</p>
                  <ol className="text-xs text-gray-300 space-y-1 list-decimal list-inside">
                    <li className="font-bold text-yellow-300">「ノイズ抑制」を無効に設定</li>
                    <li className="font-bold text-yellow-300">「エコー除去」も無効を推奨</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>Powered by VOICEVOX ずんだもん</p>
          {window.electronAPI && (
            <p className="mt-1 text-xs">Electron Desktop App v1.0.0</p>
          )}
        </div>

        {/* 上位版プロモーション & 寄付のお願い */}
        <div className="mt-6 space-y-4">
          {/* 上位版プロモーション */}
          <div className="p-6 bg-gradient-to-br from-purple-900 via-pink-900 to-orange-900 rounded-xl border-2 border-yellow-500 shadow-2xl relative overflow-hidden">
            {/* 背景装飾 */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400 opacity-10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-pink-400 opacity-10 rounded-full blur-3xl"></div>

            <div className="relative z-10">
              <div className="flex items-center justify-center gap-2 mb-3">
                <span className="px-3 py-1 bg-yellow-500 text-black font-bold text-xs rounded-full animate-pulse">NEW!</span>
                <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-pink-300 to-purple-300">
                  🎵 サウンドボード機能付き上位版
                </h3>
              </div>

              <p className="text-center text-gray-200 text-sm mb-4">
                たった<strong className="text-yellow-300 text-xl">300円</strong>の買い切りで、さらに便利に！
              </p>

              <div className="bg-black bg-opacity-40 p-4 rounded-lg mb-4">
                <h4 className="text-yellow-300 font-bold mb-3 text-center">✨ 上位版の追加機能</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="text-lg flex-shrink-0">🎵</span>
                    <div>
                      <p className="font-semibold text-white">サウンドボード</p>
                      <p className="text-gray-300 text-xs">MP3/WAV等の音声ファイルをアップロード</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-lg flex-shrink-0">⚡</span>
                    <div>
                      <p className="font-semibold text-white">ワンタップ再生</p>
                      <p className="text-gray-300 text-xs">ボタンを押すだけで即座に音声を流せる</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-lg flex-shrink-0">🎚️</span>
                    <div>
                      <p className="font-semibold text-white">音声コントロール</p>
                      <p className="text-gray-300 text-xs">音量調整や再生停止などの細かい制御</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-lg flex-shrink-0">🚀</span>
                    <div>
                      <p className="font-semibold text-white">優先アップデート</p>
                      <p className="text-gray-300 text-xs">新機能をいち早くお届け</p>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  window.open('https://hima-na.booth.pm/items/7638991', '_blank');
                }}
                className="w-full md:w-auto px-8 py-4 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-black font-bold text-lg rounded-lg transition-all transform hover:scale-105 shadow-2xl flex items-center gap-3 mx-auto justify-center"
              >
                <span className="text-2xl">🎁</span>
                <div className="text-left">
                  <div className="text-sm opacity-90">たった300円で</div>
                  <div>上位版を手に入れる</div>
                </div>
              </button>
              <p className="text-xs text-gray-300 mt-2 text-center">
                ※ BOOTHページへ移動します（買い切り型・追加課金なし）
              </p>
            </div>
          </div>

          {/* 寄付のお願い */}
          <div className="p-6 bg-gradient-to-br from-zundamon-900 to-gray-800 rounded-xl border border-zundamon-700 shadow-lg">
            <div className="text-center">
              <h3 className="text-xl font-bold mb-3 text-zundamon-300 flex items-center justify-center gap-2">
                <span>☕</span>
                <span>開発を支援する</span>
              </h3>
              <p className="text-gray-300 text-sm mb-4 leading-relaxed">
                このツールは無料で提供しておりますが、開発の継続や新機能の追加には時間とコストがかかります。
                <br />
                もしこのツールが役に立ちましたら、開発支援のご寄付をいただけますと幸いです。
                <br />
                皆様の温かいご支援が、より良いツール作りの励みになります。
              </p>
              <button
                onClick={() => {
                  window.open('https://hima-na.booth.pm/items/7638991', '_blank');
                }}
                className="px-6 py-3 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white font-bold rounded-lg transition-all transform hover:scale-105 shadow-lg flex items-center gap-2 mx-auto"
              >
                <span>💝</span>
                <span>BOOTHで寄付する</span>
              </button>
              <p className="text-xs text-gray-400 mt-3">
                ※ BOOTHページへ移動します
              </p>
            </div>
          </div>
        </div>
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <SetupWizard
        isOpen={isSetupWizardOpen}
        onClose={handleSetupComplete}
      />
    </div>
  );
}

export default App;
