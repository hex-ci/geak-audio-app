const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));

// 主进程和 preload 用 esbuild 打包（依赖一起打进去，产物目录不需要 node_modules）
const buildMain = async ({ dev, outDir }) => {
  fs.mkdirSync(outDir, { recursive: true });

  const options = {
    bundle: true,
    platform: 'node',
    target: 'node14',
    format: 'cjs',
    external: ['electron'],
    minify: !dev,
    sourcemap: dev ? 'inline' : false,
    // 开发时 __static 指向 public，打包后指向 asar 根目录
    define: { __static: dev ? JSON.stringify(path.join(root, 'public')) : '__dirname' }
  };

  await esbuild.build({
    ...options,
    entryPoints: [path.join(root, 'src/background.js')],
    outfile: path.join(outDir, 'background.js')
  });

  await esbuild.build({
    ...options,
    entryPoints: [path.join(root, 'src/preload.js')],
    outfile: path.join(outDir, 'preload.js')
  });

  fs.writeFileSync(path.join(outDir, 'package.json'), `${JSON.stringify({
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    author: pkg.author,
    main: 'background.js'
  }, null, 2)}\n`);
};

module.exports = { buildMain };
