import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import getPort from 'get-port';
import { buildMain } from './build-main.js';

const require = createRequire(import.meta.url);

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, 'dist_electron/dev');
const mainWatch = ['src/background.js', 'src/preload.js'];

// Vite 7+ 的 package exports 不再暴露 bin/vite.js，直接按路径引用本地 CLI
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');

// electron 包在 Node 里导出的是可执行文件路径（CJS），用 createRequire 取最稳
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

  // Vite dev server：端口通过 VITE_DEV_PORT 传给 vite.config.js（固定 + strictPort）
  const devServer = spawn(process.execPath, [
    viteBin
  ], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, IS_ELECTRON: '1', VITE_DEV_PORT: String(port) }
  });

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

      // dev 实例也开远程调试端口（9223，避开打包产物的 9222），便于自动化检查渲染层
      const current = spawn(electronPath, [outDir, '--remote-debugging-port=9223'], {
        cwd: root,
        stdio: 'inherit',
        env: {
          ...process.env,
          VITE_DEV_SERVER_URL: url,
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
