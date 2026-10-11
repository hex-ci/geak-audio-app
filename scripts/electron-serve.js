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
// 主动重启的 electron 进程：它们的 exit 只是我们杀掉的，不能顺带结束整个 dev 进程
const intentionalExit = new WeakSet();
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

  // 杀掉当前实例并等它真正退出：background.js 有 requestSingleInstanceLock，
  // 老进程没释放锁就启动新实例，新实例会立刻 app.quit()。
  const stopElectron = () => new Promise((resolve) => {
    const current = electron;
    electron = null;

    if (!current || current.exitCode !== null || current.killed) {
      resolve();
      return;
    }

    intentionalExit.add(current);
    current.once('exit', resolve);
    current.kill();
  });

  // 串行化重启，避免改文件太快时两次重建交叠
  let restartQueue = Promise.resolve();

  const startElectron = () => {
    restartQueue = restartQueue.then(async () => {
      await stopElectron();

      const current = spawn(electronPath, [outDir], {
        cwd: root,
        stdio: 'inherit',
        env: {
          ...process.env,
          WEBPACK_DEV_SERVER_URL: url,
          ELECTRON_DISABLE_SECURITY_WARNINGS: 'true'
        }
      });

      electron = current;
      children.push(current);

      current.on('exit', () => {
        // 主动重启杀掉的实例不算「用户关闭了应用」
        if (intentionalExit.has(current)) {
          intentionalExit.delete(current);
          return;
        }
        killAll();
        process.exit(0);
      });
    }).catch((err) => {
      console.error('启动 electron 失败：', err);
    });

    return restartQueue;
  };

  await waitForServer(url);
  await startElectron();

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
        await startElectron();
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
