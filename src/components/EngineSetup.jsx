import { useState, useEffect } from 'react';

const ENGINE_TYPES = {
  cuda: {
    name: 'CUDA版（NVIDIA GPU対応）',
    description: 'NVIDIA GPUで最高速。CUDA対応GPUが必要',
    recommended: true,
    badge: '推奨',
    note: 'NVIDIA GPU搭載PCに最適'
  },
  directml: {
    name: 'DirectML版（AMD/Intel GPU対応）',
    description: 'AMD/Intel GPUで高速動作。Windows 10以降が必要',
    recommended: true,
    badge: '推奨',
    note: 'AMD/Intel GPU搭載PCに最適'
  },
  cpu: {
    name: 'CPU版（すべてのPC対応）',
    description: 'GPU非対応の場合や、GPU版で問題が発生した場合に選択',
    recommended: false,
    badge: '互換性重視',
    note: 'GPUが使えない環境向け'
  }
};

export default function EngineSetup({ onComplete }) {
  const [step, setStep] = useState('select'); // select, downloading, complete, error
  const [selectedEngine, setSelectedEngine] = useState('cuda');
  const [progress, setProgress] = useState({});
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    if (!window.electronAPI) return;

    // Listen for progress updates
    window.electronAPI.onEngineDownloadProgress((progressData) => {
      setProgress(progressData);
    });

    // Listen for log messages
    window.electronAPI.onEngineDownloadLog((log) => {
      setLogs(prev => [...prev, log].slice(-10)); // Keep last 10 logs
    });
  }, []);

  const handleEngineSelect = (engineType) => {
    setSelectedEngine(engineType);
  };

  const handleStartDownload = async () => {
    if (!window.electronAPI) {
      setError('Electron API not available');
      setStep('error');
      return;
    }

    setStep('downloading');
    setProgress({});
    setError(null);
    setLogs([]);

    try {
      const result = await window.electronAPI.downloadEngine(selectedEngine);

      if (result.success) {
        setStep('complete');
        setTimeout(() => {
          if (onComplete) onComplete(result);
        }, 2000);
      } else {
        setError(result.error || 'Download failed');
        setStep('error');
      }
    } catch (err) {
      setError(err.message || 'Unknown error occurred');
      setStep('error');
    }
  };

  const renderProgress = () => {
    if (!progress.type) return null;

    let progressText = '';
    let progressPercent = 0;

    // Truncate long filenames to prevent overflow
    const truncateFilename = (filename, maxLength = 40) => {
      if (!filename || filename.length <= maxLength) return filename;
      const extension = filename.split('.').pop();
      const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
      const truncated = nameWithoutExt.substring(0, maxLength - extension.length - 3) + '...' + extension;
      return truncated;
    };

    if (progress.type === 'overall') {
      progressText = progress.step || '';
      progressPercent = progress.progress || 0;
    } else if (progress.type === 'download') {
      const downloaded = (progress.downloadedSize / 1024 / 1024).toFixed(1);
      const total = (progress.totalSize / 1024 / 1024).toFixed(1);
      const filename = truncateFilename(progress.file);
      progressText = `${downloaded}MB / ${total}MB`;
      progressPercent = progress.progress || 0;
    } else if (progress.type === 'extract') {
      const filename = truncateFilename(progress.file);
      progressText = `展開中: ${filename}`;
      progressPercent = progress.progress || 0;
    }

    return (
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="truncate mr-2">{progressText}</span>
          <span className="flex-shrink-0">{Math.round(progressPercent)}%</span>
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

  if (step === 'select') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800 rounded-xl p-8 max-w-3xl w-full shadow-2xl">
          <h2 className="text-3xl font-bold mb-2 text-center bg-gradient-to-r from-zundamon-400 to-emerald-400 bg-clip-text text-transparent">
            VOICEVOX Engine セットアップ
          </h2>
          <p className="text-center text-gray-300 mb-8">
            お使いのPCに最適なエンジンを選択してください
          </p>

          <div className="space-y-4 mb-8">
            {Object.entries(ENGINE_TYPES).map(([type, info]) => (
              <button
                key={type}
                onClick={() => handleEngineSelect(type)}
                className={`w-full p-6 rounded-lg border-2 transition-all text-left ${
                  selectedEngine === type
                    ? 'border-zundamon-500 bg-zundamon-900 bg-opacity-20'
                    : info.recommended
                    ? 'border-emerald-600 hover:border-emerald-500 bg-emerald-900 bg-opacity-10'
                    : 'border-gray-600 hover:border-gray-500 bg-gray-700 bg-opacity-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-bold text-white">{info.name}</h3>
                    {info.recommended && (
                      <span className="px-3 py-1 bg-gradient-to-r from-emerald-500 to-green-500 text-white text-xs font-bold rounded-full">
                        ⚡ {info.badge}
                      </span>
                    )}
                    {!info.recommended && (
                      <span className="px-3 py-1 bg-gray-600 text-gray-300 text-xs font-bold rounded-full">
                        {info.badge}
                      </span>
                    )}
                  </div>
                  {selectedEngine === type && (
                    <span className="px-3 py-1 bg-zundamon-500 text-white text-sm rounded-full">
                      ✓ 選択中
                    </span>
                  )}
                </div>
                <p className="text-gray-300 text-sm mb-2">{info.description}</p>
                <p className={`text-sm font-semibold ${info.recommended ? 'text-emerald-400' : 'text-gray-400'}`}>
                  {info.note}
                </p>
              </button>
            ))}
          </div>

          <div className="bg-gradient-to-r from-emerald-900 to-blue-900 bg-opacity-20 border border-emerald-600 rounded-lg p-4 mb-6">
            <p className="text-sm text-emerald-200 mb-3">
              <span className="font-bold">⚡ 推奨事項:</span> GPU版は音声生成が高速で、快適に使用できます。
            </p>
            <ul className="text-sm text-gray-300 space-y-1 ml-4 list-disc">
              <li><strong className="text-white">NVIDIA GPU搭載PC:</strong> CUDA版がおすすめ</li>
              <li><strong className="text-white">AMD/Intel GPU搭載PC:</strong> DirectML版がおすすめ</li>
              <li><strong className="text-white">GPU非対応/不明な場合:</strong> CPU版を選択</li>
            </ul>
            <p className="text-xs text-gray-400 mt-3">
              ※ 後から設定画面で変更することもできます
            </p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleStartDownload}
              className="flex-1 btn-primary py-4 text-lg font-bold"
            >
              ダウンロード開始
            </button>
          </div>

          <p className="text-center text-xs text-gray-400 mt-4">
            ダウンロードサイズ: 約 300-500MB（エンジンにより異なります）
          </p>
        </div>
      </div>
    );
  }

  if (step === 'downloading') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800 rounded-xl p-8 max-w-2xl w-full shadow-2xl">
          <h2 className="text-2xl font-bold mb-6 text-center text-white">
            {ENGINE_TYPES[selectedEngine].name} をインストール中...
          </h2>

          <div className="mb-8">
            {renderProgress()}
          </div>

          {logs.length > 0 && (
            <div className="bg-gray-900 rounded-lg p-4 max-h-40 overflow-y-auto">
              <p className="text-xs text-gray-400 mb-2">インストールログ:</p>
              {logs.map((log, index) => (
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
    );
  }

  if (step === 'complete') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800 rounded-xl p-8 max-w-2xl w-full shadow-2xl text-center">
          <div className="mb-6">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">
              インストール完了！
            </h2>
            <p className="text-gray-300">
              {ENGINE_TYPES[selectedEngine].name} のインストールが完了しました
            </p>
          </div>

          <div className="bg-green-900 bg-opacity-20 border border-green-600 rounded-lg p-4 mb-6">
            <p className="text-sm text-green-200">
              アプリケーションが起動します。そのままお待ちください...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800 rounded-xl p-8 max-w-2xl w-full shadow-2xl">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              インストールエラー
            </h2>
            <p className="text-gray-300 mb-4">
              エンジンのインストールに失敗しました
            </p>
          </div>

          <div className="bg-red-900 bg-opacity-20 border border-red-600 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-200 font-mono">
              {error}
            </p>
          </div>

          <div className="bg-yellow-900 bg-opacity-20 border border-yellow-600 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-200">
              <span className="font-bold">💡 解決方法:</span>
            </p>
            <ul className="text-sm text-yellow-200 mt-2 space-y-1 list-disc list-inside">
              <li>インターネット接続を確認してください</li>
              <li>ファイアウォールやアンチウイルスソフトを一時的に無効にしてみてください</li>
              <li>ディスク容量が十分にあるか確認してください（2GB以上推奨）</li>
              {error?.includes('7-Zip') && (
                <li className="font-bold">
                  7-Zipをインストールしてください:
                  <a href="https://www.7-zip.org/download.html" target="_blank" rel="noopener noreferrer" className="underline ml-1">
                    https://www.7-zip.org/download.html
                  </a>
                </li>
              )}
            </ul>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setStep('select')}
              className="flex-1 btn-secondary py-3"
            >
              戻る
            </button>
            <button
              onClick={handleStartDownload}
              className="flex-1 btn-primary py-3"
            >
              再試行
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
