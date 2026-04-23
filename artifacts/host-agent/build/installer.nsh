!macro customInstall
  ; Register the agent for auto-launch at Windows login. The agent itself
  ; can later toggle this via app.setLoginItemSettings(), but the installer
  ; sets it up by default so the host doesn't have to open the app once
  ; before getting auto-start behavior.
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" \
    "CloudGamingHostAgent" '"$INSTDIR\${PRODUCT_FILENAME}.exe" --hidden'
  DetailPrint "Cloud Gaming Host Agent registered for auto-launch at Windows login."
!macroend

!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "CloudGamingHostAgent"
!macroend
