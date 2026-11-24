; Partes propias del instalador (electron-builder las incluye en su script NSIS).
; Guarda la carpeta desde donde se ejecutó el instalador. El programa busca ahí
; versiones nuevas (Instalar-Rifas-X.Y.Z.exe) para actualizarse solo.

!macro customInstall
  FileOpen $2 "$INSTDIR\carpeta-instalador.txt" w
  FileWriteWord $2 0xFEFF
  FileWriteUTF16LE $2 "$EXEDIR"
  FileClose $2
!macroend

!macro customUnInstall
  Delete "$INSTDIR\carpeta-instalador.txt"
!macroend
