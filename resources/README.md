# Resources Folder

このフォルダには、アプリケーションで使用する外部リソースを配置します。

## VB-Cable Audio Driver

VB-Cableのインストーラーをこのフォルダに配置すると、アプリ内の「VB-Cableセットアップ」ボタンから直接インストールできます。

### セットアップ手順

1. **VB-Cableをダウンロード**
   - 公式サイト: https://vb-audio.com/Cable/
   - 「Download」セクションから最新版をダウンロード

2. **ZIPファイルを解凍**
   - ダウンロードしたZIPファイルを解凍します

3. **インストーラーを配置**

   以下のいずれかのフォルダに配置してください：

   **推奨: resourcesフォルダ (このフォルダ)**
   ```
   yomiage1/
     resources/
       VBCABLE_Setup_x64.exe  (64bit版 - 推奨)
       VBCABLE_Setup.exe      (32bit版 - オプション)
   ```

   **代替: build/vbcableフォルダ**
   ```
   yomiage1/
     build/
       vbcable/
         VBCABLE_Setup_x64.exe
         VBCABLE_Setup.exe
   ```

4. **アプリを再起動**
   - アプリを再起動すると、セットアップウィザードとメイン画面にVB-Cableインストールボタンが表示されます

### インストール方法

アプリ内で以下のいずれかの方法でインストールできます：

- **セットアップウィザード**: 初回起動時のステップ2「オーディオデバイスの設定」
- **メイン画面**: クイックアクションの「🎧 VB-Cableセットアップ」ボタン

## 注意事項

- VB-Cableのインストールには**管理者権限**が必要です
- インストール後、**システムの再起動**が必要になる場合があります
- VB-Cableは無料ソフトウェアですが、開発者への寄付がサポートされています

## ライセンス

VB-Cableは VB-Audio Software (Vincent Burel) が著作権を保有しています。
- ライセンス: Freeware (寄付歓迎)
- 公式サイト: https://vb-audio.com/Cable/

