# 果壳智能音响：设备协议事实表（移植依据）

> **本文件的每条事实都标了来源**，不要凭印象改：
> - `[设备]` = 从真机实测得到（SSDP/HTTP 抓取；原始抓包不入库，说明见 `.recon/README.md`）
> - `[app]` = 官方安卓端 Geak Music 1.6.3（`com.android.geakmusic`，APK sha256 `c0b652bf…44ad3fa`）反编译所得
> - `[文档]` = 厂商提供的 `geak-audio-app-api.md`
> - `[待确认]` = 尚未核实，改动前必须先验证
>
> 本文只记录**协议与设备本身**的事实，不含采集环境的网络地址、设备名等环境信息。

## 1. 设备与发现

| 项 | 值 | 来源 |
|---|---|---|
| 设备端口 | **不固定**：HTTP 根路径下即 `renderer.xml`，但端口随 UPnP 服务重启变化（实测 49152 / 49153 / 49154 都出现过，旧端口可能残留只回 `HTTP 500` 的实例）。**一律以 SSDP 响应里的 `LOCATION`（即 `URLBase`）为准，不要硬编码** | `[设备]` |
| friendlyName | 用户可在设备端设置，形如 `GM for …`；客户端不应依赖具体值 | `[设备]` |
| UDN（渲染器） | `uuid:geakmusic-<设备MAC>_MR`；**`geakmusic` 前缀是客户端筛选依据** | `[设备]` |
| deviceType | `urn:schemas-upnp-org:device:MediaRenderer:1` | `[设备]` |
| 设备描述 | `http://<设备IP>:49152/renderer.xml`，`URLBase = http://<设备IP>:49152/` | `[设备]` |
| serialNumber | `001` | `[设备]` |
| 同一设备还会应答 | `urn:schemas-upnp-org:device:MediaServer:1`、`urn:schemas-tencent-com:service:QPlay:1` | `[设备]` |

发现方式 `[app]`（已由 native 反汇编确认）：`CtrlPointStart` 里 `UpnpRegisterClient` 之后 `UpnpSearchAsync(handle, MX=5, ST)` **同时**搜两种设备类型——`urn:schemas-upnp-org:device:MediaRenderer:1` 与 `urn:schemas-upnp-org:device:MediaServer:1`；`CtrlPointRefresh(type, 1)` 中 `type=1` 对应 MediaServer、`type=2` 对应 MediaRenderer。渲染器与媒体服务器列表分开维护（`RendererList` / `MediaServerList`）。底层是标准 pupnp（`libupnp.so`）：`M-SEARCH * HTTP/1.1` + `MAN: "ssdp:discover"`。
现有项目只搜 `ST=urn:schemas-upnp-org:device:MediaServer:1` 并用 `UDN.indexOf('uuid:geakmusic') === 0` 过滤：该过滤器对真机成立（`uuid:geakmusic-…_MR`），但 **ST 与 app 不同**——app 还搜 `MediaRenderer:1`（控制端真正要控制的是渲染器）。

实现提示 `[设备]`（本机实测）：M-SEARCH 从**临时端口**发出即可，**不要绑定源端口 1900**——从 1900 发出去的搜索收不到任何响应，换成临时端口立刻就有响应（设备把应答单播回源端口）。响应里 `USN` 形如 `uuid:geakmusic-<MAC>_MR::<ST>`，取 `::` 前段做筛选即可；同一台设备的渲染器/媒体服务器应答用同一个 UDN。

设备**不会主动广播 `NOTIFY`（`ssdp:alive`）**：本机监听 45 秒只收到本机自己的 DLNA 服务广播，来自音响的一条都没有。所以**发现只能靠 M-SEARCH 应答**，不能依赖设备通告；好在控制端还会把设备地址缓存在本地（见 §4），缓存有效时连发现都可以跳过。

## 2. 服务与控制地址（设备自报）

| 服务 | serviceType | controlURL | eventSubURL |
|---|---|---|---|
| AVTransport | `urn:schemas-upnp-org:service:AVTransport:1` | `/MediaRenderer/AVTransport/Control` | `/MediaRenderer/AVTransport/Event` |
| RenderingControl | `urn:schemas-upnp-org:service:RenderingControl:1` | `/MediaRenderer/RenderingControl/Control` | `/MediaRenderer/RenderingControl/Event` |
| ConnectionManager | `urn:schemas-upnp-org:service:ConnectionManager:1` | `/MediaRenderer/ConnectionManager/Control` | `/MediaRenderer/ConnectionManager/Event` |
| QPlay（腾讯） | `urn:schemas-tencent-com:service:QPlay:1` | `/MediaRenderer/QPlay/Control` | `/MediaRenderer/QPlay/Event` |

控制地址一律相对 `URLBase` 解析。SOAPAction 头用 `"<serviceType>#<Action>"` 形式（标准 UPnP）。

## 3. 动作与参数（权威表）

完整动作表（含每个参数的方向）由脚本从设备 SCPD 自动生成，见 [`geak-device-actions.md`](./geak-device-actions.md)：

- **AVTransport:1 = 57 个动作**（标准 16 个 + GEAK 私有 41 个）
- **QPlay:1 = 9 个动作**
- **RenderingControl:1 = 6 个动作**（标准）
- **ConnectionManager:1 = 3 个动作**（标准）

设备自报与厂商文档的三处差异（**以设备为准**）：

1. `IOSBackGroundPlay(in:PlayListUrl)`：设备有、文档没有（iOS 后台播放，只推播放列表 URL）。
2. `SetGroupInfo(in:GroupInfo)` / `GetGroupInfo(out:GroupInfo)`：设备有、文档没有（多机分组/组播）。
3. `InterListDelete` 入参是 `(InstanceID, Index, Title, out Result)`；厂商文档写的是 `TracksMetaData`。app 传的是歌名（`GEAKDeviceInterListDelete(uuid, index, songname)`）。

## 4. 推送播放流程（app 的真实行为）

`[app]`（`GeakMusicService.java` 3679 行，行号即证据）：

1. 把播放列表写成 JSON，落盘到 **`<ShareDir>/PlayList.txt`**（`getPlayListPath()`，L1870；`CreateFiles.printText(...)` L1280）。
2. 内容形如（L1287 `addPlayListJson`）：
   ```json
   {"TracksMetaData":[{"type":2,"uuid":"<本地DMS的uuid>","url":"<音频URL>","title":"<标题>","metadata":""}]}
   ```
   注意：**`metadata` 被显式写成空字符串**（L1300 覆盖了 L1299 的值）。
3. 用 app 自带的 HTTP 服务对外提供该文件：`libdream.InitLibrary(<SD卡根>, "GeakMusic", <本机IP>)` 之后 `libdream.StartServer()`（`GeakMusicService` L795-796）。该服务就是 **pupnp 自带的 HTTP 服务器**（native 侧调用 `UpnpRegisterClient` / `UpnpSetWebServerRootDir` / `UpnpSetMaxContentLength`），web 根 = SD 卡根、前缀 `GeakMusic`，即 `ShareDir` = `<SD卡根>/GeakMusic/`。**端口是运行时动态分配的**：`GetLocalIP()` 内部用 `UpnpGetServerPort()` 拼成 `"<IP>:<端口>"`（native 已确认），所以推给设备的 URL 必须带上这个动态端口；该服务器支持 `Range: bytes=`（`libupnp.so` 内含 `Range: bytes=%d-%d` 与 `/index.html`）。
4. 组织 `CurrentURI`（L1506）：
   ```
   geakmusic://<首曲URL>|<repeatMode>|<播放列表URL>|
   ```
   其中播放列表 URL 是 `http://<本机内网IP>:<端口>/<路径>/PlayList.txt`（L1503-1505 由 ShareDir 路径拼接）。
   注：厂商文档的示例里这个 URL 以 `PlayList.xml` 结尾，而 app 实际写的是 `PlayList.txt`——文件名由控制端自己决定，设备只按给定 URL 取；实现时"本地服务实际提供的路径"与"推给设备的 URL"必须一致。
5. 调 `CtrlPointPlayURI(uuid, uri, metaData)`（native，L1967）→ 设备端 `SetAVTransportURI`；`metaData` 为空时 app 传字面量 `"metaData"`（L1531）。
6. DIDL 元数据由 `CtrlPointGetMetadata(title, creator, artist, album, albumArtURI, url, duration, size, type)`（native，L1974）生成；类名用 `object.item.geakMusic` `[app]`（`libdream.so` 字符串）。

### 播放流程的完整动作序列（native 确认，已真机验证出声）

`CtrlPointPlayURI`（`libdream.so` @ `0x218a0`，`jni/dream-control.cpp`）在**一次调用里连发三个 AVTransport 动作**：

| 顺序 | 动作 | 参数 |
|---|---|---|
| 1 | `Stop` | `InstanceID=0` |
| 2 | `SetAVTransportURI` | `InstanceID=0`、`CurrentURI`、`CurrentURIMetaData`（为空时 Java 侧传字面量 `"metaData"`） |
| 3 | `Play` | `InstanceID=0`、`Speed=1` |

证据：反编译里第 2 步失败打印 `send setavTransportURI error`、第 3 步失败打印 `send play error`；第 3 步带的参数对是 `InstanceID` + `Speed`（AVTransport 动作里只有 `Play` 是这个形状）。

**设备本身不需要 `Play`**：真机 A/B 实测（先 `Stop` 回到 `STOPPED`，再**只发** `SetAVTransportURI`、不发 `Play`）设备立刻取播放列表与音频并出声（800Hz 测试音，耳朵确认，状态 `PLAYING`）。所以 app 的第 3 步 `Play` 是**冗余但无害**的；照 app 发全三步最稳（发射台/普通 URL 时 `Play` 是否必需尚未单独验证）。

另注：控制端把设备地址缓存在本地（`~/.geak-audio-device-cache.json`），只要该地址的 `renderer.xml` 仍可访问，就不必重新走 SSDP 发现——这解释了"以前没管发现也能正常播放"。

实现约定：**固定每次都发 `Play(Speed=1)`**（与 app 无条件发送一致），不依赖设备的自动播放行为；该步失败只告警，不判定推送失败（因为设备可能已经自己播了）。

### DIDL 模板（native 原样）

`GetMetada`（`libdream.so` @ `0x245c8`）拼出的模板（`[ ]` 表示有条件才带）：

```xml
<DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/">
<item id="0" parentID="-1" restricted="false">
<upnp:class>object.item.geakMusic</upnp:class>
<dc:title>…</dc:title><dc:creator>…</dc:creator><upnp:artist>…</upnp:artist><upnp:album>…</upnp:album><upnp:albumArtURI>…</upnp:albumArtURI>
<res protocolInfo="http-get:*:audio/mpeg:" [size="<字节数>"] [duration="HH:MM:SS.000"]>音频URL</res>
</item></DIDL-Lite>
```

- `upnp:class` 有另一个分支 `object.item.audioItem.musicTrack`（native 里按第 9 个入参是否为 0 选择）。
- `protocolInfo` 固定为 `http-get:*:audio/mpeg:`（不是省略后两段的 `http-get:*:*:`）。
- `size` / `duration` 由本地媒体库扫描得到，**有值才带**；`duration` 由秒数换算成 `HH:MM:SS.000`。
- native 只把 `&` 转义成 `&amp;`；`<`/`>`/引号由客户端自行补全更稳妥（设备按标准 XML 解析，实测带完整转义正常）。

### 设备作为 HTTP 客户端的行为（实测，决定本地服务怎么写）

| 取什么 | User-Agent | 特征 | 服务端应答 |
|---|---|---|---|
| 播放列表 | `Wget/1.14 (linux-gnu)` | `Connection: Keep-Alive`、无 `Range` | `200` 全量 |
| 音频文件 | `MPlayer SVN-r32106-snapshot-4.1.2`（也见过无 UA 的同款取法） | `icy-metadata: 1`、`Connection: close`、**不带 `Range`** | `200` 全量 |
| 长度探测 | 无 UA | `Range: bytes=<文件大小>-`（起点正好在 EOF） | `416` + `Content-Range: bytes */<文件大小>` |

要点：

1. **推送后设备立刻取播放列表**（地址就是 `geakmusic://` URI 的第 3 段），再取音频；同一条 URI 下会周期性重取列表（一次播放实测取了 3 次）。
2. **播放器不请求分段**（整文件 `GET`），本地服务不必为播放实现 `Range`。那种"起点在 EOF"的 `Range` 请求是**长度探测**，按规范回 `416` 并在 `Content-Range` 里给出总长度即可——设备正是从该头读到文件大小，**不要**改成回 `200` 全量。
3. 设备**一个请求一条连接**（`connection: close`，回完就断）。本地服务无需保活；反向调用（我们 → 设备）必须禁用 keep-alive，否则第二次调用会 `socket hang up`。
4. URI 第 2 段的模式位在真机上有效：`1`（`SINGLE_CYCLE`）实测**持续循环**。

### 播放模式映射（已核实）

| app 的 repeatMode | 设备 `SetPlayMode` 值 | 语义 |
|---|---|---|
| 1 | `SINGLE_CYCLE` | 单曲循环 |
| 2 | `SEQUENCE_PLAY` | 列表循环（顺序） |
| 3 | `RANDOM_PLAY` | 随机 |

证据：`MusicPlayingActivity.java` L678-692（`setRepeatMode(1)`↔`SINGLE_CYCLE`、`(3)`↔`RANDOM_PLAY`、`(2)`↔`SEQUENCE_PLAY`，同时把字符串下发 `sendRequestUpnpHandle(uuid, 8, …)`）。
**现有项目把 `geakmusic://` 里的这一位硬编码成 `2`，忽略用户设置的模式** —— 与 app 不符。

## 5. 设备管理动作 → app 的调用映射

> P3 实现：`src/lib/device.js` 已按本表逐项封装（导出名见该文件 `export default`），JSON 类参数一律由调用方组装后原样透传。

### 参数格式补充（写 P3 实现时逐条核对）

| 动作 | 参数细节 |
|---|---|
| `GetExtraInterface` / `SetExtraInterface` | 参数是 **JSON 字符串**，形如 `{"ActionType":{"action_type":N}}`（app 的 `actionTypeJson()`），**不能传裸数字**。⚠️ 实测给 `GetExtraInterface` 传裸 `"0"`（非法值）后，设备的 UPnP 服务会**重启**（短暂不可达，端口变化，约 10 秒后自恢复）。`N` 的合法值见上表（1/2/3/9/10/11），其中 0 不合法。 |
| `Rename` | `NewName` 是**裸字符串**（native 直接把入参塞进 `NewName`）。app 的入口是 `sendRequestUpnpHandle(uuid, 12, newName, …)`。✅ 实测：ASCII 名（`GEAK-Test`）与中文名（`测试名`）都**改名成功**。⚠️ 但改名会让设备的 **UPnP 服务重启**：返回 200 后现有连接/端口短暂不可达，**约 10 秒后在（可能变化的）新端口上自行恢复**（实测端口 49152→49153→49154），不需要人工干预。客户端做法：改名后等待并**重新发现**端口，不要继续用旧端口。 |
| 闹钟 `CreateAlarm`/`UpdateAlarm` | `Recurrence` 取 `"0"`..`"5"`（`Constant.ALARM_TYPE_BIND_ONE`..`BIND_SIX`）；`Enabled` `"0"`/`"1"`；`UrlType`：`"8"` 默认闹钟铃声、`"6"` 我的收藏、`"7"` 轻听、其余为按键 1-6；`ProgramURI` 默认 `"default_clock_tone"`，app 创建时传的是 **`"标题\|节目URI"`**；`Volume` 默认 `"30"`。 |
| `PlayListItem` | 参数是 `(Index, PlayListIndex)`，Index = 内置列表号、PlayListIndex = 列表内序号。 |
| `InterListAdd` | `TracksMetaData` 的参数形状是 **`{"InterListAdd":[{type,uuid,url,title,metadata}]}`**（不是播放列表那种 `{"TracksMetaData":[...]}`！）。`uuid` 传**分享方 DMS 的 uuid**（app 用 `getShareUUID()` 或本机 DMS uuid），`metadata` 复用播放列表那套 DIDL（app 也是调 `CtrlPointGetMetadata` 生成）。实测用该格式 `InterListAdd` 后 `GetInterList` 能读到条目。 |
| `InterListDelete` | native 把载荷塞进 **`Title`** 参数（`CtrlPointInterListDelete` 里 `UpnpAddToAction(..., "Title", param_3)`）；app 传的是 `{"InterListDelete":[{"title":…}]}`。⚠️ 实测：纯标题返回 `Result=ERROR`，JSON 形返回 `OK` 但条目**仍在列表里**（删除未生效，原因待查，见 §7）。 |
| `GetPlayListCount` | 与 `GetInterList` 不同步：加了条目后 `GetInterList` 能读到、`Count` 仍是 `0`；`index=6` 返回 `-1`。不要用 `Count` 判断列表是否为空。 |
| `SetNetwork` | `AuthAlgo`: `open`/`shared`/`WPAPSK`；`CipherAlgo`: `none`/`WEP`/`AES`。⚠️ 会切换设备网络，可能让它从局域网消失。 |
| `SetExtraInterface` | 入参名是设备自报的拼写 **`Paramater`**（固件里的拼写错误，照抄）。 |

### 写动作实测结论（真机，逐条验证过）

| 动作 | 结果 |
|---|---|
| `CreateAlarm` / `ListAlarms` / `EnableAlarm` / `UpdateAlarm` / `DestroyAlarm` | ✅ 全通。`AssignedID` 等于 `StartTime`（**ID 就是起始时间，改时间后 ID 会变**，以返回的 `AssignedID` 为准）；`EnableAlarm` 后 `ListAlarms` 的 `Enabled` 会跟着变 |
| `TimingShutdown(-1)` / `GetTiming` | ✅ 通（取消态，`GetTiming` 返回 `-88`）。单位是**分钟**（app 侧入参名 `min`）；`-1` 取消、`0` 立即关机、`999` 重启 `[文档]` |
| `SetTimeZone(Index=72,"Asia/Shanghai")` | ✅ 通。app 的时区表 `R.array.timezone_values_new` 共 283 项，`Asia/Shanghai` 在下标 **72**；设置后 `GetTimeZone` 回读 `Index=72` |
| `SetTimeNow` | ✅ 通（回写设备自报的时间串即可）。注意设备自身时钟可能不准（实测停在 2010 年，只有时分秒在走） |
| `HoldButton` / `GetHoldStatus` | ✅ 全通（`1` 上锁 → 读回 `1` → `0` 解锁 → 读回 `0`） |
| `Record` / `GetFavouriteList` / `FavouriteDelete` | ✅ 全通。`Record` 收藏当前播放曲；**`FavouriteDelete` 用纯标题即可删除**（与 `InterListDelete` 不同） |
| `GetExtraInterface` / `SetExtraInterface` | ✅ 全通。**读**：参数 `{"ActionType":{"action_type":N}}`；**写**：参数 `{"Paramater":{"action_type":N,"out_put":V}}`（line-in 用 `linein` 字段、定时关机用 `customShutTimeJson` 那套）。实测「提示音」`out_put` 1→0 写入生效并回读确认。⚠️ `ActionType`/`action_type` 的合法取值未完全枚举：实测 `ActionType=2` 直接 SOAP 失败（返回 `false`），且**必须先读到合法值再回写**——用读不到的值硬写会回 `Result=ERROR` |
| `GetPlaylistInfo` / `GetInterList` / `InterListAdd` | ✅ 通（`InterListAdd` 用 `{"InterListAdd":[…]}` 格式） |
| `InterListDelete` | ⚠️ 未生效：纯标题回 `Result=ERROR`，app 的 `{"InterListDelete":[{"title":…}]}`、`{"TracksMetaData":…}`、带 `index`/完整条目等变体都回 `OK` 但**条目仍在**（`GetInterList` 复核）。畸形载荷还会触发 UPnP 服务重启。**对策：客户端不要提供"删除内置列表条目"，或明确提示"需重启设备才会清除"** |
| `GetPlayListCount` | ⚠️ 与 `GetInterList` 不同步（加了条目仍返回 `0`），不能当"条数"用 |
| `GetCurrentTransportActions` | ⚠️ 虽在 SCPD 里声明，**实测恒返回 `501 Action Failed`**，不要依赖 |
| `FavouriteFindout` | ✅ **可用（修正早前结论）**：返回 `{code, favourite, linein, power}`（当前曲是否已收藏 / linein / 电量）。早前记为 501 是探测姿势不对 |

> ⚠️ **写动作的两个特性**（实测，客户端必须容忍）：
> 1. **会让 UPnP 服务重启**：`Rename`、参数非法/畸形的写动作等，返回 200 后设备会短暂不可达（SSDP 静默、旧端口拒连或回 `HTTP 500`），**约 10 秒后在（可能变化的）新端口上自行恢复**——**不需要断电重启**。写动作之后请等待并重新发现端口。
> 2. **端口不是固定的**：UPnP/HTTP 端口随服务重启变化（实测 49152 ↔ 49153 ↔ 49154），旧端口可能残留一个**只回 `HTTP 500`** 的实例。**不要硬编码端口**，一律用 SSDP/LOCATION 里的地址；缓存地址失效时重新发现（控制端"缓存 `URLBase` 并校验 `renderer.xml`"的做法正好适配）。
>
### app 侧 JS 实现（`src/lib/device.js`）真机全量验收

用 `.recon/tools/js_e2e.cjs` 直接驱动 app 的 `device.js`（esbuild 打包产物），把 P3 面板 25 个通道对应的 54 个方法逐条对真机执行（一轮 80 次调用）：

| 组 | 结果 |
|---|---|
| 只读（DeviceInfo / PlayInfo / PlaylistInfo / InterList / PlayListCount / TimeZone / TimeNow / InternetTime / Timing / HoldStatus / WifiList / MediaInfo / PositionInfo / TransportInfo / 收藏 / 账号 / 扩展接口） | ✅ 均可取到；`GetMediaInfo` 在服务重启窗口内偶发失败，重试即通 |
| 改名 | ✅ 生效并成功改回；改名后设备约 13s 才恢复可达（期间 SSDP 静默） |
| 闹钟 CRUD | ✅ 建（`07:31`）→ 启用（`Enabled=1`）→ 停用（`0`）→ 删除（列表回空），每步读回确认 |
| 按键锁 | ✅ `1` 上锁 → 回读 `1` → `0` 解锁 → 回读 `0` |
| 时间 | ✅ `SetTimeZone(Index=72)` / `EnableInternetTime(1)` / `SetTimeNow(本机时间)` 均回读一致 |
| 定时关机 | ✅ `TimingShutdown(30)` → `LeftTimes=1799`；`TimingShutdown(-1)` → `-88`（已取消） |
| 播放模式 / 音量 | ✅ `SINGLE_CYCLE` ↔ `SEQUENCE_PLAY`、音量 30 ↔ 50 均回读一致 |
| 推送播放 | ✅ 中文标题 + 本地文件 → 设备取 `playlist.json` 与音频、状态 `PLAYING`；`Pause` / `Play` / `Seek` 通 |
| 收藏 | ✅ `Record` 新增当前曲 → `FavouriteDelete`（纯标题）回 `OK` 且列表回空 |
| 内置列表删除 | ❌ `InterListDelete`（纯标题）回 `Result=ERROR`，条目仍在（与早前结论一致） |
| 扩展接口 | ❌ `GetExtraInterface(ActionType=2)` SOAP 失败；`SetExtraInterface` 回写回 `Result=ERROR`（合法取值待枚举） |

**必须写进客户端逻辑的三条实测特性**：

1. **`CreateAlarm` 可能返回协议层失败（`false`）但闹钟其实已经建好** → 面板不能只看返回值，必须用 `ListAlarms` 复核后再提示成功/失败。
2. **写动作后设备短暂不可达（约 10–13s）**：`Rename`、闹钟等写动作之后立刻调用会失败（实测 SSDP 静默；`searchDeviceFromCache` 还返回了**过期端口** `49152`，而设备实际在 `49153`）。客户端应在写动作后**重试 + 重新发现**，不要用缓存地址硬试。
3. **设备对非法参数照单全收**：误发 `HoldButton`（`Enable=NaN`）后 `GetHoldStatus` 老实回 `"NaN"`（可用 `HoldButton(0)` 修回）。客户端必须自己拦截非法入参。

> 测试写动作一律用 `.recon/tools/mgmt_test.py`（端口自动发现 + 每条之后自动探活）；验收 app 侧 JS 实现用 `.recon/tools/js_e2e.cjs`（同上，且跑完自动恢复基线状态）。

**已在代码里落地的两条对策**（对应上面 1、2）：

- `src/lib/device.js`：`searchDeviceFromCache()` 校验缓存地址时**先取描述文件、再真调一次 `GetTransportInfo`**（旧实例可能仍能取到 `renderer.xml`，只校验描述文件会误判可用）；不可用就丢缓存重新发现。`withDevice()` 失败（含**抛异常**，例如拿 `undefined` 去 `JSON.parse`）时丢缓存 → 重新发现 → 重试一次；非幂等写动作（建闹钟/收藏当前曲/加歌到内置列表/把当前曲加入列表）传 `{ retry: false }` 避免重复执行。
- `src/components/DeviceManager.vue`：所有写动作改用 `verifyRead()` **以读回为准**（轮询若干次，超时才报失败），不再只看返回值；闹钟的增/启停/删、改名、定时关机、按键锁、收藏增删、时区、时间同步、网络时间、扩展接口都已接上。
- 实测：把缓存指向"描述可取、控制地址是死端口"的假设备后，`getDeviceInfo` 能在 **421ms** 内自动恢复（修复前是抛异常失败）。

app 的 Java 层通过 `com.android.dream.libdream` 的 native 方法访问协议（`GeakMusicService.java` 内 48 处调用）：

| app native 方法 | 对应设备动作 | 参数 |
|---|---|---|
| `CtrlPointPlayURI(uuid, url, meta)` | `SetAVTransportURI` | 见上 |
| `CtrlPointSendAction(uuid, type, value, session)` | 通用命令分发（type 表见本节末） | — |
| `CtrlPointGetAVTransportStatus(udn, status, session)` | `GetTransportInfo` / 状态回调 | — |
| `CtrlPointGetVolume(uuid)` | `RenderingControl.GetVolume` | — |
| `CtrlPointGetPlayMode(uuid)` | `GetTransportSettings` | — |
| `CtrlPointRecord(uuid)` | `Record`（收藏当前曲到红心列表） | — |
| `GEAKDeviceFavouriteList(uuid)` / `GEAKDeviceFavouriteDelete(uuid,title)` | `GetFavouriteList` / `FavouriteDelete` | — |
| `CtrlPointFavouriteFindout(uuid)` | `FavouriteFindout`（当前曲是否已收藏 + linein + 电量） | — |
| `GEAKDeviceInterList(uuid,index)` | `GetInterList` | index 从 0（按键1..6） |
| `GEAKDeviceInterListAdd(uuid,index,TracksMetaData)` | `InterListAdd` | 单次最多 100 条 `[文档]` |
| `GEAKDeviceInterListDelete(uuid,index,songname)` | `InterListDelete` | 注意是 **Title** 不是 metadata |
| `GEAKPlayInterPlayListItem(uuid,index,playlistIndex)` | `PlayListItem` | — |
| `CtrlPointAddPlayList(uuid,index)` | `AddPlayList`（把当前曲加入内置列表） | — |
| `CtrlPointGetPlayListCount(uuid,index)` | `GetPlayListCount` | — |
| `CtrlPointGetPlaylistInfo(uuid)` / `CtrlPointSetPlaylistInfo(uuid,info)` | `GetPlaylistInfo` / `SetPlaylistInfo`（内置列表改名） | — |
| `CtrlPointMusicBanding(uuid,index,TracksMetaData)` | `MusicBanding`（把内容源绑定到某个按键） | 各内容源参数结构见厂商文档 |
| `CtrlPointCreateAlarm/UpdateAlarm/DestroyAlarm/EnableAlarm/ListAlarms` | 同名 | 参数顺序一致（StartTime/StartDate/Recurrence/Enabled/ProgramURI/Volume/UrlType，ID 用于更新与删除） |
| `CtrlPointGetTiming(uuid)` / `CtrlPointTimingShutdown(uuid,min)` | `GetTiming` / `TimingShutdown` | `TimeOuts`：-1 取消、0 立即关机、999 重启 `[文档]` |
| `CtrlPointGetTimeZone/SetTimeZone/GetTimeNow/SetTimeNow` | 同名 | SetTimeNow 格式 `YYYY-MM-DDHH:MI:SS` `[文档]` |
| `CtrlPointEnableInternetTime/GetInternetTime` | 同名 | 1 开 0 关 |
| `CtrlPointHoldButton(uuid,enable)` / `CtrlPointGetHoldStatus(uuid)` | `HoldButton` / `GetHoldStatus` | 按键锁 |
| `CtrlPointSetExtraInterface/GetExtraInterface(uuid,paramater)` | `SetExtraInterface` / `GetExtraInterface` | action_type：1 linein、2 提示音、3 自动播放、9 定时关机、10 隐藏 SSID、11 AP 热点 `[文档]` |
| `CtrlPointSetNetwork(uuid,SSID,Key,AuthAlgo,CipherAlgo)` | `AVTransport.SetNetwork`（另有 `QPlay.SetNetwork`，无 InstanceID） | AuthAlgo: open/shared/WPAPSK；CipherAlgo: none/WEP/AES `[文档]` |
| `GEAKGetWIFilist(uuid)` / `GEAKGetWIFinfo(uuid)` | `GetWIFilist` / `GetWIFinfo` | 返回 JSON（ssid/level/type、ssid/password/type）`[文档]` |
| `GEAKDeviceInfo(uuid)` | `GetDeviceInfo` | 返回 JSON：DeviceName/hardware/externalSoftware/internalSoftware/macAddr/ipaddr/deviceID/sdcardCapacity/AvailableSpace/upgrade/isregister `[文档]` |
| `CtrlPointGetPowerStatus(uuid)` | `GetPowerStatus` | — |
| `CtrlPointGetAccountInfo/SetAccountInfo` | `GetAccountInfo` / `SetAccountInfo` | 各内容源账号，type 1/3/4/5 `[文档]` |
| `GetLocalIP` / `GetLocalDMSUUID` / `GetAdHocIP` | —（本机信息，非设备动作） | 推送时构造本机 URL 用 |

### 命令分发 type 表（native 反汇编确认）

`CtrlPointSendAction(uuid, type, value, session)` 的分支（`libdream.so` 的 `CtrlPointSendAction`，与 Java 侧 `Constant.E_*` 常量逐条一致）：

| type | SOAP 动作 | 服务 | 参数（`InstanceID` 恒为 0） | value 语义 |
|---|---|---|---|---|
| 1 | `Play` | AVTransport | `Speed` | 固定 `1` |
| 2 | `Stop` | AVTransport | — | — |
| 3 | `Pause` | AVTransport | — | — |
| 4 | `Seek` | AVTransport | `Unit=REL_TIME`, `Target` | 目标时间串 |
| 5 | `SetVolume` | **RenderingControl** | `Channel=Master`, `DesiredVolume` | 音量数字 |
| 6 | `Next` | AVTransport | — | — |
| 7 | `Previous` | AVTransport | — | — |
| 8 | `SetPlayMode` | AVTransport | `NewPlayMode` | `SINGLE_CYCLE` / `SEQUENCE_PLAY` / `RANDOM_PLAY` |
| 9 | `Record` | AVTransport | — | 收藏当前曲到红心列表 |
| 10 | `Reset` | AVTransport | — | 恢复出厂 |
| 11 | `Upgrade` | AVTransport | — | 设备升级 |
| 12 | `Rename` | AVTransport | `NewName` | 新设备名 |

状态读取用 `CtrlPointGetAVTransportStatus(uuid, status, session)`，`status` 取值（`Constant.GET_*`）：1 `GetMediaInfo`、2 `GetTransportInfo`、3 `GetPositionInfo`、4 `GetDeviceCapabilities`、5 `GetTransportSettings`、6 `GetCurrentTransportActions`。

> 坑：`Constant.java` 里的 `REPEAT_NONE/REPEAT_CURRENT/REPEAT_ALL = 0/1/2` 是本地播放器用的另一套常量，**不要**与 `geakmusic://` 里的 repeatMode（1/2/3）混用。

### 若干动作的实测返回（真机）

- `GetDeviceInfo` → `DeviceInfo` 是 **JSON 字符串**，字段：`DeviceName`、`hardware`（如 `GM6`）、`externalSoftware`（控制端/对外软件版本号）、`internalSoftware`（固件版本，形如 `20151209`）、`macAddr`、`ipaddr`、`deviceID`、`sdcardCapacity`、`AvailableSpace`、`upgrade`、`isregister`、`code`。
- `GetTransportInfo` → `CurrentTransportState`（`PLAYING`/`STOPPED`/`PAUSED_PLAYBACK`/`TRANSITIONING`/`NO_MEDIA_PRESENT`）、`CurrentTransportStatus`（`OK`）、`CurrentSpeed`（`1`）。
- `GetTransportSettings` → `PlayMode`（`SEQUENCE_PLAY` 等）、`RecQualityMode`。
- `GetVolume`（需 `Channel=Master`）→ `CurrentVolume`（0-100）。
- `GetPowerStatus` → `PowerStatus`（电量整数）。
- `GetTiming` → `LeftTimes`（秒；`-88` 表示定时关机已取消）。
- `ListAlarms` → `CurrentAlarmList`，JSON 字符串；无闹钟时为 `{"ListAlarms":[]}`。
- `GetPlaylistInfo` → `PlaylistInfo`，JSON 字符串，元素 `{index, name, playing, type}`；`index=6` 恒为「我的收藏」。
- `GetMediaInfo` → `NrTracks` 恒为 1，其余多为字面量 `NOT_IMPLEMENTED`（`NextURI`、`RecordMedium`、`WriteStatus`）。
- `GetPositionInfo` → `Track`、`TrackDuration`/`RelTime`（`00:00:00` 形式）、`RelCount`/`AbsCount`（无曲目时 `-1`）、`AbsTime=NOT_IMPLEMENTED`。
- `GetTimeZone` → `Index`（未设置时 `-999`）；`GetTimeNow` → 参数名叫 `CurrentTimeZone`，但返回的是**日期时间字符串**（`YYYY-MM-DD HH:MM:SS`）；设备时钟可能与实际时间不符。
- `GetInternetTime` → `Enable`（1 开 / 0 关）；`GetHoldStatus` → `HoldStatus`（0 未锁 / 1 已锁，配合 `HoldButton` 按键锁）。
- `GetInterList` → `InterList` JSON：空列表 `{"InterList": null,"code":"1"}`；非法 index（如 6）为 `{"InterList": null,"code":"-99"}`。
- `GetPlayListCount` → `Count`（内置列表空时为 `0`；`index=6` 返回 `-1`）。
- `GetFavouriteList` → `FavouriteList` JSON，空为 `{"FavouriteList": null,"code":"1"}`。
- ⚠️ `GetWIFinfo` → `WIFinfo` JSON（元素 `{password, ssid, type}`）**明文返回当前 WiFi 密码**；`GetAccountInfo` → `AccountInfo` JSON（元素 `{flag, user_id, password, token, type}`）**明文返回绑定账号凭据**。**隐私**：这两个接口的返回值（WiFi 密码、账号邮箱/密码/token）一律不要写进日志、文档、截图或上报。
- `GetCurrentTransportActions` 虽在 SCPD 里声明，但**实测恒失败**（协议层返回 `false` / SOAP Fault），不要依赖。
- `FavouriteFindout` **可用（修正早前结论）**：返回 `{code, favourite, linein, power}`（当前曲是否已收藏 / linein / 电量）。早前记为 501 是探测姿势不对。
- 只读 getter **不带 `InstanceID` 也被接受**（实测），但写动作应显式带 `InstanceID=0`（与 app 一致）。

## 6. 状态与事件

- 设备侧只有 `LastChange` 标注了 `sendEvents="yes"`（其余状态变量都 `no`）`[设备]`，即标准 UPnP GENA + AVTransport `LastChange` 事件模型。
- `TransportState` 取值：`STOPPED` / `PLAYING` / `PAUSED_PLAYBACK` / `TRANSITIONING` / `NO_MEDIA_PRESENT`；`CurrentPlayMode`：`SINGLE_CYCLE` / `SEQUENCE_PLAY` / `RANDOM_PLAY`；`Seek` 的 `Unit`：`ABS_TIME` / `REL_TIME` / `TRACK_NR` `[设备]`。
- 另有两个私有状态变量 `TimeZone`、`A_ARG_TYPE_TimeZoneIndex`，被几乎所有私有动作的 out 参数引用（设备 SCPD 把它们当通用字符串容器用）`[设备]`。
- app 用**订阅 + 会话回调**：native 侧 `subscribeAVEvent` 对设备的 AVTransport 事件地址发 `UpnpSubscribe`（请求超时 1810 秒，pupnp 默认值），另有一路 `subscribeToContentDirectory`（app 自身也充当 DMS，用于本地媒体共享）；命令结果通过会话回调 `libdream.ControlCallback(session, errcode)` 返回。
- 现有项目用 `GetTransportSettings` + `GetVolume` 轮询 `[app]` 也是可选路径，但与 app 的会话模型不同。

## 7. 待确认清单（改动前必须验证）

1. `geakmusic://` 里除 `|<mode>|` 外是否还有设备侧校验：设备对我们自造的 URL 形式是否一律接受（同类 URL 现有项目已在真机用过，但未逐字段验证）。
2. `SetGroupInfo` / `GetGroupInfo` 的 JSON 结构（设备有这两个动作、厂商文档缺失）。
3. `SetPlaylistInfo` 改名约束：`Rename` 明确要求非空、最多 10 个中文字符；`SetPlaylistInfo` 的约束 `[文档]` 只说"我的收藏"不允许改名。
4. 大文件/拖动进度条时设备是否改用 `Range` 请求（实测 24KB 与 480KB 文件都只有整文件 `GET`，未出现 `Range`）。
5. 普通 `http://` URL（电台/直链）时是否必须发 `Play`：本轮只验证了 `geakmusic://` 形式下不发也自播。
6. ~~`Rename` 的中文名打挂 UPnP 服务是否稳定复现~~ → **已定论（原结论作废）**：`Rename` 无论 ASCII 名还是中文名都会**改名成功**，代价是 UPnP 服务重启约 10 秒并可能在**新端口**恢复；不需要断电，也不存在"中文名触发固件 bug"。
7. 闹钟 ID 的语义：`CreateAlarm` 的 `AssignedID` 实测等于 `StartTime`（`07:30`），而 `ListAlarms` 返回的 JSON **没有 ID 字段**；用 `ID=StartTime` 调 `DestroyAlarm` 可以删除成功；`UpdateAlarm` 会把 ID 一起改成新的 `StartTime`。
8. `InterListDelete` 的有效载荷：**仍未解决**。native 把它塞进 `Title`；实测纯标题经 JS 层回 `Result=ERROR`、app 的 `{"InterListDelete":[{"title":…}]}` 回 `OK` 但**条目仍在**（`GetInterList` 复核）；`{"TracksMetaData":…}`、带 `index`、完整条目等变体同样无效。畸形载荷还会触发 UPnP 服务重启。
   **对策（客户端）**：不提供"删除内置列表条目"，或明确提示"需整机断电才会清除"（实测该条目会一直留在按键列表里）。
9. `GetExtraInterface` 的 `ActionType` 合法取值未枚举（实测 `=2` 直接 SOAP 失败）；`SetExtraInterface` 除已验证的「提示音」`out_put` 外的参数结构待补。
10. `searchDeviceFromCache` 会返回**过期端口**（实测缓存 `49152`、设备实际 `49153`）：客户端缓存必须校验、失效则重新发现，否则写动作之后的首次调用必失败。

已解决（勿再重复验证）：命令 type 表（§5）、内部 HTTP 服务的端口/根目录/`Range`（§4）、事件订阅方式（§6）、设备取播放列表的时机与重取（§4：推送后立即取、同一 URI 下周期性重取）、写动作导致 UPnP 服务重启且端口变化（§5）、`Rename` 的中英文名行为（§5）、闹钟 CRUD/定时关机取消/`SetTimeZone`/`InterListAdd` 的可用性（§5）。

## 8. 现有项目 vs app：已确认的差异

| # | 项目现状 | app / 设备实际 | 影响 |
|---|---|---|---|
| 1 | `geakmusic://…\|2\|…` 播放模式硬编码 `2` | 传用户当前模式（1/2/3，见 §4） | 设备端循环模式与界面不一致（**已修**：按模式映射生成） |
| 2 | 播放列表走 `/playlist.json`（express 随机端口） | 写 `<ShareDir>/PlayList.txt`，由 app 自带 HTTP 服务提供 | 设备按 app 的路径取列表；文件名/路由不一致时行为未验证（**实测无影响**：设备只按给定 URL 取） |
| 3 | 轨道 `metadata` 填了内容 | app 写空字符串 | 设备端元数据显示可能与 app 行为不同 |
| 4 | 设备管理动作几乎未实现 | 见 §5（闹钟/收藏/内置列表/改名/时区/关机/按键锁/WiFi/扩展接口/分组/电量） | 本轮范围要补齐 |
| 5 | 未订阅设备事件 | app 对 AVTransport 事件地址发 `UpnpSubscribe`（超时 1810s） | 状态刷新可靠性与 app 不同 |
| 6 | 只搜 `MediaServer:1` | app 同时搜 `MediaRenderer:1` 与 `MediaServer:1`，MX=5（§1） | **已修**：两种 ST 都发，渲染器优先 |
| 7 | 本地文件服务 `Range`：**实测无需改动**（express `res.sendFile` 已返回 `206` + `Content-Range` + `Accept-Ranges`） | app 的 pupnp 服务器同样支持 `Range: bytes=`；设备播放只用整文件 `GET`，另有 EOF 起点探测（§4） | 无差异（**已补**：EOF 起点探测改为安静回 `416`，避免未处理异常堆栈） |
| 8 | 音量/传输控制未按 type 表实现（走各自 action） | app 统一经 `CtrlPointSendAction` 的 type 1-12（§5） | 行为等价即可，无需照抄调用形态，但参数必须与表一致 |
| 9 | 推送做 `Stop` + `SetAVTransportURI` + `Play(Speed=1)`（HEAD 已有） | `CtrlPointPlayURI` 同样是这三步（二进制字符串 `Stop` / `Play` 已核实） | **无差异**；真机实测第 3 步 `Play` 并非必需（设备收 URI 后自播），但保留以与 app 一致 |
| 10 | DIDL 的 `protocolInfo` 用 `http-get:*:*:`、不带 `size`/`duration` | `http-get:*:audio/mpeg:`，`size`/`duration` 有值才带（§4） | 与 app 不完全一致（**已对齐**） |
| 11 | P3 设备管理动作（闹钟/改名/时区/按键锁/定时关机/收藏/播放模式/音量/推送）在 app 侧 `device.js` 的实现 | 见 §5「app 侧 JS 实现真机全量验收」 | **已验收**：25 个面板通道对应的 54 个方法全部真机跑通（80 次调用），仅 `InterListDelete` 与扩展接口两项设备侧不支持 |

## 9. 原始材料位置

- 入库文档：本文件与 [`geak-device-actions.md`](./geak-device-actions.md)（结论、动作表）
- **不入库**的分析过程产物（真机抓包、SCPD 原文、抓取脚本）在 `.recon/`，见 `.recon/README.md`（已 gitignore）
- 反编译工作区（仓库外、不入库）：Geak Music 1.6.3 全量反编译，1112 个 Java 文件（`jadx 1.5.6` 生成，命令见 `.recon/README.md`）
