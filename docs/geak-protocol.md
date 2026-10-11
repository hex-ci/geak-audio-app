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
| 设备端口 | `49152`（HTTP，根路径下即 `renderer.xml`） | `[设备]` |
| friendlyName | 用户可在设备端设置，形如 `GM for …`；客户端不应依赖具体值 | `[设备]` |
| UDN（渲染器） | `uuid:geakmusic-<设备MAC>_MR`；**`geakmusic` 前缀是客户端筛选依据** | `[设备]` |
| deviceType | `urn:schemas-upnp-org:device:MediaRenderer:1` | `[设备]` |
| 设备描述 | `http://<设备IP>:49152/renderer.xml`，`URLBase = http://<设备IP>:49152/` | `[设备]` |
| serialNumber | `001` | `[设备]` |
| 同一设备还会应答 | `urn:schemas-upnp-org:device:MediaServer:1`、`urn:schemas-tencent-com:service:QPlay:1` | `[设备]` |

发现方式 `[app]`：调用 pnp 库（`libupnp.so` = 标准 pupnp）做 `M-SEARCH * HTTP/1.1` + `MAN: "ssdp:discover"`，Java 侧通过 `libdream.SearchMediaServer(int)` / `CtrlPointRefresh(type, 1)` 触发，渲染器列表与媒体服务器列表分开维护（`RendererList` / `MediaServerList`）。
现有项目按 `ST=urn:schemas-upnp-org:device:MediaServer:1` 搜索并用 `UDN.indexOf('uuid:geakmusic') === 0` 过滤 `[待确认]`：实测该过滤条件对真机成立（`uuid:geakmusic-…_MR`），但真机对 `MediaRenderer:1` 与 `QPlay:1` 的 ST 也有应答，建议对齐 app 的实际 ST。

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
3. 用 app 自带的 HTTP 服务对外提供该文件（`libdream.StartServer()` `[app]`；端口与路由 `[待确认]`，需从 `libdream.so` 提取）。
4. 组织 `CurrentURI`（L1506）：
   ```
   geakmusic://<首曲URL>|<repeatMode>|<播放列表URL>|
   ```
   其中播放列表 URL 是 `http://<本机内网IP>:<端口>/<路径>/PlayList.txt`（L1503-1505 由 ShareDir 路径拼接）。
   注：厂商文档的示例里这个 URL 以 `PlayList.xml` 结尾，而 app 实际写的是 `PlayList.txt`——文件名由控制端自己决定，设备只按给定 URL 取；实现时"本地服务实际提供的路径"与"推给设备的 URL"必须一致。
5. 调 `CtrlPointPlayURI(uuid, uri, metaData)`（native，L1967）→ 设备端 `SetAVTransportURI`；`metaData` 为空时 app 传字面量 `"metaData"`（L1531）。
6. DIDL 元数据由 `CtrlPointGetMetadata(title, creator, artist, album, albumArtURI, url, duration, size, type)`（native，L1974）生成；类名用 `object.item.geakMusic` `[app]`（`libdream.so` 字符串）。

### 播放模式映射（已核实）

| app 的 repeatMode | 设备 `SetPlayMode` 值 | 语义 |
|---|---|---|
| 1 | `SINGLE_CYCLE` | 单曲循环 |
| 2 | `SEQUENCE_PLAY` | 列表循环（顺序） |
| 3 | `RANDOM_PLAY` | 随机 |

证据：`MusicPlayingActivity.java` L678-692（`setRepeatMode(1)`↔`SINGLE_CYCLE`、`(3)`↔`RANDOM_PLAY`、`(2)`↔`SEQUENCE_PLAY`，同时把字符串下发 `sendRequestUpnpHandle(uuid, 8, …)`）。
**现有项目把 `geakmusic://` 里的这一位硬编码成 `2`，忽略用户设置的模式** —— 与 app 不符。

## 5. 设备管理动作 → app 的调用映射

app 的 Java 层通过 `com.android.dream.libdream` 的 native 方法访问协议（`GeakMusicService.java` 内 48 处调用）：

| app native 方法 | 对应设备动作 | 参数 |
|---|---|---|
| `CtrlPointPlayURI(uuid, url, meta)` | `SetAVTransportURI` | 见上 |
| `CtrlPointSendAction(uuid, type, value, session)` | 通用命令分发（type 表见 §7） | — |
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

## 6. 状态与事件

- 设备侧只有 `LastChange` 标注了 `sendEvents="yes"`（其余状态变量都 `no`）`[设备]`，即标准 UPnP GENA + AVTransport `LastChange` 事件模型。
- `TransportState` 取值：`STOPPED` / `PLAYING` / `PAUSED_PLAYBACK` / `TRANSITIONING` / `NO_MEDIA_PRESENT`；`CurrentPlayMode`：`SINGLE_CYCLE` / `SEQUENCE_PLAY` / `RANDOM_PLAY`；`Seek` 的 `Unit`：`ABS_TIME` / `REL_TIME` / `TRACK_NR` `[设备]`。
- 另有两个私有状态变量 `TimeZone`、`A_ARG_TYPE_TimeZoneIndex`，被几乎所有私有动作的 out 参数引用（设备 SCPD 把它们当通用字符串容器用）`[设备]`。
- app 用的是**会话回调**模式：`CtrlPointSendAction(uuid, type, value, session)` + `libdream.ControlCallback(session, errcode)`；订阅方式（是否 `SUBSCRIBE` `/MediaRenderer/AVTransport/Event`）`[待确认]`。
- 现有项目用 `GetTransportSettings` + `GetVolume` 轮询 `[app]` 也是可选路径，但与 app 的会话模型不同。

## 7. 待确认清单（改动前必须验证）

1. `CtrlPointSendAction` 的 **type 表**（libdream.so 内 dispatch）。已知观测：`8` = SetPlayMode（值传 `SEQUENCE_PLAY` 等）、`5` = 设置音量（值传数字）、`4` = Seek（值传时间串）、`12` = 改名（值传新名字）、`1`/`3`/`6`/`7` = 传输控制类（推测 Play/Pause/…，**未证实**）、`10`/`11` = 设备信息页用的未知名。**必须从 `libdream.so` 反汇编确认。**
2. app 自带 HTTP 服务（`StartServer()`）的**端口、路由、Content-Type、是否支持 Range**：设备取 `PlayList.txt` 与本地音频文件时依赖它。现有项目用 express + `get-port` 随机端口 + `/playlist.json`，与 app 的文件名/路由不同。
3. `geakmusic://` 里第二段（模式）之外是否还有设备校验：实测设备对 app 的 URL 之外的形式是否接受 `[待确认]`。
4. `SetGroupInfo` / `GetGroupInfo` 的 JSON 结构（文档缺失）。
5. `SetPlaylistInfo` 改名约束：非空、最多 10 个中文字符（`Rename`）；`SetPlaylistInfo` 的约束 `[文档]` 说"我的收藏"不允许改名。

## 8. 现有项目 vs app：已确认的差异

| # | 项目现状 | app / 设备实际 | 影响 |
|---|---|---|---|
| 1 | `geakmusic://…\|2\|…` 播放模式硬编码 `2` | 传用户当前模式（1/2/3，见 §4） | 设备端循环模式与界面不一致 |
| 2 | 播放列表走 `/playlist.json`（express 随机端口） | 写 `<ShareDir>/PlayList.txt`，由 app 自带 HTTP 服务提供 | 设备按 app 的路径取列表；文件名/路由不一致时行为未验证 |
| 3 | 轨道 `metadata` 填了内容 | app 写空字符串 | 设备端元数据显示可能与 app 行为不同 |
| 4 | 设备管理动作几乎未实现 | 见 §5（闹钟/收藏/内置列表/改名/时区/关机/按键锁/WiFi/扩展接口/分组/电量） | 本轮范围要补齐 |
| 5 | 未订阅事件 | `LastChange` 事件模型可用 | 状态刷新可靠性与 app 不同 |

## 9. 原始材料位置

- 入库文档：本文件与 [`geak-device-actions.md`](./geak-device-actions.md)（结论、动作表）
- **不入库**的分析过程产物（真机抓包、SCPD 原文、抓取脚本）在 `.recon/`，见 `.recon/README.md`（已 gitignore）
- 反编译工作区（仓库外、不入库）：Geak Music 1.6.3 全量反编译，1112 个 Java 文件（`jadx 1.5.6` 生成，命令见 `.recon/README.md`）
