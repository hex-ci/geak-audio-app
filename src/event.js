import { ipcMain } from 'electron';
import device from './device';

const install = () => {

  // 推送播放列表
  ipcMain.on('push-playlist', async (event, playlistData) => {
    await device.pushPlaylist(playlistData);
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

};

export {
  install
};
