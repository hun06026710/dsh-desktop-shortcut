// dsh-desktop-shortcut — a DeepSeek Harness (dsh) plugin.
//
// On every boot it makes sure a desktop launcher exists that starts the dsh
// web UI in the background (hidden, logs to ~/.dsh/), with a custom icon.
// Installing the plugin is all a user has to do: the launcher appears by
// itself and is recreated if it is deleted.
//
// Platform support (auto-detected via process.platform; override with
// config.platform for testing):
//   win32  -> C:\Users\<me>\Desktop\dsh web.lnk      (icon: assets/dsh.ico)
//   darwin -> ~/Desktop/dsh web.app                  (icon: assets/dsh.icns)
//   linux  -> ~/Desktop/dsh-web.desktop  (or 桌面)   (icon: assets/dsh.png)
// UOS / Deepin / other Debian-based distros are plain linux; the Chinese
// "桌面" desktop directory is handled by the fallback chain.
//
// Config (all optional):
//   enabled  (bool)   false disables the plugin entirely. default true.
//   name     (string) launcher display/file name. default 'dsh web'.
//   port     (number) dsh web port the launcher starts/checks. default 3080.
//   dir      (string) desktop directory override (mainly for testing).
//   platform (string) force the platform handler (win32|darwin|linux).
//
// The dsh CLI entry is taken from the currently running process (argv[1]),
// so the launcher always starts the same dsh that serves this profile.
// Set env DSH_BIN to force a specific entry.
import { spawn } from 'node:child_process'
import {
  appendFileSync,
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SUPPORTED = ['win32', 'darwin', 'linux']

export const name = 'dsh-shortcut'

export function apply(ctx, config = {}) {
  if (config.enabled === false) return
  const platform = config.platform ?? process.platform
  if (!SUPPORTED.includes(platform)) {
    console.error(`[dsh-shortcut] unsupported platform "${platform}"; supported: ${SUPPORTED.join(', ')}`)
    return
  }
  // Fire-and-forget: a cosmetic launcher must never slow down or block boot.
  createDesktopShortcut(config)
    .then((result) => logLine(config, result))
    .catch((error) => {
      console.error(`[dsh-shortcut] ${error?.message ?? error}`)
      logLine(config, `ERROR: ${error?.message ?? error}`)
    })
}

// Also exported so the package can be exercised standalone, e.g.
//   node -e "import('file:///.../index.js').then(m => m.createDesktopShortcut({ dir: 'C:/tmp/t' }).then(console.log))"
export async function createDesktopShortcut(config = {}) {
  const platform = config.platform ?? process.platform
  if (platform === 'win32') return createWindowsShortcut(config)
  if (platform === 'darwin') return createMacShortcut(config)
  if (platform === 'linux') return createLinuxShortcut(config)
  throw new Error(`unsupported platform: ${platform}`)
}

// ---------------------------------------------------------------------------
// Windows
// ---------------------------------------------------------------------------

async function createWindowsShortcut(config) {
  const home = homedir()
  const launcherDir = join(home, '.dsh', 'dsh-shortcut')
  const logDir = join(home, '.dsh')
  const displayName = config.name ?? 'dsh web'
  const port = config.port ?? 3080
  const desktop = await resolveDesktopDir(config.dir, 'win32')
  const lnkPath = join(desktop, `${displayName}.lnk`)
  const launcherCmd = join(launcherDir, 'launch.cmd')

  mkdirSync(desktop, { recursive: true })
  if (existsSync(lnkPath)) {
    if (hasCustomIcon(config)) {
      const icon = await resolveIcon(config, 'win32')
      // The .lnk already points at launcherDir\dsh.ico; refresh the shell cache.
      spawn('ie4uinit.exe', ['-show'], { stdio: 'ignore', windowsHide: true }).unref()
      return `shortcut icon updated: ${lnkPath}${noteSuffix(icon)}`
    }
    return `shortcut already exists, leaving it alone: ${lnkPath}`
  }
  const binPath = resolveDshBin()
  const nodePath = process.execPath

  mkdirSync(launcherDir, { recursive: true })
  const launcherPs1 = join(launcherDir, 'launch.ps1')
  const icon = await resolveIcon(config, 'win32')
  writeFileSync(launcherPs1, windowsLauncherTemplate(nodePath, binPath, port, logDir))
  writeFileSync(
    launcherCmd,
    `@echo off\r\npowershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "${launcherPs1}"\r\n`,
  )

  await run('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    join(__dirname, 'scripts', 'create-shortcut.ps1'),
    '-LnkPath', lnkPath,
    '-TargetPath', launcherCmd,
    '-WorkDir', launcherDir,
    '-IconPath', icon.dst,
    '-Desc', `launch dsh web (port ${port}) in the background`,
    '-Refresh',
  ])
  return `shortcut created: ${lnkPath}${noteSuffix(icon)}`
}

// ---------------------------------------------------------------------------
// Linux (incl. UOS / Deepin)
// ---------------------------------------------------------------------------

async function createLinuxShortcut(config) {
  const home = homedir()
  const launcherDir = join(home, '.dsh', 'dsh-shortcut')
  const logDir = join(home, '.dsh')
  const displayName = config.name ?? 'dsh web'
  const port = config.port ?? 3080
  const desktop = await resolveDesktopDir(config.dir, 'linux')
  const fileBase = displayName.replace(/\s+/g, '-')
  const entryPath = join(desktop, `${fileBase}.desktop`)

  mkdirSync(desktop, { recursive: true })
  if (existsSync(entryPath)) {
    if (hasCustomIcon(config)) {
      const icon = await resolveIcon(config, 'linux')
      return `desktop icon updated: ${entryPath}${noteSuffix(icon)}`
    }
    return `desktop entry already exists, leaving it alone: ${entryPath}`
  }
  const binPath = resolveDshBin()

  mkdirSync(launcherDir, { recursive: true })
  const launchSh = join(launcherDir, 'launch.sh')
  const icon = await resolveIcon(config, 'linux')
  writeFileSync(launchSh, unixLauncherTemplate(process.execPath, binPath, port, logDir, 'xdg-open'), {
    mode: 0o755,
  })
  try {
    chmodSync(launchSh, 0o755)
  } catch {
    // Windows test runs: chmod is a no-op
  }

  writeFileSync(
    entryPath,
    `[Desktop Entry]\nType=Application\nVersion=1.0\nName=${displayName}\nComment=Launch dsh web in the background\nExec=${launchSh}\nIcon=${icon.dst}\nTerminal=false\nCategories=Network;Development;\n`,
  )
  try {
    chmodSync(entryPath, 0o755)
  } catch {
    // no-op on Windows test runs
  }
  return `desktop entry created: ${entryPath}${noteSuffix(icon)}`
}

// ---------------------------------------------------------------------------
// macOS
// ---------------------------------------------------------------------------

async function createMacShortcut(config) {
  const home = homedir()
  const launcherDir = join(home, '.dsh', 'dsh-shortcut')
  const logDir = join(home, '.dsh')
  const displayName = config.name ?? 'dsh web'
  const port = config.port ?? 3080
  const desktop = await resolveDesktopDir(config.dir, 'darwin')
  const appPath = join(desktop, `${displayName}.app`)
  const resDir = join(appPath, 'Contents', 'Resources')

  mkdirSync(desktop, { recursive: true })
  if (existsSync(appPath)) {
    if (hasCustomIcon(config)) {
      const icon = await resolveIcon(config, 'darwin')
      copyFileSync(icon.dst, join(resDir, 'dsh.icns'))
      return `app icon updated: ${appPath}${noteSuffix(icon)}`
    }
    return `app bundle already exists, leaving it alone: ${appPath}`
  }
  const binPath = resolveDshBin()

  const contents = join(appPath, 'Contents')
  const macosDir = join(contents, 'MacOS')
  mkdirSync(macosDir, { recursive: true })
  mkdirSync(resDir, { recursive: true })

  writeFileSync(
    join(macosDir, 'dsh-web-launcher'),
    unixLauncherTemplate(process.execPath, binPath, port, logDir, 'open'),
    { mode: 0o755 },
  )
  try {
    chmodSync(join(macosDir, 'dsh-web-launcher'), 0o755)
  } catch {
    // no-op on Windows test runs
  }
  writeFileSync(join(contents, 'Info.plist'), macInfoPlist(displayName))
  const icon = await resolveIcon(config, 'darwin')
  copyFileSync(icon.dst, join(resDir, 'dsh.icns'))
  return `app bundle created: ${appPath}${noteSuffix(icon)}`
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function resolveDshBin() {
  if (process.env.DSH_BIN) return resolve(process.env.DSH_BIN)
  const entry = process.argv[1]
  if (typeof entry === 'string' && entry.length > 0) {
    const p = resolve(entry)
    if (existsSync(p) && extname(p).toLowerCase() === '.js') return p
  }
  throw new Error(
    'cannot determine the dsh CLI entry (process.argv[1] is not a .js file); set DSH_BIN to the dsh bin.js path',
  )
}

function hasCustomIcon(config) {
  return typeof config.icon === 'string' && config.icon.trim() !== ''
}

function noteSuffix(icon) {
  return icon?.note ? ` (${icon.note})` : ''
}

/**
 * Resolve the icon file for a platform into ~/.dsh/dsh-shortcut/<dst>.
 * config.icon (path) wins when given: right-format files are copied as-is,
 * everything else is converted with platform-native tooling (PowerShell +
 * System.Drawing on Windows; sips + iconutil on macOS; ImageMagick on Linux).
 * Any failure degrades to the built-in icon with a note, never an error.
 */
async function resolveIcon(config, platform) {
  const launcherDir = join(homedir(), '.dsh', 'dsh-shortcut')
  const builtinMap = {
    win32: ['dsh.ico', join(__dirname, 'assets', 'dsh.ico')],
    darwin: ['dsh.icns', join(__dirname, 'assets', 'dsh.icns')],
    linux: ['dsh.png', join(__dirname, 'assets', 'dsh.png')],
  }
  const entry = builtinMap[platform]
  if (!entry) throw new Error(`no icon mapping for ${platform}`)
  const [dstName, builtinPath] = entry
  const dst = join(launcherDir, dstName)
  mkdirSync(launcherDir, { recursive: true })
  const fallback = (note) => {
    copyFileSync(builtinPath, dst)
    return { dst, from: 'builtin', ...(note ? { note } : {}) }
  }
  if (!hasCustomIcon(config)) return fallback()
  const userIcon = config.icon.trim()
  if (!existsSync(userIcon)) {
    return fallback(`config.icon not found (${userIcon}); using the built-in icon`)
  }
  const ext = extname(userIcon).toLowerCase()
  try {
    if (platform === 'win32') {
      if (ext === '.ico') {
        copyFileSync(userIcon, dst)
        return { dst, from: 'custom' }
      }
      await run('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        join(__dirname, 'scripts', 'convert-to-ico.ps1'),
        '-InputPath', userIcon,
        '-OutputPath', dst,
      ])
      return { dst, from: 'custom' }
    }
    if (platform === 'darwin') {
      if (ext === '.icns') {
        copyFileSync(userIcon, dst)
        return { dst, from: 'custom' }
      }
      await run('sh', [join(__dirname, 'scripts', 'convert-to-icns.sh'), userIcon, dst])
      return { dst, from: 'custom' }
    }
    if (platform === 'linux') {
      if (ext === '.png') {
        copyFileSync(userIcon, dst)
        return { dst, from: 'custom' }
      }
      await run('magick', [userIcon, '-resize', '256x256', dst])
      return { dst, from: 'custom' }
    }
  } catch (error) {
    return fallback(
      `custom icon failed (${String(error?.message ?? error).slice(0, 120)}); using the built-in icon`,
    )
  }
  return fallback()
}

async function resolveDesktopDir(override, platform) {
  if (override) return override
  const home = homedir()
  if (platform === 'win32') {
    try {
      const out = await run('reg.exe', [
        'query',
        'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders',
        '/v',
        'Desktop',
      ])
      const m = out.match(/Desktop\s+REG_(?:EXPAND_)?SZ\s+([^\r\n]+)/i)
      if (m) {
        const expanded = m[1].trim().replace(/%([^%]+)%/g, (_, key) => process.env[key] ?? '')
        if (expanded && existsSync(expanded)) return expanded
      }
    } catch {
      // fall through to candidates
    }
    for (const candidate of [
      join(home, 'Desktop'),
      join(home, 'OneDrive', 'Desktop'),
      join(home, 'OneDrive', '桌面'),
      join(home, '桌面'),
    ]) {
      if (existsSync(candidate)) return candidate
    }
    throw new Error('cannot locate the Desktop directory')
  }
  if (platform === 'darwin') {
    const p = join(home, 'Desktop')
    if (existsSync(p)) return p
    throw new Error(`cannot locate the Desktop directory (${p} missing)`)
  }
  if (platform === 'linux') {
    // xdg-user-dir DESKTOP is the authoritative answer when available.
    try {
      const out = await run('xdg-user-dir', ['DESKTOP'])
      let p = out.trim()
      if (p.startsWith('~/')) p = join(home, p.slice(2))
      if (p && existsSync(p)) return p
    } catch {
      // fall through to candidates
    }
    for (const candidate of [join(home, 'Desktop'), join(home, '桌面')]) {
      if (existsSync(candidate)) return candidate
    }
    throw new Error('cannot locate the Desktop directory')
  }
  throw new Error(`unsupported platform: ${platform}`)
}

function windowsLauncherTemplate(nodePath, binPath, port, logDir) {
  return `# dsh web launcher - generated by the dsh-shortcut plugin.
# Double-clicked through launch.cmd. Starts dsh web in the background if it
# is not already running, then opens the browser. Idempotent.
$ErrorActionPreference = 'SilentlyContinue'
$node = '${nodePath}'
$bin  = '${binPath}'
$port = ${port}
$url  = 'http://127.0.0.1:' + $port
$out  = '${logDir}\\dsh-web.out.log'
$err  = '${logDir}\\dsh-web.err.log'
$launchLog = '${logDir}\\dsh-launch.log'
function Log($m) { try { Add-Content -Path $launchLog -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $m" -Encoding utf8 } catch {} }
$conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($conn) { Log 'dsh already running -> opening browser'; Start-Process $url; exit 0 }
Log 'dsh not running -> starting dsh web in background'
Start-Process -FilePath $node -ArgumentList @($bin, 'web', '--port', "$port") -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err
for ($i = 0; $i -lt 60; $i++) {
  $c = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  if ($c) { Log 'dsh web is up -> opening browser'; Start-Process $url; exit 0 }
  Start-Sleep -Seconds 1
}
Log 'ERROR: dsh web did not come up within 60s'
exit 1
`
}

function unixLauncherTemplate(nodePath, binPath, port, logDir, openCmd) {
  return `#!/bin/sh
# dsh web launcher - generated by the dsh-shortcut plugin.
# Starts dsh web in the background if it is not already running, then opens
# the browser. Idempotent.
NODE='${nodePath}'
BIN='${binPath}'
PORT=${port}
URL="http://127.0.0.1:\${PORT}"
LOG_DIR='${logDir}'
mkdir -p "\$LOG_DIR"
log() { echo "\$(date '+%Y-%m-%d %H:%M:%S')  \$1" >> "\$LOG_DIR/dsh-launch.log"; }
probe() { curl -s -o /dev/null --max-time 2 "\$URL"; }
if probe; then
  log 'dsh already running -> opening browser'
  ${openCmd} "\$URL" >/dev/null 2>&1
  exit 0
fi
log 'dsh not running -> starting dsh web in background'
nohup "\$NODE" "\$BIN" web --port "\$PORT" >> "\$LOG_DIR/dsh-web.out.log" 2>> "\$LOG_DIR/dsh-web.err.log" &
i=0
while [ \$i -lt 60 ]; do
  if probe; then
    log 'dsh web is up -> opening browser'
    ${openCmd} "\$URL" >/dev/null 2>&1
    exit 0
  fi
  i=\$((i + 1))
  sleep 1
done
log 'ERROR: dsh web did not come up within 60s'
exit 1
`
}

function macInfoPlist(displayName) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>${displayName}</string>
  <key>CFBundleDisplayName</key>
  <string>${displayName}</string>
  <key>CFBundleIdentifier</key>
  <string>dev.dsh.desktop-shortcut</string>
  <key>CFBundleExecutable</key>
  <string>dsh-web-launcher</string>
  <key>CFBundleIconFile</key>
  <string>dsh</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>LSMinimumSystemVersion</key>
  <string>10.13</string>
</dict>
</plist>
`
}

function logLine(config, msg) {
  try {
    appendFileSync(
      join(homedir(), '.dsh', 'dsh-shortcut.log'),
      `${new Date().toISOString()}  ${msg}\n`,
    )
  } catch {
    // logging must never throw
  }
}

function run(command, args, timeoutMs = 60_000) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => child.kill(), timeoutMs)
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) {
        resolvePromise(stdout)
      } else {
        reject(
          new Error(`${command} exited ${code}: ${(stderr || stdout).trim().slice(0, 400)}`),
        )
      }
    })
  })
}
