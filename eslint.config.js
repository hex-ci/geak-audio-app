import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'

const isProd = process.env.NODE_ENV === 'production'

const sharedRules = {
  'no-console': isProd ? 'warn' : 'off',
  'no-debugger': isProd ? 'warn' : 'off',
  'no-empty': ['error', { allowEmptyCatch: true }],
  'no-unused-vars': ['error', { caughtErrors: 'none' }]
}

export default [
  {
    ignores: ['dist/**', 'dist_electron/**', '.recon/**', 'node_modules/**']
  },
  js.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  {
    // 渲染层：浏览器环境
    files: ['src/**/*.{js,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser }
    },
    rules: sharedRules
  },
  {
    // 主进程/preload：Node 环境
    files: ['src/**/*.js'],
    languageOptions: {
      globals: { ...globals.node }
    }
  },
  {
    // 构建脚本与配置文件：Node 环境
    files: ['scripts/**/*.js', '*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node }
    },
    rules: {
      ...sharedRules,
      'no-console': 'off'
    }
  }
]
