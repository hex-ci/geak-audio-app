# 渲染层技术栈迁移记录（Vue 2 + Element UI + webpack → Vue 3 + Element Plus + Vite）

本文记录 geak-audio-app 从 2026-10 开始的这次大重构：**目标是不改变任何功能**，只换技术栈；
样式改用 Element Plus 官方默认主题。设备协议层（`src/lib/device.js` 等）不做功能改动。

## 一、版本对照

| 组件 | 迁移前 | 迁移后 |
|---|---|---|
| 渲染层框架 | Vue 2.7.14 | Vue 3.5.43 |
| UI 库 | Element UI 2.15.14（babel-plugin-component 按需引入） | Element Plus 2.14.7（**全量引入**，官方默认主题） |
| 渲染层构建 | vue-cli 5（webpack 5）+ vue-loader 15 | Vite 8.3.4 + @vitejs/plugin-vue 6 |
| 样式预处理 | sass-loader 12 + sass 1.69 | sass 1.105（Vite 内置支持，去掉 sass-loader） |
| 运行时 | Electron 13.6.9 | Electron 44.7.0 |
| 打包 | electron-builder 22.14 | electron-builder 26.15 |
| 代码检查 | ESLint 7 + .eslintrc.js（eslintrc 格式） | ESLint 10.12 + eslint.config.js（flat config） |
| 主进程打包 | esbuild（target node14） | esbuild（target node22，跟随 Electron 44 内置 Node） |

删除的依赖：`@vue/cli-service`、`@vue/cli-plugin-babel`、`@vue/cli-plugin-eslint`、`@babel/core`、
`babel-loader`、`babel-plugin-component`、`vue-template-compiler`、`sass-loader`、`element-ui`、
`core-js`、`dayjs`（零引用）、`electron-devtools-installer`（v3 与 Electron 44 不兼容，Vue 调试改由
`vite-plugin-vue-devtools` 在 dev 下提供）。

保留在最新小版本、**故意不跨大版本**的：`axios`、`get-port`（7.x 是 ESM-only，主进程打的是 CJS）、
`netmask`、`lodash`、`normalize.css`。按你的要求，`express` 一并升到大版本 5.x。

## 二、渲染层写法改动（Vue 3 / Element Plus 必改项）

| 类别 | 处理 |
|---|---|
| `new Vue(...).$mount()` | `createApp(App).mount('#app')` |
| `Vue.use(X)`（24 处） | `app.use(ElementPlus)` 全量引入，组件无需逐个注册 |
| `Vue.prototype.$x`（7 处） | `app.config.globalProperties.$x`，**保持同名**，因此渲染层 16 处 `$message/$notify/$confirm/...` 调用点一行未改 |
| `slot="x"`（6 处） | `<template #x>`（`el-upload` 的 trigger、`el-popconfirm` 的 reference、`el-input` 的 append、`el-dialog` 的 footer） |
| `slot-scope="scope"`（5 处） | `<template #default="scope">` |
| `:visible.sync`（2 处） | `el-dialog` 改 `v-model` |
| `@keyup.enter.native`（1 处） | 去掉 `.native` |
| `this.$set`（1 处） | 直接赋值（Vue 3 响应式代理） |
| `el-icon-xxx` 字体类（4 处） | 图标组件（`@element-plus/icons-vue` 全局注册）；`el-input` 用 `#prefix` 插槽、`el-button` 用默认插槽放 `<el-icon>` |
| `size="mini"`（9 处） | `size="small"`（EP 无 mini） |
| `type="text"`（5 处） | 布尔属性 `text` |
| `el-switch` 的 `:value`（4 处） | `:model-value`（EP 由 modelValue 驱动，旧写法开关显示不跟随状态） |
| `item.raw.path`（1 处） | `window.$electron.getPathForFile(item.raw)`——**Electron 32 起 `File.path` 已被移除**，preload 里新暴露了 `webUtils.getPathForFile` 包装 |

## 三、构建链改动

- 新增 `index.html`（仓库根目录，Vite 入口）、`vite.config.js`、`eslint.config.js`；删除 `vue.config.js`、
  `babel.config.js`、`.eslintrc.js`、`public/index.html`（后者会被 Vite 复制并覆盖构建产物）。
- `vite.config.js`：`base` 在 electron 构建下为 `./`；`build.outDir` 由 `IS_ELECTRON` 决定；dev 端口取
  `VITE_DEV_PORT`（strictPort）；dev 下挂 Vue Devtools 插件。
- `scripts/electron-serve.js` / `scripts/electron-build.js`：把 `vue-cli-service serve|build` 换成 Vite CLI，
  并且直接引用 `node_modules/vite/bin/vite.js`（Vite 7+ 的 package exports 不再暴露 `bin/vite.js`）。
- `src/background.js`：开发判断改 `!app.isPackaged`；dev server 环境变量改名 `VITE_DEV_SERVER_URL`；
  `webPreferences` 显式 `nodeIntegration: false` / `contextIsolation: true`；移除 devtools 自动安装。
- 生产加载仍是 `win.loadFile()` + 相对资源路径（白屏问题的结论见 `docs/electron-build-notes.md`）。
- **依赖全部放 devDependencies**：主进程由 esbuild 全量打包、渲染层由 Vite 打包，运行时不需要 node_modules。
  效果：`app.asar` 从 **64MB 降到 2.8MB**（安装包仍 ~112MB，因为 Electron 44 自身的二进制比 13 大得多）。

## 四、验证（这一段是本迁移的核心证据）

1. **界面行为基线对比**（`.recon/tools/`，不进仓库）
   用带状态 mock 的假 `$ipcRenderer` 顶替 preload，自动点遍 6 个顶层页签 + 6 个子页签、每个按钮与开关，
   记录「交互 → IPC 频道与参数」序列与面板可见文本；在迁移前的 Vue 2 产物与迁移后的 Vue 3 产物上各跑一次：
   - 迁移前 436 次调用 / 迁移后 437 次调用；**唯一差异是 1 次幂等读 `get-time-now`**（页签懒渲染导致的一次多读）。
   - 其余差异全部由「`el-popconfirm` 的确认气泡在 EP 下 teleport 到 body」解释（脚本少点到 2 个确认按钮），
     不是功能缺失：没有任何写动作丢失或新增，没有任何频道消失。
   - 页面错误：迁移前 0 条；迁移后 4 条 `ResizeObserver loop completed with undelivered notifications`
     （见「遗留问题」）。
2. **真机端到端**：在打包产物里切到「本机播放列表」→ 刷新 → 推送，界面提示「推送完成」，
   设备状态变为 `PLAYING`，主进程日志里设备（`MPlayer SVN-r32106` / `NSPlayer`）成功拉到音频文件，
   `NotFoundError` 为 0。
3. **本地文件服务回归**（`server_check.mjs`）：`/get-file` 返回 200 + 正确长度；设备的
   `Range: bytes=<size>-` 探测返回 416 + `Content-Range: bytes */<size>`。
4. **打包产物验证**：从 asar 加载（`file:///.../app.asar/index.html`），标题、页签数（12）、按钮数（145）、
   云听电台真实列表（19 个电台）全部正常；`window.$ipcRenderer`、`window.$electron.getPathForFile` 均可用，
   `window.process` 为 undefined（隔离完好）。
5. dev 链路：`npm run electron:serve` 起 Vite dev server（~600ms）并加载应用页，无报错。

## 五、过程中的坑（都已写进 AGENTS.md）

- **Express 5 的 `res.sendFile`**：传绝对路径会 404（Express 4 可以，实测），改成 `root` + 文件名。不修这个，
  本地文件推送会静默失败（设备取不到文件、一直 STOPPED）。
- **Electron 32+ 移除 `File.path`**：本地播放列表的路径会变成 undefined。
- **ESLint 9+/10 的默认值变化**：`no-unused-vars` 的 `caughtErrors` 默认 `'all'` 会把 `catch (e) {}` 报错；
  显式恢复 `'none'`。新规则 `no-useless-assignment` 命中一处无用初始化。
- **Vite 7+ 不再暴露 `bin/vite.js`**（`ERR_PACKAGE_PATH_NOT_EXPORTED`），按路径引用即可。
- **Windows 打包 EPERM**：electron-builder 改名 `win-unpacked.tmp` → `win-unpacked` 被拒。实测特征为「内容可读写/复制/删除，只有根目录改名被拦」，即有**进程对目录本身持有句柄**；本机元凶是 **VS Code 的文件监视器**（开着该仓库时必失败，退出后一次通过）。绕过办法见 AGENTS.md「坑」。

## 六、遗留问题

1. **`ResizeObserver loop completed with undelivered notifications`** —— **已决定：接受并记录，不做处理**。
   Element Plus 内部（`el-tabs` / `el-table` / `el-select`）在某个页签**第一次被渲染**时抛一次；实测在 Electron 44
   （Chromium 152）下、打包产物与 dev 实例行为一致，全新会话点完所有页签共 3 次。它是 Chromium 对 RO 循环的无害提示，
   功能无影响（界面行为基线与旧版逐条一致）；因为只在首次渲染时出现，日常会话里通常看不到。
   上游 element-plus#20003 已关闭为 not_planned，关掉页签活动条 transition 实测无效，故不遮蔽、不换组件。
   核查脚本：`.recon/tools/ro_check.js`。
2. **`appveyor.yml` 未验证**：CI 是 Windows + node 22 镜像，本机跑不了；Node 版本要求已满足 Vite/ESLint，
   但 CI 是否放行需要下次 CI 结果确认。
3. **安装包体积**：Electron 13 → 44 使安装包从 ~60MB 变为 ~112MB（Electron 自身变大，非应用代码）。

## 七、模块制式：整个项目改为 ESM

`package.json` 增加 `"type": "module"`，随之：

- `scripts/build-main.js`、`scripts/electron-build.js`、`scripts/electron-serve.js` 从 CommonJS 改写为 ESM
  （`require` → `import`，`module.exports` → `export`），`__dirname` → `import.meta.dirname`；
  需要 CJS 能力处（取 electron 可执行文件路径）用 `createRequire(import.meta.url)`。
- 配置文件去掉 `.mjs` 后缀：`vite.config.mjs` → `vite.config.js`，`eslint.config.mjs` → `eslint.config.js`
  （ESLint 里 `scripts/**` 的规则块也从 `sourceType: 'commonjs'` 改为 `'module'`）。
- 主进程产物仍是 CJS：esbuild `format: 'cjs'`，产物目录里生成的 `package.json` 不带 `type`，
  Electron 侧的加载方式完全不变。
- 验证：`node --check` 全部通过；`npm run lint`、`npm run build` 正常；dev 模式下 Vite 起服务并拉起
  Electron（`--remote-debugging-port=9223`），无 ESM 相关报错；重新产出的安装包与组装实例均正常渲染
  （145 个按钮 / 12 个页签 / 真实电台数据）。

## 八、生产环境改用 app:// 自定义协议（取代 file://）

Electron 升级到 44 后，把渲染层的加载方式从 `file://`（`win.loadFile`）换成官方推荐的自定义协议：
`registerSchemesAsPrivileged`（ready 前）+ `protocol.handle` + `net.fetch`（ready 后），实现放在
`src/lib/app-protocol.js`，生产窗口加载 `app://./index.html`。这样页面有正常 origin（`app://.`）而不是
opaque origin，也不再是"file:// 页面对本机文件近乎无限制访问"的那种风险面。

实测（打包产物）：界面完整、失败资源 0、样式生效、云听接口在新 origin 下仍可用、目录穿越请求回 400、
真机推送「推送完成」+ 设备 PLAYING。详见 `docs/electron-build-notes.md`。
