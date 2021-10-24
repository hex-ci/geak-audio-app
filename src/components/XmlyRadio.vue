<template>
  <div class="xmly-radio" v-loading="loading">
    <div class="selector">
      <div class="selector-item">
        地区：
        <el-select v-model="selectorAreaValue" @change="changeSelector">
          <el-option v-for="item in selectorArea" :key="`${item.id}-${item.type}`" :label="item.name" :value="`${item.id}-${item.type}`"></el-option>
        </el-select>
      </div>
      <div class="selector-item">
        分类：
        <el-select v-model="selectorTypeValue" @change="changeSelector">
          <el-option v-for="item in selectorType" :key="item.id" :label="item.name" :value="item.id"></el-option>
        </el-select>
      </div>
      <div class="selector-item">
        <el-button type="primary" @click="refresh()">刷新</el-button>
      </div>
    </div>

    <el-table :data="channels" border style="width: 100%" class="table">
      <el-table-column prop="name" label="频道" />
      <el-table-column prop="programName" label="当前节目" />
      <el-table-column label="操作" width="100">
        <template #default="scope">
          <el-button @click="pushLivePlaylist(scope.row.id)" size="mini">推送</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination layout="prev, pager, next" :page-size="pageSize" :total="pageTotal" @current-change="changePage"></el-pagination>
  </div>
</template>

<script>
import request from '../lib/request';

const ipcRenderer = window.$ipcRenderer;

export default {
  name: 'XmlyRadio',

  data() {
    return {
      channels: [],
      detail: {},
      selectorAreaValue: '0-0',
      selectorTypeValue: 0,
      selectorArea: [],
      selectorType: [],
      pageTotal: 0,
      pageSize: 30,
      loading: false
    }
  },

  created() {
    this.getDetail();
    this.refresh();
  },

  methods: {
    async getDetail() {
      const url = 'https://mobile.ximalaya.com/radio-first-page-app/homePage';

      const result = await request(url);

      if (result.data.ret == 0) {
        this.detail = result.data.data;
        this.selectorArea = this.detail.modules[2].locations;
        this.selectorType = this.detail.modules[2].categories;
      }
    },

    async refresh(page = 1) {
      const value = this.selectorAreaValue.split('-');
      const url = 'https://mobile.ximalaya.com/radio-first-page-app/search';

      this.loading = true;
      const result = await request(url, {
        params: {
          locationId: value[0],
          locationTypeId: value[1],
          categoryId: this.selectorTypeValue,
          pageNum: page,
          pageSize: this.pageSize
        }
      });
      this.loading = false;

      if (result.data.ret == 0) {
        this.pageTotal = result.data.data.total;
        this.channels = result.data.data.radios;
      }
    },

    changeSelector() {
      this.refresh();
    },

    changePage(page) {
      this.refresh(page);
    },

    pushLivePlaylist(channelId) {
      const channelDetail = this.channels.find(item => item.id == channelId);

      this.pushPlaylist({
        TracksMetaData: [{
          type: 2,
          uuid: '',
          metadata: '',
          url: `ffmpeg://${channelDetail.playUrl.aac64}`,
          title: channelDetail.name
        }]
      });
    },

    pushPlaylist(playlistData) {
      this.$emit('loading');
      ipcRenderer.send('push-playlist', playlistData);
    }
  }
}
</script>

<style lang="scss" scoped>
.xmly-radio {
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
