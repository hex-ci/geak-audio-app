import { protocol } from 'electron';
import fs from 'fs';
import path from 'path';

const mimeTypes = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

const mimeTypeOf = (filename) => mimeTypes[path.extname(filename).toLowerCase()] || 'application/octet-stream';

// 注册 app:// 协议，把渲染层资源从 asar 里读出来
// Chromium 会把 app:///fonts/x.woff 规范化成 host=fonts、path=/x.woff，所以 host 也要拼回路径
export const registerAppProtocol = (scheme = 'app') => {
  protocol.registerBufferProtocol(scheme, (request, next) => {
    const url = new URL(request.url);
    const reqPath = path.normalize(url.host && url.host !== '.' ? `/${url.host}${url.pathname}` : url.pathname);

    if (!reqPath.startsWith('/')) {
      next({ mimeType: null, charset: null, data: null });
      return;
    }

    fs.readFile(path.join(__dirname, reqPath === '/' ? '/index.html' : reqPath), (err, data) => {
      if (err) {
        console.error(err);
        next({ mimeType: null, charset: null, data: null });
        return;
      }

      const mimeType = mimeTypeOf(reqPath);

      next({
        mimeType,
        charset: /^text\/|^application\/(javascript|json)/.test(mimeType) ? 'utf-8' : null,
        data
      });
    });
  });
};
