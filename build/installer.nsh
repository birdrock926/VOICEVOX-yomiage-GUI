; カスタムNSISインストーラースクリプト
; VB-CABLEとツールディレクトリを確実にインストールするため

!macro customInstall
  ; vbcableディレクトリを作成
  CreateDirectory "$INSTDIR\resources\vbcable"

  ; tools/7zディレクトリを作成
  CreateDirectory "$INSTDIR\resources\tools"
  CreateDirectory "$INSTDIR\resources\tools\7z"
!macroend

!macro customUnInstall
  ; アンインストール時にディレクトリを削除
  RMDir /r "$INSTDIR\resources\vbcable"
  RMDir /r "$INSTDIR\resources\tools\7z"
  RMDir "$INSTDIR\resources\tools"
!macroend
