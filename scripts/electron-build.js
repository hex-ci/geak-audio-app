const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { buildMain } = require('./build-main');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'dist_electron/bundled');

const run = (script, args, env) => {
  const result = spawnSync(process.execPath, [require.resolve(script), ...args], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...env }
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

(async () => {
  fs.rmSync(outDir, { recursive: true, force: true });

  // 渲染层
  run('@vue/cli-service/bin/vue-cli-service.js', ['build', '--dest', outDir], { IS_ELECTRON: '1' });

  // 主进程 + preload
  await buildMain({ dev: false, outDir });

  // 打包安装包（参数透传给 electron-builder）
  run('electron-builder/out/cli/cli.js', process.argv.slice(2));
})();
