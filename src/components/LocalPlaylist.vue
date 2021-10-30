<template>
  <div class="local-playlist" v-loading="loading">
    <el-alert title="播放本地文件时，请不要关闭本程序，否则会停止播放" type="info" :closable="false"></el-alert>
    <div class="selector">
      <el-upload
       class="upload-file"
       ref="upload"
       action=""
       multiple
       :auto-upload="false"
       :show-file-list="false" :on-change="change"
       accept=".mp3,.wav,.m4a,.flac,.ape"
      >
        <el-button slot="trigger" type="primary">添加文件</el-button>
      </el-upload>
      <el-button type="primary" @click="push">推送</el-button>
      <el-popconfirm title="确认删除所有播放列表内容吗？" class="clear" @confirm="removeAll">
        <el-button type="danger" slot="reference">清除播放列表</el-button>
      </el-popconfirm>
      <el-button @click="refresh">刷新</el-button>
    </div>

    <el-table :data="listing" border style="width: 100%" class="table">
      <el-table-column prop="file" label="文件名" />
      <el-table-column prop="path" label="全路径" />
      <el-table-column label="操作" width="80">
        <template #default="scope">
          <el-button @click="remove(scope.$index)" type="danger" size="mini">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script>
import debounce from 'lodash/debounce';
import concat from 'lodash/concat';

const ipcRenderer = window.$ipcRenderer;

const baseName = (str) => {
  var idx = str.lastIndexOf('/')
  idx = idx > -1 ? idx : str.lastIndexOf('\\')
  if (idx < 0) {
    return str
  }
  return str.substring(idx + 1);
};

export default {
  name: 'LocalPlaylist',

  data() {
    return {
      listing: [],
      loading: false
    }
  },

  created() {
    this.refresh();
  },

  methods: {
    async refresh() {
      this.loading = true;
      const result = await ipcRenderer.invoke('load-local-playlist');
      this.loading = false;

      this.listing = result;
    },

    change() {
      this.addFile();
    },

    remove(index) {
      this.listing.splice(index, 1);
      ipcRenderer.invoke('save-local-playlist', this.listing);
    },

    removeAll() {
      this.listing = [];
      ipcRenderer.invoke('save-local-playlist', this.listing);
    },

    addFile: debounce(function () {
      const files = this.$refs.upload.uploadFiles.map(item => ({
        file: baseName(item.raw.path),
        path: item.raw.path
      }));

      this.$refs.upload.clearFiles();

      this.listing = concat(this.listing, files);

      ipcRenderer.invoke('save-local-playlist', this.listing);
    }, 100),

    push() {
      const tracks = this.listing.map(item => ({
        type: 2,
        uuid: '',
        metadata: '',
        url: `/get-file?path=${encodeURIComponent(item.path)}`,
        title: item.file
      }));

      this.pushPlaylist({
        TracksMetaData: tracks
      });
    },

    pushPlaylist(playlistData) {
      this.$emit('push-playlist', playlistData, true);
    }
  }
}
</script>

<style lang="scss" scoped>
.local-playlist {
  .el-alert {
    margin-bottom: 10px;
  }

  .clear {
    margin-left: 10px;
    margin-right: 10px;
  }

  .selector {
    .selector-item {
      display: inline-block;

      + .selector-item {
        margin-left: 20px;
      }
    }

    .upload-file {
      display: inline-block;
      margin-right: 10px;
    }
  }

  .table {
    margin-top: 10px;
    margin-bottom: 10px;
  }
}
</style>
