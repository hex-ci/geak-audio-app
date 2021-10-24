import { ipcMain } from 'electron';
import axios from 'axios';
import device from './device';
import playlist from './playlist';

const install = () => {

  // 发送请求
  ipcMain.handle('request', async (_, options) => {
    const result = await axios(options);
    return { data: result.data, status: result.status };
  });

  // 获取本地播放列表
  ipcMain.handle('load-local-playlist', async () => {
    const result = await playlist.load();
    return result;
  });

  // 保存本地播放列表
  ipcMain.handle('save-local-playlist', async (_, data) => {
    const result = await playlist.save(data);
    return result;
  });

  // 推送播放列表
  ipcMain.on('push-playlist', async (event, playlistData, local = false) => {
    await device.pushPlaylist(playlistData, local);
    event.reply('reply-message', '推送完成');
  });

  // 开始播放
  ipcMain.on('play', async (event) => {
    await device.play();
    event.reply('reply-message', '操作完成');
  });

  // 停止
  ipcMain.on('stop', async (event) => {
    await device.stop();
    event.reply('reply-message', '操作完成');
  });

  // 暂停
  ipcMain.on('pause', async (event) => {
    await device.pause();
    event.reply('reply-message', '操作完成');
  });

  // 上一首
  ipcMain.on('previous', async (event) => {
    await device.previous();
    event.reply('reply-message', '操作完成');
  });

  // 下一首
  ipcMain.on('next', async (event) => {
    await device.next();
    event.reply('reply-message', '操作完成');
  });

  // 设置音量
  ipcMain.on('set-volume', async (event, volume) => {
    await device.setVolume(volume);
    event.reply('reply-message', '操作完成');
  });

  // 设置播放模式
  ipcMain.on('set-play-mode', async (event, mode) => {
    await device.setPlayMode(mode);
    event.reply('reply-message', '操作完成');
  });

  // 获取音响信息
  ipcMain.handle('get-device-info', async () => {
    const result = await device.getDeviceInfo();
    return result;
  });

  // 获取播放信息
  ipcMain.handle('get-play-info', async () => {
    const result = await device.getPlayInfo();
    return result;
  });
};

export {
  install
};
