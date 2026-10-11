# AGENTS.md

GEAK Audio（果壳智能音响桌面工具）：Electron 应用，通过 UPnP/DLNA 把云听电台、喜马拉雅电台/频道、本地音频文件推送到局域网内的「果壳智能音响」播放。渲染层是 Vue 2.7 + Element UI 2，由 vue-cli 5（webpack 5）构建；主进程与 preload 由 esbuild 打包；安装包由 electron-builder 直接产出（不再使用 vue-cli-plugin-electron-builder）。UI 文案与注释一律中文，代码标识符英文。

## 环境与安装

- Node 22.x（推荐）或 24.x；仓库没有 `.nvmrc`，也没有 `engines` 字段。
- 安装：`npm i`。npm 11（Node 24/26 自带）默认拦截依赖的安装脚本，可能装不上 electron 二进制，需再执行一次 `npm install-scripts approve electron`。
- 没有测试框架：package.json 没有 test script，appveyor.yml 里是 `test: off`。不要编造或新增测试命令。

## 命令

- `npm run lint` — vue-cli-service lint
- `npm run build` — 只构建渲染层到 `dist/`（publicPath 为 `/`）
- `npm run electron:serve` — dev server + esbuild 打主进程 + 启动 Electron；改 `src/background.js`、`src/preload.js`、`src/lib/*` 会自动重打包并重启 Electron
- `npm run electron:build` — 渲染层 + 主进程 + electron-builder，产物在 `dist_electron/`
- `npm run electron:build:all` — `--mac --win --x64 --arm64`
- `npm run electron:build:ci` — CI 用，`--publish never`
- 额外参数直接透传给 electron-builder：`npm run electron:build -- --linux dir`

## 目录与构建

- `src/background.js` — Electron 主进程入口（源码）。esbuild 打成 `dist_electron/bundled/background.js`，产物目录里生成的 package.json `main` 就是它。
- `src/preload.js` — 只暴露 `window.$ipcRenderer` 的 send/on/invoke。contextIsolation 默认开启，nodeIntegration 由 `ELECTRON_NODE_INTEGRATION` 决定（默认关），渲染层不能直接 require/fs。
- `src/lib/protocol.js` — 注册 `app://` 协议，把 asar 里的渲染层资源读出来。Chromium 会把 `app:///fonts/x` 规范化成 host=fonts、path=/x，所以 host 也要拼回路径。
- `src/lib/event.js` — 全部 `ipcMain.handle` 通道集中于此。新增 IPC 命令必须在这里注册，否则渲染层 invoke 会挂。
- `src/lib/device.js` — SSDP 发现 + UPnP `AVTransport` / `RenderingControl` 调用；设备地址缓存到 `~/.geak-audio-device-cache.json`。
- `src/lib/server.js` — 主进程内 express，端口用 `get-port` 随机取；提供 `/playlist.json` 与 `/get-file?path=`。音响从 `http://<本机内网IP>:<port>` 拉播放列表和本地文件。import 即启动，无显式生命周期。
- `src/lib/playlist.js`、`src/lib/favorite.js` — 持久化到 `~/.geak-audio-playlist.json`、`~/.geak-audio-favorite.json`；读失败返回 `[]`，空 catch 是刻意的（eslint `no-empty` 已配 `allowEmptyCatch`）。
- `src/lib/request.js` — 渲染层 HTTP 走主进程 axios，绕开 CORS。`RadioCn.vue` 是例外，直接在渲染层 axios + md5 签名（key 内联在文件里）。
- `src/components/*.vue` — 一个 tab 一个组件，统一 Options API：向上 `$emit('push-playlist', data[, isLocal])` 和 `'add-favorite'`；App.vue 通过 `$refs[name].favoritePush()` 回推收藏项。
- `src/main.js` — Element UI 按需引入（babel-plugin-component + theme-chalk）。新用到的 `el-*` 组件必须在这里 import 并 `Vue.use`，否则不渲染。
- `scripts/build-main.js` — esbuild 打主进程与 preload，依赖全部打进去，产物目录不需要 node_modules；`scripts/electron-build.js`、`scripts/electron-serve.js` 分别是打包与开发入口。
- electron-builder 配置在 package.json 的 `build` 字段：appDir 为 `dist_electron/bundled`，`npmRebuild: false`（依赖已打进主进程包、没有原生模块，避免打包时再跑一次 npm install）。
- `build/icon.png` 是 electron-builder 图标（手工维护）；`dist/`、`dist_electron/` 是构建产物，已 gitignore。
- 没有 vue-router / vuex：依赖里装着，但 `main.js` 里是注释状态，切页靠 App.vue 的 `el-tabs`。不要把它们接回来。

## 约定

- ESLint 7 + `plugin:vue/essential` + `eslint:recommended`，无 prettier、无 TypeScript。单引号、2 空格缩进、行尾分号跟随文件现状。
- 提交信息很随意：中文短描述或 `update`，发版提交就是版本号（如 `1.2.0`）。没有 conventional commit 前缀。
- `package-lock.json` 在 `.gitignore` 里（仓库有意不跟踪），不要 git add。

## 坑

- 渲染层构建只剩 3 条告警，全是 webpack 体积/性能提示（与升级前的 cli4 一致）。曾经多出来的 30 条 `export 'default' (imported as '...') was not found` 是误报：vue-loader 15 的 style 块与 babel-plugin-component 生成的 theme-chalk 引入都固定写 default import，而 css-loader 6 的样式模块没有导出。vue.config.js 里的 `DropCssDefaultImportWarningPlugin` 在 afterSeal 阶段把它们从 `compilation.warnings` 摘掉——`ignoreWarnings` / `stats.warningsFilter` 对它无效，因为 `@soda/friendly-errors-webpack-plugin` 直接读那个数组。改这条正则时必须保证只匹配样式模块（`?vue&type=style` / `theme-chalk`），别把真正的 export 报错一起吞掉。换 vue-loader 版本解决不了：15.x 全系（15.9.5–15.11.1）codegen 是同一行，上游只在 17（Vue 3 线）改成副作用导入。
- electron 构建下 css 里的字体必须是相对路径（vue.config.js 里 fonts 规则的 `generator.publicPath = '../'`）。改成绝对 `app:///fonts/...` 会被 Chromium 当成 host 解析，字体 404。
- publicPath 只能在 vue.config.js 的 `publicPath` 选项里改；在 chainWebpack 里改 `output.publicPath` 会被 vue-cli 直接报错拒绝。electron 生产构建用 `app://./`，dev 与纯 web 构建用 `/`（靠 `IS_ELECTRON` + `NODE_ENV` 区分）。
- 必须有真实音响在同一局域网。搜索设备可能持续几分钟，App.vue 搜索对话框里的「取消」是唯一退路；换了网络或找不到设备时，删掉 `~/.geak-audio-device-cache.json` 强制重新发现。
- SSDP 会给每个非内网 IPv4 绑定 UDP 1900（`device.js`）。1900 被占（其他 DLNA/SSDP 客户端、或已有一个本应用实例）就搜不到设备。
- 单实例锁（`requestSingleInstanceLock`）：已有实例在跑时再 `electron:serve`，新进程会立刻退出。
- 本地文件播放依赖主进程的 express 服务，应用一关就断流（UI 里有对应提示）。
- 不要用 `npm run serve` 调试：那是纯浏览器，没有 preload，`window.$ipcRenderer` 为 undefined，页面会报错。调试走 `npm run electron:serve`。
- CI 是 AppVeyor（Windows，node 22，Visual Studio 2022 镜像），本机无法验证；改 appveyor.yml 后要看 CI 结果确认。
