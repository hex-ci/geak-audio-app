<template>
  <div class="device-manager">
    <el-tabs v-model="activePanel" type="border-card">
      <!-- 设备信息与改名 -->
      <el-tab-pane label="设备" name="device">
        <el-form label-width="110px" size="small">
          <el-form-item label="设备名称：">
            <span>{{ device.DeviceName }}</span>
          </el-form-item>
          <el-form-item label="固件/硬件：">
            <span>{{ device.externalSoftware }} / {{ device.hardware }}</span>
          </el-form-item>
          <el-form-item label="电量：">
            <span>{{ power }}%</span>
          </el-form-item>
          <el-form-item label="改名：">
            <el-input v-model="newName" placeholder="新的设备名称" style="width: 240px" />
            <el-tooltip content="改名后设备会短暂离线约 10 秒（UPnP 服务重启），稍后自动恢复" placement="top">
              <!-- EP 图标必须包在 el-icon 里：图标组件输出的 <svg> 没有 width/height，
                   裸用会按 SVG 默认尺寸撑开（实测 571×571px） -->
              <el-icon><QuestionFilled /></el-icon>
            </el-tooltip>
            <el-button type="primary" size="small" :loading="busy" @click="renameDevice">保存</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <!-- 闹钟 -->
      <el-tab-pane label="闹钟" name="alarm">
        <el-table :data="alarms" size="small" empty-text="设备上没有闹钟">
          <el-table-column prop="StartTime" label="时间" width="90" />
          <el-table-column prop="StartDate" label="日期" width="120" />
          <el-table-column label="重复" width="110">
            <template #default="scope">{{ recurrenceLabel(scope.row.Recurrence) }}</template>
          </el-table-column>
          <el-table-column label="启用" width="90">
            <template #default="scope">
              <el-button text @click="toggleAlarm(scope.row)">
                {{ String(scope.row.Enabled) === '1' ? '停用' : '启用' }}
              </el-button>
            </template>
          </el-table-column>
          <el-table-column prop="Volume" label="音量" width="70" />
          <el-table-column label="操作">
            <template #default="scope">
              <el-button text @click="removeAlarm(scope.row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-divider content-position="left">新建闹钟</el-divider>
        <el-form :inline="true" size="small">
          <el-form-item label="时间">
            <el-input v-model="alarmForm.StartTime" placeholder="07:30" style="width: 90px" />
          </el-form-item>
          <el-form-item label="日期">
            <el-input v-model="alarmForm.StartDate" placeholder="2026-10-12" style="width: 130px" />
          </el-form-item>
          <el-form-item label="重复">
            <el-select v-model="alarmForm.Recurrence" style="width: 110px">
              <el-option v-for="(label, index) in weekdays" :key="index" :label="label" :value="String(index)" />
            </el-select>
          </el-form-item>
          <el-form-item label="音量">
            <el-input-number v-model="alarmForm.Volume" :min="0" :max="100" size="small" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" size="small" :loading="busy" @click="addAlarm">添加</el-button>
          </el-form-item>
        </el-form>
        <div class="hint">
          铃声用设备自带的 <code>default_clock_tone</code>（对应 app 的「默认闹钟铃声」）；设备的 ID 就是起始时间，
          改时间后 ID 会跟着变，所以这里用「时间」定位闹钟。
        </div>
      </el-tab-pane>

      <!-- 定时关机 -->
      <el-tab-pane label="定时关机" name="timing">
        <el-form label-width="110px" size="small">
          <el-form-item label="剩余时间：">
            <span>{{ timingText }}</span>
          </el-form-item>
          <el-form-item label="设定：">
            <el-input-number v-model="shutdownMinutes" :min="1" :max="600" size="small" />
            <span class="unit">分钟后关机</span>
            <el-button type="primary" size="small" :loading="busy" @click="setShutdown">确定</el-button>
            <el-button size="small" @click="cancelShutdown">取消定时关机</el-button>
          </el-form-item>
        </el-form>
        <div class="hint">单位是分钟（app 侧参数名为 <code>min</code>）；<code>-1</code> 表示取消。</div>
      </el-tab-pane>

      <!-- 按键锁 -->
      <el-tab-pane label="按键锁" name="hold">
        <el-form label-width="110px" size="small">
          <el-form-item label="按键锁：">
            <el-switch :model-value="holdStatus === 1" @change="toggleHold" />
            <span class="unit">{{ holdStatus === 1 ? '已锁定（设备按键不可用）' : '未锁定' }}</span>
          </el-form-item>
        </el-form>
        <el-button size="small" @click="loadHold">刷新</el-button>
      </el-tab-pane>

      <!-- 收藏与内置列表 -->
      <el-tab-pane label="收藏与列表" name="list">
        <el-divider content-position="left">设备侧「我的收藏」</el-divider>
        <el-table :data="favourites" size="small" empty-text="收藏是空的">
          <el-table-column prop="title" label="标题" />
          <el-table-column label="操作" width="100">
            <template #default="scope">
              <el-button text @click="removeFavourite(scope.row.title)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-button size="small" :loading="busy" @click="recordNow">收藏当前播放曲目</el-button>
        <el-button size="small" @click="loadFavourites">刷新</el-button>

        <el-divider content-position="left">设备内置列表（按键 1-6 等）</el-divider>
        <el-select v-model="selectedListIndex" size="small" style="width: 260px" @change="loadInterList">
          <el-option
            v-for="item in playlistInfo"
            :key="item.index"
            :label="`${item.index} · ${item.name}`"
            :value="item.index"
          />
        </el-select>
        <el-table :data="interList" size="small" empty-text="该列表为空" style="margin-top: 8px">
          <el-table-column prop="title" label="标题" />
          <el-table-column label="操作" width="100">
            <template #default="scope">
              <el-button text @click="playBuiltin(scope.$index)">播放</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="hint">
          设备内置列表的「删除」实测在固件 1.6.6 上不生效（`InterListDelete` 返回 OK 但条目仍在），
          所以这里只提供播放；条目要清掉只能等设备整机重启。
        </div>
      </el-tab-pane>

      <!-- 时间与设置 -->
      <el-tab-pane label="时间与设置" name="settings">
        <el-form label-width="130px" size="small">
          <el-form-item label="设备时间：">
            <span>{{ timeNow }}</span>
            <el-button size="small" @click="syncTime">把当前时间写入设备</el-button>
          </el-form-item>
          <el-form-item label="时区：">
            <span>索引 {{ timeZoneIndex }}</span>
            <el-select v-model="timeZonePick" size="small" style="width: 200px">
              <el-option label="Asia/Shanghai（中国）" :value="72" />
              <el-option label="Asia/Hong_Kong" :value="71" />
              <el-option label="Asia/Tokyo" :value="81" />
              <el-option label="UTC" :value="0" />
            </el-select>
            <el-button size="small" :loading="busy" @click="applyTimeZone">设置</el-button>
          </el-form-item>
          <el-form-item label="网络时间：">
            <el-switch :model-value="internetTime === 1" @change="toggleInternetTime" />
          </el-form-item>
          <el-form-item label="提示音：">
            <el-switch :model-value="extra.tone === 1" @change="value => setExtra(2, value)" />
          </el-form-item>
          <el-form-item label="开机自动播放：">
            <el-switch :model-value="extra.autoplay === 1" @change="value => setExtra(3, value)" />
          </el-form-item>
          <el-form-item label="当前 WiFi：">
            <span v-if="currentWifi">{{ currentWifi.ssid }}（信号 {{ currentWifi.level }}，类型 {{ currentWifi.type }}）</span>
            <span v-else>未读到</span>
            <el-button size="small" @click="loadWifi">刷新</el-button>
          </el-form-item>
        </el-form>
        <div class="hint">
          出于隐私考虑，这里**不提供 WiFi 密码显示、也不提供改网**：设备会明文返回 WiFi 密码与账号凭据，
          改网还可能让设备直接离线（app 的配网走的是设备热点模式，属另一套流程）。
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script>
const ipcRenderer = window.$ipcRenderer;

export default {
  name: 'DeviceManager',

  data() {
    return {
      activePanel: 'device',
      busy: false,
      device: {},
      power: -1,
      newName: '',
      alarms: [],
      alarmForm: {
        StartTime: '07:30',
        StartDate: '',
        Recurrence: '1',
        Volume: 30
      },
      weekdays: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'],
      shutdownMinutes: 30,
      timing: -88,
      holdStatus: 0,
      favourites: [],
      playlistInfo: [],
      selectedListIndex: 6,
      interList: [],
      timeNow: '',
      timeZoneIndex: -999,
      timeZonePick: 72,
      internetTime: -1,
      extra: { tone: -1, autoplay: -1 },
      wifiList: []
    };
  },

  computed: {
    timingText() {
      if (this.timing === -88 || this.timing === -1) {
        return '未设定';
      }

      return `${this.timing} 分钟后关机`;
    },

    currentWifi() {
      return this.wifiList.find(item => item.type === '2') || null;
    }
  },

  mounted() {
    this.refreshAll();
  },

  methods: {
    notify(message, type = 'success') {
      this.$message({ message, type });
    },

    // 设备离线时（例如改名后 UPnP 服务重启）统一给个提示
    guard(result, okMessage) {
      if (result === false || result === null || result === undefined) {
        this.notify('设备没有应答，可能正在重启（约 10 秒后自动恢复），稍后再试', 'warning');

        return false;
      }

      if (okMessage) {
        this.notify(okMessage);
      }

      return true;
    },

    async refreshAll() {
      await Promise.all([
        this.loadDevice(),
        this.loadAlarms(),
        this.loadTiming(),
        this.loadHold(),
        this.loadFavourites(),
        this.loadPlaylists(),
        this.loadTime(),
        this.loadWifi(),
        this.loadExtra()
      ]);
    },

    // 写动作一律以"读回"为准。两条实测原因：
    // 1) 设备可能返回失败但动作其实已生效（如 CreateAlarm 返回 false 却建好了闹钟）；
    // 2) 写动作后设备会短暂不可达（约 10–13 秒），立刻读会失败。
    async verifyRead(readFn, predicate, tries = 6, gapMs = 1500) {
      for (let i = 0; i < tries; i++) {
        try {
          if (predicate(await readFn())) {
            return true;
          }
        }
        catch (error) {
          // 设备重启窗口内可能直接抛错，继续等下一轮
        }

        await new Promise(resolve => setTimeout(resolve, gapMs));
      }

      return false;
    },

    async loadDevice() {
      const info = await ipcRenderer.invoke('get-device-info');

      this.device = info?.device ?? {};
      this.power = info?.power ?? -1;
      this.newName = this.device.DeviceName ?? '';
    },

    async renameDevice() {
      if (!this.newName) {
        return this.notify('名称不能为空', 'warning');
      }

      this.busy = true;
      await ipcRenderer.invoke('rename-device', this.newName);
      this.busy = false;

      // 改名会让 UPnP 服务重启（实测约 13 秒，端口可能变）：以读回为准
      const ok = await this.verifyRead(
        () => ipcRenderer.invoke('get-device-info'),
        info => info?.device?.DeviceName === this.newName,
        10,
        2000
      );

      if (ok) {
        this.notify(`已改名为 ${this.newName}`);
        await this.loadDevice();
      }
      else {
        this.notify('改名请求已发送，但设备仍在重启、暂未确认生效（稍后点刷新查看）', 'warning');
      }
    },

    // ---- 闹钟 ----
    recurrenceLabel(value) {
      const index = Number(value);
      const label = this.weekdays[index];

      return label ? `${label}（${index}）` : String(value);
    },

    async loadAlarms() {
      const result = await ipcRenderer.invoke('list-alarms');

      this.alarms = this.parseJson(result?.CurrentAlarmList)?.ListAlarms ?? [];
    },

    async addAlarm() {
      this.busy = true;
      const startTime = this.alarmForm.StartTime;
      const result = await ipcRenderer.invoke('create-alarm', {
        StartTime: startTime,
        StartDate: this.alarmForm.StartDate,
        Recurrence: this.alarmForm.Recurrence,
        Enabled: '1',
        ProgramURI: 'default_clock_tone',
        Volume: String(this.alarmForm.Volume),
        UrlType: '8'
      });
      this.busy = false;

      // 实测：设备可能回"失败"但闹钟其实已建好 → 一律以 ListAlarms 复核为准
      const ok = await this.verifyRead(
        () => ipcRenderer.invoke('list-alarms'),
        r => (this.parseJson(r?.CurrentAlarmList)?.ListAlarms ?? []).some(item => item.StartTime === startTime),
        6,
        1500
      );

      if (ok) {
        this.notify('闹钟已添加');
      }
      else {
        this.notify(`未能确认闹钟已添加（设备返回：${JSON.stringify(result)}）`, 'error');
      }

      await this.loadAlarms();
    },

    async toggleAlarm(row) {
      // 注意：这里**不要**整表重新加载——el-table 在自身布局观测回调里再次改尺寸会触发
      // “ResizeObserver loop completed with undelivered notifications.”，所以只就地改这一行。
      const enabled = String(row.Enabled) !== '1';
      const result = await ipcRenderer.invoke('enable-alarm', row.StartTime, enabled ? 1 : 0);
      const ok = await this.verifyRead(
        () => ipcRenderer.invoke('list-alarms'),
        r => (this.parseJson(r?.CurrentAlarmList)?.ListAlarms ?? [])
          .some(item => item.StartTime === row.StartTime && String(item.Enabled) === (enabled ? '1' : '0')),
        5,
        1200
      );

      if (!ok) {
        return this.notify(`未能确认该闹钟状态（设备返回：${JSON.stringify(result)}）`, 'error');
      }

      row.Enabled = enabled ? '1' : '0';
      this.notify(enabled ? '已启用该闹钟' : '已停用该闹钟');
    },

    async removeAlarm(alarm) {
      const result = await ipcRenderer.invoke('destroy-alarm', alarm.StartTime);
      const ok = await this.verifyRead(
        () => ipcRenderer.invoke('list-alarms'),
        r => !(this.parseJson(r?.CurrentAlarmList)?.ListAlarms ?? []).some(item => item.StartTime === alarm.StartTime),
        5,
        1200
      );

      if (!ok) {
        return this.notify(`未能确认闹钟已删除（设备返回：${JSON.stringify(result)}）`, 'error');
      }

      // 就地删除，避免整表重建（整表重建会触发 el-table 的 ResizeObserver loop 报错）
      this.alarms = this.alarms.filter(item => item.StartTime !== alarm.StartTime);
      this.notify('闹钟已删除');
    },

    // ---- 定时关机 ----
    async loadTiming() {
      const result = await ipcRenderer.invoke('get-timing');

      this.timing = Number(result?.LeftTimes ?? -88);
    },

    async setShutdown() {
      this.busy = true;
      const minutes = this.shutdownMinutes;
      await ipcRenderer.invoke('set-timing-shutdown', minutes);
      this.busy = false;
      const ok = await this.verifyRead(
        () => ipcRenderer.invoke('get-timing'),
        r => Number(r?.LeftTimes ?? -88) > 0,
        5,
        1200
      );

      this.notify(ok ? `已设定 ${minutes} 分钟后关机` : '未能确认定时关机已设定（稍后点刷新查看）', ok ? 'success' : 'warning');
      await this.loadTiming();
    },

    async cancelShutdown() {
      await ipcRenderer.invoke('set-timing-shutdown', -1);
      const ok = await this.verifyRead(
        () => ipcRenderer.invoke('get-timing'),
        r => Number(r?.LeftTimes ?? -88) === -88,
        5,
        1200
      );

      this.notify(ok ? '已取消定时关机' : '未能确认已取消（稍后点刷新查看）', ok ? 'success' : 'warning');
      await this.loadTiming();
    },

    // ---- 按键锁 ----
    async loadHold() {
      const result = await ipcRenderer.invoke('get-hold-status');

      this.holdStatus = Number(result?.HoldStatus ?? 0);
    },

    async toggleHold(enabled) {
      const target = enabled ? 1 : 0;

      await ipcRenderer.invoke('hold-button', target);
      const ok = await this.verifyRead(
        () => ipcRenderer.invoke('get-hold-status'),
        r => Number(r?.HoldStatus ?? -1) === target,
        5,
        1200
      );

      this.notify(ok ? (enabled ? '按键已锁定' : '按键已解锁') : '未能确认按键锁状态（稍后点刷新查看）', ok ? 'success' : 'warning');
      await this.loadHold();
    },

    // ---- 收藏 ----
    async loadFavourites() {
      const result = await ipcRenderer.invoke('get-favourite-list');

      this.favourites = this.parseJson(result?.FavouriteList)?.FavouriteList ?? [];
    },

    async recordNow() {
      this.busy = true;
      const before = (await ipcRenderer.invoke('get-favourite-list')) && this.favourites.length;
      await ipcRenderer.invoke('record-favourite');
      this.busy = false;
      const ok = await this.verifyRead(
        () => ipcRenderer.invoke('get-favourite-list'),
        r => (this.parseJson(r?.FavouriteList)?.FavouriteList ?? []).length > Number(before ?? 0),
        5,
        1200
      );

      this.notify(ok ? '已把当前曲目加入设备收藏' : '未能确认已加入收藏（设备需正在播放才有当前曲目）', ok ? 'success' : 'warning');
      await this.loadFavourites();
    },

    async removeFavourite(title) {
      await ipcRenderer.invoke('favourite-delete', title);
      const ok = await this.verifyRead(
        () => ipcRenderer.invoke('get-favourite-list'),
        r => !(this.parseJson(r?.FavouriteList)?.FavouriteList ?? []).some(item => item.title === title),
        5,
        1200
      );

      if (!ok) {
        return this.notify('未能确认已从设备收藏中删除（稍后点刷新查看）', 'warning');
      }

      // 就地删除，避免整表重建
      this.favourites = this.favourites.filter(item => item.title !== title);
      this.notify('已从设备收藏中删除');
    },

    // ---- 内置列表 ----
    async loadPlaylists() {
      const result = await ipcRenderer.invoke('get-playlist-info');

      this.playlistInfo = this.parseJson(result?.PlaylistInfo)?.PlaylistInfo ?? [];

      // 默认选中项必须真实存在（设备自报的列表索引不一定是 0/6）
      if (!this.playlistInfo.some(item => item.index === this.selectedListIndex)) {
        this.selectedListIndex = this.playlistInfo[0]?.index ?? 0;
      }

      await this.loadInterList();
    },

    async loadInterList() {
      const result = await ipcRenderer.invoke('get-inter-list', this.selectedListIndex);

      this.interList = this.parseJson(result?.InterList)?.InterList ?? [];
    },

    async playBuiltin(index) {
      const result = await ipcRenderer.invoke('play-list-item', this.selectedListIndex, index);

      this.guard(result, '已请求设备播放该曲目');
    },

    // ---- 时间 / 时区 / 设置 ----
    async loadTime() {
      const now = await ipcRenderer.invoke('get-time-now');
      const zone = await ipcRenderer.invoke('get-time-zone');
      const internetTime = await ipcRenderer.invoke('get-internet-time');

      this.timeNow = now?.CurrentTimeZone ?? '';
      this.timeZoneIndex = Number(zone?.Index ?? -999);
      this.internetTime = Number(internetTime?.Enable ?? -1);
    },

    async syncTime() {
      const stamp = this.formatNow();
      const minuteKey = stamp.slice(0, 16);

      this.busy = true;
      await ipcRenderer.invoke('set-time-now', stamp);
      this.busy = false;
      // 设备回读的秒可能差一两秒，比到分钟即可
      const ok = await this.verifyRead(
        () => ipcRenderer.invoke('get-time-now'),
        r => String(r?.CurrentTimeZone ?? '').slice(0, 16) === minuteKey,
        5,
        1200
      );

      this.notify(ok ? `已写入时间 ${stamp}` : `未能确认时间已写入（设备当前时间：${this.timeNow || '读取失败'}）`, ok ? 'success' : 'warning');
      await this.loadTime();
    },

    formatNow() {
      const pad = value => String(value).padStart(2, '0');
      const now = new Date();

      return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    },

    async applyTimeZone() {
      const pick = this.timeZonePick;

      this.busy = true;
      await ipcRenderer.invoke('set-time-zone', pick, this.zoneIdOf(pick));
      this.busy = false;
      const ok = await this.verifyRead(
        () => ipcRenderer.invoke('get-time-zone'),
        r => Number(r?.Index ?? -999) === Number(pick),
        5,
        1200
      );

      this.notify(ok ? '时区已设置' : '未能确认时区已设置（稍后点刷新查看）', ok ? 'success' : 'warning');
      await this.loadTime();
    },

    zoneIdOf(index) {
      const ids = { 72: 'Asia/Shanghai', 71: 'Asia/Hong_Kong', 81: 'Asia/Tokyo', 0: 'UTC' };

      return ids[index] ?? 'Asia/Shanghai';
    },

    async toggleInternetTime(enabled) {
      const target = enabled ? 1 : 0;

      await ipcRenderer.invoke('enable-internet-time', target);
      const ok = await this.verifyRead(
        () => ipcRenderer.invoke('get-internet-time'),
        r => Number(r?.Enable ?? -1) === target,
        5,
        1200
      );

      this.notify(ok ? (enabled ? '已开启网络时间' : '已关闭网络时间') : '未能确认网络时间开关（稍后点刷新查看）', ok ? 'success' : 'warning');
      await this.loadTime();
    },

    async loadExtra() {
      const tone = await ipcRenderer.invoke('get-extra-interface', JSON.stringify({ ActionType: { action_type: 2 } }));
      const autoplay = await ipcRenderer.invoke('get-extra-interface', JSON.stringify({ ActionType: { action_type: 3 } }));

      this.extra = {
        tone: Number(this.parseJson(tone?.Paramater)?.Paramater?.out_put ?? -1),
        autoplay: Number(this.parseJson(autoplay?.Paramater)?.Paramater?.out_put ?? -1)
      };
    },

    async setExtra(actionType, enabled) {
      const parameter = JSON.stringify({ Paramater: { action_type: actionType, out_put: enabled ? 1 : 0 } });

      await ipcRenderer.invoke('set-extra-interface', parameter);
      const ok = await this.verifyRead(
        async () => ipcRenderer.invoke('get-extra-interface', JSON.stringify({ ActionType: { action_type: actionType } })),
        r => Number(this.parseJson(r?.Paramater)?.Paramater?.out_put ?? -1) === (enabled ? 1 : 0),
        4,
        1200
      );

      this.notify(ok ? '设置已生效' : '未能确认设置已生效（本机固件可能不支持该扩展接口）', ok ? 'success' : 'warning');
      await this.loadExtra();
    },

    async loadWifi() {
      const result = await ipcRenderer.invoke('get-wifi-list');

      this.wifiList = this.parseJson(result?.WIFilist)?.WIFilist ?? [];
    },

    parseJson(text) {
      if (!text || typeof text !== 'string') {
        return null;
      }

      try {
        return JSON.parse(text);
      }
      catch (error) {
        return null;
      }
    }
  }
};
</script>

<style lang="scss" scoped>
.device-manager {
  padding: 8px;
}

.unit {
  margin: 0 8px;
  color: #606266;
}

.hint {
  margin-top: 10px;
  color: #909399;
  font-size: 12px;
  line-height: 1.6;
}
</style>
