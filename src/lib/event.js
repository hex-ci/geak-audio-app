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

  // 推送播放列表（mode 是界面当前播放模式，决定 geakmusic:// 里的循环模式）
  ipcMain.handle('push-playlist', async (event, playlistData, local = false, mode = 'SEQUENCE_PLAY') => {
    const result = await device.pushPlaylist(playlistData, local, {}, mode);
    return result !== false;
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

  // ---------------------------------------------------------------------------
  // 设备管理：与 app 的设备管理能力一一对应（见 docs/geak-protocol.md §5）
  //
  // 注意：device.js 里的 getWifiInfo / getAccountInfo **故意不暴露给渲染进程**——
  // 这两个接口会明文返回 WiFi 密码与账号凭据（邮箱/密码/token），不该进界面层。
  // ---------------------------------------------------------------------------

  // 收藏（设备侧“我的收藏”）
  ipcMain.handle('record-favourite', async () => device.record());
  ipcMain.handle('get-favourite-list', async () => device.getFavouriteList());
  ipcMain.handle('favourite-findout', async () => device.favouriteFindout());
  ipcMain.handle('favourite-delete', async (event, title) => device.favouriteDelete(title));

  // 内置播放列表（按键 1..6 / 我的收藏等）
  ipcMain.handle('get-inter-list', async (event, index = 0) => device.getInterList(index));
  ipcMain.handle('get-play-list-count', async (event, index = 0) => device.getPlayListCount(index));
  ipcMain.handle('inter-list-add', async (event, index, tracksMetaData) => device.interListAdd(index, tracksMetaData));
  ipcMain.handle('inter-list-delete', async (event, index, title) => device.interListDelete(index, title));
  ipcMain.handle('play-list-item', async (event, index, playlistIndex) => device.playListItem(index, playlistIndex));
  ipcMain.handle('add-play-list', async (event, index) => device.addPlayList(index));
  ipcMain.handle('get-playlist-info', async () => device.getPlaylistInfo());
  ipcMain.handle('set-playlist-info', async (event, playlistInfo) => device.setPlaylistInfo(playlistInfo));

  // 闹钟
  ipcMain.handle('list-alarms', async () => device.listAlarms());
  ipcMain.handle('create-alarm', async (event, alarm) => device.createAlarm(alarm));
  ipcMain.handle('update-alarm', async (event, id, alarm) => device.updateAlarm(id, alarm));
  ipcMain.handle('destroy-alarm', async (event, id) => device.destroyAlarm(id));
  ipcMain.handle('enable-alarm', async (event, id, enable) => device.enableAlarm(id, enable));

  // 时间 / 时区 / 网络时间
  ipcMain.handle('get-time-zone', async () => device.getTimeZone());
  ipcMain.handle('set-time-zone', async (event, index, currentTimeZone) => device.setTimeZone(index, currentTimeZone));
  ipcMain.handle('get-time-now', async () => device.getTimeNow());
  ipcMain.handle('set-time-now', async (event, desiredTime) => device.setTimeNow(desiredTime));
  ipcMain.handle('get-internet-time', async () => device.getInternetTime());
  ipcMain.handle('enable-internet-time', async (event, enable) => device.enableInternetTime(enable));

  // 定时关机 / 按键锁
  ipcMain.handle('get-timing', async () => device.getTiming());
  ipcMain.handle('set-timing-shutdown', async (event, timeouts) => device.shutdown(timeouts));
  ipcMain.handle('get-hold-status', async () => device.getHoldStatus());
  ipcMain.handle('hold-button', async (event, enable) => device.holdButton(enable));

  // 设备改名
  ipcMain.handle('rename-device', async (event, newName) => device.rename(newName));

  // WiFi（只读：只给 SSID/信号，不给密码——密码接口未暴露）
  ipcMain.handle('get-wifi-list', async () => device.getWifiList());

  // 扩展接口（参数必须是 {"ActionType":{"action_type":N}} 这种 JSON，见文档）
  ipcMain.handle('get-extra-interface', async (event, actionType) => device.getExtraInterface(actionType));
  ipcMain.handle('set-extra-interface', async (event, parameter) => device.setExtraInterface(parameter));

  // 传输/进度（界面状态用）
  ipcMain.handle('seek', async (event, target, unit = 'REL_TIME') => device.seek(target, unit));
  ipcMain.handle('get-media-info', async () => device.getMediaInfo());
  ipcMain.handle('get-position-info', async () => device.getPositionInfo());
  ipcMain.handle('get-transport-info', async () => device.getTransportInfo());
  ipcMain.handle('get-current-transport-actions', async () => device.getCurrentTransportActions());
};

export {
  install
};
