import { net, protocol } from 'electron';
import path from 'path';
import { pathToFileURL } from 'url';

// 生产环境的渲染层用自定义 app:// 协议加载，而不是 file://。
// 理由（Electron 安全清单第 18 条）：file:// 页面对本机文件近乎无限制访问，一旦 XSS 即可读任意文件；
// 自定义协议 + standard 特权会给出一个正常 origin（app://.），而不是 opaque origin。
//
// 注意：Electron 25 起旧的 registerBufferProtocol / registerFileProtocol 已被移除，
// 现在的写法只有 registerSchemesAsPrivileged（ready 之前，一次性）+ protocol.handle + net.fetch。
export const APP_SCHEME = 'app';

// host 用 '.'：配合 vite.config.js 里 electron 构建的 base: './'，资源按相对路径解析
export const APP_INDEX_URL = 'app://./index.html';

// 必须在 app ready 之前调用；同一个 scheme 重复注册会静默失效，所以只在这里注册一次。
export const registerAppScheme = () => {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: {
        standard: true,        // 有正常 origin，不是 opaque
        secure: true,          // 视为安全上下文（storage / crypto.subtle / Service Worker 可用）
        supportFetchAPI: true  // 页面里可以 fetch
      }
    }
  ]);
};

// app ready 之后调用。root 传渲染层产物目录（打包后就是 asar 内的 __dirname）。
export const registerAppProtocol = (root) => {
  protocol.handle(APP_SCHEME, async (request) => {
    let url;

    try {
      url = new URL(request.url);
    }
    catch (e) {
      return new Response('400 Bad Request', { status: 400 });
    }

    const { host, pathname } = url;
    // host 为 '.' 或空 → 产物根目录；其余 host 拼进路径（兼容 app://foo/bar 这种写法）
    const baseDir = (!host || host === '.') ? root : path.join(root, host);
    const relative = decodeURIComponent(pathname).replace(/^\/+/, '');
    const target = path.join(baseDir, relative);

    // 目录穿越防护：解析后的路径必须仍落在产物目录内（%2e%2e%2f 这类编码也会在这里被挡掉）
    const rel = path.relative(root, target);

    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      return new Response('400 Bad Request', { status: 400 });
    }

    try {
      return await net.fetch(pathToFileURL(target).toString());
    }
    catch (e) {
      return new Response('404 Not Found', { status: 404 });
    }
  });
};
