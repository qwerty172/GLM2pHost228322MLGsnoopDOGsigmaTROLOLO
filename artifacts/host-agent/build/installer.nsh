!macro customInstall
  ; The agent registers itself for auto-launch at first run via
  ; app.setLoginItemSettings(). No installer-side registry write needed.
  DetailPrint "Cloud Gaming Host Agent installed. It will start automatically at Windows login after the first launch."
!macroend

!macro customUnInstall
  ; Best-effort cleanup of the auto-launch registry entry.
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "CloudGamingHostAgent"
!macroend
