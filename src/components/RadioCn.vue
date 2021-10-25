<template>
  <div class="radio-cn">
    <div class="selector">
      <div class="selector-item">
        地区：
        <el-select v-model="selectorAreaValue" @change="changeSelector">
          <el-option v-for="item in selectorArea" :key="item.id" :label="item.name" :value="item.id"></el-option>
        </el-select>
      </div>
      <div class="selector-item">
        分类：
        <el-select v-model="selectorTypeValue" @change="changeSelector">
          <el-option label="全部" value=""></el-option>
          <el-option v-for="item in selectorType" :key="item.id" :label="item.name" :value="item.id"></el-option>
        </el-select>
      </div>
    </div>

    <el-table :data="channels" border style="width: 100%" class="table">
      <el-table-column prop="name" label="频道" width="180" />
      <el-table-column prop="description" label="描述" />
      <el-table-column label="操作" width="220">
        <template #default="scope">
          <el-button @click="pushLivePlaylist(scope.row.id)" size="mini">推送直播</el-button>
          <el-button @click="pushPlaybackPlaylist(scope.row.id)" size="mini">推送昨日回放</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script>
import axios from 'axios';
import jsonpAdapter from 'axios-jsonp';
import dayjs from 'dayjs';

export default {
  name: 'RadioCn',

  data() {
    return {
      channels: [],
      detail: {},
      selectorAreaValue: '3225',
      selectorTypeValue: '',
      selectorArea: [],
      selectorType: []
    }
  },

  created() {
    this.refresh();
  },

  mounted() {
  },

  methods: {
    async refresh() {
      const url = 'http://tacc.radio.cn/pcpages/radiopages';

      const result = await axios.get(url, {
        adapter: jsonpAdapter,
        params: {
          place_id: this.selectorAreaValue,
          type_id: this.selectorTypeValue
        },
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.117 Safari/537.36' }
      });

      if (result.data.result_code == 0) {
        this.detail = result.data.data;
        this.channels = this.detail.top;
        this.selectorArea = this.detail.place;
        this.selectorType = this.detail.type;
      }
    },

    changeSelector() {
      this.refresh();
    },

    async pushPlaybackPlaylist(channelId) {
      console.log('正在下载云听电台...');

      const yesterday = dayjs().subtract(1, 'days').format('YYYY-MM-DD');
      const url = `http://tacc.radio.cn/pcpages/liveSchedules`;

      const result = await axios.get(url, {
        adapter: jsonpAdapter,
        params: {
          date: yesterday,
          channel_id: channelId
        },
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

      this.pushPlaylist({
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
      this.$emit('push-playlist', playlistData);
    }
  }
}
</script>

<style lang="scss" scoped>
.radio-cn {
  .selector {
    .selector-item {
      display: inline-block;

      + .selector-item {
        margin-left: 20px;
      }
    }
  }

  .table {
    margin-top: 10px;
    margin-bottom: 10px;
  }
}
</style>
