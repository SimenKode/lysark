; The Windows installer for Lysark. One double click: it installs for the
; person who runs it, asks for no administrator rights and no choices, and
; starts the program when it is done. Built by tools/windows-installer.mjs
; with makensis, which also runs on Linux.
;
; Given on the command line: VERSION, SOURCE (the unpacked program),
; OUTFILE, ICON and SIZE_KB.

Unicode true
SetCompressor /SOLID lzma
SetCompressorDictSize 64
RequestExecutionLevel user
ManifestDPIAware true

!include "MUI2.nsh"

!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\Lysark"
!define UNINSTALLER "Avinstaller Lysark.exe"

Name "Lysark"
OutFile "${OUTFILE}"
; Fixed, and inside the person's own profile: no administrator is needed.
InstallDir "$LOCALAPPDATA\Programs\Lysark"
BrandingText "Lysark ${VERSION}"
ShowInstDetails nevershow
ShowUninstDetails nevershow
AutoCloseWindow true

VIProductVersion "${VERSION}.0"
VIAddVersionKey "ProductName" "Lysark"
VIAddVersionKey "FileDescription" "Installerer Lysark"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "LegalCopyright" "GPL-3.0-or-later"

!define MUI_ICON "${ICON}"
!define MUI_UNICON "${ICON}"

!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Norwegian"

; A program that is running cannot be replaced. Ask the person to close it
; rather than closing it for them: there may be work that is not saved.
!macro WAIT_UNTIL_CLOSED
  !define ID ${__LINE__}
  again_${ID}:
    IfFileExists "$INSTDIR\Lysark.exe" 0 free_${ID}
    ClearErrors
    FileOpen $0 "$INSTDIR\Lysark.exe" a
    IfErrors 0 close_${ID}
    ; The buttons are Windows' own and follow its language, so the text does not name them.
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "Lysark er åpent. Lukk programmet, og prøv på nytt." IDRETRY again_${ID}
    Quit
  close_${ID}:
    FileClose $0
  free_${ID}:
  !undef ID
!macroend

Section "Lysark"
  !insertmacro WAIT_UNTIL_CLOSED
  ; An earlier version goes out first. Settings and projects lie elsewhere
  ; and are not touched.
  RMDir /r "$INSTDIR"
  SetOutPath "$INSTDIR"
  File /r "${SOURCE}/*"
  WriteUninstaller "$INSTDIR\${UNINSTALLER}"

  CreateShortcut "$SMPROGRAMS\Lysark.lnk" "$INSTDIR\Lysark.exe"
  CreateShortcut "$DESKTOP\Lysark.lnk" "$INSTDIR\Lysark.exe"

  ; So that Lysark stands in Windows' list of installed programs.
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayName" "Lysark"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayIcon" "$INSTDIR\Lysark.exe"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "UninstallString" '"$INSTDIR\${UNINSTALLER}"'
  WriteRegStr HKCU "${UNINSTALL_KEY}" "QuietUninstallString" '"$INSTDIR\${UNINSTALLER}" /S'
  WriteRegStr HKCU "${UNINSTALL_KEY}" "URLInfoAbout" "https://github.com/SimenKode/lysark"
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "EstimatedSize" ${SIZE_KB}
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoRepair" 1
SectionEnd

Function .onInstSuccess
  IfSilent +2
  Exec '"$INSTDIR\Lysark.exe"'
FunctionEnd

Section "Uninstall"
  !insertmacro WAIT_UNTIL_CLOSED
  Delete "$SMPROGRAMS\Lysark.lnk"
  Delete "$DESKTOP\Lysark.lnk"
  ; $INSTDIR is where this uninstaller lies. Only a folder that holds the
  ; program is removed, whatever it has been moved to.
  IfFileExists "$INSTDIR\Lysark.exe" 0 +2
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "${UNINSTALL_KEY}"
SectionEnd
