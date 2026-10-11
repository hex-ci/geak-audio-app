# Electron 打包记录（Windows）

## 症状：打包后（.exe）白屏，窗口标题停在「应用正在初始化...」

- 窗口能打开但内容全白；标题停在 `src/background.js` 创建窗口时设的 `应用正在初始化...`，
  之后的 `win.setTitle(... v<版本>)` 显然没执行 —— 说明卡在 `createWindow()` 里的**页面加载**那一步。
- 开发环境（`npm run electron:serve`）一切正常，只有打包后复现。

## 诊断方法（不需要手工看 GUI）

1. 带调试端口启动打包好的程序：

   ```bash
   dist_electron/win-unpacked/"GEAK Audio.exe" --inspect=5858 --remote-debugging-port=9222 --enable-logging
   ```

   从终端启动时 Electron 会把主进程日志写到继承的控制台，关键行直接可见：

   ```
   electron: Failed to load URL: app://./index.html with error: ERR_FAILED
   UnhandledPromiseRejectionWarning: Error: ERR_FAILED (-2) loading 'app://./index.html'
   ```

2. 用 CDP 分别进主进程与渲染层看真实状态（工具：`.recon/tools/diagnose_exe.cjs`、`.recon/tmp/cdp_eval.cjs`）：

   - 渲染层 `Runtime.evaluate` 读 `location.href` / `document.title` / `document.body.innerText`，
     用来区分"完全白屏"和"框架起来了但资源没加载"；
   - 主进程里可以重放 `loadURL` 并捕获异常。**注意：CDP 的全局作用域里没有 `require`**，
     要用 `process.mainModule.require(...)`。

3. **隔离实验（定案关键）**：在运行中的应用里现场重新注册协议 ——

   - 对一个**已注册**的 scheme 再次 `protocol.registerBufferProtocol`：注册调用"成功"，
     但处理函数**再也不被调用**，导航直接 `ERR_FAILED`；
   - 先 `protocol.unregisterProtocol(scheme)` 再注册：处理函数被正常调用（实测 +5 次，页面渲染出真实内容）。

4. 直接 `loadURL('file:///' + app.asar/index.html)`：能渲染出真实页面 → 证明问题只在自定义协议这一层。

## 根因

渲染层原本走自定义 `app://` 协议（已删除的 `src/lib/protocol.js` + `publicPath: 'app://./'`）。
在 Electron 13.6.9 下实测：`registerBufferProtocol('app', ...)` 一旦发生**重复注册**就会卡死
（注册不报错，但处理函数不再被调用），`app://./index.html` 必然 `ERR_FAILED` —— 打包后白屏即由此而来。
开发环境用 http dev server，不经过这条路，所以只有打包后才暴露。

## 处置

- `vue.config.js`：electron 构建下 `publicPath` 改为 `'./'`（相对路径）。
- `src/background.js`：生产环境改为 `win.loadFile(path.join(__dirname, 'index.html'))`，从 asar 里加载；不再注册 `app://`。
- 旧的 `src/lib/protocol.js` **已删除**：它是已废弃 API（`registerBufferProtocol`）的旧实现，留着就是死代码。

## 这条路正不正统？（与官方建议的取舍，实事求是）

两个事实都要说清：

1. `win.loadFile()` 是官方 `BrowserWindow` 文档里的标准写法（与 `loadURL` 并列给出的"load a local HTML file"），
   也是 electron-builder / electron-forge 模板的常见做法 —— 所以这条**不是野路子**。
2. 但 Electron 官方安全清单第 18 条明确建议：**不要用 `file://`，优先用自定义协议**：
   > Avoid usage of the file:// protocol and prefer usage of custom protocols … Pages running on file:// have
   > unilateral access to every file on your machine meaning that XSS issues can be used to load arbitrary files
   > from the users machine.
   而今天推荐的自定义协议写法是 `protocol.handle`（配 `registerSchemesAsPrivileged({ standard: true, secure: true, supportFetchAPI: true })`），
   **Electron 25 才有**；本项目原先用的 `registerBufferProtocol` 属已废弃老 API（25 起被移除）。

因此当前状态是**"可用但非安全上最优"**的取舍。就本项目而言风险面较小，理由是实测确认的：

- 渲染层没有 `v-html` / `webview` / `iframe`，不渲染远端或不受信任的 HTML；
- 与内容源（云听、喜马拉雅）的 HTTP 请求都在**主进程**里经 IPC 走 axios（`ipcMain.handle('request')`），
  与页面 origin 无关，所以换成 `file://` 不影响这些接口，也不涉及 CORS；
- 窗口保持 `contextIsolation: true`、`nodeIntegration` 关闭。

**要真正走正统路线，应做的是**（建议作为独立任务，而不是塞进这次修 bug）：

1. 把 Electron 从 13（已 EOL）升到当前稳定版；
2. 渲染层改回自定义协议，但用新 API：

```js
// 主进程，app ready 之前
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }
])

// app ready 之后
protocol.handle('app', (req) => {
  const { host, pathname } = new URL(req.url)
  const target = path.join(__dirname, host === '.' ? '' : host, pathname)
  // 防目录穿越：必须校验 target 仍在 __dirname 之内
  const rel = path.relative(__dirname, target)
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    return new Response('bad request', { status: 400 })
  }
  return net.fetch(pathToFileURL(target).toString())
})
```

3. `vue.config.js` 的 `publicPath` 再改回 `app://./`（或保持相对路径 + `app://./index.html` 一并验证）。

升级会连带处理一批 breaking changes（sandbox 默认开启、`remote` 移除、协议 API 替换等），所以要单独排期与回归。

## 验证（打包后）

```bash
node scripts/electron-build.js --publish never      # 产出 dist_electron/geak-audio-win-x64-<版本>.exe
dist_electron/win-unpacked/"GEAK Audio.exe" --remote-debugging-port=9222 &
node .recon/tmp/cdp_eval.cjs .recon/tmp/check_page.js 9222
```

期望输出：

```
url   = file:///.../resources/app.asar/index.html
title = GEAK Audio 果壳智能音响播放工具
正文   = 播放 停止 暂停 … 本机播放列表 收藏夹 设备管理 …
```

## 同类坑（备查）

- 自定义协议在 Electron 里一旦"注册两次"就可能静默失效，注册前**先无条件注销**是最稳的写法；
  但本项目最终没有采用自定义协议 —— `file://` + 相对资源路径在 asar 下更省事，也不需要特权 scheme。
- 升级 Electron 时注意：`protocol.registerBufferProtocol` / `registerFileProtocol` 等旧 API 在
  **Electron 25** 已被移除，届时需要改用 `protocol.handle` + `net.fetch`。

## 附：那些样式警告能不能用 loader 选项消掉？（实测：不能）

完整形态（`GEAK_RAW_CSS_WARNINGS=1 npm run build` 可重现，共 35 条）：

```
warning in ./src/App.vue
export 'default' (imported as 'style0') was not found in './App.vue?vue&type=style&index=0&id=…&lang=scss&scoped=true'

warning in ./src/main.js
export 'default' (imported as '_Table2') was not found in 'element-ui/lib/theme-chalk/table.css'
```

实测三种常见"正规方案"，都不行：

| 方案 | 结果 | 为什么不行 |
|---|---|---|
| `css.loaderOptions.css.esModule = false` | ❌ 仍 35 条 | 警告说的是"处理/抽取后的样式模块没有导出"，与 css-loader 的 JS 导出模式无关 |
| `babel-plugin-component` 配 `style: false`（并全局引入主题 CSS 一次） | ❌ 清 babel 缓存后仍 27 条 | 该插件对样式走的是 `addDefault()`（`lib/core.js`），不认 `style` 这个选项 |
| `css: { extract: false }` | ⚠️ 35 → 8 条 | theme-chalk 那 27 条（babel 生成的默认导入）消失；剩 8 条是 SFC 样式块 |

剩下 8 条的根因：`vue-loader@15.11` 的 `lib/codegen/styleInjection.js` **硬编码**生成
`import styleN from '<SFC style 模块>'`，整个包没有 `esModule` 之类开关可调。

**结论**：在 Vue 2.7 + vue-cli 5 + css-loader 6 这套组合下，`vue.config.js` 里"在 `afterSeal` 里
按精确规则摘这两类警告"是唯一能 0 警告的做法（`@soda/friendly-errors-webpack-plugin` 直接读
`compilation.warnings`，所以 `ignoreWarnings` / `stats.warningsFilter` 都无效）。
它只过滤这两类消息，其余警告照常输出（构建里仍能看到体积/性能类警告）；要彻底消失只能升级到
Vue 3 + vue-loader 17。
