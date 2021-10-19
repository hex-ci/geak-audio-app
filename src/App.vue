<template>
  <div class="app">
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
      channels: []
    }
  },

  mounted() {
    ipcRenderer.on('push-playlist-ok', () => {
      this.loading?.close();
      this.$message('推送完成');
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
      this.loading = this.$loading({
        lock: true,
        text: '正在搜索设备并推送，最多可能需要等几分钟，请稍候',
        spinner: 'el-icon-loading',
        background: 'rgba(255, 255, 255, 1)'
      });

      ipcRenderer.send('push-playlist', playlistData);
    }
  }
}
</script>

<style lang="scss" scoped>
.app {
  margin-left: 10px;
  margin-right: 10px;
}
</style>
