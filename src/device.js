import fs from 'fs';
import os from 'os';
import path from 'path';
import Client from 'upnp-device-client';
import ssdp from '@achingbrain/ssdp';
import getPort from 'get-port';
import { Netmask } from 'netmask';
import express from 'express';
import axios from 'axios';

const devicePath = path.join(os.homedir(), '.geak-audio-device-cache.json');
const ipList = Object.values(os.networkInterfaces()).flat().filter(i => i.family == 'IPv4' && !i.internal);

const callAction = (client, type, method, params = {}) => {
  return new Promise((resolve) => {
    client.callAction(type, method, { InstanceID: 0, ...params }, function(err, result) {
      if (err) {
        resolve(false);
        return;
      }

      resolve(result);
    });
  });
}

const searchDevice = () => {
  return new Promise((resolve) => {
    console.log('开始搜索设备...');

    const bus = ssdp();

    bus.on('error', console.error);

    const usn = 'urn:schemas-upnp-org:device:MediaServer:1';

    bus.discover(usn);

    bus.on(`discover:${usn}`, service => {
      // console.log(service);

      if (service.UDN.indexOf('uuid:geakmusic') === 0) {
        bus.stop();

        console.log('搜索设备完成！');

        // 缓存设备地址
        fs.writeFileSync(devicePath, JSON.stringify(service));

        resolve(service);
      }
    });
  });
};

const searchDeviceFromCache = async () => {
  let device;

  try {
    device = JSON.parse(fs.readFileSync(devicePath).toString());
  }
  catch (e) {
  }

  if (!device?.details?.URLBase) {
    device = await searchDevice();
  }

  let rendererUrl = `${device.details.URLBase}renderer.xml`;

  // 测试设备地址
  try {
    await axios.get(rendererUrl);
  }
  catch (e) {
    device = null;
  }

  if (!device?.details?.URLBase) {
    device = await searchDevice();
  }

  return `${device.details.URLBase}renderer.xml`;
};

const startServer = async (port, playlistData) => {
  const app = express();
  let server;

  app.get('/playlist.json', (req, res) => {
    res.send(JSON.stringify(playlistData));
    setImmediate(() => {
      server.close();
    })
  });

  return new Promise((resolve) => {
    server = app.listen(port, () => {
      resolve(port);
    })
  })
};

const pushPlaylist = async (playlistData, mediaInfo = {}) => {
  const rendererUrl = await searchDeviceFromCache();

  // 确定 ip 和端口
  const parsedUrl = new URL(rendererUrl);
  const block = new Netmask(parsedUrl.hostname, '255.255.255.0');

  const ip = ipList.find(item => block.contains(item.address)).address;
  const port = await getPort();

  const playlistUrl = `http://${ip}:${port}/playlist.json`;
  const client = new Client(rendererUrl);

  console.log('开始推送播放列表...');

  await startServer(port, playlistData);

  const params = {
    InstanceID: 0,
    CurrentURI: `geakmusic://${mediaInfo.url ?? playlistData.TracksMetaData[0].url}|2|${playlistUrl}|`,
    CurrentURIMetaData: `<DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/">
<item id="0" parentID="-1" restricted="false">
<upnp:class>object.item.geakMusic</upnp:class>
<dc:title>${mediaInfo.title}</dc:title>
<dc:creator>Hex</dc:creator>
<upnp:artist>${mediaInfo.artist}</upnp:artist>
<upnp:album>${mediaInfo.album}</upnp:album>
<upnp:albumArtURI></upnp:albumArtURI>
<res protocolInfo="http-get:*:*:">${mediaInfo.url ?? playlistData.TracksMetaData[0].url}}</res>
</item></DIDL-Lite>`
  };

  await callAction(client, 'AVTransport', 'Stop');
  await callAction(client, 'AVTransport', 'SetAVTransportURI', params);
  await callAction(client, 'AVTransport', 'Play', { Speed: 1 });

  console.log('推送完成！');
};

const play = async () => {
  const rendererUrl = await searchDeviceFromCache();
  const client = new Client(rendererUrl);

  await callAction(client, 'AVTransport', 'Play', { Speed: 1 });
}

const stop = async () => {
  const rendererUrl = await searchDeviceFromCache();
  const client = new Client(rendererUrl);

  await callAction(client, 'AVTransport', 'Stop');
}

const pause = async () => {
  const rendererUrl = await searchDeviceFromCache();
  const client = new Client(rendererUrl);

  await callAction(client, 'AVTransport', 'Pause');
}

const next = async () => {
  const rendererUrl = await searchDeviceFromCache();
  const client = new Client(rendererUrl);

  await callAction(client, 'AVTransport', 'Next');
}

const previous = async () => {
  const rendererUrl = await searchDeviceFromCache();
  const client = new Client(rendererUrl);

  await callAction(client, 'AVTransport', 'Previous');
}

const setVolume = async (volume) => {
  const rendererUrl = await searchDeviceFromCache();
  const client = new Client(rendererUrl);

  await callAction(client, 'RenderingControl', 'SetVolume', { Channel: 'Master', DesiredVolume: volume });
}

const getVolume = async () => {
  const rendererUrl = await searchDeviceFromCache();
  const client = new Client(rendererUrl);

  const currentVolume = await callAction(client, 'RenderingControl', 'GetVolume');

  return currentVolume.CurrentVolume;
}

export default {
  searchDevice,
  searchDeviceFromCache,
  pushPlaylist,
  play,
  stop,
  pause,
  previous,
  next,
  setVolume,
  getVolume
}
