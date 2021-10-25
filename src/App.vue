<template>
  <div class="app">
    <div class="player">
      <el-button size="small" @click="play">播放</el-button>
      <el-button size="small" @click="stop">停止</el-button>
      <el-button size="small" @click="pause">暂停</el-button>
      <el-button size="small" @click="previous">上一首</el-button>
      <el-button size="small" @click="next">下一首</el-button>
      <el-button size="small" @click="showInfo">查看音响信息</el-button>
      <div class="player-item">
        <span class="label">播放模式</span>
        <el-select v-model="mode" @change="changeMode">
          <el-option label="顺序播放" value="SEQUENCE_PLAY"></el-option>
          <el-option label="随机播放" value="RANDOM_PLAY"></el-option>
          <el-option label="单曲循环" value="SINGLE_CYCLE"></el-option>
        </el-select>
      </div>
      <div class="player-item">
        <span class="label">音量</span><el-slider v-model="volume" @change="setVolume"></el-slider>
      </div>
    </div>

    <el-tabs v-model="activeSite">
      <el-tab-pane label="云听电台" name="radio-cn">
        <radio-cn @loading="setLoading"></radio-cn>
      </el-tab-pane>

      <el-tab-pane label="喜马拉雅电台" name="xmly-radio">
        <xmly-radio @loading="setLoading"></xmly-radio>
      </el-tab-pane>

      <el-tab-pane label="喜马拉雅频道" name="xmly-channel">
        <xmly-channel @loading="setLoading"></xmly-channel>
      </el-tab-pane>

      <el-tab-pane label="本机播放列表" name="local-playlist">
        <local-playlist @loading="setLoading"></local-playlist>
      </el-tab-pane>
    </el-tabs>

    <el-dialog
      title="音响信息"
      :visible.sync="dialogVisible"
      width="600px"
    >
      <el-form ref="form" label-width="120px" v-if="deviceInfo.device">
        <el-form-item label="设备名称：">
          <span>{{ deviceInfo.device.DeviceName }}</span>
        </el-form-item>
        <el-form-item label="设备ID：">
          <span>{{ deviceInfo.device.deviceID }}</span>
        </el-form-item>
        <el-form-item label="固件版本号：">
          <span>{{ deviceInfo.device.externalSoftware }}</span>
        </el-form-item>
        <el-form-item label="硬件版本号：">
          <span>{{ deviceInfo.device.hardware }}</span>
        </el-form-item>
        <el-form-item label="设备IP：">
          <span>{{ deviceInfo.device.ipaddr }}</span>
        </el-form-item>
        <el-form-item label="设备Mac地址：">
          <span>{{ deviceInfo.device.macAddr }}</span>
        </el-form-item>
        <el-form-item label="剩余电量：">
          <span>{{ deviceInfo.power }}%</span>
        </el-form-item>
      </el-form>
      <span slot="footer" class="dialog-footer">
        <el-button @click="dialogVisible = false">关闭</el-button>
      </span>
    </el-dialog>

    <el-dialog
      title="搜索设备..."
      :visible.sync="loading"
      width="600px"
      :show-close="false"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
    >
      <p class="loading"><i class="el-icon-loading"></i> 正在搜索设备，可能需要几分钟，请稍候，如取消可能导致程序异常</p>
      <span slot="footer" class="dialog-footer">
        <el-button @click="stopSearchDevice">取消</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import RadioCn from './components/RadioCn.vue';
import XmlyRadio from './components/XmlyRadio.vue';
import XmlyChannel from './components/XmlyChannel.vue';
import LocalPlaylist from './components/LocalPlaylist.vue';

const ipcRenderer = window.$ipcRenderer;

export default {
  name: 'App',

  components: {
    RadioCn,
    XmlyRadio,
    XmlyChannel,
    LocalPlaylist
  },

  data() {
    return {
      fullscreenLoading: false,
      activeSite: 'radio-cn',
      loading: false,
      dialogVisible: false,
      volume: 20,
      mode: 'SEQUENCE_PLAY',
      deviceInfo: {}
    }
  },

  mounted() {
    ipcRenderer.removeAllListeners();
    ipcRenderer.on('reply-message', (message) => {
      this.unsetLoading();
      this.$notify({ title: message });
    });

    this.getPlayInfo();
  },

  methods: {
    setLoading() {
      this.loading = true;
    },

    unsetLoading() {
      this.loading = false;
    },

    play() {
      this.setLoading();
      ipcRenderer.send('play');
    },

    stop() {
      this.setLoading();
      ipcRenderer.send('stop');
    },

    pause() {
      this.setLoading();
      ipcRenderer.send('pause');
    },

    previous() {
      this.setLoading();
      ipcRenderer.send('previous');
    },

    next() {
      this.setLoading();
      ipcRenderer.send('next');
    },

    setVolume(volume) {
      this.setLoading();
      ipcRenderer.send('set-volume', volume);
    },

    changeMode(mode) {
      this.setLoading();
      ipcRenderer.send('set-play-mode', mode);
    },

    async showInfo() {
      this.setLoading();
      const result = await ipcRenderer.invoke('get-device-info');
      this.unsetLoading();

      this.deviceInfo = result;

      this.dialogVisible = true;
    },

    async getPlayInfo() {
      this.setLoading();
      const result = await ipcRenderer.invoke('get-play-info');
      this.unsetLoading();

      this.mode = result.transportSettings.PlayMode;
      this.volume = Number(result.volume);
    },

    stopSearchDevice() {
      ipcRenderer.invoke('stop-search-device');
    }
  }
}
</script>

<style lang="scss" scoped>
.app {
  margin-left: 10px;
  margin-right: 10px;
  margin-bottom: 10px;

  .player {
    margin-top: 10px;
    border: 1px solid #ebebeb;
    border-radius: 3px;
    padding: 20px 30px;
    display: flex;

    .player-item {
      display: flex;
      flex-direction: row;
      flex-wrap: nowrap;
      justify-content: flex-start;
      align-content: stretch;
      align-items: center;
      margin-left: 20px;

      .el-slider {
        width: 200px;
        margin-left: 15px;
      }

      .el-select {
        margin-left: 10px;
        width: 120px;
      }
    }
  }

  .selector {
    + .selector {
      margin-top: 5px;
    }
  }

  .loading {
    text-align: center;
  }
}
</style>
