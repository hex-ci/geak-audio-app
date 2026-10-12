# AGENTS.md

GEAK Audio（果壳智能音响桌面工具）：Electron 应用，通过 UPnP/DLNA 把云听电台、喜马拉雅电台/频道、本地音频文件推送到局域网内的「果壳智能音响」播放。渲染层是 **Vue 3.5 + Element Plus 2.14**（全量引入、官方默认主题），由 **Vite 8** 构建；主进程与 preload 由 esbuild 打成 CJS；安装包由 **electron-builder 26** 产出；运行时是 **Electron 44**。UI 文案与注释一律中文，代码标识符英文。

## 环境与安装

- Node 20.19+ / 22.12+ / 24.x（Vite 8 与 ESLint 10 的要求）。仓库没有 `.nvmrc`，也没有 `engines` 字段。
- 安装：`npm i`。npm 11 及以上默认拦截依赖的安装脚本，可能装不上 electron 二进制，需再执行一次 `npm install-scripts approve electron`。
- 没有测试框架：package.json 没有 test script，appveyor.yml 里是 `test: off`。不要编造或新增测试命令；界面/协议层的回归靠 `.recon/tools/` 下的基线脚本（见文末「验证手段」）。

## 命令

- `npm run lint` — `eslint .`（ESLint 10 flat config，配置在 `eslint.config.js`）
- `npm run build` — 只构建渲染层到 `dist/`（base 为 `/`，用于浏览器/回归测试）
- `npm run serve` — 只起 Vite dev server（**没有 preload**，`window.$ipcRenderer` 为 undefined，页面会报错；调试请用下面这条）
- `npm run electron:serve` — Vite dev server + esbuild 打主进程 + 启动 Electron；改 `src/background.js`、`src/preload.js`、`src/lib/*` 会自动重打包并重启 Electron。dev 实例带 `--remote-debugging-port=9223`，端口由 `VITE_DEV_PORT` 固定传给 Vite
- `npm run electron:build` — 渲染层（Vite，`IS_ELECTRON=1` → 产物进 `dist_electron/bundled`、base 用相对路径）+ 主进程 + electron-builder，产物在 `dist_electron/`
- `npm run electron:build:all` — `--mac --win --x64 --arm64`
- `npm run electron:build:ci` — CI 用，`--publish never`
- 额外参数直接透传给 electron-builder：`npm run electron:build -- --linux dir`

## 目录与构建

- `index.html` — Vite 的渲染层入口（在仓库根目录，不再用 `public/index.html`；**public 里不能再放 index.html**，否则会覆盖构建产物）。
- `vite.config.js` — 渲染层构建配置：`base` 在 electron 构建下为 `./`（asar 里以 file:// 加载，必须相对路径）、否则 `/`；`build.outDir` 由 `IS_ELECTRON` 决定（`dist_electron/bundled` / `dist`）；`server.port` 取 `VITE_DEV_PORT`（strictPort）；dev 下挂 `vite-plugin-vue-devtools`。
- `eslint.config.js` — flat config：`@eslint/js` recommended + `eslint-plugin-vue` flat/essential + `globals`；渲染层与构建脚本都是 ESM。
- `src/main.js` — `createApp` + **全量引入 Element Plus**（`element-plus/dist/index.css`，取默认主题）+ 全局注册 `@element-plus/icons-vue` 的全部图标 + 把 `$message/$notify/$msgbox/$alert/$confirm/$prompt/$loading` 挂成 EP 的同名全局方法（因此渲染层里这些调用点与迁移前完全一致）。**新用到 `el-*` 组件不需要在这里注册**（全量引入覆盖全部组件）。
- `src/background.js` — Electron 主进程入口。生产分支用自定义 `app://` 协议加载 `app://./index.html`（不用 `file://`，理由见 `docs/electron-build-notes.md`）；dev URL 走 `VITE_DEV_SERVER_URL`；开发判断用 `!app.isPackaged`。esbuild 打成 `dist_electron/bundled/background.js`。
- `src/preload.js` — 暴露 `window.$ipcRenderer`（send/on/invoke）与 `window.$electron.getPathForFile(file)`。后者是必须的：Electron 32 起 `<input type=file>` 的 `File.path` 被移除，取真实路径只能走 `webUtils.getPathForFile`，而 contextBridge 的函数会把原始 File 对象透传给 preload。
- `src/lib/app-protocol.js` — `app://` 协议的实现：`registerAppScheme()` 在 app ready **之前**把 scheme 注册为 privileged（`standard` 给出正常 origin、`secure` 进安全上下文、`supportFetchAPI` 允许 fetch，同一 scheme 只能注册一次）；`registerAppProtocol(root)` 在 ready 之后用 `protocol.handle` + `net.fetch` 把 `app://<host>/<path>` 映射到渲染层产物目录，并用 `path.relative` 挡目录穿越（`%2e%2e%2f` 这类编码也会被挡）。Electron 25 起 `registerBufferProtocol` / `registerFileProtocol` 等旧 API 已移除，只有这一套写法。
- `src/lib/event.js` — 全部 `ipcMain.handle` 通道集中于此（25 个以上）。新增 IPC 命令必须在这里注册，否则渲染层 invoke 会挂。
- `src/lib/device.js` — SSDP 发现 + UPnP `AVTransport` / `RenderingControl` 调用；设备地址缓存到 `~/.geak-audio-device-cache.json`（缓存地址要用一次真实动作调用校验，不能只取 renderer.xml）。
- `src/lib/server.js` — 主进程内 express 5，端口用 `get-port` 随机取；提供 `/playlist.json` 与 `/get-file?path=`。音响从 `http://<本机内网IP>:<port>` 拉播放列表和本地文件。import 即启动，无显式生命周期。
- `src/lib/playlist.js`、`src/lib/favorite.js` — 持久化到 `~/.geak-audio-playlist.json`、`~/.geak-audio-favorite.json`；读失败返回 `[]`，空 catch 是刻意的。
- `src/lib/request.js` — 渲染层 HTTP 走主进程 axios，绕开 CORS。`RadioCn.vue` 是例外，直接在渲染层 axios + md5 签名（key 内联在文件里）。
- `src/components/*.vue` — 一个 tab 一个组件，统一 Options API：向上 `$emit('push-playlist', data[, isLocal])` 和 `'add-favorite'`；App.vue 通过 `$refs[name].favoritePush()` 回推收藏项。
- `scripts/build-main.js` — esbuild 打主进程与 preload（`target: node22`，跟随 Electron 44 内置 Node），依赖全部打进去，产物目录不需要 node_modules；`scripts/electron-build.js`、`scripts/electron-serve.js` 分别是打包与开发入口，两者都用 `path.join(root,'node_modules/vite/bin/vite.js')` 直接引用 Vite CLI（Vite 7+ 的 package exports 不再暴露 `bin/vite.js`）。
- electron-builder 配置在 package.json 的 `build` 字段：appDir 为 `dist_electron/bundled`，`npmRebuild: false`。**所有依赖都在 devDependencies**：它们已被 esbuild/Vite 全量打进产物，运行时不需要 node_modules，这样 asar 只有 ~2.8MB（若把依赖放回 dependencies，asar 会膨胀到 60MB+）。
- `build/icon.png` 是 electron-builder 图标（手工维护）；`dist/`、`dist_electron/` 是构建产物，已 gitignore。

## 约定

- ESLint 10 flat config（`eslint.config.js`），`plugin:vue/essential` 的对应物是 `pluginVue.configs['flat/essential']`，无 prettier、无 TypeScript。单引号、2 空格缩进。
- 提交信息很随意：中文短描述或 `update`，发版提交就是版本号（如 `1.2.0`）。没有 conventional commit 前缀。
- `package-lock.json` 在 `.gitignore` 里（仓库有意不跟踪），不要 git add。
- 项目是 **`"type": "module"`**：`scripts/*.js`、`vite.config.js`、`eslint.config.js` 全是 ESM，不要写 `require` / `module.exports`；需要 CJS 能力时用 `createRequire(import.meta.url)`（如 `scripts/electron-serve.js` 取 electron 可执行文件路径），取仓库根目录用 `import.meta.dirname`。主进程产物本身仍是 CJS（esbuild `format: 'cjs'`，产物目录里生成的 package.json 不带 type），所以 Electron 侧的加载方式不变。

## 坑

- **Element Plus 与 Element UI 的写法差异**（迁移时逐一改过，新写模板别再用旧写法）：`size="mini"` → `small`；`type="text"` → 布尔属性 `text`；`el-switch` 用 `:model-value` 驱动（旧代码传的 `:value` 在 EP 下不影响开关显示）；`:visible.sync` → `v-model`；具名插槽 `slot="x"` → `<template #x>`；作用域插槽 `slot-scope="scope"` → `<template #default="scope">`；`@keyup.enter.native` → 去掉 `.native`；`el-icon-xxx` 字体类 → 图标组件（`<el-icon><Search /></el-icon>`；`el-input` 的图标用 `#prefix` 插槽，`el-button` 用默认插槽里放 `<el-icon>`）；`this.$set` → 直接赋值。`el-popconfirm` 的确认气泡在 EP 下 teleport 到 body（不再渲染在面板内）。
- **ResizeObserver 警告（已决定：接受并记录，不要遮蔽）**：Element Plus 内部（`el-tabs` / `el-table` / `el-select` 的 ResizeObserver）在**某个页签第一次被渲染**时会抛一次 `ResizeObserver loop completed with undelivered notifications` （实测：全新会话按首次渲染顺序切完 6 个页签 + 6 个设备子页签，共 3 次；Electron 44 / Chromium 152，打包产物与 dev 一致）。特征与影响：它是 Chromium 对 RO 循环的无害提示（窗口级 error 事件），功能无影响（界面行为基线与旧版逐条一致）；**只在页签首次渲染时出现**，所以已经打开过所有页签的会话里不会再看到——这也是"控制台没提示"的原因。上游（element-plus#20003）被关闭为 not_planned，关掉页签活动条 transition 也无效（实测），因此没有库侧修法：**不要**去加 window 级错误过滤或替换 `el-tabs`，就让它这样。复现/核查用 `.recon/tools/ro_check.js`（在真实应用里挂 error 监听再点一遍所有页签）。
- **Express 5**：`res.sendFile('<绝对路径>')` 会返回 404（Express 4 可以，已实测），必须写成 `res.sendFile(path.basename(p), { root: path.dirname(p) })`。`server.js` 已按此改。
- **Electron 32+ 移除了 `File.path`**：本地文件播放取路径必须走 preload 暴露的 `window.$electron.getPathForFile(file)`，直接用 `file.raw.path` 会拿到 undefined。
- **ESLint 9+/10 的默认值变化**：`no-unused-vars` 的 `caughtErrors` 默认为 `'all'`，会把 `catch (e) {}` 里的 e 报成错误；本项目在 `eslint.config.js` 里显式恢复为 `'none'`。新规则 `no-useless-assignment` 命中过 `device.js` 里的无用初始化（已按规则改）。
- **Windows 打包 EPERM（改名被拒）—— 已由构建脚本自动兜底**：electron-builder 把解压好的 Electron 从
  `win-unpacked.tmp` 改名到 `win-unpacked` 时可能被拒（`EPERM: operation not permitted` / 访问被拒绝）。
  实测特征：目录内容的**读写、复制、删除，以及子目录改名都正常，唯独根目录改名被拦**；Windows Restart Manager
  也查不出占用者——这是「有进程把工作目录落在这个目录上」的典型表现，本机是 VS Code 的组件（Volar / Stylelint /
  tsserver 扩展宿主），退出 VS Code 即恢复。注意：`.vscode/settings.json` 里排除文件监视**不足以根治**（试过，仍会失败）。
  `scripts/electron-build.js` 现在会在这种情况下自动退化：复制 `.tmp` → 补上 electron-builder 在改名之后会做的三步
  （`electron.exe` 改名成 `GEAK Audio.exe`、删 `resources/default_app.asar`、把 `dist_electron/bundled` 打成
  `resources/app.asar`）→ 用官方支持的 `--prepackaged` 出安装包。所以 `npm run electron:build` 两种情况都能跑通；
  想避免走兜底，打包前关掉该仓库的 VS Code 窗口即可。
- **系统 Node 与 Hermes 自带 Node 混用**：agent 的 bash 会话里 Hermes 自带的 Node 26 常抢到 PATH 最前，而 npm 安装 electron 这类带 postinstall 的包在 Node 26 下会**静默失败**（只落 1 个文件、却 exit 0）。跑安装与打包前先 `export PATH="/c/Program Files/nodejs:$PATH"` 用系统 Node 24。
- 渲染层资源一律用**相对路径**（Vite `base: './'`）。`app://` 的 handler 会把 `app://fonts/x` 这类 host 也拼回路径（兼容老写法），但别在 CSS/JS 里手写绝对 `app://...` 地址。
- 必须有真实音响在同一局域网。搜索设备可能持续几分钟，App.vue 搜索对话框里的「取消」是唯一退路；换了网络或找不到设备时，删掉 `~/.geak-audio-device-cache.json` 强制重新发现。
- SSDP 会给每个非内网 IPv4 绑定 UDP 1900（`device.js`）。1900 被占（其他 DLNA/SSDP 客户端、或已有一个本应用实例）就搜不到设备。
- 单实例锁（`requestSingleInstanceLock`）：**dev 实例与打包版共用同一把锁**（两边都 `app.setName('GEAK Audio')`，
  userData 相同）。因此 dev 的 `electron.exe` 还在跑时，启动打包好的 `GEAK Audio.exe` 会立刻退出、`--remote-debugging-port`
  也不监听，看着像「应用起不来」。清理用 `powershell "Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force"`
  加 `powershell "Stop-Process -Name 'GEAK Audio' -Force -ErrorAction SilentlyContinue"`（本机 `taskkill //IM` 不总是生效）。
  重打包前也要先杀干净，否则 `win-unpacked` 被占用。
- 本地文件播放依赖主进程的 express 服务，应用一关就断流（UI 里有对应提示）。
- CI 是 AppVeyor（Windows，node 22，Visual Studio 2022 镜像），本机无法验证；改 appveyor.yml 后要看 CI 结果确认。

## 验证手段（`.recon/tools/`，已 gitignore，不进仓库）

- `ui_runner.cjs` + `ui_baseline_stub.js` + `ui_baseline.js` + `ui_diff.py` — 界面行为基线：用带状态 mock 的假 `$ipcRenderer` 顶替 preload，自动点遍每个页签/按钮/开关，记录「交互 → IPC 频道与参数」序列与面板可见文本；重构前后各跑一次，`ui_diff.py` 逐条比对（时间类参数已归一化）。迁移 Vue 3 时就是靠它证明 IPC 行为零变化。
- `cdp_get.cjs` — 对已带远程调试端口的进程执行一段页面 JS（`--port`、`--expr` 或 `--file`、`--match` 过滤目标），用来读打包产物的 `location.href` / 标题 / 正文。
- `server_check.mjs` — 本地文件服务回归：`/get-file` 应 200 且长度正确；设备的 `Range: bytes=<size>-` 探测应回 416 + `Content-Range: bytes */<size>`。
- `device_state.cjs` / `device_stop.cjs`（在 `.recon/tmp/`，用 esbuild 打出的 `device.bundle.cjs`）— 独立读设备状态 / 让设备停止。
- 排查打包白屏：先看 `docs/electron-build-notes.md`（启动参数、CDP、asar 校验那套流程）。
