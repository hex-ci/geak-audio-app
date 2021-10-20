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
        <el-table :data="channels" border style="width: 100%">
          <el-table-column prop="name" label="频道" width="180" />
          <el-table-column prop="description" label="描述" />
          <el-table-column label="操作" width="220">
            <template #default="scope">
              <el-button @click="pushLivePlaylist(scope.row.id)" size="mini">推送直播</el-button>
              <el-button @click="pushPlaybackPlaylist(scope.row.id)" size="mini">推送昨日回放</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script>
import axios from 'axios';
import jsonpAdapter from 'axios-jsonp';
import dayjs from 'dayjs';

const ipcRenderer = window.$ipcRenderer;

export default {
  name: 'App',

  data() {
    return {
      fullscreenLoading: false,
      activeSite: 'radio-cn',
      loading: null,
      channels: [],
      volume: 20
    }
  },

  mounted() {
    ipcRenderer.removeAllListeners();
    ipcRenderer.on('reply-message', (message) => {
      this.loading?.close();
      this.$notify({ title: message });
    });

    this.refresh();
  },

  methods: {
    async refresh() {
      const radioCnPageUrl = `http://tacc.radio.cn/pcpages/radiopages`;

      const result = await axios.get(radioCnPageUrl, {
        adapter: jsonpAdapter,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.117 Safari/537.36' }
      });

      this.channels = result.data.data.channel;
    },

    setLoading() {
      this.loading = this.$loading({
        lock: true,
        text: '正在搜索并操作设备，最多可能需要几分钟，请稍候',
        spinner: 'el-icon-loading',
        background: 'rgba(255, 255, 255, 1)'
      });
    },

    async pushPlaybackPlaylist(channelId) {
      console.log('\n正在下载云听电台...');

      const yesterday = dayjs().subtract(1, 'days').format('YYYY-MM-DD');
      const radioCnChannelUrl = `http://tacc.radio.cn/pcpages/liveSchedules?date=${yesterday}&channel_id=${channelId}`;

      const result = await axios.get(radioCnChannelUrl, {
        adapter: jsonpAdapter,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.117 Safari/537.36' }
      });

      console.log('下载完成！正在生成播放列表...');

      const playlistData = { TracksMetaData: [] };

      result.data.data.program.forEach((item) => {
        if (!item.stream) {
          return;
        }

        playlistData.TracksMetaData.push({
          type: 2,
          uuid: '',
          metadata: '',
          url: item.stream[0].url,
          title: item.programName
        });
      });

      this.pushPlaylist(playlistData);
    },

    pushLivePlaylist(channelId) {
      const channelDetail = this.channels.find(item => item.id == channelId);

      this.pushPlaylist( {
        TracksMetaData: [{
          type: 2,
          uuid: '',
          metadata: '',
          url: `ffmpeg://${channelDetail.streams[0].url}`,
          title: channelDetail.name
        }]
      });
    },

    pushPlaylist(playlistData) {
      this.setLoading();
      ipcRenderer.send('push-playlist', playlistData);
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
}
</style>
