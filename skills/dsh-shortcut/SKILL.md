# dsh-shortcut

Create (or restore) a desktop launcher that starts the DeepSeek Harness (dsh)
web UI in the background with a custom icon, and verify it works. The
launcher type depends on the detected OS.

Use when the user asks for a desktop shortcut / launcher icon for dsh web,
or when the existing one is missing and should be recreated.

## Steps

1. Detect the OS (`win32` / `darwin` / `linux`; UOS/Deepin are `linux`).
2. Locate this package's files: `<package>/scripts/create-shortcut.ps1` and
   the icons in `<package>/assets/` (`dsh.ico`, `dsh.icns`, `dsh.png`).
   If the user has a custom icon (`config.icon`), use it instead: on Windows
   convert via `<package>/scripts/convert-to-ico.ps1`, on macOS via
   `convert-to-icns.sh` (sips + iconutil), on Linux use a `.png` directly
   (or ImageMagick for other formats).
3. Resolve the real Desktop directory:
   - Windows: `HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\User
     Shell Folders` → `Desktop`, expand `%VAR%`, fall back to
     `%USERPROFILE%\Desktop` / OneDrive.
   - Linux: `xdg-user-dir DESKTOP`, then `~/Desktop` / `~/桌面`.
   - macOS: `~/Desktop`.
4. Create the launcher target (starts dsh web hidden in the background, then
   opens the browser):
   - Windows: `launch.cmd` → `launch.ps1`; create the `.lnk` via
     `scripts/create-shortcut.ps1 -LnkPath <desktop>\dsh web.lnk -TargetPath
     <launch.cmd> -IconPath assets\dsh.ico -Refresh`.
   - Linux: write `~/.desktop` entry (`Exec=` → `launch.sh`, `Icon=` →
     `dsh.png`), `chmod +x` both files.
   - macOS: build `dsh web.app` bundle (Contents/Info.plist,
     Contents/MacOS/dsh-web-launcher, Contents/Resources/dsh.icns).
5. Verify: the launcher file exists with the expected icon reference. If dsh
   is running, launching should just open `http://127.0.0.1:3080`; if not, it
   starts the server in the background first (see `~/.dsh/dsh-launch.log`).

GNOME may require one manual "Allow Launching" on a fresh `.desktop` file.
