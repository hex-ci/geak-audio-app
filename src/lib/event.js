import { ipcMain, BrowserWindow } from 'electron';
import axios from 'axios';
import device from './device';
import playlist from './playlist';
import favorite from './favorite';

const install = () => {

  // 发送请求
  ipcMain.handle('request', async (_, options) => {
    const result = await axios(options);
    return { data: result.data, status: result.status };
  });

  // 隐藏主窗口
  ipcMain.handle('hide-window', () => {
    const windows = BrowserWindow.getAllWindows();
    windows?.[0]?.hide();
  });

  // 获取当前平台
  ipcMain.handle('get-platform', () => process.platform);

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

  // 获取收藏夹
  ipcMain.handle('load-favorite', async () => {
    const result = await favorite.load();
    return result;
  });

  // 保存收藏夹
  ipcMain.handle('save-favorite', async (_, data) => {
    const result = await favorite.save(data);
    return result;
  });

  // 推送播放列表
  ipcMain.handle('push-playlist', async (event, playlistData, local = false) => {
    await device.pushPlaylist(playlistData, local);
    return true;
  });

  // 开始播放
  ipcMain.handle('play', async () => {
    await device.play();
    return true;
  });

  // 停止
  ipcMain.handle('stop', async () => {
    await device.stop();
    return true;
  });

  // 暂停
  ipcMain.handle('pause', async () => {
    await device.pause();
    return true;
  });

  // 上一首
  ipcMain.handle('previous', async () => {
    await device.previous();
    return true;
  });

  // 下一首
  ipcMain.handle('next', async () => {
    await device.next();
    return true;
  });

  // 设置音量
  ipcMain.handle('set-volume', async (event, volume) => {
    await device.setVolume(volume);
    return true;
  });

  // 设置播放模式
  ipcMain.handle('set-play-mode', async (event, mode) => {
    await device.setPlayMode(mode);
    return true;
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

  // 停止搜索设备
  ipcMain.handle('stop-search-device', () => {
    device.stopSearchDevice();
    return true;
  });

  // 关机或重启
  // time = 0 为立即关机
  // time = 999 为重启
  ipcMain.handle('shutdown', async (event, time = 0) => {
    await device.shutdown(time);
    return true;
  });
};

export {
  install
};
