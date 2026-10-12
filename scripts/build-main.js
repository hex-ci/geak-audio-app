import fs from 'node:fs';
import path from 'node:path';
import esbuild from 'esbuild';

const root = path.resolve(import.meta.dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

// 主进程和 preload 用 esbuild 打包（依赖一起打进去，产物目录不需要 node_modules）
// target 跟随 Electron 内置 Node 版本：Electron 44 → Node 22
const buildMain = async ({ dev, outDir }) => {
  fs.mkdirSync(outDir, { recursive: true });

  const options = {
    bundle: true,
    platform: 'node',
    target: 'node22',
    // 主进程入口仍打成 CJS（Electron 侧最稳），产物目录里生成的 package.json 不带 type
    format: 'cjs',
    external: ['electron'],
    minify: !dev,
    sourcemap: dev ? 'inline' : false,
    // 开发时 __static 指向 public，打包后指向 asar 根目录（产物是 CJS，__dirname 可用）
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

export { buildMain };
