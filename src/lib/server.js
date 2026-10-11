import express from 'express';
import getServerPort from 'get-port';
import cloneDeep from 'lodash/cloneDeep';
import fs from 'fs';

const app = express();

let playlistData;
let server;
let port;

app.get('/playlist.json', (req, res) => {
  res.send(JSON.stringify(playlistData));
});

app.get('/get-file', (req, res) => {
  console.log(`[get-file] range=${req.headers.range ?? '(无)'} ua=${req.headers['user-agent'] ?? ''} path=${req.query.path}`);

  // 设备拿到 DIDL 后会发 "Range: bytes=<文件大小>-"（起点正好在 EOF）来探测文件长度。
  // 按 HTTP 规范这种请求应回 416 并在 Content-Range 里带上总长度，设备正是从那里读到大小；
  // 但 express 的 sendFile 是以抛异常的方式处理它的，会在日志里留下未处理错误堆栈。
  // 这里提前判定并按同样的语义安静应答。
  const range = req.headers.range;

  if (range) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(range.trim());

    if (match) {
      try {
        const size = fs.statSync(req.query.path).size;

        if (Number(match[1]) >= size) {
          res.writeHead(416, {
            'Accept-Ranges': 'bytes',
            'Content-Range': `bytes */${size}`,
            'Content-Type': 'application/octet-stream',
            'Content-Length': 0
          });
          res.end();

          return;
        }
      }
      catch (e) {
        // 文件不存在等异常交给 sendFile 去报错
      }
    }
  }

  res.sendFile(req.query.path);
});

const startServer = async () => {
  port = await getServerPort();

  server = app.listen(port);
};

const setPlaylist = (data) => {
  playlistData = cloneDeep(data);
};

const getServer = () => server;

const getPort = () => port;

startServer();

export default {
  setPlaylist,
  getServer,
  getPort
};
