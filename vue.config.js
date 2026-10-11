// electron 生产构建：渲染层资源从 asar 里读，用自定义协议而不是 file://
const isElectronBuild = !!process.env.IS_ELECTRON && process.env.NODE_ENV === 'production'

// css-loader 6 的样式模块没有 default 导出，而 vue-loader 15 的 style 块与 babel-plugin-component
// 生成的 theme-chalk 引入都固定写 default import，webpack 5 因此对每个样式报
// export 'default' (imported as '...') was not found in '...'。样式抽取与注入实测正常，属误报。
// ignoreWarnings / stats.warningsFilter 对它无效：@soda/friendly-errors-webpack-plugin 直接读
// compilation.warnings，绕过了 compilation.getWarnings()，只能在 afterSeal 里把这条从数组摘掉。
const CSS_DEFAULT_IMPORT = /export 'default' \(imported as '[^']+'\) was not found in '[^']*(?:\?vue&type=style|theme-chalk)[^']*'/

class DropCssDefaultImportWarningPlugin {
  apply (compiler) {
    compiler.hooks.compilation.tap('DropCssDefaultImportWarning', compilation => {
      compilation.hooks.afterSeal.tap('DropCssDefaultImportWarning', () => {
        compilation.warnings = compilation.warnings.filter(warning => !CSS_DEFAULT_IMPORT.test(warning.message))
      })
    })
  }
}

module.exports = {
  publicPath: isElectronBuild ? 'app://./' : '/',
  configureWebpack: {
    plugins: [new DropCssDefaultImportWarningPlugin()]
  },
  chainWebpack: config => {
    // electron 下 css 里的字体必须相对引用：绝对 app:///fonts/x 会被 Chromium 当成 host=fonts，路径变成 /x
    if (isElectronBuild) {
      const rule = config.module.rule('fonts')
      rule.set('generator', { ...rule.get('generator'), publicPath: '../' })
    }
  }
}
