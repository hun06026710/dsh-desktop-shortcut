# dsh-desktop-shortcut

一个 [DeepSeek Harness](https://github.com/deepseek-ai/dsh)（dsh）插件：自动在桌面维护一个"后台启动 dsh web 界面"的启动器，并配上专属图标。**装一次即可**——每次 dsh 启动时插件自动识别操作系统、检查桌面，缺少启动器就自动创建（create-if-missing，绝不改动已存在的启动器）。

## 平台支持（自动识别）

| 系统 | 识别值 | 创建的启动器 | 图标 |
| :-- | :-- | :-- | :-- |
| Windows | `win32` | `Desktop\dsh web.lnk` | `assets/dsh.ico` |
| macOS | `darwin` | `Desktop\dsh web.app`（原生应用包） | `assets/dsh.icns` |
| Linux（含 UOS / 统信 / Deepin 等 Debian 系） | `linux` | `Desktop\dsh-web.desktop`（或中文 `桌面` 目录） | `assets/dsh.png` |

Linux 上桌面目录优先用 `xdg-user-dir DESKTOP` 解析，找不到再回退 `~/Desktop` 和本地化的 `~/桌面`（覆盖 UOS 中文环境）。其他平台打一行日志后跳过。

## 双击启动器后的行为

1. 检查 dsh web 是否已在运行（默认端口 `3080`）；
2. 没在运行 → **后台静默启动** `dsh web`（日志写入 `~/.dsh/dsh-web.out.log`）；
3. 用默认浏览器打开 `http://127.0.0.1:<端口>`（分别用 `Start-Process` / `open` / `xdg-open`）。

每次运行都会追加到 `~/.dsh/dsh-launch.log`。

## 安装（用户侧）

包发布到 npm 后（见下文），在提供 Web 界面的 profile 里执行：

```sh
npx -y @deepseek-ai/dsh plugin --profile web add dsh-desktop-shortcut@0.1.0
```

重启 dsh。下次启动时插件就会按当前操作系统创建启动器。启动器脚本和图标位于 `~/.dsh/dsh-shortcut/`。

## 配置

全部可选，默认一行配置都不用写：

```yaml
- insert:
    - id: dsh-shortcut
      name: 'dsh-desktop-shortcut'
      config:
        enabled: false   # 彻底停用插件
        name: 'dsh web'  # 启动器显示/文件名
        port: 3080       # 启动器检查/启动的端口
        icon: 'C:\Users\me\Pictures\my-icon.png'   # 可选：自定义图标
        # dir: '/home/me/Desktop'       # 覆盖桌面目录（测试用）
        # platform: 'linux'             # 强制指定平台处理分支（测试用）
```

dsh 入口取自当前运行的 dsh 进程（`process.argv[1]`），所以启动器启动的总是当前 profile 所用的同一个 dsh。如需强制指定入口，可设置环境变量 `DSH_BIN`。

## 自定义图标

设置 `config.icon` 指向自己的图片，插件就会用它替代内置鲸鱼图标。各平台支持情况：

| 系统 | 直接使用 | 自动转换 |
| :-- | :-- | :-- |
| Windows | `.ico` | png/jpg/bmp/gif → 多尺寸 `.ico`（PowerShell + System.Drawing） |
| macOS | `.icns` | 其他格式 → `.icns`（系统自带 `sips` + `iconutil`） |
| Linux | `.png` | 其他格式：装有 ImageMagick（`magick`）时转换 |

需要转换时，图片会**等比适配进方形画布**（不变形、透明留边）。如果路径不存在或转换失败，插件自动回退内置图标，并在 `~/.dsh/dsh-shortcut.log` 写明原因——绝不会弄坏启动器。修改 `config.icon` 后，已存在的启动器会在下次启动时**自动更新图标**（无需先删掉启动器）。

## 停用 / 卸载

- **彻底卸载**：`dsh plugin --profile web remove dsh-desktop-shortcut`，重启后插件不再运行（已创建的桌面图标不会自动删除，可手动删除）。
- **停用不卸载**：在补丁层加两行（本 profile 编辑 `~/.dsh/profiles/web/cordis.patch.yml`；全局编辑 `~/.dsh/cordis.patch.yml`，优先级更高）：

  ```yaml
  - id: dsh-shortcut
    disabled: true
  ```

  或使用插件自身开关 `config: { enabled: false }`。改完重启 dsh 生效；删掉那两行即可恢复。

## 发布到 npm

```sh
cd dsh-shortcut
npm login
npm publish
```

注意：pnpm 的 `minimumReleaseAge` 时效门控会拦下 24 小时内发布的包，所以要让用户按**具名版本**安装（`...@0.1.0`），而不是 `@latest`。

## 独立使用 / 测试

插件逻辑已导出，可不启动 dsh 直接运行，并可用 `platform` 参数强制测试各平台分支：

```sh
node -e "import('file:///绝对路径/dsh-shortcut/index.js').then(m => m.createDesktopShortcut({ dir: 'C:/tmp/desk', platform: 'linux' }).then(console.log))"
```

`scripts/create-shortcut.ps1` 是独立的 Windows 快捷方式创建脚本，可单独使用。

## 故障排查

- 安装/重启后没有启动器 → 查看 `~/.dsh/dsh-shortcut.log` 里的插件日志，以及服务端日志中的 `[dsh-shortcut]` 错误。
- 启动器点了没反应 → 在终端里直接运行启动脚本；`~/.dsh/dsh-launch.log` 记录每次运行，`dsh-web.out.log` / `dsh-web.err.log` 显示服务端输出。
- GNOME 桌面可能拒绝从桌面启动 `.desktop` 文件（"不受信任的应用程序启动器"）：右键文件 → **允许启动**（仅需这一次手动确认；文件本身是插件创建的）。
- 打包版 dsh（桌面应用）等无法从 `process.argv[1]` 探测到入口的机器 → 设置 `DSH_BIN` 指向 dsh 安装的 `lib/bin.js`。

## 许可

[MIT](LICENSE)
