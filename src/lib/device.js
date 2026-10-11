import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import https from 'https';
import dgram from 'dgram';
import { Netmask } from 'netmask';
import axios from 'axios';
import cloneDeep from 'lodash/cloneDeep';
import server from './server';

const devicePath = path.join(os.homedir(), '.geak-audio-device-cache.json');
const ipList = Object.values(os.networkInterfaces()).flat().filter(i => i.family == 'IPv4' && !i.internal);

// 与官方 app 一致：发现时同时搜这两种设备类型（app 的 UpnpSearchAsync 对两者各发一次）
const MEDIA_RENDERER_TYPE = 'urn:schemas-upnp-org:device:MediaRenderer:1';
const MEDIA_SERVER_TYPE = 'urn:schemas-upnp-org:device:MediaServer:1';

// ---------------------------------------------------------------------------
// SSDP 发现
// ---------------------------------------------------------------------------
const SSDP_ADDRESS = '239.255.255.250';
const SSDP_PORT = 1900;
const SEARCH_ROUNDS = 3;          // 搜索报文发送轮数
const SEARCH_ROUND_GAP = 1500;    // 轮与轮的间隔（毫秒）
const SEARCH_TOTAL_MS = 12000;    // 单次搜索总上限
const RENDERER_GRACE_MS = 2500;   // 媒体服务器先到时，留给渲染器的时间窗口

let searchState = null;

// 构造 M-SEARCH 报文（用显式 CRLF 拼接，避免字符串转义带来的歧义）
const CRLF = String.fromCharCode(13, 10);

const buildSearchMessage = (st) => Buffer.from([
  'M-SEARCH * HTTP/1.1',
  `HOST: ${SSDP_ADDRESS}:${SSDP_PORT}`,
  'MAN: "ssdp:discover"',
  'MX: 1',
  `ST: ${st}`,
  '',
  ''
].join(CRLF), 'utf8');

// 解析 SSDP 响应头（首行是状态行，之后是 Key: Value）
const parseSsdpHeaders = (text) => {
  const headers = {};
  const lines = String(text).split('\n');

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    const index = line.indexOf(':');

    if (index > 0) {
      headers[line.slice(0, index).trim().toUpperCase()] = line.slice(index + 1).trim();
    }
  }

  return headers;
};

// ---------------------------------------------------------------------------
// SOAP 调用
// ---------------------------------------------------------------------------

const SERVICE_TYPE = {
  AVTransport: 'urn:schemas-upnp-org:service:AVTransport:1',
  RenderingControl: 'urn:schemas-upnp-org:service:RenderingControl:1'
};

// 设备描述缓存（rendererUrl -> { serviceType: 控制地址 })
const serviceCache = new Map();

function Client(rendererUrl) {
  this.rendererUrl = rendererUrl;
}

const escapeXml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

// 设备把 JSON 结果作为文本返回，XML 里是 &quot; 这类实体，必须还原
const unescapeXml = (value) => String(value)
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, '\'')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&amp;/g, '&');

const loadServices = async (rendererUrl) => {
  if (serviceCache.has(rendererUrl)) {
    return serviceCache.get(rendererUrl);
  }

  const response = await axios.get(rendererUrl, { timeout: 3000, responseType: 'text' });
  const xml = String(response.data);
  const urlBase = (xml.match(/<URLBase>([\s\S]*?)<\/URLBase>/)?.[1] ?? new URL(rendererUrl).origin + '/').trim();
  const services = {};

  for (const match of xml.matchAll(/<service>([\s\S]*?)<\/service>/g)) {
    const block = match[1];
    const serviceType = block.match(/<serviceType>([\s\S]*?)<\/serviceType>/)?.[1]?.trim();
    const controlURL = block.match(/<controlURL>([\s\S]*?)<\/controlURL>/)?.[1]?.trim();

    if (serviceType && controlURL) {
      services[serviceType] = /^https?:/.test(controlURL) ? controlURL : new URL(controlURL, urlBase).toString();
    }
  }

  serviceCache.set(rendererUrl, services);

  return services;
};

// 把 <u:XxxResponse> 里的元素拍平成 { 参数名: 文本 }
const parseActionResult = (xml) => {
  const result = {};

  for (const match of xml.matchAll(/<([A-Za-z_][\w.-]*)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g)) {
    const [, tag, inner] = match;

    if (['Envelope', 'Body', 'Fault', 'detail', 'UPnPError'].includes(tag) || inner.includes('<')) {
      continue;
    }

    result[tag] = unescapeXml(inner);
  }

  return result;
};

const buildEnvelope = (serviceType, method, params) => {
  const args = Object.entries(params)
    .map(([key, value]) => `<${key}>${escapeXml(value ?? '')}</${key}>`)
    .join('');

  return '<?xml version="1.0" encoding="utf-8"?>'
    + '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">'
    + `<s:Body><u:${method} xmlns:u="${serviceType}">${args}</u:${method}></s:Body>`
    + '</s:Envelope>';
};

// 设备（2016 年固件）应答一个请求后就关闭连接：必须禁用 keep-alive，
// 否则复用同一个 socket 的第二次调用会直接 socket hang up。
const noKeepAliveHttp = new http.Agent({ keepAlive: false });
const noKeepAliveHttps = new https.Agent({ keepAlive: false });

const callAction = async (client, type, method, params = {}) => {
  const serviceType = SERVICE_TYPE[type] ?? type;

  try {
    const services = await loadServices(client.rendererUrl);
    const controlUrl = services[serviceType];

    if (!controlUrl) {
      console.error(`设备描述里没有服务 ${serviceType} 的控制地址`);

      return false;
    }

    const body = buildEnvelope(serviceType, method, { InstanceID: 0, ...params });

    const response = await axios.post(controlUrl, Buffer.from(body, 'utf8'), {
      timeout: 10000,
      responseType: 'text',
      httpAgent: noKeepAliveHttp,
      httpsAgent: noKeepAliveHttps,
      headers: {
        'Content-Type': 'text/xml; charset="utf-8"',
        SOAPACTION: `"${serviceType}#${method}"`,
        Connection: 'close',
        'Accept-Encoding': 'identity'
      }
    });

    return parseActionResult(String(response.data));
  }
  catch (error) {
    const detail = error?.response?.data ? String(error.response.data).replace(/\s+/g, ' ').slice(0, 300) : error.message;

    console.error(`UPnP 调用失败 ${type}.${method}: ${detail}`);

    return false;
  }
};

const searchDevice = () => {
  return new Promise((resolve) => {
    console.log('开始搜索设备...');

    const sockets = [];
    let settled = false;
    let cancelled = false;
    let serverFallback = null;
    let graceTimer = null;
    let totalTimer = null;
    let roundTimer = null;

    const cleanup = () => {
      clearTimeout(graceTimer);
      clearTimeout(totalTimer);
      clearTimeout(roundTimer);

      for (const socket of sockets) {
        try {
          socket.close();
        }
        catch (e) {
        }
      }

      searchState = null;
    };

    const finish = (service) => {
      if (settled) {
        return;
      }

      settled = true;
      console.log('搜索设备完成！');

      // 缓存设备地址
      fs.writeFileSync(devicePath, JSON.stringify(service));

      cleanup();
      resolve(service);
    };

    const giveUp = () => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(false);
    };

    searchState = {
      cancel: () => {
        cancelled = true;
        console.log('停止搜索设备！');
        giveUp();
      }
    };

    const handleResponse = (text) => {
      if (settled || cancelled) {
        return;
      }

      const headers = parseSsdpHeaders(text);

      if (!headers.LOCATION || !headers.USN) {
        return;
      }

      const udn = headers.USN.split('::')[0];

      // 只认果壳音响（UDN 形如 uuid:geakmusic-<MAC>_MR / _MS）
      if (!udn.startsWith('uuid:geakmusic')) {
        return;
      }

      const service = {
        UDN: headers.USN,
        ST: headers.ST,
        LOCATION: headers.LOCATION,
        SERVER: headers.SERVER,
        'CACHE-CONTROL': headers['CACHE-CONTROL'],
        details: { URLBase: new URL('.', headers.LOCATION).toString() }
      };

      // 控制目标是渲染器，优先采用
      if (headers.ST === MEDIA_RENDERER_TYPE) {
        finish(service);

        return;
      }

      // 媒体服务器先到时，先等一个窗口给渲染器
      serverFallback = serverFallback ?? service;
      graceTimer = graceTimer ?? setTimeout(() => finish(serverFallback), RENDERER_GRACE_MS);
    };

    const targets = ipList.length > 0 ? ipList : [{ address: '0.0.0.0' }];

    for (const item of targets) {
      const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

      socket.on('error', (error) => console.error('SSDP socket 错误:', error.message));
      socket.on('message', (buffer) => handleResponse(buffer.toString('utf8')));

      socket.bind(0, item.address, () => {
        try {
          socket.setMulticastTTL(4);
          socket.setBroadcast(true);
        }
        catch (e) {
        }

        let round = 0;

        const sendRound = () => {
          if (settled || cancelled) {
            return;
          }

          for (const st of [MEDIA_RENDERER_TYPE, MEDIA_SERVER_TYPE]) {
            const message = buildSearchMessage(st);

            socket.send(message, 0, message.length, SSDP_PORT, SSDP_ADDRESS, (error) => {
              if (error && round === 0) {
                console.error('SSDP 发送失败:', error.message);
              }
            });
          }

          round += 1;

          if (round < SEARCH_ROUNDS) {
            roundTimer = setTimeout(sendRound, SEARCH_ROUND_GAP);
          }
        };

        sendRound();
      });

      sockets.push(socket);
    }

    totalTimer = setTimeout(() => {
      console.log('搜索设备超时，未发现果壳音响');
      giveUp();
    }, SEARCH_TOTAL_MS);
  });
};

const searchDeviceFromCache = async ({ force = false } = {}) => {
  let device;

  // force=true 用于重试路径：跳过缓存，直接重新发现（缓存里可能是过期端口）
  if (!force) {
    try {
      device = JSON.parse(fs.readFileSync(devicePath).toString());
    }
    catch (e) {
    }
  }

  if (!device?.details?.URLBase) {
    device = await searchDevice();
  }

  if (device !== false) {
    let rendererUrl = `${device.details.URLBase}renderer.xml`;

    // 校验缓存地址。两级：先取描述文件（便宜），再真调一次动作（关键）——
    // 实测旧实例有时仍能取到 renderer.xml（缓存里 49152、真机在 49153），只校验描述文件会误判为可用。
    let usable = false;

    try {
      await axios.get(rendererUrl, { timeout: 1000 });
      usable = true;
    }
    catch (e) {
      usable = false;
    }

    if (usable) {
      const probe = await callAction(new Client(rendererUrl), 'AVTransport', 'GetTransportInfo');

      usable = probe !== false;
    }

    if (!usable) {
      console.log('缓存里的设备地址不可用（描述文件或动作调用失败），改为重新发现');
      device = null;
    }

    if (!device?.details?.URLBase) {
      device = await searchDevice();
    }
  }

  if (device === false) {
    return false;
  }
  else {
    return `${device.details.URLBase}renderer.xml`;
  }
};

const stopSearchDevice = () => {
  if (searchState) {
    searchState.cancel();
  }
};

// geakmusic:// 第二段的播放模式是整数：1 单曲循环、2 顺序、3 随机。
// 官方 app 用用户当前的 repeatMode（见 docs/geak-protocol.md §4），这里必须与界面上的模式一致。
const PLAY_MODE_CODE = {
  SINGLE_CYCLE: 1,
  SEQUENCE_PLAY: 2,
  RANDOM_PLAY: 3
};

const pushPlaylist = async (playlistData, local = false, mediaInfo = {}, playMode = 'SEQUENCE_PLAY') => {
  const rendererUrl = await searchDeviceFromCache();

  if (rendererUrl === false) {
    return false;
  }

  // 确定 ip 和端口
  const parsedUrl = new URL(rendererUrl);
  const block = new Netmask(parsedUrl.hostname, '255.255.255.0');

  const ip = ipList.find(item => block.contains(item.address)).address;

  const port = server.getPort();

  const playlistUrl = `http://${ip}:${port}/playlist.json`;
  const client = new Client(rendererUrl);

  console.log('开始推送播放列表...');

  playlistData = cloneDeep(playlistData);

  if (local) {
    const tracks = playlistData.TracksMetaData.map(item => ({
      ...item,
      url: `http://${ip}:${port}${item.url}`
    }));
    playlistData = {
      TracksMetaData: tracks
    };
  }

  server.setPlaylist(playlistData);

  // 首曲 URL：URI 与 DIDL 的 res 必须一致
  const firstTrackUrl = mediaInfo.url ?? playlistData.TracksMetaData[0].url;
  const firstTrack = playlistData.TracksMetaData[0] ?? {};

  // 与 app 的 native 模板（libdream.so 的 GetMetada）对齐：
  // protocolInfo 固定 "http-get:*:audio/mpeg:"，size 与 duration 有值时才带；
  // duration 形如 00:03:00.000（native 里由秒数换算而来）。
  const formatDuration = (duration) => {
    if (typeof duration === 'string' && /^\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(duration.trim())) {
      return duration.trim();
    }

    if (typeof duration === 'number' && duration > 0) {
      const hours = Math.floor(duration / 3600);
      const minutes = Math.floor((duration % 3600) / 60);
      const seconds = Math.floor(duration % 60);
      const pad = value => String(value).padStart(2, '0');

      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.000`;
    }

    return null;
  };

  const resDuration = formatDuration(firstTrack.duration ?? mediaInfo.duration);
  const resAttributes = [
    'protocolInfo="http-get:*:audio/mpeg:"',
    Number(firstTrack.size ?? mediaInfo.size) > 0 ? `size="${Number(firstTrack.size ?? mediaInfo.size)}"` : null,
    resDuration ? `duration="${resDuration}"` : null
  ].filter(Boolean).join(' ');

  const params = {
    InstanceID: 0,
    CurrentURI: `geakmusic://${firstTrackUrl}|${PLAY_MODE_CODE[playMode] ?? 2}|${playlistUrl}|`,
    // DIDL 必须闭合合法（设备对 XML 错误直接回 SOAP Fault 501 XML error，推送会静默失败）
    CurrentURIMetaData: `<DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/">
<item id="0" parentID="-1" restricted="false">
<upnp:class>object.item.geakMusic</upnp:class>
<dc:title>${escapeXml(mediaInfo.title ?? firstTrack.title ?? '')}</dc:title>
<dc:creator>${escapeXml(mediaInfo.creator ?? '')}</dc:creator>
<upnp:artist>${escapeXml(mediaInfo.artist ?? '')}</upnp:artist>
<upnp:album>${escapeXml(mediaInfo.album ?? '')}</upnp:album>
<upnp:albumArtURI></upnp:albumArtURI>
<res ${resAttributes}>${escapeXml(firstTrackUrl)}</res>
</item></DIDL-Lite>`
  };

  await callAction(client, 'AVTransport', 'Stop');

  const setResult = await callAction(client, 'AVTransport', 'SetAVTransportURI', params);

  if (setResult === false) {
    // 设备拒绝时不要谎报成功（例如 DIDL 不合法会返回 SOAP Fault 501 XML error）
    console.error('推送失败：设备拒绝 SetAVTransportURI，请检查 DIDL 与 geakmusic:// URI 格式');
    return false;
  }

  // 固定每次都发 Play(Speed=1)：app 的 CtrlPointPlayURI 就是无条件发这一步（见 docs/geak-protocol.md §4）。
  // 实测设备收到 geakmusic:// URI 后也会自己开播，所以这一步失败只告警、不判定推送失败。
  const playResult = await callAction(client, 'AVTransport', 'Play', { Speed: 1 });

  if (playResult === false) {
    console.warn('Play(Speed=1) 调用未成功，但设备可能已自动开始播放（详见 docs/geak-protocol.md §4）');
  }

  console.log('推送完成！');

  return true;
};

const play = async () => {
  const rendererUrl = await searchDeviceFromCache();

  if (rendererUrl === false) {
    return false;
  }

  const client = new Client(rendererUrl);

  // 如实返回结果：设备没接受时界面不应显示成“正在播放”
  const result = await callAction(client, 'AVTransport', 'Play', { Speed: 1 });

  return result !== false;
}

const stop = async () => {
  const rendererUrl = await searchDeviceFromCache();

  if (rendererUrl === false) {
    return false;
  }

  const client = new Client(rendererUrl);

  const result = await callAction(client, 'AVTransport', 'Stop');

  return result !== false;
}

const pause = async () => {
  const rendererUrl = await searchDeviceFromCache();

  if (rendererUrl === false) {
    return false;
  }

  const client = new Client(rendererUrl);

  const result = await callAction(client, 'AVTransport', 'Pause');

  return result !== false;
}

const next = async () => {
  const rendererUrl = await searchDeviceFromCache();

  if (rendererUrl === false) {
    return false;
  }

  const client = new Client(rendererUrl);
  const result = await callAction(client, 'AVTransport', 'Next');

  return result !== false;
}

const previous = async () => {
  const rendererUrl = await searchDeviceFromCache();

  if (rendererUrl === false) {
    return false;
  }

  const client = new Client(rendererUrl);
  const result = await callAction(client, 'AVTransport', 'Previous');

  return result !== false;
}

const setVolume = async (volume) => {
  const rendererUrl = await searchDeviceFromCache();

  if (rendererUrl === false) {
    return false;
  }

  const client = new Client(rendererUrl);
  const result = await callAction(client, 'RenderingControl', 'SetVolume', { Channel: 'Master', DesiredVolume: volume });

  return result !== false;
}

const getVolume = async () => {
  const rendererUrl = await searchDeviceFromCache();

  if (rendererUrl === false) {
    return false;
  }

  const client = new Client(rendererUrl);

  const currentVolume = await callAction(client, 'RenderingControl', 'GetVolume');

  return currentVolume.CurrentVolume;
}

const setPlayMode = async (mode = 'SEQUENCE_PLAY') => {
  const rendererUrl = await searchDeviceFromCache();

  if (rendererUrl === false) {
    return false;
  }

  const client = new Client(rendererUrl);

  // SEQUENCE_PLAY, RANDOM_PLAY, SINGLE_CYCLE
  await callAction(client, 'AVTransport', 'SetPlayMode', { NewPlayMode: mode });
}

const safeJson = (text) => {
  if (!text || typeof text !== 'string') {
    return null;
  }

  try {
    return JSON.parse(text);
  }
  catch (e) {
    return null;
  }
};

const getDeviceInfo = async () => {
  const rendererUrl = await searchDeviceFromCache();

  if (rendererUrl === false) {
    return {
      device: {},
      power: -1
    };
  }

  const client = new Client(rendererUrl);

  const device = await callAction(client, 'AVTransport', 'GetDeviceInfo');
  const power = await callAction(client, 'AVTransport', 'GetPowerStatus');

  // 两个都失败说明设备确实不可用（换过端口/正在重启），丢掉缓存重新发现再试一次
  if (device === false && power === false) {
    invalidateDeviceCache();

    const retryUrl = await searchDeviceFromCache({ force: true });

    if (retryUrl === false) {
      return {
        device: {},
        power: -1
      };
    }

    const retryClient = new Client(retryUrl);
    const retryDevice = await callAction(retryClient, 'AVTransport', 'GetDeviceInfo');
    const retryPower = await callAction(retryClient, 'AVTransport', 'GetPowerStatus');

    return {
      device: safeJson(retryDevice?.DeviceInfo) ?? {},
      power: retryPower === false ? -1 : Number(retryPower?.PowerStatus)
    };
  }

  return {
    device: safeJson(device?.DeviceInfo) ?? {},
    power: power === false ? -1 : Number(power?.PowerStatus)
  };
}

const getPlayInfo = async () => {
  const rendererUrl = await searchDeviceFromCache();

  if (rendererUrl === false) {
    return {
      transportSettings: {},
      volume: -1
    };
  }

  const client = new Client(rendererUrl);

  // FavouriteFindout, GetMediaInfo, GetTransportInfo, GetPositionInfo, GetPlaylistInfo
  const transportSettings = await callAction(client, 'AVTransport', 'GetTransportSettings');
  const currentVolume = await callAction(client, 'RenderingControl', 'GetVolume');

  return {
    transportSettings: transportSettings === false ? {} : transportSettings,
    volume: currentVolume === false ? -1 : Number(currentVolume.CurrentVolume)
  };
}

// 关机
// time = 0 为立即关机
// time = 999 为重启
const shutdown = async (time = 0) => {
  const rendererUrl = await searchDeviceFromCache();

  if (rendererUrl === false) {
    return false;
  }

  const client = new Client(rendererUrl);

  await callAction(client, 'AVTransport', 'TimingShutdown', { TimeOuts: time });
}

// ---------------------------------------------------------------------------
// 设备管理
//
// 与 app 的 JNI 包装一一对应（com.android.dream.libdream，见 docs/geak-protocol.md §5）：
//   CtrlPoint*  → 控制点类（传输/音量/收藏/闹钟/时间/WiFi/账号/扩展接口）
//   GEAKDevice* → 设备管理（内置播放列表的增删查）
// 带 JSON 的参数（PlaylistInfo、TracksMetaData、AccountInfo、扩展接口参数）按 app 的做法
// 由调用方组装后原样透传，这里不改写内容。
//
// ⚠️ 参数格式必须与 app 一致，否则可能把设备的 UPnP 服务打挂（实测：给
// GetExtraInterface 传裸数字 "0" 就导致整个 UPnP 服务停止应答，只能断电重启）。
// ---------------------------------------------------------------------------

// 丢弃缓存的设备地址。实测写动作（Rename、闹钟等）会让 UPnP 服务重启、端口可能变化，
// 而**旧端口有时仍能取到 renderer.xml**（所以只校验描述文件不够），必须丢缓存重新发现。
const invalidateDeviceCache = () => {
  serviceCache.clear();

  try {
    fs.unlinkSync(devicePath);
  }
  catch (e) {
  }
};

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// 所有动作的统一入口。
// 动作失败时（含"缓存地址是过期端口""设备正在重启约 10–13 秒"这两种实测情形）：
// 丢弃缓存 → 重新发现 → 再试一次。
// 非幂等的写动作（建闹钟 / 收藏当前曲 / 往内置列表加歌 / 把当前曲加入列表）传 { retry: false }，
// 否则重试会重复执行。
const withDevice = async (handler, options = {}) => {
  const retry = options.retry !== false;

  for (let attempt = 0; attempt < (retry ? 2 : 1); attempt++) {
    const rendererUrl = await searchDeviceFromCache({ force: attempt > 0 });

    if (rendererUrl === false) {
      return false;
    }

    let result;

    try {
      result = await handler(new Client(rendererUrl));
    }
    catch (error) {
      // 有些方法底层失败时会抛（例如拿 undefined 去 JSON.parse）；按失败处理，走重试
      console.error(`动作抛错（按失败处理）：${error?.message ?? error}`);
      result = false;
    }

    if (result !== false) {
      return result;
    }

    if (attempt === 0 && retry) {
      invalidateDeviceCache();
      await delay(1500);
      console.log('动作失败：已丢弃设备地址缓存，重新发现后重试一次');
    }
  }

  return false;
};

// ---- 收藏（设备侧“我的收藏”）----
// Record 会往收藏里加条目：非幂等，失败不重试
const record = () => withDevice(client => callAction(client, 'AVTransport', 'Record'), { retry: false });
const getFavouriteList = () => withDevice(client => callAction(client, 'AVTransport', 'GetFavouriteList'));
const favouriteFindout = () => withDevice(client => callAction(client, 'AVTransport', 'FavouriteFindout'));
const favouriteDelete = title => withDevice(client => callAction(client, 'AVTransport', 'FavouriteDelete', { Title: title }));

// ---- 内置播放列表（按键 1 / 我的收藏 / 喜马拉雅等）----
const getInterList = (index = 0) => withDevice(client => callAction(client, 'AVTransport', 'GetInterList', { Index: index }));
const getPlayListCount = (index = 0) => withDevice(client => callAction(client, 'AVTransport', 'GetPlayListCount', { Index: index }));
// InterListAdd 会往内置列表加条目：非幂等，失败不重试
const interListAdd = (index, tracksMetaData) => withDevice(client => callAction(client, 'AVTransport', 'InterListAdd', { Index: index, TracksMetaData: tracksMetaData }), { retry: false });
const interListDelete = (index, title) => withDevice(client => callAction(client, 'AVTransport', 'InterListDelete', { Index: index, Title: title }));
const playListItem = (index, playlistIndex) => withDevice(client => callAction(client, 'AVTransport', 'PlayListItem', { Index: index, PlayListIndex: playlistIndex }));
// AddPlayList 会改列表内容：非幂等，失败不重试
const addPlayList = index => withDevice(client => callAction(client, 'AVTransport', 'AddPlayList', { Index: index }), { retry: false });
const getPlaylistInfo = () => withDevice(client => callAction(client, 'AVTransport', 'GetPlaylistInfo'));
const setPlaylistInfo = playlistInfo => withDevice(client => callAction(client, 'AVTransport', 'SetPlaylistInfo', { PlaylistInfo: playlistInfo }));

// ---- 闹钟 ----
// alarm: { StartTime, StartDate, Recurrence(0-5), Enabled("0"/"1"), ProgramURI, Volume, UrlType }
// app 侧 CreateAlarm 的 ProgramURI 传的是 "标题|节目URI"，默认 "default_clock_tone"
const listAlarms = () => withDevice(client => callAction(client, 'AVTransport', 'ListAlarms'));
// CreateAlarm 非幂等（重试会建出重复闹钟）；且实测设备可能返回失败但其实已建好，调用方要以 ListAlarms 复核
const createAlarm = alarm => withDevice(client => callAction(client, 'AVTransport', 'CreateAlarm', { ...alarm }), { retry: false });
const updateAlarm = (id, alarm) => withDevice(client => callAction(client, 'AVTransport', 'UpdateAlarm', { ID: id, ...alarm }));
const destroyAlarm = id => withDevice(client => callAction(client, 'AVTransport', 'DestroyAlarm', { ID: id }));
const enableAlarm = (id, enable) => withDevice(client => callAction(client, 'AVTransport', 'EnableAlarm', { ID: id, Enable: enable }));

// ---- 时间 / 时区 / 网络时间 ----
const getTimeZone = () => withDevice(client => callAction(client, 'AVTransport', 'GetTimeZone'));
const setTimeZone = (index, currentTimeZone) => withDevice(client => callAction(client, 'AVTransport', 'SetTimeZone', { Index: index, CurrentTimeZone: currentTimeZone }));
const getTimeNow = () => withDevice(client => callAction(client, 'AVTransport', 'GetTimeNow'));
const setTimeNow = desiredTime => withDevice(client => callAction(client, 'AVTransport', 'SetTimeNow', { DesiredTime: desiredTime }));
const getInternetTime = () => withDevice(client => callAction(client, 'AVTransport', 'GetInternetTime'));
const enableInternetTime = enable => withDevice(client => callAction(client, 'AVTransport', 'EnableInternetTime', { Enable: enable }));

// ---- 定时关机 / 按键锁 ----
const getTiming = () => withDevice(client => callAction(client, 'AVTransport', 'GetTiming'));
const getHoldStatus = () => withDevice(client => callAction(client, 'AVTransport', 'GetHoldStatus'));
const holdButton = enable => withDevice(client => callAction(client, 'AVTransport', 'HoldButton', { Enable: enable }));

// ---- 设备改名 ----
const rename = newName => withDevice(client => callAction(client, 'AVTransport', 'Rename', { NewName: newName }));

// ---- WiFi ----
const getWifiList = () => withDevice(client => callAction(client, 'AVTransport', 'GetWIFilist'));
const getWifiInfo = () => withDevice(client => callAction(client, 'AVTransport', 'GetWIFinfo'));

// ⚠️ 会把设备切到指定 SSID/密码，可能让它从局域网消失（app 的 CtrlPointSetNetwork）。
// 除非明确知道自己在做什么，否则不要调用。
const setNetwork = (ssid, key, authAlgo, cipherAlgo) => withDevice(client => callAction(client, 'AVTransport', 'SetNetwork', {
  SSID: ssid,
  Key: key,
  AuthAlgo: authAlgo,
  CipherAlgo: cipherAlgo
}));

// ---- 账号 / 扩展接口 ----
const getAccountInfo = () => withDevice(client => callAction(client, 'AVTransport', 'GetAccountInfo'));
const setAccountInfo = accountInfo => withDevice(client => callAction(client, 'AVTransport', 'SetAccountInfo', { AccountInfo: accountInfo }));

// actionType 必须是 app 的 actionTypeJson 格式：{"ActionType":{"action_type":N}}（N 见 app 各页面的用法）
const getExtraInterface = actionType => withDevice(client => callAction(client, 'AVTransport', 'GetExtraInterface', { ActionType: actionType }));
const setExtraInterface = parameter => withDevice(client => callAction(client, 'AVTransport', 'SetExtraInterface', { Paramater: parameter }));

// ---- 传输与进度（界面状态用）----
const seek = (target, unit = 'REL_TIME') => withDevice(client => callAction(client, 'AVTransport', 'Seek', { Unit: unit, Target: target }));
const getMediaInfo = () => withDevice(client => callAction(client, 'AVTransport', 'GetMediaInfo'));
const getPositionInfo = () => withDevice(client => callAction(client, 'AVTransport', 'GetPositionInfo'));
const getTransportInfo = () => withDevice(client => callAction(client, 'AVTransport', 'GetTransportInfo'));
const getCurrentTransportActions = () => withDevice(client => callAction(client, 'AVTransport', 'GetCurrentTransportActions'));

export default {
  searchDevice,
  searchDeviceFromCache,
  stopSearchDevice,
  pushPlaylist,
  play,
  stop,
  pause,
  previous,
  next,
  setVolume,
  getVolume,
  setPlayMode,
  getDeviceInfo,
  getPlayInfo,
  shutdown,
  record,
  getFavouriteList,
  favouriteFindout,
  favouriteDelete,
  getInterList,
  getPlayListCount,
  interListAdd,
  interListDelete,
  playListItem,
  addPlayList,
  getPlaylistInfo,
  setPlaylistInfo,
  listAlarms,
  createAlarm,
  updateAlarm,
  destroyAlarm,
  enableAlarm,
  getTimeZone,
  setTimeZone,
  getTimeNow,
  setTimeNow,
  getInternetTime,
  enableInternetTime,
  getTiming,
  getHoldStatus,
  holdButton,
  rename,
  getWifiList,
  getWifiInfo,
  setNetwork,
  getAccountInfo,
  setAccountInfo,
  getExtraInterface,
  setExtraInterface,
  seek,
  getMediaInfo,
  getPositionInfo,
  getTransportInfo,
  getCurrentTransportActions
};
