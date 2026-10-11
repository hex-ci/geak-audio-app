# 果壳智能音响：设备动作与状态变量表（SCPD 原文提取）

> 数据来源：**真实设备**返回的服务描述（SCPD），不是厂商文档。
> 对象：果壳智能音响（UPnP MediaRenderer，UDN 前缀 `uuid:geakmusic`）自报的服务描述。
> 生成方式：`.recon/tools/gen_actions_doc.py` 从设备返回的 SCPD XML 自动生成；原始 XML 与抓包不入库（见 `.recon/`，已 gitignore）。
> 配套说明见 [geak-protocol.md](./geak-protocol.md)。

## AVTransport:1

- serviceType: `urn:schemas-upnp-org:service:AVTransport:1`
- controlURL: `/MediaRenderer/AVTransport/Control`　eventSubURL: `/MediaRenderer/AVTransport/Event`　SCPDURL: `/web/av.xml`
- 动作数: **57**

| 动作 | 参数（方向 名称） |
|---|---|
| `SetAVTransportURI` | in InstanceID; in CurrentURI; in CurrentURIMetaData |
| `GetCurrentTransportActions` | in InstanceID; out Actions |
| `GetMediaInfo` | in InstanceID; out NrTracks; out MediaDuration; out CurrentURI; out CurrentURIMetaData; out NextURI; out NextURIMetaData; out PlayMedium; out RecordMedium; out WriteStatus |
| `GetTransportInfo` | in InstanceID; out CurrentTransportState; out CurrentTransportStatus; out CurrentSpeed |
| `GetPositionInfo` | in InstanceID; out Track; out TrackDuration; out TrackMetaData; out TrackURI; out RelTime; out AbsTime; out RelCount; out AbsCount |
| `GetDeviceCapabilities` | in InstanceID; out PlayMedia; out RecMedia; out RecQualityModes |
| `GetTransportSettings` | in InstanceID; out PlayMode; out RecQualityMode |
| `Stop` | in InstanceID |
| `Play` | in InstanceID; in Speed |
| `Pause` | in InstanceID |
| `Seek` | in InstanceID; in Unit; in Target |
| `Next` | in InstanceID |
| `Previous` | in InstanceID |
| `Record` | in InstanceID |
| `Reset` | in InstanceID |
| `Upgrade` | in InstanceID |
| `Rename` | in InstanceID; in NewName |
| `SetTimeZone` | in InstanceID; in Index; in CurrentTimeZone |
| `GetTimeZone` | in InstanceID; out Index |
| `SetTimeNow` | in InstanceID; in DesiredTime |
| `GetTimeNow` | in InstanceID; out CurrentTimeZone |
| `CreateAlarm` | in InstanceID; in StartTime; in StartDate; in Recurrence; in Enabled; in ProgramURI; in Volume; in UrlType; out AssignedID |
| `UpdateAlarm` | in InstanceID; in ID; in StartTime; in StartDate; in Recurrence; in Enabled; in ProgramURI; in Volume; in UrlType; out AssignedID |
| `DestroyAlarm` | in InstanceID; in ID |
| `ListAlarms` | in InstanceID; out CurrentAlarmList |
| `EnableAlarm` | in InstanceID; in ID; in Enable |
| `EnableInternetTime` | in InstanceID; in Enable |
| `SetPlayMode` | in InstanceID; in NewPlayMode |
| `TimingShutdown` | in InstanceID; in TimeOuts |
| `GetTiming` | in InstanceID; out LeftTimes |
| `HoldButton` | in InstanceID; in Enable |
| `GetHoldStatus` | in InstanceID; out HoldStatus |
| `GetWIFilist` | in InstanceID; out WIFilist |
| `GetWIFinfo` | in InstanceID; out WIFinfo |
| `GetDeviceInfo` | in InstanceID; out DeviceInfo |
| `GetFavouriteList` | in InstanceID; out FavouriteList |
| `FavouriteDelete` | in InstanceID; in Title |
| `GetInterList` | in InstanceID; in Index; out InterList |
| `InterListAdd` | in InstanceID; in Index; in TracksMetaData; out Result |
| `InterListDelete` | in InstanceID; in Index; in Title; out Result |
| `PlayListItem` | in InstanceID; in Index; in PlayListIndex |
| `GetPlayListCount` | in InstanceID; in Index; out Count |
| `AddPlayList` | in InstanceID; in Index |
| `GetInternetTime` | in InstanceID; out Enable |
| `SetNetwork` | in InstanceID; in SSID; in Key; in AuthAlgo; in CipherAlgo |
| `IOSBackGroundPlay` | in InstanceID; in PlayListUrl |
| `MusicBanding` | in InstanceID; in Index; in TracksMetaData |
| `GetPlaylistInfo` | in InstanceID; out PlaylistInfo |
| `SetAccountInfo` | in InstanceID; in AccountInfo |
| `GetAccountInfo` | in InstanceID; out AccountInfo |
| `SetExtraInterface` | in InstanceID; in Paramater |
| `GetExtraInterface` | in InstanceID; in ActionType; out Paramater |
| `SetPlaylistInfo` | in InstanceID; in PlaylistInfo |
| `GetPowerStatus` | in InstanceID; out PowerStatus |
| `FavouriteFindout` | in InstanceID; out Findout |
| `SetGroupInfo` | in InstanceID; in GroupInfo |
| `GetGroupInfo` | in InstanceID; out GroupInfo |

### AVTransport:1 状态变量

| 状态变量 | 类型 | 事件 | 取值约束 |
|---|---|---|---|
| `TransportState` | string | no | STOPPED, PLAYING, PAUSED_PLAYBACK, TRANSITIONING, NO_MEDIA_PRESENT |
| `TransportStatus` | string | no | OK, ERROR_OCCURRED |
| `CurrentTransportActions` | string | no |  |
| `PlaybackStorageMedium` | string | no |  |
| `RecordStorageMedium` | string | no |  |
| `PossiblePlaybackStorageMedia` | string | no |  |
| `PossibleRecordStorageMedia` | string | no |  |
| `CurrentPlayMode` | string | no | SINGLE_CYCLE, SEQUENCE_PLAY, RANDOM_PLAY |
| `TransportPlaySpeed` | string | no | 1 |
| `RecordMediumWriteStatus` | string | no |  |
| `CurrentRecordQualityMode` | string | no |  |
| `PossibleRecordQualityModes` | string | no |  |
| `NumberOfTracks` | ui4 | no | [0..1] |
| `CurrentTrack` | ui4 | no | [0..1 step 1] |
| `CurrentTrackDuration` | string | no |  |
| `CurrentMediaDuration` | string | no |  |
| `CurrentTrackMetaData` | string | no |  |
| `AVTransportURIMetaData` | string | no |  |
| `CurrentTrackURI` | string | no |  |
| `AVTransportURI` | string | no |  |
| `NextAVTransportURI` | string | no |  |
| `NextAVTransportURIMetaData` | string | no |  |
| `RelativeTimePosition` | string | no |  |
| `AbsoluteTimePosition` | string | no |  |
| `RelativeCounterPosition` | i4 | no |  |
| `AbsoluteCounterPosition` | i4 | no |  |
| `LastChange` | string | yes |  |
| `A_ARG_TYPE_SeekMode` | string | no | ABS_TIME, REL_TIME, TRACK_NR |
| `A_ARG_TYPE_SeekTarget` | string | no |  |
| `A_ARG_TYPE_InstanceID` | ui4 | no |  |
| `A_ARG_TYPE_Name` | string | no |  |
| `A_ARG_TYPE_TimeZoneIndex` | i4 | no |  |
| `TimeZone` | string | no |  |

## QPlay:1

- serviceType: `urn:schemas-tencent-com:service:QPlay:1`
- controlURL: `/MediaRenderer/QPlay/Control`　eventSubURL: `/MediaRenderer/QPlay/Event`　SCPDURL: `/web/qplay.xml`
- 动作数: **0**

| 动作 | 参数（方向 名称） |
|---|---|

## RenderingControl:1

- serviceType: `urn:schemas-upnp-org:service:RenderingControl:1`
- controlURL: `/MediaRenderer/RenderingControl/Control`　eventSubURL: `/MediaRenderer/RenderingControl/Event`　SCPDURL: `/web/rct.xml`
- 动作数: **6**

| 动作 | 参数（方向 名称） |
|---|---|
| `ListPresets` | in InstanceID; out CurrentPresetNameList |
| `SelectPreset` | in InstanceID; in PresetName |
| `GetMute` | in InstanceID; in Channel; out CurrentMute |
| `SetMute` | in InstanceID; in Channel; in DesiredMute |
| `GetVolume` | in InstanceID; in Channel; out CurrentVolume |
| `SetVolume` | in InstanceID; in Channel; in DesiredVolume |

### RenderingControl:1 状态变量

| 状态变量 | 类型 | 事件 | 取值约束 |
|---|---|---|---|
| `LastChange` | string | yes |  |
| `PresetNameList` | string | no |  |
| `Mute` | boolean | no |  |
| `Volume` | ui2 | no | [0..100 step 1] |
| `A_ARG_TYPE_Channel` | string | no | Master |
| `A_ARG_TYPE_InstanceID` | ui4 | no |  |
| `A_ARG_TYPE_PresetName` | string | no | FactoryDefaults |

## ConnectionManager:1

- serviceType: `urn:schemas-upnp-org:service:ConnectionManager:1`
- controlURL: `/MediaRenderer/ConnectionManager/Control`　eventSubURL: `/MediaRenderer/ConnectionManager/Event`　SCPDURL: `/web/connectmanager.xml`
- 动作数: **3**

| 动作 | 参数（方向 名称） |
|---|---|
| `GetProtocolInfo` | out Source; out Sink |
| `GetCurrentConnectionIDs` | out ConnectionIDs |
| `GetCurrentConnectionInfo` | in ConnectionID; out RcsID; out AVTransportID; out ProtocolInfo; out PeerConnectionManager; out PeerConnectionID; out Direction; out Status |

### ConnectionManager:1 状态变量

| 状态变量 | 类型 | 事件 | 取值约束 |
|---|---|---|---|
| `SourceProtocolInfo` | string | yes |  |
| `SinkProtocolInfo` | string | yes |  |
| `CurrentConnectionIDs` | string | yes |  |
| `A_ARG_TYPE_ConnectionStatus` | string | no | OK, ContentFormatMismatch, InsufficientBandwidth, UnreliableChannel, Unknown |
| `A_ARG_TYPE_ConnectionManager` | string | no |  |
| `A_ARG_TYPE_Direction` | string | no | Input, Output |
| `A_ARG_TYPE_ProtocolInfo` | string | no |  |
| `A_ARG_TYPE_ConnectionID` | i4 | no |  |
| `A_ARG_TYPE_AVTransportID` | i4 | no |  |
| `A_ARG_TYPE_RcsID` | i4 | no |  |
