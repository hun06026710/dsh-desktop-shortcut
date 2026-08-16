# create-shortcut.ps1 — create a Windows .lnk shortcut (usable standalone).
# Also used by the dsh-desktop-shortcut plugin at boot.
param(
    [Parameter(Mandatory=$true)][string]$LnkPath,
    [Parameter(Mandatory=$true)][string]$TargetPath,
    [string]$WorkDir = '',
    [string]$IconPath = '',
    [string]$Desc = '',
    [switch]$Refresh
)
$ErrorActionPreference = 'Stop'
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut($LnkPath)
$sc.TargetPath = $TargetPath
if ($WorkDir) { $sc.WorkingDirectory = $WorkDir }
if ($IconPath) { $sc.IconLocation = "$IconPath,0" }
if ($Desc) { $sc.Description = $Desc }
$sc.WindowStyle = 7   # minimized
$sc.Save()
if (-not (Test-Path $LnkPath)) { throw "shortcut was not created: $LnkPath" }
Write-Output "OK $LnkPath"
if ($Refresh) { Start-Process "$env:SystemRoot\System32\ie4uinit.exe" -ArgumentList '-show' -WindowStyle Hidden }
