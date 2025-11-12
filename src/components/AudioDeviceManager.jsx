import { useState, useEffect } from 'react';

export default function AudioDeviceManager() {
  const [devices, setDevices] = useState({ input: [], output: [] });
  const [hasVirtualDevice, setHasVirtualDevice] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // デバイスのスキャン
  const scanDevices = async () => {
    setIsScanning(true);
    try {
      // ブラウザのメディアデバイスAPIを使用
      const allDevices = await navigator.mediaDevices.enumerateDevices();

      const inputDevices = allDevices.filter(d => d.kind === 'audioinput');
      const outputDevices = allDevices.filter(d => d.kind === 'audiooutput');

      setDevices({
        input: inputDevices,
        output: outputDevices
      });

      // 仮想デバイスの検出（VB-CABLE, BlackHole等）
      const virtualKeywords = ['cable', 'virtual', 'blackhole', 'loopback', 'vb-audio'];
      const hasVirtual = [...inputDevices, ...outputDevices].some(device =>
        virtualKeywords.some(keyword =>
          device.label.toLowerCase().includes(keyword)
        )
      );
      setHasVirtualDevice(hasVirtual);

    } catch (err) {
      console.error('Failed to enumerate devices:', err);
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    scanDevices();

    // デバイス変更の監視
    navigator.mediaDevices.addEventListener('devicechange', scanDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', scanDevices);
    };
  }, []);

  const getDeviceIcon = (deviceLabel) => {
    const label = deviceLabel.toLowerCase();
    if (label.includes('cable') || label.includes('virtual') || label.includes('blackhole')) {
      return '🔄';
    } else if (label.includes('microphone') || label.includes('マイク')) {
      return '🎤';
    } else if (label.includes('speaker') || label.includes('スピーカー')) {
      return '🔊';
    } else if (label.includes('headphone') || label.includes('ヘッドホン')) {
      return '🎧';
    }
    return '🔈';
  };

  const isVirtualDevice = (deviceLabel) => {
    const label = deviceLabel.toLowerCase();
    const virtualKeywords = ['cable', 'virtual', 'blackhole', 'loopback', 'vb-audio'];
    return virtualKeywords.some(keyword => label.includes(keyword));
  };

  return (
    <div className="space-y-6">
      <div className={`p-4 rounded-lg ${hasVirtualDevice ? 'bg-green-900 bg-opacity-30 border border-green-600' : 'bg-yellow-900 bg-opacity-30 border border-yellow-600'}`}>
        <div className="flex items-center gap-2 mb-2">
          {hasVirtualDevice ? (
            <>
              <span className="text-green-500 text-xl">✓</span>
              <h3 className="font-bold text-green-400">仮想オーディオデバイスが検出されました</h3>
            </>
          ) : (
            <>
              <span className="text-yellow-500 text-xl">⚠</span>
              <h3 className="font-bold text-yellow-400">仮想オーディオデバイスが見つかりません</h3>
            </>
          )}
        </div>
        <p className="text-sm text-gray-300">
          {hasVirtualDevice
            ? 'ゲームVCに音声を送信する準備ができています。'
            : 'VB-CABLEやBlackHole等の仮想オーディオデバイスをインストールしてください。'}
        </p>
      </div>

      {!hasVirtualDevice && (
        <div className="bg-gradient-to-r from-zundamon-600 to-emerald-600 p-6 rounded-lg">
          <h3 className="text-xl font-bold mb-3 text-white">仮想オーディオデバイスのインストール</h3>
          <p className="text-white text-sm mb-4">
            ゲームVCに音声を送信するには、仮想オーディオデバイスが必要です。お使いのOSに応じてダウンロードしてください。
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <a
              href="https://vb-audio.com/Cable/"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white text-gray-900 px-6 py-4 rounded-lg font-bold hover:bg-gray-100 transition-colors flex items-center justify-between group"
            >
              <div>
                <div className="text-lg">Windows向け</div>
                <div className="text-sm font-normal text-gray-600">VB-CABLE（無料）</div>
              </div>
              <span className="text-2xl group-hover:translate-x-1 transition-transform">→</span>
            </a>

            <a
              href="https://existential.audio/blackhole/"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white text-gray-900 px-6 py-4 rounded-lg font-bold hover:bg-gray-100 transition-colors flex items-center justify-between group"
            >
              <div>
                <div className="text-lg">macOS向け</div>
                <div className="text-sm font-normal text-gray-600">BlackHole（無料）</div>
              </div>
              <span className="text-2xl group-hover:translate-x-1 transition-transform">→</span>
            </a>
          </div>

          <div className="mt-4 p-3 bg-white bg-opacity-20 rounded text-white text-xs">
            <strong>Linux:</strong> PulseAudioのループバック機能を使用してください。
            <code className="block mt-1 bg-black bg-opacity-30 p-2 rounded font-mono">
              pactl load-module module-loopback
            </code>
          </div>
        </div>
      )}

      {/* デバイスリスト */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold">オーディオデバイス一覧</h3>
          <button
            onClick={scanDevices}
            disabled={isScanning}
            className="btn-secondary text-sm flex items-center gap-2"
          >
            {isScanning ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>スキャン中...</span>
              </>
            ) : (
              <>
                <span>🔄</span>
                <span>再スキャン</span>
              </>
            )}
          </button>
        </div>

        {/* 出力デバイス */}
        <div className="mb-4">
          <h4 className="text-sm font-semibold mb-2 text-gray-400">出力デバイス（再生デバイス）</h4>
          <div className="space-y-2">
            {devices.output.length === 0 ? (
              <p className="text-sm text-gray-500 p-3 bg-gray-800 rounded">デバイスが見つかりません</p>
            ) : (
              devices.output.map((device, index) => (
                <div
                  key={device.deviceId || index}
                  className={`p-3 rounded-lg flex items-center gap-3 ${
                    isVirtualDevice(device.label)
                      ? 'bg-zundamon-900 bg-opacity-30 border border-zundamon-600'
                      : 'bg-gray-700'
                  }`}
                >
                  <span className="text-2xl">{getDeviceIcon(device.label)}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{device.label || '不明なデバイス'}</p>
                    {isVirtualDevice(device.label) && (
                      <p className="text-xs text-zundamon-400 mt-1">
                        ✓ 仮想デバイス - このアプリの再生先に設定してください
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 入力デバイス */}
        <div>
          <h4 className="text-sm font-semibold mb-2 text-gray-400">入力デバイス（マイクデバイス）</h4>
          <div className="space-y-2">
            {devices.input.length === 0 ? (
              <p className="text-sm text-gray-500 p-3 bg-gray-800 rounded">デバイスが見つかりません</p>
            ) : (
              devices.input.map((device, index) => (
                <div
                  key={device.deviceId || index}
                  className={`p-3 rounded-lg flex items-center gap-3 ${
                    isVirtualDevice(device.label)
                      ? 'bg-zundamon-900 bg-opacity-30 border border-zundamon-600'
                      : 'bg-gray-700'
                  }`}
                >
                  <span className="text-2xl">{getDeviceIcon(device.label)}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{device.label || '不明なデバイス'}</p>
                    {isVirtualDevice(device.label) && (
                      <p className="text-xs text-zundamon-400 mt-1">
                        ✓ 仮想デバイス - Discord/ゲームのマイク入力に設定してください
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="p-4 bg-gray-800 rounded-lg">
        <h4 className="font-bold mb-3">セットアップガイド</h4>
        <div className="space-y-4">
          <div className="border-l-4 border-zundamon-500 pl-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-zundamon-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">1</span>
              <p className="font-semibold">VB-CABLEのダウンロードとインストール（Windows）</p>
            </div>
            <div className="text-sm text-gray-400 space-y-1 ml-8">
              <p>① 上のボタンから公式サイトにアクセス</p>
              <p>② 「Download」ボタンをクリックしてZIPファイルをダウンロード</p>
              <p>③ ZIPファイルを解凍</p>
              <p>④ <code className="bg-gray-700 px-1 rounded">VBCABLE_Setup_x64.exe</code>（64bit版）を<strong>右クリック→管理者として実行</strong></p>
              <p>⑤ 「Install Driver」をクリック</p>
              <p>⑥ インストール完了後、<strong>PCを再起動</strong></p>
            </div>
          </div>

          <div className="border-l-4 border-zundamon-500 pl-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-zundamon-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">2</span>
              <p className="font-semibold">Windowsサウンド設定を変更</p>
            </div>
            <div className="text-sm text-gray-400 space-y-1 ml-8">
              <p>① Windowsの設定を開く（Win + I）</p>
              <p>② 「システム」→「サウンド」</p>
              <p>③ <strong>「出力」セクション</strong>で「CABLE Input (VB-Audio Virtual Cable)」を選択</p>
              <p className="text-yellow-400">※ この設定で、このアプリの音声がVB-CABLEに送られます</p>
            </div>
          </div>

          <div className="border-l-4 border-zundamon-500 pl-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-zundamon-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">3</span>
              <p className="font-semibold">Discord/ゲームのマイク設定を変更</p>
            </div>
            <div className="text-sm text-gray-400 space-y-1 ml-8">
              <p>【Discordの場合】</p>
              <p>① ユーザー設定（歯車アイコン）を開く</p>
              <p>② 「音声・ビデオ」タブ</p>
              <p>③ <strong>「入力デバイス」</strong>で「CABLE Output (VB-Audio Virtual Cable)」を選択</p>
              <p className="mt-2">【ゲームの場合】</p>
              <p>ゲームの設定でマイク入力を「CABLE Output」に変更</p>
            </div>
          </div>

          <div className="border-l-4 border-green-500 pl-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-green-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">4</span>
              <p className="font-semibold">動作テスト</p>
            </div>
            <div className="text-sm text-gray-400 space-y-1 ml-8">
              <p>① このアプリでテキストを入力して「読み上げ」</p>
              <p>② Discord/ゲームで音声が聞こえることを確認</p>
              <p className="text-green-400">✓ 音声が聞こえれば設定完了です！</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 bg-blue-900 bg-opacity-20 border border-blue-600 rounded-lg">
        <h4 className="font-bold mb-2 text-blue-400">ヒント</h4>
        <ul className="space-y-1 text-sm text-gray-300">
          <li>• 仮想オーディオデバイスはアプリ外部のソフトウェアです</li>
          <li>• 一度インストールすれば、常にシステムに表示されます</li>
          <li>• 使用しない時はWindowsのサウンド設定で通常のデバイスに戻してください</li>
          <li>• VB-CABLEは無料ですが、寄付により開発がサポートされています</li>
        </ul>
      </div>

      <div className="p-4 bg-red-900 bg-opacity-20 border border-red-600 rounded-lg">
        <h4 className="font-bold mb-2 text-red-400">トラブルシューティング</h4>
        <div className="space-y-2 text-sm text-gray-300">
          <div>
            <p className="font-semibold">音声が聞こえない場合</p>
            <ul className="ml-4 mt-1 space-y-1 text-xs">
              <li>• Windowsの音量ミキサーで各アプリの音量を確認</li>
              <li>• VB-CABLEが正しくインストールされているか確認（デバイス一覧に表示されるか）</li>
              <li>• PC再起動後に再度設定を確認</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold">音声が途切れる場合</p>
            <ul className="ml-4 mt-1 space-y-1 text-xs">
              <li>• Windowsのサウンド設定でサンプルレートを確認（48000 Hz推奨）</li>
              <li>• 他のアプリケーションを閉じてCPU負荷を減らす</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold">デバイスが表示されない場合</p>
            <ul className="ml-4 mt-1 space-y-1 text-xs">
              <li>• 管理者権限でインストールしたか確認</li>
              <li>• ドライバーが正しくインストールされているか確認</li>
              <li>• デバイスマネージャーでオーディオデバイスを確認</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
