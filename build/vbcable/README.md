# VB-CABLE インストーラー

このフォルダにVB-CABLEのインストーラーを配置すると、アプリからワンクリックでインストールできるようになります。

## ダウンロード手順

1. 公式サイトにアクセス: https://vb-audio.com/Cable/
2. **VB-CABLE Driver** セクションから以下のファイルをダウンロード:
   - `VBCABLE_Setup_x64.exe` (64-bit Windows用)
   - `VBCABLE_Setup.exe` (32-bit Windows用)

3. ダウンロードしたファイルをこのフォルダ（`build/vbcable/`）に配置

## ファイル構造

```
build/vbcable/
├── README.md
├── VBCABLE_Setup_x64.exe  (64-bit用 - ダウンロードして配置)
└── VBCABLE_Setup.exe      (32-bit用 - ダウンロードして配置)
```

## 注意事項

- VB-CABLEは別途ライセンスで配布されているため、このリポジトリには含まれていません
- 配布版（installer/portable）を作成する場合は、必ず上記ファイルを配置してからビルドしてください
- 開発版を実行する場合は、このファイルがなくてもアプリは動作しますが、アプリ内からのVB-CABLEインストール機能は使用できません
