import { createApp } from 'vue'
import ElementPlus, { ElMessage, ElNotification, ElMessageBox, ElLoading } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as ElementPlusIcons from '@element-plus/icons-vue'

import 'normalize.css'
// Element Plus 默认主题
import 'element-plus/dist/index.css'

import App from './App.vue'

const app = createApp(App)

// Element Plus 的图标是组件（不再是 el-icon-xxx 字体类），全局注册后模板里可直接用 <Search />
for (const [name, component] of Object.entries(ElementPlusIcons)) {
  app.component(name, component)
}

app.use(ElementPlus, { locale: zhCn })

// 与原 Element UI 保持同名的全局方法：渲染层里的 $message / $notify / $confirm /
// $alert / $prompt / $msgbox / $loading 调用点（共 16 处）因此无需改动。
app.config.globalProperties.$message = ElMessage
app.config.globalProperties.$notify = ElNotification
app.config.globalProperties.$msgbox = ElMessageBox
app.config.globalProperties.$alert = ElMessageBox.alert
app.config.globalProperties.$confirm = ElMessageBox.confirm
app.config.globalProperties.$prompt = ElMessageBox.prompt
app.config.globalProperties.$loading = ElLoading.service

app.mount('#app')
