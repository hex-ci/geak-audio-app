<template>
  <div class="xmly-channel" v-loading="loading">
    <div class="selector">
      搜索：<el-input v-model.trim="searchValue" ></el-input> <el-button type="primary" @click="search()">搜索</el-button>
    </div>

    <div class="selector">
      频道：<el-cascader v-model="typeValue" :props="props" @change="changeSelector"></el-cascader>
    </div>

    <el-table :data="channels" border style="width: 100%" class="table">
      <el-table-column prop="albumTitle" label="专辑名称" />
      <el-table-column prop="albumUserNickName" label="作者" />
      <el-table-column prop="intro" label="介绍" />
      <el-table-column label="操作" width="150">
        <template #default="scope">
          <el-button @click="pushPlaybackPlaylist(scope.row.albumId)" type="primary" size="mini">推送</el-button>
          <el-button @click="favorite(scope.row.albumId, scope.row.albumTitle)" size="mini">收藏</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination layout="prev, pager, next" :page-size="pageSize" :total="pageTotal" @current-change="changePage"></el-pagination>
  </div>
</template>

<script>
import request from '../lib/request';

export default {
  name: 'XmlyChannel',

  data() {
    return {
      channels: [],
      typeValue: '',
      pageTotal: 0,
      loading: false,
      searchValue: '',
      pageSize: 30,
      props: {
        lazy: true,
        lazyLoad: this.loadSubType,
        label: 'name',
        value: 'id'
      }
    }
  },

  created() {
    // this.getDetail();
  },

  methods: {
    async refresh(page = 1) {
      const url = `https://www.ximalaya.com/revision/metadata/v2/channel/albums`;

      this.loading = true;
      const result = await request(url, {
        params: {
          pageNum: page,
          pageSize: this.pageSize,
          sort: 1,
          metadataValueId: this.typeValue[1]
        }
      });
      this.loading = false;

      if (result.data.ret == 200) {
        this.pageTotal = result.data.data.total;
        this.channels = result.data.data.albums;
      }
    },

    async loadSubType(node, resolve) {
      if (node.root) {
        const url = `https://www.ximalaya.com/revision/metadata/v2/group/all`;

        const result = await request(url);

        if (result.data.ret == 200) {
          resolve(result.data.data.groups);
        }
      }
      else {
        const url = `https://www.ximalaya.com/revision/metadata/v2/group/channels`;

        const result = await request(url, {
          params: {
            groupId: node.value
          }
        });

        if (result.data.ret == 200) {
          const nodes = result.data.data.channels.map(item => ({
            id: item.relationMetadataValueId,
            name: item.channelName,
            leaf: true
          }));

          resolve(nodes);
        }
      }
    },

    async search(page = 1) {
      if (!this.searchValue) {
        return;
      }

      this.typeValue = '';

      const url = `https://www.ximalaya.com/revision/search/main`;

      this.loading = true;
      const result = await request(url, {
        params: {
          core: 'album',
          kw: this.searchValue,
          page,
          spellchecker: 'true',
          rows: this.pageSize,
          condition: 'relation',
          device: 'iPhone'
        }
      });
      this.loading = false;

      if (result.data.ret == 200) {
        this.pageTotal = result.data.data.album.total;
        this.channels = result.data.data.album.docs.map(item => ({
          ...item,
          albumTitle: item.title,
          albumUserNickName: item.nickname,
        }));
      }
    },

    changeSelector() {
      this.searchValue = '';
      this.refresh();
    },

    changePage(page) {
      if (this.searchValue) {
        this.search(page);
      }
      else {
        this.refresh(page);
      }
    },

    async getAudioUrl(id) {
      const url = `https://www.ximalaya.com/revision/play/v1/audio`;

      const result = await request(url, {
        params: {
          id,
          ptype: 1
        }
      });

      return result.data.data.src.replace(/^https:\/\//, 'http://');
    },

    async pushPlaybackPlaylist(id) {
      const url = `https://www.ximalaya.com/revision/play/album`;

      this.loading = true;

      const result = await request(url, {
        params: {
          albumId: id,
          pageNum: 1,
          pageSize: this.pageSize
        }
      });

      const tracks = [];

      for (const item of result.data.data.tracksAudioPlay) {
        let url;

        if (item.canPlay) {
          url = item.src;
        }
        else {
          url = await this.getAudioUrl(item.trackId);
        }

        tracks.push({
          type: 2,
          uuid: '',
          metadata: '',
          url,
          title: item.trackName
        });
      }

      if (!tracks.length) {
        return;
      }

      this.loading = false;

      this.pushPlaylist({ TracksMetaData: tracks });
    },

    pushPlaylist(playlistData) {
      this.$emit('push-playlist', playlistData);
    },

    favorite(id, title) {
      this.$emit('add-favorite', {
        name: 'xmly-channel',
        category: '喜马拉雅频道',
        id,
        title
      });
    },

    favoritePush(favoriteData) {
      this.pushPlaybackPlaylist(favoriteData.id);
    }
  }
}
</script>

<style lang="scss" scoped>
.xmly-channel {
  .selector {
    + .selector {
      margin-top: 5px;
    }

    .el-input {
      width: 300px;
    }
  }

  .table {
    margin-top: 10px;
    margin-bottom: 10px;
  }
}
</style>

<style lang="scss">
.el-cascader-panel {
  max-height: 500px;
}
</style>
