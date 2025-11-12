import { useState, useEffect } from 'react';
import AudioDeviceManager from './AudioDeviceManager';

export default function SetupWizard({ isOpen, onClose }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [vbCableAvailable, setVbCableAvailable] = useState(false);
  const [installingVbCable, setInstallingVbCable] = useState(false);
  const [installMessage, setInstallMessage] = useState(null);

  useEffect(() => {
    if (window.electronAPI && window.electronAPI.checkVbCableInstaller) {
      window.electronAPI.checkVbCableInstaller().then(result => {
        setVbCableAvailable(result.exists || false);
      }).catch(err => {
        console.error('Error checking VB-Cable installer:', err);
        setVbCableAvailable(false);
      });
    }
  }, []);

  const handleInstallVbCable = async () => {
    if (!window.electronAPI || !window.electronAPI.installVbCable) {
      setInstallMessage({ type: 'error', text: 'Electron APIが利用できません' });
      return;
    }

    setInstallingVbCable(true);
    setInstallMessage({ type: 'info', text: 'VB-Cableインストーラーを起動中...' });

    try {
      const result = await window.electronAPI.installVbCable();

      if (result.success) {
        setInstallMessage({
          type: 'success',
          text: result.message || 'インストーラーが起動しました。画面の指示に従ってインストールを完了してください。'
        });
      } else {
        setInstallMessage({
          type: 'error',
          text: result.error || 'インストールに失敗しました'
        });
      }
    } catch (error) {
      setInstallMessage({
        type: 'error',
        text: error.message || 'インストールに失敗しました'
      });
    } finally {
      setInstallingVbCable(false);
    }
  };

  if (!isOpen) return null;

  const steps = [
    {
      title: 'ようこそ！',
      icon: '👋',
      content: (
        <div className="space-y-4">
          <p className="text-lg">ずんだもん VC読み上げツールへようこそ！</p>
          <p className="text-gray-300">
            このウィザードでは、アプリを使い始めるための初期設定を行います。
          </p>
          <div className="bg-zundamon-900 bg-opacity-30 p-4 rounded-lg border border-zundamon-600">
            <h4 className="font-bold mb-2 text-zundamon-400">このアプリでできること</h4>
            <ul className="space-y-2 text-sm">
              <li>✓ テキストをずんだもん音声で読み上げ</li>
              <li>✓ Discord/ゲーム内VCに音声を送信</li>
              <li>✓ 多彩な話者と音声設定</li>
              <li>✓ キーバインドで素早く操作</li>
            </ul>
          </div>
          <div className="p-4 bg-blue-900 bg-opacity-20 border border-blue-600 rounded-lg">
            <p className="text-sm text-blue-200">
              VOICEVOX Engineはアプリに同梱されており、アプリ起動時に自動的に起動します。
              別途VOICEVOXをインストールする必要はありません。
            </p>
          </div>
        </div>
      )
    },
    {
      title: 'オーディオデバイスの設定',
      icon: '🔊',
      content: (
        <div className="space-y-4">
          <p className="text-gray-300">
            ゲームVCに音声を送るには、<strong className="text-zundamon-400">仮想オーディオデバイス</strong>が必要です。
          </p>

          <div className="p-4 bg-zundamon-900 bg-opacity-30 border border-zundamon-600 rounded-lg">
            <h4 className="font-bold mb-2 text-zundamon-400">仮想オーディオデバイスとは？</h4>
            <p className="text-sm text-gray-300 mb-3">
              通常のスピーカーやヘッドホンと異なり、アプリケーション間で音声をやり取りするための「仮想的なオーディオデバイス」です。
              これにより、このアプリの音声をDiscord/ゲームのマイク入力として使用できます。
            </p>
            <div className="text-sm space-y-2">
              <p className="text-gray-400"><strong className="text-zundamon-300">必要な場合：</strong></p>
              <ul className="list-disc list-inside text-gray-400 ml-2 space-y-1">
                <li>Discord、Skype、Zoomなどで音声を流したい</li>
                <li>ゲーム内VCで音声を使用したい</li>
                <li>配信・録画ソフトに音声を入力したい</li>
              </ul>
              <p className="text-gray-400 mt-3"><strong className="text-zundamon-300">不要な場合：</strong></p>
              <ul className="list-disc list-inside text-gray-400 ml-2 space-y-1">
                <li>自分のスピーカー/ヘッドホンで聞くだけの場合</li>
                <li>既にVB-CABLEをインストール済みの場合</li>
              </ul>
            </div>
          </div>

          {/* VB-CABLE Quick Install (Windows only) */}
          {window.electronAPI && window.electronAPI.platform === 'win32' && (
            <div className="p-4 bg-gradient-to-r from-purple-900 to-blue-900 border border-purple-600 rounded-lg">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 text-3xl">⚡</div>
                <div className="flex-1">
                  <h4 className="font-bold mb-2">VB-CABLE 簡単インストール（Windows）</h4>

                  <div className="bg-black bg-opacity-30 p-3 rounded mb-3">
                    <p className="text-sm font-semibold text-blue-300 mb-2">VB-CABLEとは？</p>
                    <p className="text-sm text-gray-300 mb-2">
                      VB-CABLEは、VB-Audio Software社が提供する無料の仮想オーディオケーブルです。
                      「CABLE Input」に入力された音声が「CABLE Output」から出力される仕組みで、
                      アプリケーション間で音声をルーティングできます。
                    </p>
                    <p className="text-xs text-gray-400">
                      開発者：Vincent Burel（VB-Audio Software） | ライセンス：Freeware（寄付歓迎）
                    </p>
                  </div>

                  <div className="bg-green-900 bg-opacity-20 border border-green-600 rounded p-3 mb-3">
                    <p className="text-sm text-green-200">
                      <strong>✓ 既にインストール済みの場合</strong>
                      <br />
                      Windowsのサウンド設定で「CABLE Input」が表示されていれば、
                      このステップをスキップして「次へ」をクリックしてください。
                    </p>
                  </div>

                  {vbCableAvailable ? (
                    <>
                      <p className="text-sm text-gray-300 mb-3">
                        VB-CABLEインストーラーが同梱されています。
                        下のボタンをクリックすると、管理者権限でインストーラーが起動します。
                      </p>

                      <button
                        onClick={handleInstallVbCable}
                        disabled={installingVbCable}
                        className="btn-primary w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {installingVbCable ? 'インストーラー起動中...' : 'VB-CABLEをインストール'}
                      </button>
                    </>
                  ) : (
                    <div className="bg-yellow-900 bg-opacity-30 border border-yellow-600 rounded p-4">
                      <p className="text-sm text-yellow-200 font-semibold mb-2">
                        ⚠️ VB-CABLEインストーラーが見つかりません
                      </p>
                      <p className="text-sm text-gray-300 mb-3">
                        アプリケーションにVB-CABLEインストーラーを同梱するには、以下の手順に従ってください：
                      </p>
                      <ol className="text-sm text-gray-300 space-y-2 list-decimal list-inside mb-3">
                        <li>
                          <a
                            href="https://vb-audio.com/Cable/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 underline"
                          >
                            VB-Audio公式サイト
                          </a>
                          からVB-CABLEをダウンロード
                        </li>
                        <li>ZIPファイルを解凍</li>
                        <li>
                          <code className="bg-black bg-opacity-40 px-2 py-0.5 rounded text-xs">
                            VBCABLE_Setup_x64.exe
                          </code>
                          を以下のいずれかのフォルダに配置：
                          <ul className="ml-6 mt-1 space-y-1 text-xs">
                            <li>• <code className="bg-black bg-opacity-40 px-1 rounded">build/vbcable/</code></li>
                            <li>• <code className="bg-black bg-opacity-40 px-1 rounded">resources/</code></li>
                          </ul>
                        </li>
                        <li>アプリを再起動</li>
                      </ol>
                      <p className="text-xs text-gray-400">
                        💡 手動でインストールする場合は、公式サイトからダウンロードしたインストーラーを直接実行してください。
                      </p>
                    </div>
                  )}

                  {installMessage && (
                    <div className={`mt-3 p-3 rounded-lg text-sm ${
                      installMessage.type === 'success' ? 'bg-green-900 bg-opacity-30 border border-green-600 text-green-200' :
                      installMessage.type === 'error' ? 'bg-red-900 bg-opacity-30 border border-red-600 text-red-200' :
                      installMessage.type === 'warning' ? 'bg-yellow-900 bg-opacity-30 border border-yellow-600 text-yellow-200' :
                      'bg-blue-900 bg-opacity-30 border border-blue-600 text-blue-200'
                    }`}>
                      {installMessage.text}
                    </div>
                  )}

                  <div className="mt-3 space-y-1">
                    <p className="text-xs text-gray-400">
                      ⚠ インストールには管理者権限が必要です（UACダイアログが表示されます）
                    </p>
                    <p className="text-xs text-gray-400">
                      ⚠ インストール完了後、PCの再起動が必要です
                    </p>
                    <p className="text-xs text-gray-400">
                      💡 VB-CABLEは無料ソフトウェアです。気に入った場合は開発者への寄付をご検討ください
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <AudioDeviceManager />
        </div>
      )
    },
    {
      title: '⚠️ 重要：規定のデバイスを元に戻す',
      icon: '🔊',
      content: (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-red-900 to-orange-900 p-6 rounded-xl border-2 border-red-500 shadow-lg">
            <div className="flex items-center gap-4 mb-4">
              <div className="text-6xl animate-pulse">⚠️</div>
              <div>
                <h3 className="text-2xl font-bold text-red-200">必ず確認してください！</h3>
                <p className="text-red-300">VB-CABLEインストール後の重要な設定</p>
              </div>
            </div>

            <div className="bg-black bg-opacity-40 p-4 rounded-lg mb-4">
              <p className="text-lg font-bold text-yellow-300 mb-2">
                🎯 VB-CABLEをインストールすると、自動的にWindowsの規定のデバイスがVB-CABLEに変更されます
              </p>
              <p className="text-gray-200 mb-3">
                <strong className="text-red-300">再生デバイス</strong>と<strong className="text-red-300">録音デバイス（マイク）</strong>の両方が自動的に変更されます。
              </p>
              <ul className="text-gray-200 space-y-2 text-sm">
                <li>• <strong>再生デバイス</strong>が変更されると → PC上のすべての音（YouTube、ゲーム音など）が聞こえなくなります</li>
                <li>• <strong>録音デバイス</strong>が変更されると → 元のマイクが使えなくなります</li>
              </ul>
              <p className="text-gray-200 mt-3">
                <strong className="text-red-300">どちらも元のデバイスに戻す必要があります。</strong>
              </p>
            </div>

            <div className="bg-white bg-opacity-10 p-4 rounded-lg border border-yellow-500">
              <h4 className="text-xl font-bold text-yellow-300 mb-3">📝 設定手順（1分で完了）</h4>
              <ol className="space-y-3 text-base">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-8 h-8 bg-zundamon-600 rounded-full flex items-center justify-center font-bold">1</span>
                  <div>
                    <p className="font-semibold text-white">タスクバー右下のスピーカーアイコンを右クリック</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-8 h-8 bg-zundamon-600 rounded-full flex items-center justify-center font-bold">2</span>
                  <div>
                    <p className="font-semibold text-white">「サウンドの設定」をクリック</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-8 h-8 bg-zundamon-600 rounded-full flex items-center justify-center font-bold">3</span>
                  <div>
                    <p className="font-semibold text-white">「出力デバイスを選択してください」で<strong className="text-yellow-300">元のスピーカー/ヘッドホン</strong>を選択</p>
                    <p className="text-sm text-gray-300 mt-1">（例：Realtek Audio、ヘッドホン、スピーカーなど）</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-8 h-8 bg-zundamon-600 rounded-full flex items-center justify-center font-bold">4</span>
                  <div>
                    <p className="font-semibold text-white">「入力デバイスを選択してください」で<strong className="text-yellow-300">元のマイク</strong>を選択</p>
                    <p className="text-sm text-gray-300 mt-1">（例：マイク配列、内蔵マイク、USBマイクなど）</p>
                  </div>
                </li>
              </ol>
            </div>
          </div>

          <div className="bg-blue-900 bg-opacity-30 p-4 rounded-lg border border-blue-500">
            <h4 className="font-bold text-blue-300 mb-2">💡 確認方法</h4>
            <p className="text-sm text-gray-300">
              YouTubeなどで動画を再生して、音が聞こえることを確認してください。<br />
              音が聞こえない場合は、上記の手順で正しいデバイスが選択されているか確認してください。
            </p>
          </div>

          <div className="bg-green-900 bg-opacity-30 p-4 rounded-lg border border-green-600">
            <h4 className="font-bold text-green-300 mb-2">✅ このアプリでVB-CABLEを使用する方法</h4>
            <p className="text-sm text-gray-300">
              メイン画面の「出力デバイス」で「CABLE Input」を選択するだけです。<br />
              Discord/ゲームでは「CABLE Output」をマイク入力として選択してください。
            </p>
          </div>
        </div>
      )
    },
    {
      title: '設定完了！',
      icon: '🎉',
      content: (
        <div className="space-y-4 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <p className="text-xl font-bold text-zundamon-400">セットアップ完了です！</p>
          <p className="text-gray-300">
            早速テキストを入力して、ずんだもん音声を楽しみましょう！
          </p>

          <div className="bg-gray-800 p-4 rounded-lg text-left space-y-3 mt-6">
            <h4 className="font-bold">クイックスタート</h4>
            <ol className="space-y-2 text-sm">
              <li>1. テキストエリアに文章を入力</li>
              <li>2. 「読み上げ」ボタンをクリック（または Ctrl+Enter）</li>
              <li>3. Discord/ゲームで音声が聞こえることを確認</li>
            </ol>
          </div>

          <div className="p-4 bg-zundamon-900 bg-opacity-30 border border-zundamon-600 rounded-lg text-left">
            <h4 className="font-bold mb-2">便利な機能</h4>
            <ul className="space-y-1 text-sm">
              <li>• 設定ボタンから詳細なカスタマイズが可能</li>
              <li>• キーバインドで快適な操作</li>
              <li>• 履歴から過去のテキストを再利用</li>
              <li>• お気に入り話者を登録して素早く切り替え</li>
            </ul>
          </div>

          <div className="p-4 bg-red-900 bg-opacity-30 border border-red-600 rounded-lg text-left">
            <h4 className="font-bold mb-2 text-red-300">⚠️ Discord使用時の必須設定</h4>
            <div className="space-y-2 text-sm">
              <p className="text-red-200">
                <strong>ノイズキャンセルを必ず無効化してください</strong>
              </p>
              <p className="text-gray-300">
                Discordのノイズキャンセル機能が有効だと、音声合成の音声が完全にカットされて相手に届きません。この設定は必須です。
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
                  <li>「ノイズ抑制」を<strong className="text-red-300">無効</strong>に設定</li>
                  <li>「エコー除去」も<strong className="text-red-300">無効</strong>を推奨</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )
    }
  ];

  const currentStepData = steps[currentStep];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* ヘッダー */}
        <div className="px-6 py-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <span className="text-4xl">{currentStepData.icon}</span>
              <h2 className="text-2xl font-bold">{currentStepData.title}</h2>
            </div>
            {currentStep === steps.length - 1 && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors p-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* プログレスバー */}
          <div className="flex gap-2 mt-4">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`h-2 flex-1 rounded-full transition-all ${
                  index <= currentStep ? 'bg-zundamon-500' : 'bg-gray-700'
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-gray-400 mt-2">
            ステップ {currentStep + 1} / {steps.length}
          </p>
        </div>

        {/* コンテンツ */}
        <div className="p-6 overflow-y-auto flex-1">
          {currentStepData.content}
        </div>

        {/* フッター */}
        <div className="px-6 py-4 border-t border-gray-700 flex items-center justify-between">
          <button
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← 戻る
          </button>

          {currentStep < steps.length - 1 ? (
            <button
              onClick={() => setCurrentStep(currentStep + 1)}
              className="btn-primary"
            >
              次へ →
            </button>
          ) : (
            <button
              onClick={onClose}
              className="btn-primary"
            >
              完了
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
