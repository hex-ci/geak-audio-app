module.exports = {
  pluginOptions: {
    electronBuilder: {
      preload: 'src/preload.js',
      chainWebpackMainProcess: config => {
        config.module
          .rule('babel')
          .before('ts')
          .use('babel')
          .loader('babel-loader')
          .options({
            presets: ['@vue/cli-plugin-babel/preset']
          });

        config.merge({
          externals: {
            'upnp-device-client': 'require("upnp-device-client")'
          }
        });
      }
    }
  }
}
