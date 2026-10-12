import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// Electron 生产构建：渲染层从 asar 里以 file:// 加载，因此资源必须走相对路径。
// 纯 web 构建（npm run build，用于调试/回归）仍用绝对路径。
const isElectronBuild = !!process.env.IS_ELECTRON && process.env.NODE_ENV === 'production'

// dev server 端口固定，便于 electron-serve 与调试脚本确定地址（见 scripts/electron-serve.js）
const devPort = Number(process.env.VITE_DEV_PORT || 5173)

// 开发期接 Vue Devtools，仅 dev server 生效
const isDevServer = process.env.NODE_ENV !== 'production' && !isElectronBuild

export default defineConfig({
  base: isElectronBuild ? './' : '/',
  plugins: [vue(), ...(isDevServer ? [vueDevTools()] : [])],
  build: {
    outDir: process.env.IS_ELECTRON ? 'dist_electron/bundled' : 'dist',
    emptyOutDir: true,
    target: 'chrome140'
  },
  server: {
    port: devPort,
    strictPort: true
  }
})
