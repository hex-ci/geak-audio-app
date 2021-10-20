module.exports = {
  pluginOptions: {
    electronBuilder: {
      preload: 'src/preload.js',
      chainWebpackMainProcess: config => {
        config.module
          .rule('js')
            .test(/\.m?jsx?$/)
            .exclude
              .add(/node_modules/)
              .end()
            .use('babel')
              .loader('babel-loader')
              .options({
                configFile: false,
                presets: [
                  ['@babel/preset-env', {
                    modules: false,
                    bugfixes: true,
                    targets: {
                      node: '10'
                    },
                    useBuiltIns: false
                  }]
                ]
              });
      }
    }
  }
}
