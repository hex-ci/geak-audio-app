<template>
  <div class="radio-cn">
    <div class="selector">
      <div class="selector-item">
        地区：
        <el-select v-model="selectorAreaValue" @change="changeSelector">
          <el-option v-for="item in selectorArea" :key="item.provinceCode" :label="item.provinceName" :value="item.provinceCode"></el-option>
        </el-select>
      </div>
      <div class="selector-item">
        分类：
        <el-select v-model="selectorTypeValue" @change="changeSelector">
          <el-option v-for="item in selectorType" :key="item.id" :label="item.categoryName" :value="item.id"></el-option>
        </el-select>
      </div>
    </div>

    <el-table :data="channels" border style="width: 100%" class="table">
      <el-table-column prop="title" label="频道" width="300" />
      <el-table-column prop="subtitle" label="当前节目" />
      <el-table-column label="操作" width="180">
        <template #default="scope">
          <el-button @click="pushLivePlaylist(scope.row.contentId)" type="primary" size="mini">推送直播</el-button>
          <!-- <el-button @click="pushPlaybackPlaylist(scope.row.contentId)" size="mini">推送昨日回放</el-button> -->
          <el-button @click="favorite(scope.row.contentId, scope.row.title)" size="mini">收藏</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script>
import axios from 'axios';
// import dayjs from 'dayjs';
import md5 from '../lib/md5';

const key = 'f0fc4c668392f9f9a447e48584c214ee';

const getParamsOrderByKey = (params) => {
  let sortArr = Object.keys(params).sort();
  let sortParams = [];
  let tmpKey = '';

  if (sortArr.length) {
    for (let i = 0; i < sortArr.length; i++) {
      tmpKey = sortArr[i];
      sortParams.push(tmpKey + '=' + params[tmpKey]);
    }
  }

  return sortParams.join('&');
}

export default {
  name: 'RadioCn',

  data() {
    return {
      channels: [],
      detail: {},
      selectorAreaValue: 0,
      selectorTypeValue: '0',
      selectorArea: [],
      selectorType: [],
    }
  },

  created() {
    this.refresh();
  },

  methods: {
    async refresh() {
      this.getRadioProvinceList();
      this.getRadioCategoryList();
      this.channels = await this.getRadioList(this.selectorAreaValue, this.selectorTypeValue);
    },

    async request(url, opts = {}) {
      var tm = new Date().getTime();
      var signText = (opts.params ? (getParamsOrderByKey(opts.params) + '&') : '') + 'timestamp=' + tm + '&key=' + key;

      return await axios.get(url, {
        headers: {
          'Content-Type': 'application/json',
          equipmentId: '0000',
          platformCode: 'WEB',
          timestamp: tm,
          sign: md5(signText),
        },
        ...opts,
      });
    },

    async getRadioProvinceList() {
      const result = await this.request('https://ytmsout.radio.cn/web/appProvince/list/all');

      if (result.data.code == 0) {
        this.selectorArea = result.data.data;
      }
    },

    async getRadioCategoryList() {
      const result = await this.request('https://ytmsout.radio.cn/web/appCategory/list/all');

      if (result.data.code == 0) {
        this.selectorType = result.data.data;
      }
    },

    async getRadioList(areaId, typeId) {
      const result = await this.request('https://ytmsout.radio.cn/web/appBroadcast/list', {
        params: {
          provinceCode: areaId,
          categoryId: typeId,
        },
      });

      if (result.data.code == 0) {
        return result.data.data;
      }
      else {
        return [];
      }
    },

    changeSelector() {
      this.refresh();
    },

    // async pushPlaybackPlaylist(channelId) {
    //   console.log('正在下载云听电台...');

    //   const yesterday = dayjs().subtract(1, 'days').format('YYYY-MM-DD');

    //   const result = await this.request('https://ytmsout.radio.cn/web/appProgram/listByDate', {
    //     params: {
    //       date: yesterday,
    //       broadcastId: channelId,
    //     },
    //   });

    //   if (result.data.code == 0) {
    //     console.log('下载完成！正在生成播放列表...');

    //     const playlistData = { TracksMetaData: [] };

    //     result.data.data.forEach((item) => {
    //       if (!item.downloadUrl) {
    //         return;
    //       }

    //       playlistData.TracksMetaData.push({
    //         type: 2,
    //         uuid: '',
    //         metadata: '',
    //         url: `${item.downloadUrl}`,
    //         title: item.programName,
    //       });
    //     });

    //     this.pushPlaylist(playlistData);
    //   }
    // },

    pushLivePlaylist(channelId) {
      const channelDetail = this.channels.find(item => item.contentId == channelId);

      this.pushPlaylist({
        TracksMetaData: [{
          type: 2,
          uuid: '',
          metadata: '',
          url: `ffmpeg://${channelDetail.playUrlLow}`,
          title: channelDetail.title
        }]
      });
    },

    pushPlaylist(playlistData) {
      this.$emit('push-playlist', playlistData);
    },

    favorite(id, title) {
      this.$emit('add-favorite', {
        name: 'radio-cn',
        category: '云听电台',
        id,
        title,
        extra: {
          placeId: this.selectorAreaValue,
          typeId: this.selectorTypeValue
        }
      });
    },

    // 收藏夹推送
    async favoritePush(favoriteData) {
      const channels = await this.getRadioList(favoriteData.extra.placeId, favoriteData.extra.typeId);
      const channelDetail = channels.find(item => item.contentId == favoriteData.id);

      this.pushPlaylist({
        TracksMetaData: [{
          type: 2,
          uuid: '',
          metadata: '',
          url: `ffmpeg://${channelDetail.playUrlLow}`,
          title: channelDetail.title
        }]
      });
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
