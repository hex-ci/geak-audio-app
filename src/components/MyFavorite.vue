<template>
  <div class="my-favorite" v-loading="loading">
    <div class="selector">
      <el-popconfirm title="确认删除所有收藏夹内容吗？" class="clear" @confirm="removeAll">
        <el-button type="danger" slot="reference">清除收藏夹</el-button>
      </el-popconfirm>
      <el-button @click="refresh">刷新</el-button>
    </div>

    <el-table :data="listing" border style="width: 100%" class="table">
      <el-table-column prop="category" label="分类" width="300" />
      <el-table-column prop="title" label="频道/专辑" />
      <el-table-column label="操作" width="150">
        <template #default="scope">
          <el-button @click="push(scope.row)" type="primary" size="mini">推送</el-button>
          <el-button @click="remove(scope.$index)" type="danger" size="mini">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script>
import concat from 'lodash/concat';

const ipcRenderer = window.$ipcRenderer;

export default {
  name: 'MyFavorite',

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
      const result = await ipcRenderer.invoke('load-favorite');
      this.loading = false;

      this.listing = result;
    },

    remove(index) {
      this.listing.splice(index, 1);
      ipcRenderer.invoke('save-favorite', this.listing);
    },

    removeAll() {
      this.listing = [];
      ipcRenderer.invoke('save-favorite', this.listing);
    },

    push(favoriteData) {
      this.$emit('favorite-push', favoriteData);
    },

    async addFavorite(favoriteData) {
      const result = this.listing.find(item => favoriteData.name === item.name && favoriteData.id === item.id);

      if (result) {
        this.$notify({ type: 'warning', title: '已经收藏过了', duration: 2000 });
        return
      }

      this.listing = concat(this.listing, favoriteData);
      await ipcRenderer.invoke('save-favorite', this.listing);

      this.$notify({ type: 'success', title: '收藏成功', duration: 2000 });
    }
  }
}
</script>

<style lang="scss" scoped>
.my-favorite {
  .clear {
    margin-right: 10px;
  }

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
