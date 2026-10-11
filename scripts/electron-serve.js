const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const getPort = require('get-port');
const { buildMain } = require('./build-main');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'dist_electron/dev');
const mainWatch = ['src/background.js', 'src/preload.js'];

const electronPath = require('electron');

const children = [];
const killAll = () => {
  children.forEach((child) => {
    if (!child.killed) {
      child.kill();
    }
  });
};

const waitForServer = (url) => new Promise((resolve) => {
  const retry = () => {
    http.get(url, (res) => {
      res.resume();
      resolve();
    }).on('error', () => setTimeout(retry, 200));
  };

  retry();
});

(async () => {
  if (!fs.existsSync(electronPath)) {
    console.error('electron 二进制不存在，先执行：npm install-scripts approve electron（npm 11 默认拦截 postinstall）');
    process.exit(1);
  }

  const port = await getPort();
  const url = `http://localhost:${port}/`;

  const rebuild = async () => {
    await buildMain({ dev: true, outDir });
  };

  await rebuild();

  const devServer = spawn(process.execPath, [
    require.resolve('@vue/cli-service/bin/vue-cli-service.js'),
    'serve',
    '--port',
    String(port)
  ], { cwd: root, stdio: 'inherit', env: { ...process.env, IS_ELECTRON: '1' } });

  children.push(devServer);

  let electron = null;
  const startElectron = () => {
    if (electron && !electron.killed) {
      electron.kill();
    }

    electron = spawn(electronPath, [outDir], {
      cwd: root,
      stdio: 'inherit',
      env: {
        ...process.env,
        WEBPACK_DEV_SERVER_URL: url,
        ELECTRON_DISABLE_SECURITY_WARNINGS: 'true'
      }
    });

    children.push(electron);
    electron.on('exit', () => {
      killAll();
      process.exit(0);
    });
  };

  await waitForServer(url);
  startElectron();

  // 主进程文件变化时重新打包并重启 electron
  let timer = null;
  const watchFiles = mainWatch
    .map((file) => path.join(root, file))
    .concat(fs.readdirSync(path.join(root, 'src/lib')).map((file) => path.join(root, 'src/lib', file)));

  watchFiles.forEach((file) => {
    fs.watch(file, () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        console.log(`\n${path.relative(root, file)} 已变化，重新打包主进程...`);
        await rebuild();
        startElectron();
      }, 100);
    });
  });

  ['SIGINT', 'SIGTERM'].forEach((signal) => {
    process.on(signal, () => {
      killAll();
      process.exit(0);
    });
  });
})();
