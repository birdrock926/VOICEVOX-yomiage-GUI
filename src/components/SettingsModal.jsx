import { useState, useEffect } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import AudioDeviceManager from './AudioDeviceManager';

export default function SettingsModal({ isOpen, onClose }) {
  const { settings, updateSettings, resetSettings, exportSettings, importSettings } = useSettings();
  const [activeTab, setActiveTab] = useState('voicevox');
  const [importError, setImportError] = useState(null);

  if (!isOpen) return null;

  const tabs = [
    { id: 'voicevox', label: '音声設定', icon: '🎤' },
    { id: 'audioDevices', label: 'オーディオデバイス', icon: '🔊' },
    { id: 'keybinds', label: 'キーバインド', icon: '⌨️' },
    { id: 'presets', label: 'プリセット', icon: '⚡' },
    { id: 'ui', label: 'UI設定', icon: '🎨' },
    { id: 'textProcessing', label: 'テキスト処理', icon: '📝' },
    { id: 'advanced', label: '詳細設定', icon: '⚙️' }
  ];

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      await importSettings(file);
      setImportError(null);
      alert('設定をインポートしました');
    } catch (err) {
      setImportError('設定のインポートに失敗しました: ' + err.message);
    }
  };

  const handleReset = () => {
    if (confirm('すべての設定をリセットしますか？')) {
      resetSettings();
      alert('設定をリセットしました');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <span className="text-zundamon-500">⚙️</span>
            設定
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-48 bg-gray-900 p-4 space-y-2 overflow-y-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-all flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'bg-zundamon-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <span>{tab.icon}</span>
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === 'voicevox' && <VoicevoxSettings settings={settings} updateSettings={updateSettings} />}
            {activeTab === 'audioDevices' && <AudioDeviceManager />}
            {activeTab === 'keybinds' && <KeybindSettings settings={settings} updateSettings={updateSettings} />}
            {activeTab === 'presets' && <PresetsSettings settings={settings} updateSettings={updateSettings} />}
            {activeTab === 'ui' && <UISettings settings={settings} updateSettings={updateSettings} />}
            {activeTab === 'textProcessing' && <TextProcessingSettings settings={settings} updateSettings={updateSettings} />}
            {activeTab === 'advanced' && <AdvancedSettings settings={settings} updateSettings={updateSettings} />}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-700 flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={exportSettings}
              className="btn-secondary text-sm"
            >
              📤 エクスポート
            </button>
            <label className="btn-secondary text-sm cursor-pointer">
              📥 インポート
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </label>
            <button
              onClick={handleReset}
              className="btn-secondary text-sm"
            >
              🔄 リセット
            </button>
          </div>
          {importError && <p className="text-red-500 text-sm">{importError}</p>}
          <button
            onClick={onClose}
            className="btn-primary"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

function VoicevoxSettings({ settings, updateSettings }) {
  const { voicevox } = settings;
  const [currentEngine, setCurrentEngine] = useState(null);
  const [installedEngines, setInstalledEngines] = useState([]);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({});
  const [downloadLogs, setDownloadLogs] = useState([]);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const ENGINE_TYPES = {
    cuda: {
      name: 'CUDA版',
      description: 'NVIDIA GPU対応',
      fullDescription: '【推奨】NVIDIA GPUで最高速。CUDA対応GPUが必要',
      recommended: true
    },
    directml: {
      name: 'DirectML版',
      description: 'AMD/Intel GPU対応',
      fullDescription: '【推奨】AMD/Intel GPUで高速動作。Windows 10以降が必要',
      recommended: true
    },
    cpu: {
      name: 'CPU版',
      description: 'すべてのPC対応',
      fullDescription: 'GPU非対応の場合や、GPU版で問題が発生した場合に選択',
      recommended: false
    }
  };

  useEffect(() => {
    console.log('[Settings] VoicevoxSettings component mounted');
    loadEngineInfo();

    if (window.electronAPI) {
      console.log('[Settings] Setting up download listeners');
      window.electronAPI.onEngineDownloadProgress((progressData) => {
        setDownloadProgress(progressData);
      });

      window.electronAPI.onEngineDownloadLog((log) => {
        setDownloadLogs(prev => [...prev, log].slice(-10));
      });
    }
  }, []);

  const loadEngineInfo = async () => {
    if (!window.electronAPI) {
      console.log('[Settings] Electron API not available');
      return;
    }

    try {
      console.log('[Settings] Loading engine info...');
      const current = await window.electronAPI.getCurrentEngine();
      console.log('[Settings] getCurrentEngine result:', current);
      console.log('[Settings] Extracted engineType:', current?.engineType);

      const installed = await window.electronAPI.getInstalledEngines();
      console.log('[Settings] getInstalledEngines result:', installed);
      console.log('[Settings] Is array?:', Array.isArray(installed));

      // getCurrentEngine returns { engineType: 'cuda' }, extract the string
      const engineType = current?.engineType || null;
      console.log('[Settings] Setting currentEngine to:', engineType);
      setCurrentEngine(engineType);

      const enginesArray = Array.isArray(installed) ? installed : [];
      console.log('[Settings] Setting installedEngines to:', enginesArray);
      setInstalledEngines(enginesArray);

      console.log('[Settings] Engine info loaded successfully');
    } catch (err) {
      console.error('[Settings] Failed to load engine info:', err);
      console.error('[Settings] Error stack:', err.stack);
      // Set safe defaults on error
      setCurrentEngine(null);
      setInstalledEngines([]);
    }
  };

  const handleSwitchEngine = async (engineType) => {
    if (!window.electronAPI) {
      setMessage({ type: 'error', text: 'Electron API が利用できません' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const result = await window.electronAPI.switchEngine(engineType);
      if (result.success) {
        setMessage({ type: 'success', text: `${ENGINE_TYPES[engineType].name}に切り替えました。アプリを再起動してください。` });
        await loadEngineInfo();
      } else {
        setMessage({ type: 'error', text: result.error || 'エンジンの切り替えに失敗しました' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'エラーが発生しました' });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadEngine = async (engineType) => {
    if (!window.electronAPI) {
      setMessage({ type: 'error', text: 'Electron API が利用できません' });
      return;
    }

    setDownloading(true);
    setDownloadProgress({});
    setDownloadLogs([]);
    setShowDownloadModal(false);
    setMessage(null);

    try {
      const result = await window.electronAPI.downloadEngine(engineType);
      if (result.success) {
        setMessage({ type: 'success', text: `${ENGINE_TYPES[engineType].name}のダウンロードが完了しました` });
        await loadEngineInfo();
      } else {
        setMessage({ type: 'error', text: result.error || 'ダウンロードに失敗しました' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'エラーが発生しました' });
    } finally {
      setDownloading(false);
    }
  };

  const handleRemoveEngine = async (engineType) => {
    if (!window.electronAPI) {
      setMessage({ type: 'error', text: 'Electron API が利用できません' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const result = await window.electronAPI.removeEngine(engineType);
      if (result.success) {
        setMessage({ type: 'success', text: `${ENGINE_TYPES[engineType].name}を削除しました` });
        await loadEngineInfo();
      } else {
        setMessage({ type: 'error', text: result.error || 'エンジンの削除に失敗しました' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'エラーが発生しました' });
    } finally {
      setLoading(false);
      setShowRemoveConfirm(null);
    }
  };

  const renderDownloadProgress = () => {
    if (!downloadProgress.type) return null;

    let progressText = '';
    let progressPercent = 0;

    if (downloadProgress.type === 'overall') {
      progressText = downloadProgress.step || '';
      progressPercent = downloadProgress.progress || 0;
    } else if (downloadProgress.type === 'download') {
      const downloaded = (downloadProgress.downloadedSize / 1024 / 1024).toFixed(1);
      const total = (downloadProgress.totalSize / 1024 / 1024).toFixed(1);
      progressText = `Downloading ${downloadProgress.file}: ${downloaded}MB / ${total}MB`;
      progressPercent = downloadProgress.progress || 0;
    } else if (downloadProgress.type === 'extract') {
      progressText = `Extracting ${downloadProgress.file}`;
      progressPercent = downloadProgress.progress || 0;
    }

    return (
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>{progressText}</span>
          <span>{Math.round(progressPercent)}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
          <div
            className="bg-gradient-to-r from-zundamon-500 to-emerald-500 h-full transition-all duration-300 ease-out flex items-center justify-center text-xs font-bold text-white"
            style={{ width: `${Math.min(progressPercent, 100)}%` }}
          >
            {Math.round(progressPercent) > 10 && `${Math.round(progressPercent)}%`}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold mb-4">音声パラメータ</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-2">速度 (Speed Scale)</label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.05"
                value={voicevox.speedScale}
                onChange={(e) => updateSettings('voicevox', { speedScale: parseFloat(e.target.value) })}
                className="flex-1"
              />
              <span className="text-sm font-mono w-12 text-right">{voicevox.speedScale.toFixed(2)}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">音声の再生速度 (0.5 = 遅い, 2.0 = 速い)</p>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">ピッチ (Pitch Scale)</label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="-0.15"
                max="0.15"
                step="0.01"
                value={voicevox.pitchScale}
                onChange={(e) => updateSettings('voicevox', { pitchScale: parseFloat(e.target.value) })}
                className="flex-1"
              />
              <span className="text-sm font-mono w-12 text-right">{voicevox.pitchScale.toFixed(2)}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">音声の高さ (-0.15 = 低い, 0.15 = 高い)</p>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">抑揚 (Intonation Scale)</label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0.0"
                max="2.0"
                step="0.05"
                value={voicevox.intonationScale}
                onChange={(e) => updateSettings('voicevox', { intonationScale: parseFloat(e.target.value) })}
                className="flex-1"
              />
              <span className="text-sm font-mono w-12 text-right">{voicevox.intonationScale.toFixed(2)}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">音声の抑揚の強さ (0.0 = 平坦, 2.0 = 抑揚強い)</p>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">音量 (Volume Scale)</label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0.0"
                max="2.0"
                step="0.05"
                value={voicevox.volumeScale}
                onChange={(e) => updateSettings('voicevox', { volumeScale: parseFloat(e.target.value) })}
                className="flex-1"
              />
              <span className="text-sm font-mono w-12 text-right">{voicevox.volumeScale.toFixed(2)}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">音声の音量 (0.0 = 無音, 2.0 = 大きい)</p>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">開始無音時間 (Pre Phoneme Length)</label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.01"
                value={voicevox.prePhonemeLength}
                onChange={(e) => updateSettings('voicevox', { prePhonemeLength: parseFloat(e.target.value) })}
                className="flex-1"
              />
              <span className="text-sm font-mono w-12 text-right">{voicevox.prePhonemeLength.toFixed(2)}s</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">音声開始前の無音時間</p>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">終了無音時間 (Post Phoneme Length)</label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.01"
                value={voicevox.postPhonemeLength}
                onChange={(e) => updateSettings('voicevox', { postPhonemeLength: parseFloat(e.target.value) })}
                className="flex-1"
              />
              <span className="text-sm font-mono w-12 text-right">{voicevox.postPhonemeLength.toFixed(2)}s</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">音声終了後の無音時間</p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xl font-bold mb-4">VOICEVOX接続設定</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-2">VOICEVOX URL</label>
            <input
              type="text"
              value={voicevox.url}
              onChange={(e) => updateSettings('voicevox', { url: e.target.value })}
              className="input"
              placeholder="http://127.0.0.1:50021"
            />
            <p className="text-xs text-gray-400 mt-1">VOICEVOX ENGINEのURL（通常は変更不要）</p>
          </div>

          <div className="p-4 bg-blue-900 bg-opacity-20 border border-blue-600 rounded-lg">
            <p className="text-sm text-blue-200">
              VOICEVOX Engineはアプリに同梱されており、アプリ起動時に自動的に起動します。
              手動でVOICEVOXをインストールする必要はありません。
            </p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xl font-bold mb-4">VOICEVOX Engine 管理</h3>

        {message && (
          <div className={`p-4 rounded-lg mb-4 ${
            message.type === 'success'
              ? 'bg-green-900 bg-opacity-20 border border-green-600'
              : 'bg-red-900 bg-opacity-20 border border-red-600'
          }`}>
            <p className={`text-sm ${message.type === 'success' ? 'text-green-200' : 'text-red-200'}`}>
              {message.text}
            </p>
          </div>
        )}

        <div className="space-y-4">
          {/* Current Engine Display */}
          {currentEngine && (
            <div className="p-4 bg-gray-700 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">現在のエンジン</p>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-bold">{ENGINE_TYPES[currentEngine]?.name || currentEngine}</p>
                    <span className="px-2 py-1 bg-zundamon-600 text-white text-xs rounded-full">
                      使用中
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {ENGINE_TYPES[currentEngine]?.description}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Installed Engines List */}
          <div>
            <p className="text-sm font-semibold mb-2">インストール済みエンジン</p>
            <div className="space-y-2">
              {installedEngines.length === 0 ? (
                <p className="text-sm text-gray-400 p-4 bg-gray-700 rounded-lg">
                  インストール済みのエンジンがありません
                </p>
              ) : (
                installedEngines.map((engineType) => {
                  const isActive = engineType === currentEngine;
                  return (
                    <div
                      key={engineType}
                      className="flex items-center justify-between p-4 bg-gray-700 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{ENGINE_TYPES[engineType]?.name || engineType}</p>
                          {isActive && (
                            <span className="px-2 py-1 bg-zundamon-600 text-white text-xs rounded-full">
                              使用中
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {ENGINE_TYPES[engineType]?.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {!isActive && (
                          <>
                            <button
                              onClick={() => handleSwitchEngine(engineType)}
                              disabled={loading}
                              className="btn-primary text-sm px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              切り替え
                            </button>
                            <button
                              onClick={() => setShowRemoveConfirm(engineType)}
                              disabled={loading}
                              className="btn-secondary text-sm px-4 py-2 text-red-400 hover:bg-red-900 hover:bg-opacity-20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              削除
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Download Button */}
          <button
            onClick={() => setShowDownloadModal(true)}
            disabled={loading || downloading}
            className="w-full btn-primary py-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            新しいエンジンをダウンロード
          </button>

          <div className="p-4 bg-yellow-900 bg-opacity-20 border border-yellow-600 rounded-lg">
            <p className="text-sm text-yellow-200">
              <span className="font-bold">ℹ️ 注意:</span> エンジンを切り替えた後は、アプリケーションを再起動する必要があります。
            </p>
          </div>
        </div>
      </div>

      {/* Download Selection Modal */}
      {showDownloadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-2xl w-full mx-4 shadow-2xl">
            <h3 className="text-2xl font-bold mb-4">エンジンを選択</h3>
            <p className="text-gray-300 mb-6">ダウンロードするエンジンを選択してください</p>

            <div className="space-y-3 mb-6">
              {Object.entries(ENGINE_TYPES).map(([type, info]) => {
                const isInstalled = installedEngines.includes(type);
                return (
                  <button
                    key={type}
                    onClick={() => !isInstalled && handleDownloadEngine(type)}
                    disabled={isInstalled}
                    className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                      isInstalled
                        ? 'border-gray-600 bg-gray-700 opacity-50 cursor-not-allowed'
                        : info.recommended
                        ? 'border-emerald-600 hover:border-emerald-500 bg-emerald-900 bg-opacity-10'
                        : 'border-gray-600 hover:border-gray-500 bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <h4 className="text-lg font-bold">{info.name}</h4>
                        {info.recommended && !isInstalled && (
                          <span className="px-2 py-1 bg-gradient-to-r from-emerald-500 to-green-500 text-white text-xs font-bold rounded-full">
                            ⚡ 推奨
                          </span>
                        )}
                      </div>
                      {isInstalled && (
                        <span className="px-3 py-1 bg-gray-600 text-white text-xs rounded-full">
                          インストール済み
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-300 mb-1">{info.fullDescription}</p>
                    <p className="text-xs text-gray-400">サイズ: 約 300-500MB</p>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDownloadModal(false)}
                className="flex-1 btn-secondary py-3"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Confirmation Dialog */}
      {showRemoveConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-xl font-bold mb-4">エンジンの削除</h3>
            <p className="text-gray-300 mb-6">
              本当に <span className="font-bold text-zundamon-400">{ENGINE_TYPES[showRemoveConfirm]?.name}</span> を削除しますか？
              この操作は取り消せません。
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowRemoveConfirm(null)}
                disabled={loading}
                className="flex-1 btn-secondary py-3 disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={() => handleRemoveEngine(showRemoveConfirm)}
                disabled={loading}
                className="flex-1 btn-primary py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Download Progress Modal */}
      {downloading && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-8 max-w-2xl w-full mx-4 shadow-2xl">
            <h3 className="text-2xl font-bold mb-6 text-center">
              エンジンをダウンロード中...
            </h3>

            <div className="mb-8">
              {renderDownloadProgress()}
            </div>

            {downloadLogs.length > 0 && (
              <div className="bg-gray-900 rounded-lg p-4 max-h-40 overflow-y-auto">
                <p className="text-xs text-gray-400 mb-2">ダウンロードログ:</p>
                {downloadLogs.map((log, index) => (
                  <p key={index} className="text-xs text-gray-300 font-mono">
                    {log}
                  </p>
                ))}
              </div>
            )}

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-400">
                この処理には数分かかる場合があります。しばらくお待ちください...
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KeybindSettings({ settings, updateSettings }) {
  const { keybinds } = settings;
  const [recording, setRecording] = useState(null);
  const [recordedKeys, setRecordedKeys] = useState([]);
  const [pressedKeys, setPressedKeys] = useState(new Set());

  const keybindLabels = {
    submit: '送信',
    quickRead: 'クイック読み上げ',
    toggleWindow: 'ウィンドウ表示切替',
    clearText: 'テキストクリア',
    focusInput: '入力欄にフォーカス'
  };

  const normalizeKey = (keyName) => {
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
      return specialKeyMap[lowerKey];
    } else if (keyName.length === 1) {
      return keyName.toUpperCase();
    }
    return keyName;
  };

  const recordKeybind = (key) => {
    setRecording(key);
    setRecordedKeys([]);
    setPressedKeys(new Set());

    const keydownHandler = (e) => {
      e.preventDefault();

      const keyName = normalizeKey(e.key);
      const currentPressedKeys = new Set(pressedKeys);

      // Add modifiers
      if (e.ctrlKey && !currentPressedKeys.has('Control')) currentPressedKeys.add('Control');
      if (e.shiftKey && !currentPressedKeys.has('Shift')) currentPressedKeys.add('Shift');
      if (e.altKey && !currentPressedKeys.has('Alt')) currentPressedKeys.add('Alt');
      if (e.metaKey && !currentPressedKeys.has('Command')) currentPressedKeys.add('Command');

      // Add main key if it's not a modifier
      if (keyName !== 'Control' && keyName !== 'Shift' && keyName !== 'Alt' && keyName !== 'Meta' && keyName !== 'Command') {
        currentPressedKeys.add(keyName);
      }

      setPressedKeys(currentPressedKeys);
      setRecordedKeys(Array.from(currentPressedKeys));
    };

    const keyupHandler = (e) => {
      e.preventDefault();

      // When user releases keys, save the combination
      const keys = Array.from(pressedKeys);
      if (keys.length > 0) {
        const accelerator = keys.join('+');
        updateSettings('keybinds', { [key]: accelerator });
        cleanup();
      }
    };

    const cleanup = () => {
      setRecording(null);
      setRecordedKeys([]);
      setPressedKeys(new Set());
      document.removeEventListener('keydown', keydownHandler);
      document.removeEventListener('keyup', keyupHandler);
    };

    document.addEventListener('keydown', keydownHandler);
    document.addEventListener('keyup', keyupHandler);

    // Timeout after 10 seconds
    setTimeout(() => {
      cleanup();
    }, 10000);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xl font-bold mb-4">キーバインド設定</h3>
        <p className="text-sm text-gray-400 mb-4">
          各アクションに割り当てるキーを設定できます。「記録」ボタンをクリック後、キーを長押しして離すと記録されます。
        </p>
      </div>

      {recording && recordedKeys.length > 0 && (
        <div className="p-4 bg-zundamon-900 bg-opacity-30 border border-zundamon-600 rounded-lg">
          <p className="text-sm text-zundamon-200 mb-2">現在押されているキー:</p>
          <code className="px-3 py-2 bg-gray-900 rounded text-zundamon-400 font-mono text-lg">
            {recordedKeys.join(' + ')}
          </code>
          <p className="text-xs text-gray-400 mt-2">キーを離すと確定されます</p>
        </div>
      )}

      {Object.entries(keybindLabels).map(([key, label]) => (
        <div key={key} className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
          <div>
            <p className="font-semibold">{label}</p>
            <p className="text-sm text-gray-400">{key}</p>
          </div>
          <div className="flex items-center gap-2">
            <code className="px-3 py-2 bg-gray-900 rounded text-zundamon-400 font-mono text-sm">
              {keybinds[key]}
            </code>
            <button
              onClick={() => recordKeybind(key)}
              className={`btn-secondary text-sm ${recording === key ? 'bg-zundamon-600 animate-pulse' : ''}`}
            >
              {recording === key ? '⏺ キーを押してください...' : '記録'}
            </button>
          </div>
        </div>
      ))}

      <div className="p-4 bg-blue-900 bg-opacity-30 border border-blue-600 rounded-lg">
        <p className="text-sm text-blue-200">
          💡 複数のキーを同時に長押しして、離すと組み合わせが記録されます。例: Ctrl + Enter
        </p>
      </div>

      <div className="p-4 bg-yellow-900 bg-opacity-30 border border-yellow-600 rounded-lg">
        <p className="text-sm text-yellow-200">
          ⚠️ グローバルホットキー（アプリがフォーカスされていない時も動作）はElectron版でのみ有効です。
        </p>
      </div>
    </div>
  );
}

function UISettings({ settings, updateSettings }) {
  const { ui } = settings;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold mb-4">表示設定</h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
            <div>
              <p className="font-semibold">履歴を表示</p>
              <p className="text-sm text-gray-400">読み上げ履歴をサイドバーに表示します</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={ui.showHistory}
                onChange={(e) => updateSettings('ui', { showHistory: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-zundamon-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-zundamon-600"></div>
            </label>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">履歴保持件数</label>
            <input
              type="number"
              min="5"
              max="100"
              value={ui.historyLimit}
              onChange={(e) => updateSettings('ui', { historyLimit: parseInt(e.target.value) })}
              className="input w-32"
            />
            <p className="text-xs text-gray-400 mt-1">保存する履歴の最大数</p>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
            <div>
              <p className="font-semibold">コンパクトモード</p>
              <p className="text-sm text-gray-400">UIを小さく表示します</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={ui.compactMode}
                onChange={(e) => updateSettings('ui', { compactMode: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-zundamon-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-zundamon-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
            <div>
              <p className="font-semibold">読み上げ後に自動最小化</p>
              <p className="text-sm text-gray-400">音声を再生したらウィンドウを最小化します</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={ui.autoMinimizeOnRead}
                onChange={(e) => updateSettings('ui', { autoMinimizeOnRead: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-zundamon-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-zundamon-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
            <div>
              <p className="font-semibold">トレイに最小化</p>
              <p className="text-sm text-gray-400">最小化時にシステムトレイに格納します</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={ui.minimizeToTray}
                onChange={(e) => updateSettings('ui', { minimizeToTray: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-zundamon-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-zundamon-600"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

function TextProcessingSettings({ settings, updateSettings }) {
  const { textProcessing } = settings;
  const [newRule, setNewRule] = useState({ from: '', to: '' });

  const addRule = () => {
    if (newRule.from && newRule.to) {
      const updatedRules = [...textProcessing.autoReplaceRules, newRule];
      updateSettings('textProcessing', { autoReplaceRules: updatedRules });
      setNewRule({ from: '', to: '' });
    }
  };

  const removeRule = (index) => {
    const updatedRules = textProcessing.autoReplaceRules.filter((_, i) => i !== index);
    updateSettings('textProcessing', { autoReplaceRules: updatedRules });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold mb-4">テキスト自動置換</h3>

        <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg mb-4">
          <div>
            <p className="font-semibold">自動置換を有効化</p>
            <p className="text-sm text-gray-400">テキスト送信前に自動で置換を実行します</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={textProcessing.autoReplaceEnabled}
              onChange={(e) => updateSettings('textProcessing', { autoReplaceEnabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-zundamon-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-zundamon-600"></div>
          </label>
        </div>

        <div className="space-y-2 mb-4">
          {textProcessing.autoReplaceRules.map((rule, index) => (
            <div key={index} className="flex items-center gap-2 p-3 bg-gray-700 rounded-lg">
              <code className="flex-1 text-sm">{rule.from}</code>
              <span className="text-gray-500">→</span>
              <code className="flex-1 text-sm text-zundamon-400">{rule.to}</code>
              <button
                onClick={() => removeRule(index)}
                className="text-red-500 hover:text-red-400 px-2"
              >
                削除
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newRule.from}
            onChange={(e) => setNewRule({ ...newRule, from: e.target.value })}
            placeholder="置換前"
            className="input flex-1"
          />
          <span className="flex items-center text-gray-500">→</span>
          <input
            type="text"
            value={newRule.to}
            onChange={(e) => setNewRule({ ...newRule, to: e.target.value })}
            placeholder="置換後"
            className="input flex-1"
          />
          <button onClick={addRule} className="btn-primary">
            追加
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-xl font-bold mb-4">その他</h3>

        <div>
          <label className="block text-sm font-semibold mb-2">最大文字数</label>
          <input
            type="number"
            min="50"
            max="2000"
            value={textProcessing.maxLength}
            onChange={(e) => updateSettings('textProcessing', { maxLength: parseInt(e.target.value) })}
            className="input w-32"
          />
          <p className="text-xs text-gray-400 mt-1">1回の読み上げで許可する最大文字数</p>
        </div>
      </div>
    </div>
  );
}

function AdvancedSettings({ settings, updateSettings }) {
  const { advanced } = settings;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold mb-4">サーバー設定</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-2">サーバーポート</label>
            <input
              type="number"
              min="1024"
              max="65535"
              value={advanced.serverPort}
              onChange={(e) => updateSettings('advanced', { serverPort: parseInt(e.target.value) })}
              className="input w-32"
            />
            <p className="text-xs text-gray-400 mt-1">内部サーバーのポート番号（変更後は再起動が必要）</p>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">再接続試行回数</label>
            <input
              type="number"
              min="1"
              max="20"
              value={advanced.reconnectAttempts}
              onChange={(e) => updateSettings('advanced', { reconnectAttempts: parseInt(e.target.value) })}
              className="input w-32"
            />
            <p className="text-xs text-gray-400 mt-1">接続失敗時の再試行回数</p>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">再接続待機時間（ミリ秒）</label>
            <input
              type="number"
              min="500"
              max="10000"
              step="500"
              value={advanced.reconnectDelay}
              onChange={(e) => updateSettings('advanced', { reconnectDelay: parseInt(e.target.value) })}
              className="input w-32"
            />
            <p className="text-xs text-gray-400 mt-1">再接続までの待機時間</p>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">リクエストタイムアウト（ミリ秒）</label>
            <input
              type="number"
              min="1000"
              max="60000"
              step="1000"
              value={advanced.requestTimeout}
              onChange={(e) => updateSettings('advanced', { requestTimeout: parseInt(e.target.value) })}
              className="input w-32"
            />
            <p className="text-xs text-gray-400 mt-1">APIリクエストのタイムアウト時間</p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xl font-bold mb-4">デバッグ設定</h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
            <div>
              <p className="font-semibold">ログを有効化</p>
              <p className="text-sm text-gray-400">詳細なログを出力します</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={advanced.enableLogging}
                onChange={(e) => updateSettings('advanced', { enableLogging: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-zundamon-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-zundamon-600"></div>
            </label>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">ログレベル</label>
            <select
              value={advanced.logLevel}
              onChange={(e) => updateSettings('advanced', { logLevel: e.target.value })}
              className="input w-full"
            >
              <option value="error">Error</option>
              <option value="warn">Warning</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

function PresetsSettings({ settings, updateSettings }) {
  const { presets } = settings;
  const [editingPreset, setEditingPreset] = useState(null);
  const [newPreset, setNewPreset] = useState({ label: '', text: '' });

  const handleAddPreset = () => {
    if (!newPreset.label.trim() || !newPreset.text.trim()) {
      alert('ラベルとテキストを入力してください');
      return;
    }

    const newId = presets.items.length > 0
      ? Math.max(...presets.items.map(p => p.id)) + 1
      : 1;

    const updated = {
      ...presets,
      items: [...presets.items, { id: newId, label: newPreset.label, text: newPreset.text }]
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
      ...presets,
      items: presets.items.map(p => p.id === id ? { ...p, label: editingPreset.label, text: editingPreset.text } : p)
    };

    updateSettings('presets', updated);
    setEditingPreset(null);
  };

  const handleDeletePreset = (id) => {
    if (!confirm('このプリセットを削除しますか？')) return;

    const updated = {
      ...presets,
      items: presets.items.filter(p => p.id !== id)
    };

    updateSettings('presets', updated);
    if (editingPreset && editingPreset.id === id) {
      setEditingPreset(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
        <div>
          <p className="font-semibold">プリセットを有効化</p>
          <p className="text-sm text-gray-400">テキスト入力欄の下にクイックプリセットボタンを表示</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={presets.enabled}
            onChange={(e) => updateSettings('presets', { enabled: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-zundamon-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-zundamon-600"></div>
        </label>
      </div>

      <div>
        <h3 className="text-xl font-bold mb-4">新しいプリセットを追加</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-semibold mb-2">ラベル</label>
            <input
              type="text"
              value={newPreset.label}
              onChange={(e) => setNewPreset({ ...newPreset, label: e.target.value })}
              placeholder="例: こんにちは"
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2">テキスト</label>
            <textarea
              value={newPreset.text}
              onChange={(e) => setNewPreset({ ...newPreset, text: e.target.value })}
              placeholder="例: こんにちは、ずんだもんなのだ！"
              className="input w-full h-24 resize-none"
            />
          </div>
          <button onClick={handleAddPreset} className="btn-primary w-full">
            ➕ プリセットを追加
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-xl font-bold mb-4">登録済みプリセット</h3>
        {presets.items.length === 0 ? (
          <div className="p-8 bg-gray-700 rounded-lg text-center text-gray-400">
            <p>プリセットが登録されていません</p>
            <p className="text-sm mt-2">上のフォームから新しいプリセットを追加してください</p>
          </div>
        ) : (
          <div className="space-y-3">
            {presets.items.map((preset) => (
              <div key={preset.id} className="p-4 bg-gray-700 rounded-lg">
                {editingPreset && editingPreset.id === preset.id ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-semibold mb-2">ラベル</label>
                      <input
                        type="text"
                        value={editingPreset.label}
                        onChange={(e) => setEditingPreset({ ...editingPreset, label: e.target.value })}
                        className="input w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-2">テキスト</label>
                      <textarea
                        value={editingPreset.text}
                        onChange={(e) => setEditingPreset({ ...editingPreset, text: e.target.value })}
                        className="input w-full h-24 resize-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdatePreset(preset.id)}
                        className="btn-primary flex-1"
                      >
                        ✓ 保存
                      </button>
                      <button
                        onClick={() => setEditingPreset(null)}
                        className="btn-secondary flex-1"
                      >
                        ✗ キャンセル
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-zundamon-600 text-white text-sm font-bold rounded-full">
                          {preset.label}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingPreset({ ...preset })}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                        >
                          ✏️ 編集
                        </button>
                        <button
                          onClick={() => handleDeletePreset(preset.id)}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                        >
                          🗑️ 削除
                        </button>
                      </div>
                    </div>
                    <p className="text-gray-300 text-sm">{preset.text}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
