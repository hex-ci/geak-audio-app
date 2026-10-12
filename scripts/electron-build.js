import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildMain } from './build-main.js';

const root = path.resolve(import.meta.dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const outDir = path.join(root, 'dist_electron/bundled');

// 三个 CLI 都按路径直接引用：Vite 7+ / electron-builder / @electron/asar 的 package exports
// 不保证能 require.resolve 到各自的 bin 文件。
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const builderCli = path.join(root, 'node_modules', 'electron-builder', 'out', 'cli', 'cli.js');
const asarBin = path.join(root, 'node_modules', '@electron', 'asar', 'bin', 'asar.js');

const run = (script, args, env) => {
  const result = spawnSync(process.execPath, [script, ...args], {
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

  // 渲染层（Vite 把产物写到 dist_electron/bundled，路径由 vite.config.js 里的 IS_ELECTRON 决定）
  run(viteBin, ['build'], { IS_ELECTRON: '1', NODE_ENV: 'production' });

  // 主进程 + preload
  await buildMain({ dev: false, outDir });

  // ---------------------------------------------------------------------------
  // 打包安装包（参数透传给 electron-builder）
  //
  // 本机会偶发：electron-builder 把解压好的 Electron 从 win-unpacked.tmp 改名到 win-unpacked 时被拒
  // （EPERM: operation not permitted / 访问被拒绝）。实测特征——目录内容的读写、复制、删除，以及
  // **子目录**改名都正常，唯独**根目录**改名被拦；Windows Restart Manager 也报不出占用者。这是
  // 「有进程把工作目录落在这个目录上」的典型表现（本机是 VS Code 的组件，退出 VS Code 即恢复；
  // .vscode/settings.json 里排除监视不足以根治）。
  //
  // 此时 .tmp 里的内容是完整的，于是退化为：复制成 win-unpacked → 补上 electron-builder 在改名之后
  // 会做的三步（exe 改名、删掉 default_app.asar、把应用打成 app.asar）→ 用官方支持的 --prepackaged 出包。
  // 想彻底避免走这条路：打包前关掉该仓库的 VS Code 窗口。
  // ---------------------------------------------------------------------------
  const builderArgs = process.argv.slice(2);
  const tmpDir = path.join(root, 'dist_electron/win-unpacked.tmp');
  const unpackedDir = path.join(root, 'dist_electron/win-unpacked');

  const runBuilder = (args) => spawnSync(process.execPath, [builderCli, ...args], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env }
  });

  let result = runBuilder(builderArgs);

  if (result.status !== 0 && fs.existsSync(tmpDir)) {
    console.warn('[electron-build] 打包失败，但解压目录 .tmp 是完整的 → 改用「复制 + 补齐打包步骤 + --prepackaged」重试');

    fs.rmSync(unpackedDir, { recursive: true, force: true });
    fs.cpSync(tmpDir, unpackedDir, { recursive: true });
    fs.rmSync(tmpDir, { recursive: true, force: true });

    const srcExe = path.join(unpackedDir, 'electron.exe');
    const dstExe = path.join(unpackedDir, `${pkg.build.productName}.exe`);
    if (fs.existsSync(srcExe)) {
      fs.renameSync(srcExe, dstExe);
    }
    fs.rmSync(path.join(unpackedDir, 'resources/default_app.asar'), { force: true });

    run(asarBin, ['pack', outDir, path.join(unpackedDir, 'resources/app.asar')], {});

    result = runBuilder(['--prepackaged', unpackedDir, ...builderArgs]);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
})();
