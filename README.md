# dsh-desktop-shortcut

A [DeepSeek Harness](https://github.com/deepseek-ai/dsh) plugin that keeps a
desktop launcher for starting the dsh web UI in the background, with a custom
icon. **Install once, and the launcher appears by itself** — on every boot
the plugin detects the operating system, checks the desktop, and creates the
launcher when it is missing (create-if-missing, never touches an existing
one).

## Platform support (auto-detected)

| OS | Detection | Launcher created | Icon |
| :-- | :-- | :-- | :-- |
| Windows | `win32` | `Desktop\dsh web.lnk` | `assets/dsh.ico` |
| macOS | `darwin` | `Desktop\dsh web.app` (native app bundle) | `assets/dsh.icns` |
| Linux (incl. UOS / Deepin / any Debian-based) | `linux` | `Desktop\dsh-web.desktop` (or `桌面`) | `assets/dsh.png` |

On Linux the desktop directory is resolved via `xdg-user-dir DESKTOP` first,
then `~/Desktop` and the localized `~/桌面` (which covers UOS in Chinese
locale). Other platforms log once and skip.

## What the launcher does

Double-clicking it:

1. checks whether dsh web is already running on its port (default `3080`);
2. if not, starts `dsh web` **hidden in the background** (logs go to
   `~/.dsh/dsh-web.out.log`);
3. opens `http://127.0.0.1:<port>` in the default browser
   (`Start-Process` / `open` / `xdg-open`).

Every run is appended to `~/.dsh/dsh-launch.log`.

## Install (for users)

The package must be published to npm (see below). Then, in the profile that
serves the web UI:

```sh
npx -y @deepseek-ai/dsh plugin --profile web add dsh-desktop-shortcut@0.1.0
```

Restart dsh. The next boot creates the launcher for the current OS. The
launcher scripts and icon live in `~/.dsh/dsh-shortcut/`.

## Config

All optional; default row needs no config at all:

```yaml
- insert:
    - id: dsh-shortcut
      name: 'dsh-desktop-shortcut'
      config:
        enabled: false   # disable the plugin entirely
        name: 'dsh web'  # launcher display/file name
        port: 3080       # port the launcher checks/starts
        icon: 'C:\Users\me\Pictures\my-icon.png'   # optional custom icon
        # dir: '/home/me/Desktop'       # override the desktop dir (testing)
        # platform: 'linux'             # force a platform handler (testing)
```

The dsh CLI entry is taken from the running dsh process (`process.argv[1]`),
so the launcher always starts the same dsh that serves the profile. Set the
`DSH_BIN` environment variable to force a specific entry.

## Custom icon

Set `config.icon` to a path of your own image and the plugin uses it for the
launcher instead of the built-in whale. Accepted inputs per OS:

| OS | Direct use | Converted automatically |
| :-- | :-- | :-- |
| Windows | `.ico` | png/jpg/bmp/gif → multi-size `.ico` (PowerShell + System.Drawing) |
| macOS | `.icns` | png/jpg/... → `.icns` (system `sips` + `iconutil`) |
| Linux | `.png` | other formats via ImageMagick (`magick`) when installed |

The image is contain-fitted into a square (no distortion) where conversion is
needed. If the path is missing or conversion fails, the plugin falls back to
the built-in icon and says so in `~/.dsh/dsh-shortcut.log` — it never breaks
the launcher. Changing `config.icon` on a machine that already has the
launcher **updates the existing icon** on the next boot (no need to delete
the launcher first).

## Publishing

```sh
cd dsh-shortcut
npm login
npm publish
```

Note: pnpm's `minimumReleaseAge` gate holds back packages published in the
last 24 hours, so tell users to install by **named version** (`...@0.1.0`),
not `@latest`.

## Standalone use / testing

The plugin logic is exported so you can run it without booting dsh, and each
platform handler can be forced for testing:

```sh
node -e "import('file:///abs/path/dsh-shortcut/index.js').then(m => m.createDesktopShortcut({ dir: 'C:/tmp/desk', platform: 'linux' }).then(console.log))"
```

`scripts/create-shortcut.ps1` is a plain Windows shortcut creator usable on
its own.

## Troubleshooting

- No launcher after install/reboot → check `~/.dsh/dsh-shortcut.log` for the
  plugin's own log lines, and the server log for `[dsh-shortcut]` errors.
- Launcher does nothing → run it from a terminal; `~/.dsh/dsh-launch.log`
  records each run and `dsh-web.out.log`/`dsh-web.err.log` show the server.
- GNOME desktops may refuse a `.desktop` file launched from the Desktop
  ("Untrusted application launcher"): right-click the file → **Allow
  Launching** (this sets the trusted metadata; the plugin creates the file
  for you, only this one-time confirmation is manual).
- On a machine where `process.argv[1]` is not the dsh CLI entry (packaged
  desktop app), set `DSH_BIN` to the `lib/bin.js` path of the dsh install.
