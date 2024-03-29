<template>
  <div class="app">
    <div class="player">
      <el-button-group>
        <el-button size="small" @click="play">播放</el-button>
        <el-button size="small" @click="stop">停止</el-button>
        <el-button size="small" @click="pause">暂停</el-button>
        <el-button size="small" @click="previous">上一首</el-button>
        <el-button size="small" @click="next">下一首</el-button>
      </el-button-group>
      <el-button-group>
        <el-select v-model="mode" @change="changeMode" size="small">
          <el-option label="顺序播放" value="SEQUENCE_PLAY"></el-option>
          <el-option label="随机播放" value="RANDOM_PLAY"></el-option>
          <el-option label="单曲循环" value="SINGLE_CYCLE"></el-option>
        </el-select>
      </el-button-group>
      <el-button-group>
        <el-button size="small" @click="showInfo">查看音响信息</el-button>
        <el-button size="small" @click="minimize" v-if="platform === 'win32'">最小化到任务栏</el-button>
        <el-button size="small" @click="reboot">重启</el-button>
        <el-button size="small" @click="shutdown">关机</el-button>
      </el-button-group>
      <div class="player-item-outer">
        <div class="player-item">
          <el-button type="text" @click="mute">音量</el-button><el-slider v-model="volume" @change="changeVolume"></el-slider>
        </div>
      </div>
    </div>

    <el-tabs v-model="activeSite">
      <el-tab-pane label="云听电台" name="radio-cn">
        <radio-cn @push-playlist="pushPlaylist" @add-favorite="addFavorite" ref="radio-cn" />
      </el-tab-pane>

      <el-tab-pane label="喜马拉雅电台" name="xmly-radio">
        <xmly-radio @push-playlist="pushPlaylist" @add-favorite="addFavorite" ref="xmly-radio" />
      </el-tab-pane>

      <el-tab-pane label="喜马拉雅频道" name="xmly-channel">
        <xmly-channel @push-playlist="pushPlaylist" @add-favorite="addFavorite" ref="xmly-channel" />
      </el-tab-pane>

      <el-tab-pane label="本机播放列表" name="local-playlist">
        <local-playlist @push-playlist="pushPlaylist" />
      </el-tab-pane>

      <el-tab-pane label="收藏夹" name="my-favorite">
        <my-favorite @push-playlist="pushPlaylist" @favorite-push="favoritePush" ref="my-favorite" />
      </el-tab-pane>
    </el-tabs>

    <el-dialog
      title="音响信息"
      :visible.sync="infoDialogVisible"
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
        <el-button @click="infoDialogVisible = false">关闭</el-button>
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
import MyFavorite from './components/MyFavorite.vue';

const ipcRenderer = window.$ipcRenderer;

const loadingDelay = 800;

export default {
  name: 'App',

  components: {
    RadioCn,
    XmlyRadio,
    XmlyChannel,
    LocalPlaylist,
    MyFavorite
  },

  data() {
    return {
      fullscreenLoading: false,
      activeSite: 'radio-cn',
      loading: true,
      infoDialogVisible: false,
      volume: 20,
      oldVolume: 20,
      mode: 'SEQUENCE_PLAY',
      deviceInfo: {},
      platform: '',
      timer: null
    }
  },

  async created() {
    this.platform = await ipcRenderer.invoke('get-platform');
  },

  mounted() {
    this.getPlayInfo();
  },

  methods: {
    setLoading() {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.loading = true;
      }, loadingDelay);
    },

    unsetLoading() {
      this.timer = clearTimeout(this.timer);
      this.loading = false;
    },

    async invoke(name, ...args) {
      this.setLoading();
      const result = await ipcRenderer.invoke(name, ...args);
      this.unsetLoading();

      return result;
    },

    async pushPlaylist(playlistData, isLocal = false) {
      await this.invoke('push-playlist', playlistData, isLocal);
      this.$notify({ type: 'success', title: '推送完成', duration: 1000 });
    },

    play() {
      this.invoke('play');
    },

    stop() {
      this.invoke('stop');
    },

    pause() {
      this.invoke('pause');
    },

    previous() {
      this.invoke('previous');
    },

    next() {
      this.invoke('next');
    },

    setVolume(volume) {
      this.invoke('set-volume', volume);
    },

    changeVolume(volume) {
      this.oldVolume = volume;
      this.setVolume(volume);
    },

    changeMode(mode) {
      this.invoke('set-play-mode', mode);
    },

    mute() {
      if (this.volume > 0) {
        this.oldVolume = this.volume;
        this.volume = 0;
      }
      else {
        this.volume = this.oldVolume;
      }

      this.setVolume(this.volume);
    },

    async reboot() {
      try {
        await this.$confirm('继续吗?', '重启');
        await this.invoke('shutdown', 999);
        this.$notify({ type: 'success', title: '正在重启...', duration: 1000 });
      }
      catch (e) {
      }
    },

    async shutdown() {
      try {
        await this.$confirm('继续吗?', '关机');
        await this.invoke('shutdown');
        this.$notify({ type: 'success', title: '正在关机...', duration: 1000 });
      }
      catch (e) {
      }
    },

    async showInfo() {
      const result = await this.invoke('get-device-info');

      this.deviceInfo = result;

      this.infoDialogVisible = true;
    },

    async getPlayInfo() {
      const result = await this.invoke('get-play-info');

      this.mode = result.transportSettings.PlayMode ?? 'SEQUENCE_PLAY';
      this.volume = Number(result.volume < 0 ? 20 : result.volume);
      this.oldVolume = this.volume;
    },

    stopSearchDevice() {
      ipcRenderer.invoke('stop-search-device');
    },

    minimize() {
      ipcRenderer.invoke('hide-window');
    },

    addFavorite(favoriteData) {
      this.$refs['my-favorite'].addFavorite(favoriteData);
    },

    favoritePush(favoriteData) {
      this.$refs[favoriteData.name].favoritePush(favoriteData);
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
    align-items: center;

    .el-button-group {
      + .el-button-group {
        margin-left: 5px;
      }
    }

    .el-slider {
      width: 200px;
      margin-left: 15px;
    }

    .el-select {
      width: 120px;
    }

    .player-item-outer {
      flex: 1 auto;
      display: flex;
      justify-content: flex-end;

      .player-item {
        display: flex;
        flex-direction: row;
        flex-wrap: nowrap;
        justify-content: flex-start;
        align-content: stretch;
        align-items: center;
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
