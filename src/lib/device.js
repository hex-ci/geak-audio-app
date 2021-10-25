import fs from 'fs';
import os from 'os';
import path from 'path';
import Client from 'upnp-device-client';
import ssdp from '@achingbrain/ssdp';
import { Netmask } from 'netmask';
import axios from 'axios';
import cloneDeep from 'lodash/cloneDeep';
import server from './server';

const devicePath = path.join(os.homedir(), '.geak-audio-device-cache.json');
const ipList = Object.values(os.networkInterfaces()).flat().filter(i => i.family == 'IPv4' && !i.internal);

let bus = null;

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

    const usn = 'urn:schemas-upnp-org:device:MediaServer:1';

    if (!bus) {
      bus = ssdp();

      bus.on('error', console.error);

      bus.on('ready', () => {
        Promise.all(
          bus.sockets.map(socket => {
            return new Promise((resolve) => {
              socket.on('close', () => resolve())
            })
          })
        ).then(() => {
          console.log('停止搜索设备！');
          if (bus.isCancel) {
            resolve(false);
          }
          bus = null;
        });
      });

      bus.on(`discover:${usn}`, service => {
        // console.log(service);

        if (service.UDN.indexOf('uuid:geakmusic') === 0) {
          try {
            bus.stop();
          }
          catch (e) {
          }

          console.log('搜索设备完成！');

          // 缓存设备地址
          fs.writeFileSync(devicePath, JSON.stringify(service));

          resolve(service);
        }
      });
    }

    bus.discover(usn);
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

  if (device !== false) {
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
  }

  if (device === false) {
    return false;
  }
  else {
    return `${device.details.URLBase}renderer.xml`;
  }
};

const stopSearchDevice = () => {
  if (bus) {
    bus.isCancel = true;
    bus.stop();
  }
};

const pushPlaylist = async (playlistData, local = false, mediaInfo = {}) => {
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

  if (rendererUrl === false) {
    return false;
  }

  const client = new Client(rendererUrl);

  await callAction(client, 'AVTransport', 'Play', { Speed: 1 });
}

const stop = async () => {
  const rendererUrl = await searchDeviceFromCache();

  if (rendererUrl === false) {
    return false;
  }

  const client = new Client(rendererUrl);

  await callAction(client, 'AVTransport', 'Stop');
}

const pause = async () => {
  const rendererUrl = await searchDeviceFromCache();

  if (rendererUrl === false) {
    return false;
  }

  const client = new Client(rendererUrl);

  await callAction(client, 'AVTransport', 'Pause');
}

const next = async () => {
  const rendererUrl = await searchDeviceFromCache();

  if (rendererUrl === false) {
    return false;
  }

  const client = new Client(rendererUrl);

  await callAction(client, 'AVTransport', 'Next');
}

const previous = async () => {
  const rendererUrl = await searchDeviceFromCache();

  if (rendererUrl === false) {
    return false;
  }

  const client = new Client(rendererUrl);

  await callAction(client, 'AVTransport', 'Previous');
}

const setVolume = async (volume) => {
  const rendererUrl = await searchDeviceFromCache();

  if (rendererUrl === false) {
    return false;
  }

  const client = new Client(rendererUrl);

  await callAction(client, 'RenderingControl', 'SetVolume', { Channel: 'Master', DesiredVolume: volume });
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

  return {
    device: JSON.parse(device?.DeviceInfo),
    power: power?.PowerStatus
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
    transportSettings,
    volume: currentVolume.CurrentVolume
  };
}

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
  getPlayInfo
};
