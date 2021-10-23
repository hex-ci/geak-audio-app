<template>
  <div class="app">
    <div class="player">
      <el-button size="small" @click="play">播放</el-button>
      <el-button size="small" @click="stop">停止</el-button>
      <el-button size="small" @click="pause">暂停</el-button>
      <el-button size="small" @click="previous">上一首</el-button>
      <el-button size="small" @click="next">下一首</el-button>
      <div class="volume">
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
    </el-tabs>
  </div>
</template>

<script>
import RadioCn from './components/RadioCn.vue';
import XmlyRadio from './components/XmlyRadio.vue';
import XmlyChannel from './components/XmlyChannel.vue';

const ipcRenderer = window.$ipcRenderer;

export default {
  name: 'App',

  components: {
    RadioCn,
    XmlyRadio,
    XmlyChannel
  },

  data() {
    return {
      fullscreenLoading: false,
      activeSite: 'radio-cn',
      loading: null,
      volume: 20,
    }
  },

  mounted() {
    ipcRenderer.removeAllListeners();
    ipcRenderer.on('reply-message', (message) => {
      this.loading?.close();
      this.$notify({ title: message });
    });
  },

  methods: {
    setLoading() {
      this.loading = this.$loading({
        lock: true,
        text: '正在搜索并操作设备，最多可能需要几分钟，请稍候',
        spinner: 'el-icon-loading',
        background: 'rgba(255, 255, 255, 1)'
      });
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
    }
  }
}
</script>

<style lang="scss" scoped>
.app {
  margin-left: 10px;
  margin-right: 10px;

  .player {
    margin-top: 10px;
    border: 1px solid #ebebeb;
    border-radius: 3px;
    padding: 20px 30px;
    display: flex;

    .volume {
      display: flex;
      flex-direction: row;
      flex-wrap: nowrap;
      justify-content: flex-start;
      align-content: stretch;
      align-items: center;
      margin-left: 10px;

      .el-slider {
        width: 200px;
        margin-left: 15px;
      }
    }
  }

  .selector {
    + .selector {
      margin-top: 5px;
    }
  }

  .table {
    margin-top: 10px;
  }
}
</style>
