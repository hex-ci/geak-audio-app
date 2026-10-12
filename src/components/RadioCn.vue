<template>
  <div class="radio-cn" v-loading="loading" :element-loading-text="loadingText">
    <div class="selector">
      <div class="selector-item">
        <el-button-group>
          <el-button :type="mode === 'area' ? 'primary' : ''" @click="switchMode('area')">按地区浏览</el-button>
          <el-button :type="mode === 'search' ? 'primary' : ''" @click="switchMode('search')">搜索电台</el-button>
        </el-button-group>
      </div>

      <template v-if="mode === 'area'">
        <div class="selector-item">
          地区：
          <el-select v-model="selectorAreaValue" @change="refresh">
            <el-option v-for="item in selectorArea" :key="item.value" :label="item.label" :value="item.value"></el-option>
          </el-select>
        </div>
        <div class="selector-item">
          <el-button @click="refresh()">刷新</el-button>
        </div>
      </template>

      <template v-else>
        <div class="selector-item">
          <el-input ref="searchInput" v-model="keyword" class="search" clearable
            placeholder="搜索全国电台（名称 / 台别）" @keyup.enter="doSearch" @clear="clearSearch">
            <!-- 图标用插槽 + 全局注册的图标组件，避免在 <script> 里为空而多引一个变量 -->
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
            <template #append>
              <el-button @click="doSearch"><el-icon><Search /></el-icon>搜索</el-button>
            </template>
          </el-input>
        </div>
      </template>

      <div class="selector-item count">{{ countText }}</div>
    </div>

    <el-table :data="channels" border style="width: 100%" class="table">
      <el-table-column prop="title" label="频道" width="300" />
      <el-table-column prop="subtitle" label="当前节目" />
      <el-table-column prop="tagName" label="台别" width="180" />
      <el-table-column label="操作" width="180">
        <template #default="scope">
          <el-button @click="pushLivePlaylist(scope.row)" type="primary" size="small"
            :loading="pushingId === scope.row.contentId">推送直播</el-button>
          <el-button @click="favorite(scope.row)" size="small">收藏</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script>
import axios from 'axios';
import md5 from '../lib/md5';

// 云听 App 的接口（format / contentBiz 两组接口），base 不带 /web 前缀，
// 与旧版直接调用的 https://ytmsout.radio.cn/web/* 不是同一套网关。
const API_BASE = 'https://ytmsout.radio.cn';

// 密钥按接口分组，取自云听 App 的签名工具类 ParamSignUtils。
const KEY_FORMAT = '40359b279ed420d0643e12df721e6c4d';
const KEY_CONTENT_BIZ = '3196d2bb67a730342382ce8f690c8c44';

// 央广频率分组：contentBiz/appBroadcast/all/group/1
const CNR_GROUP_TYPE = 1;
const CNR_GROUP_VALUE = 'group:1';

// 建全量电台索引时的并发上限（对网关密集请求会被限流）
const INDEX_CONCURRENCY = 6;

const getParamsOrderByKey = (params) => {
  const sortArr = Object.keys(params).sort();
  const sortParams = [];

  if (sortArr.length) {
    for (let i = 0; i < sortArr.length; i++) {
      const tmpKey = sortArr[i];
      sortParams.push(tmpKey + '=' + params[tmpKey]);
    }
  }

  return sortParams.join('&');
};

// 限并发地跑一批异步任务，按原顺序返回结果
const mapLimit = async (items, limit, worker) => {
  const results = [];
  let cursor = 0;

  const run = async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));

  return results;
};

export default {
  name: 'RadioCn',

  data() {
    return {
      mode: 'area',
      areaChannels: [],
      allChannels: [],
      keyword: '',
      searchedKeyword: '',
      selectorAreaValue: CNR_GROUP_VALUE,
      selectorArea: [{ label: '央广频率', value: CNR_GROUP_VALUE }],
      areaLoaded: false,
      refreshLoading: false,
      indexLoading: false,
      pushingId: null,
    }
  },

  computed: {
    isSearching() {
      return this.mode === 'search';
    },

    loading() {
      return this.refreshLoading || this.indexLoading;
    },

    loadingText() {
      return this.indexLoading ? '正在加载全部电台，请稍候...' : '正在加载云听电台...';
    },

    searched() {
      return this.searchedKeyword.length > 0;
    },

    channels() {
      if (!this.isSearching) {
        return this.areaChannels;
      }

      if (!this.searched) {
        return [];
      }

      return this.allChannels.filter(item => this.matchKeyword(item));
    },

    countText() {
      if (!this.isSearching) {
        return `共 ${this.channels.length} 个电台`;
      }

      if (!this.searched) {
        return '输入关键词后点「搜索」，范围为全国电台';
      }

      return `在全部 ${this.allChannels.length} 个电台中搜索“${this.searchedKeyword}”：${this.channels.length} 个`;
    }
  },

  created() {
    this.refresh();
  },

  methods: {
    switchMode(mode) {
      if (this.mode === mode) {
        return;
      }

      this.mode = mode;

      if (mode === 'search') {
        this.$nextTick(() => {
          if (this.$refs.searchInput) {
            this.$refs.searchInput.focus();
          }
        });
      }
    },

    async refresh() {
      this.refreshLoading = true;

      try {
        await this.ensureAreaList();
        this.areaChannels = await this.getRadioList(this.selectorAreaValue);
      }
      catch (e) {
        this.areaChannels = [];
        this.notifyError(e);
      }
      finally {
        this.refreshLoading = false;
      }
    },

    notifyError(e) {
      this.$notify({
        type: 'error',
        title: '云听接口请求失败',
        message: String((e && e.message) || e),
        duration: 4000
      });
    },

    async ensureAreaList() {
      if (this.areaLoaded) {
        return;
      }

      await this.getAreaList();
      this.areaLoaded = true;
    },

    // 云听 App 网关签名：md5(按 key 排序的参数 + '&timestamp=' + ts + '&key=' + 分组密钥)
    async request(path, opts = {}) {
      const key = opts.key || KEY_CONTENT_BIZ;
      const params = opts.params || null;
      const tm = new Date().getTime();
      const signText = (params ? (getParamsOrderByKey(params) + '&') : '') + 'timestamp=' + tm + '&key=' + key;

      const result = await axios.get(API_BASE + path, {
        params: params || undefined,
        headers: {
          'Content-Type': 'application/json',
          equipmentId: '0000',
          platformCode: 'ANDROID',
          equipmentSource: 'ANDROID',
          timestamp: tm,
          sign: md5(signText),
        },
      });

      if (result.data && result.data.code == 0) {
        return result.data.data;
      }

      throw new Error((result.data && result.data.message) || '云听接口返回异常');
    },

    // 地区列表（App: format/appProvince/list/all，无参数）
    async getAreaList() {
      const provinces = await this.request('/format/appProvince/list/all', { key: KEY_FORMAT });

      this.selectorArea = [
        { label: '央广频率', value: CNR_GROUP_VALUE },
        ...(provinces || []).map(item => ({
          label: item.provinceName,
          value: String(item.provinceCode),
        })),
      ];
    },

    // 频道列表（App: contentBiz/appBroadcast/all/group/{groupType} 或 allByProvince）
    async getRadioList(areaValue) {
      if (areaValue === CNR_GROUP_VALUE) {
        const list = await this.request('/contentBiz/appBroadcast/all/group/' + CNR_GROUP_TYPE);

        return list || [];
      }

      const list = await this.request('/contentBiz/appBroadcast/allByProvince', {
        params: { provinceCode: areaValue },
      });

      return list || [];
    },

    // 电台详情：只有这个接口给高清地址（列表接口只返回低码率的 playUrlLow / mp3PlayUrlLow）
    async getRadioDetail(contentId) {
      return await this.request('/contentBiz/appBroadcast/detail/' + contentId);
    },

    // 高清优先：playUrlHigh > mp3PlayUrlHigh > playUrlLow > mp3PlayUrlLow
    pickPlayUrl(item) {
      if (!item) {
        return '';
      }

      return item.playUrlHigh || item.mp3PlayUrlHigh || item.playUrlLow || item.mp3PlayUrlLow || '';
    },

    // 搜索只搜电台：索引 = 央广频率 + 31 个省级列表（全国地方台），首次搜索时构建一次
    doSearch() {
      this.searchedKeyword = this.keyword.trim();

      if (!this.searchedKeyword) {
        return null;
      }

      return this.ensureAllChannels();
    },

    clearSearch() {
      this.keyword = '';
      this.searchedKeyword = '';
    },

    matchKeyword(item) {
      const kw = this.searchedKeyword.toLowerCase();

      if (!kw) {
        return true;
      }

      const haystack = `${item.title || ''} ${item.tagName || ''} ${item.subtitle || ''}`.toLowerCase();

      return haystack.indexOf(kw) !== -1;
    },

    async ensureAllChannels() {
      if (this.allChannels.length || this.indexLoading) {
        return;
      }

      this.indexLoading = true;

      try {
        await this.ensureAreaList();

        const provinces = this.selectorArea.filter(item => item.value !== CNR_GROUP_VALUE);
        const lists = await mapLimit(provinces, INDEX_CONCURRENCY, item =>
          this.getRadioList(item.value).catch(() => []));
        const cnr = await this.getRadioList(CNR_GROUP_VALUE).catch(() => []);
        const merged = new Map();

        cnr.forEach(item => merged.set(String(item.contentId), item));
        lists.forEach(list => {
          (list || []).forEach(item => merged.set(String(item.contentId), item));
        });

        this.allChannels = Array.from(merged.values());
      }
      catch (e) {
        this.notifyError(e);
      }
      finally {
        this.indexLoading = false;
      }
    },

    // 推送直播：先取详情拿高清地址，详情不可用时退回列表里的地址。
    // 推送结果的提示由 App.vue 统一发出（它等音响应答后才知道成功与否），这里不再重复提示；
    // 只有“没有可用地址”这种连推送都没发生的情况才由组件自己提示。
    async pushLivePlaylist(channelDetail) {
      this.pushingId = channelDetail.contentId;

      try {
        let playUrl = '';

        try {
          const detail = await this.getRadioDetail(channelDetail.contentId);

          playUrl = this.pickPlayUrl(detail);
        }
        catch (e) {
          // 详情接口不可用，退回列表里的地址
        }

        if (!playUrl) {
          playUrl = this.pickPlayUrl(channelDetail);
        }

        if (!playUrl) {
          this.$notify({ type: 'error', title: '该电台没有可用的播放地址', duration: 3000 });
          return;
        }

        this.pushPlaylist({
          TracksMetaData: [{
            type: 2,
            uuid: '',
            metadata: '',
            url: `ffmpeg://${playUrl}`,
            title: channelDetail.title
          }]
        });
      }
      finally {
        this.pushingId = null;
      }
    },

    pushPlaylist(playlistData) {
      this.$emit('push-playlist', playlistData);
    },

    findStation(contentId) {
      const inIndex = this.allChannels.find(item => item.contentId == contentId);

      if (inIndex) {
        return inIndex;
      }

      return this.areaChannels.find(item => item.contentId == contentId);
    },

    // 收藏夹推送：走 App 的电台详情接口取最新高清地址（列表里的地址带 time 令牌会过期）
    async favoritePush(favoriteData) {
      try {
        const detail = await this.getRadioDetail(favoriteData.id);
        const playUrl = this.pickPlayUrl(detail);

        if (playUrl) {
          this.pushPlaylist({
            TracksMetaData: [{
              type: 2,
              uuid: '',
              metadata: '',
              url: `ffmpeg://${playUrl}`,
              title: detail.name || favoriteData.title
            }]
          });
          return;
        }
      }
      catch (e) {
        // 详情接口不可用时回退到本地列表
      }

      const channelDetail = this.findStation(favoriteData.id);

      if (channelDetail) {
        await this.pushLivePlaylist(channelDetail);
      }
    },

    favorite(channelDetail) {
      this.$emit('add-favorite', {
        name: 'radio-cn',
        category: '云听电台',
        id: channelDetail.contentId,
        title: channelDetail.title,
        extra: {
          provinceCode: this.selectorAreaValue
        }
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
      vertical-align: middle;

      + .selector-item {
        margin-left: 20px;
      }

      // Element Plus 的 el-input / el-select 是 width: 100%，在 inline-block 的收缩容器里
      // 会塌成内容宽度（Element UI 时代靠原生 <input> 的默认宽度撑着，约 235px）。
      // 这里显式还原旧宽度，否则标签会被挤到换行、选项文字显示成省略号。
      .el-select {
        width: 235px;
      }

      &.count {
        color: #909399;
      }
    }
  }

  .search {
    width: 340px;
  }

  .table {
    margin-top: 10px;
    margin-bottom: 10px;
  }
}
</style>
