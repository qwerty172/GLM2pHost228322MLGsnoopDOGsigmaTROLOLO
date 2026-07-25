!macro customInstall
  ; Register the agent for auto-launch at Windows login. The agent itself
  ; can later toggle this via app.setLoginItemSettings(), but the installer
  ; sets it up by default so the host doesn't have to open the app once
  ; before getting auto-start behavior.
  ; ${APP_EXECUTABLE_FILENAME} is provided by electron-builder's NSIS
  ; macros and resolves to the installed agent's .exe filename.
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" \
    "CloudGamingHostAgent" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --hidden'
  DetailPrint "Cloud Gaming Host Agent registered for auto-launch at Windows login."
  DetailPrint "Optional: create local user DecentralHubPlayer for isolated game launches (see INSTALL.txt)."
!macroend

!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "CloudGamingHostAgent"
!macroend
