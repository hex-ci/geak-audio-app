# Next *- urn:schemas-upnp-org:service:AVTransport:1*

设备本身的播放列表的下一曲（红心收藏、内置播放列表1、内置播放列表2、内置播放列表3、控制端临时推送的播放列表等）

***Arguments***

- *(in)* InstanceID–value=0

***ErrorCode***

# Previous\*- urn:schemas-upnp-org:service:AVTransport:1*

设备本身的播放列表的上一曲（红心收藏、内置播放列表1、内置播放列表2、内置播放列表3、控制端临时推送的播放列表等）

***Arguments***

- *(in)* InstanceID–value=0

***ErrorCode***

***Remark***

# Record\*- urn:schemas-upnp-org:service:AVTransport:1*

对当前的播放的歌曲进行收藏，保存到设备的红心收藏列表中，只有在播放过程中才生效

***Arguments***

- *(in)* InstanceID–value=0

***ErrorCode***

***Remark***

# Reset\*- urn:schemas-upnp-org:service:AVTransport:1*

恢复出厂设置

***Arguments***

- *(in)* InstanceID–value=0

***ErrorCode***

***Remark***

# Upgrade\*- urn:schemas-upnp-org:service:AVTransport:1*

对设备进行升级，DMC首先通过action:GetDeviceInfo得到设备是否有升级包，设备自行升级

***Arguments***

- *(in)* InstanceID–value=0

***ErrorCode***

***Remark***

# Rename\*- urn:schemas-upnp-org:service:AVTransport:1*

对设备名称进行改名，不能为空，长度限制最长10个中文字符

***Arguments***

- *(in)* InstanceID–value=0
- *(in)* NewName: 设备名称，长度限制10个中文字符

***ErrorCode***

***Remark***

设备改名后，DMR重启

# SetTimeZone\*- urn:schemas-upnp-org:service:AVTransport:1*

对设备名称设置时区

***Arguments***

- *(in)* Index：时区的定义的index
- *(in)* CurrentTimeZone: Asia/Shanghai

***ErrorCode***

***Remark***

DMC定义index跟具体时区对应关系，信息由DMC保存

- Asia/Shanghai

# GetTimeZone\*- urn:schemas-upnp-org:service:AVTransport:1*

获取设备时区信息的index

***Arguments***

- *(in)* InstanceID：0
- *(out)* Index:

***ErrorCode***

***Remark***

DMC定义index跟具体时区对应关系，根据index显示，如果返回-1，默认为Asia/Shanghai

# SetTimeNow\*- urn:schemas-upnp-org:service:AVTransport:1*

设置设备时间

***Arguments***

- *(in)* DesiredTime：格式定义为“YYYY-MM-DDHH:MI:SS”

***ErrorCode***

***Remark***

当指定日期时，时间为00:00:00,当设置时间为，日期为0000-00-00

# GetTimeNow\*- urn:schemas-upnp-org:service:AVTransport:1*

获取设备时间

***Arguments***

- *(in) InstanceID*：0
- *(out)* CurrentTimeZone：输出格式定义为“YYYY-MM-DDHH:MI:SS”

***ErrorCode***

***Remark***

# CreateAlarm\*- urn:schemas-upnp-org:service:AVTransport:1*

创建闹钟

***Arguments***

- *(in)* StartTime：闹钟时间 HH:MI
- *(in)* StartDate- 闹钟日期，当指定一次时有效,格式：YYYY-MM-DD
- \*(in)\*Recurrence：闹钟频率，以int型按位来存储，第0位为星期1，第6位为星期日，依次类推，每位中1为有效，0为无效，当都为0时，表示闹钟只执行一次，同时参数StartDate有效
- \*(in)\*Enabled：闹钟打开与关闭	 (1-打开，0-关闭)
- *(in)* ProgramURI：闹钟音乐URI（Title|URI）
- *(in)* Volume：闹钟音量
- *(in)* UrlType：URL类型，整形（0-按键1绑定列表，1-按键2绑定列表，2-按键3绑定列表，3-按键4绑定列表，4-按键5绑定列表，5-按键6绑定列表，6-红心收藏列表，7-蜻蜓电台， 8-默认铃声）
- \*(out)\*AssignedID:返回的闹钟ID，跟StartTime一致

***ErrorCode***

***Remark***

```
UrlType=7时，ProgramURI = 电台名|电台URI
UrlType=8时，ProgramURI = 默认铃声|default_clock_tone
```

# UpdateAlarm\*- urn:schemas-upnp-org:service:AVTransport:1*

修改闹钟

***Arguments***

- *(in)* ID：闹钟ID由CreateAlarm返回
- *(in)* StartTime：闹钟时间 HH:MI
- *(in)* StartDate- 闹钟日期，当指定一次时有效,格式：YYYY-MM-DD
- *(in)Recurrence：闹钟频率，以int型按位来存储，第0位为星期1，第6位为星期日，依次类推，每位中1为有效，0为无效，当都为0时，表示闹钟只执行一次，同时参数StartDate有效*
- *(in)* Enable&#x64;*：*&#x95F9;钟打开与关闭		(1-打开，0-关闭)
- *(in)* ProgramURI：闹钟音乐URI（Title|URI）
- *(in)* Volume：闹钟音量(5-100)，整形
- *(in)* UrlType：URL类型，整形		（0-按键1绑定列表，1-按键2绑定列表，2-按键3绑定列表，3-按键4绑定列表，4-按键5绑定列表，5-按键6绑定列表，6-红心收藏列表，7-蜻蜓电台， 8-默认铃声）
- \*(out)\*AssignedID:返回的闹钟ID，跟StartTime一致

***ErrorCode***

***Remark***

```
UrlType=7时，ProgramURI = 电台名|电台URI
UrlType=8时，ProgramURI = 默认铃声|default_clock_tone
```

# DestroyAlarm\*- urn:schemas-upnp-org:service:AVTransport:1*

删除闹钟

***Arguments***

- *(in)* ID：闹钟ID 由CreateAlarm返回

***ErrorCode***

***Remark***

# ListAlarms\*- urn:schemas-upnp-org:service:AVTransport:1*

获取闹钟列表

***Arguments***

- *(in) InstanceID*：0
- *(out)* CurrentAlarmList：以JSON格式返回：

```
{
“ListAlarms” :
[
   {
“StartTime”:“07:00”,
“StartDate” :“”,
“Recurrence” :3,      //表示周日、周1
“Enabled” :“1”,
“ProgramURI”:“默认铃声|default_clock_tone”,
“Volume”: 50,
“UrlType” :8
	},
{
“StartTime”: “08:00”,
“StartDate” :“”,
“Recurrence” :4,      //表示周2
“Enabled” :“1”,
“ProgramURI”:“上海人民广播电台|ffmpeg://http://m.hz.qingting.fm/live/270.m3u8”,
“Volume”: 50,
“UrlType” :7
	},
]
    }
```

***ErrorCode***

***Remark***

```
当闹钟列表为空是： { “ListAlarms” :null }
```

# EnableAlarm\*- urn:schemas-upnp-org:service:AVTransport:1*

打开和关闭闹钟

***Arguments***

- *(in)* ID：闹钟ID 由CreateAlarm返回
- *(in)* Enable：0和1

***ErrorCode***

***Remark***

# EnableInternetTime\*- urn:schemas-upnp-org:service:AVTransport:1*

打开和关闭Internet时间同步

***Arguments***

- *(in)* Enable：0和1

***ErrorCode***

***Remark***

# SetPlayMode\*- urn:schemas-upnp-org:service:AVTransport:1*

设置设备的播放模式

***Arguments***

- *(in) InstanceID*：0
- *(out)* NewPlayMode:播放模式，SINGLE_CYCLE：单曲循环，SEQUENCE_PLAY列表循环，RANDOM_PLAY：随机循环

***Remark***

# TimingShutdown\*- urn:schemas-upnp-org:service:AVTransport:1*

定时关机，定义多少分钟后进行关机

***Arguments***

- *(in) TimeOuts*：定义多少分钟	（-1表示取消定时关机,0表示立即关机，999表示重启）

***Remark***

# GetTiming\*- urn:schemas-upnp-org:service:AVTransport:1*

获取还有多少分钟后进行关机

***Arguments***

- *(in)* InstanceID：0
- *(out)* LeftTimes：多少秒	（-88表示定时关机已被取消）

***Remark***

DMC获取时间，后关机时间信息自行改变

# HoldButton\*- urn:schemas-upnp-org:service:AVTransport:1*

按键锁定

***Arguments***

- *(in)* Enable：0和1

***Remark***

# GetHoldStatus\*- urn:schemas-upnp-org:service:AVTransport:1*

获取按键锁定状态

***Arguments***

- *(in)* InstanceID：0
- *(out)* HoldStatus：当前设备按键锁住状态

***Remark***

# GetWIFilist\*- urn:schemas-upnp-org:service:AVTransport:1*

获取SSID列表

***Arguments***

- *(in)* InstanceID：0
- *(out)* WIFilist：当前SSID列表

格式：

```json
{
"WIFilist” :
   [
     {
"ssid" : "xxxx",
       "level" : "60",
       "type" : "2"
     },
     {
"ssid" : "tp-link-xx",
       "level" : "60",
       "type" : "0"
}
   ]
}
```

***Remark***

# GetWIFinfo\*- urn:schemas-upnp-org:service:AVTransport:1*

获取SSID密码列表

***Arguments***

- *(in)* InstanceID：0
- *(out)* WIFinfo：当前密码列表

格式：

```json
{
"WIFinfo” :
   [
{
         "ssid" : "ssid1",
         "password" : "xxxxx",
         "type" : "2"
     },
{
         "ssid" : "ssid12",
         "password" : "xxxxx",
         "type" : "2"
      }
   ]
}
```

***Remark***

# SetNetwork\*- urn:tencent-com:serviceId:QPlay*

连接路由器

***Arguments***

- *(in)* SSID：对应路由器SSID
- *(in)* Key：路由器密码
- *(in)* AuthAlgo：当密码类型type为0：取值open，当type=1时，取值shared，当type=2时，取值WPAPSK
- *(in)* CipherAlgo：type为0：取值none，当type=1时，取值WEP，当type=2时，取值AES

# GetDeviceInfo\*- urn:schemas-upnp-org:service:AVTransport:1*

获取设备信息

***Arguments***

- *(in)* InstanceID：0
- *(out)* DeviceInfo：

格式：

```json
      {
         "DeviceName" : "geakmusic",
         "hardware" : "xxxxx",
         "externalSoftware" : "xxxxx"
         "internalSoftware" : "xxxxx",
         "macAddr" : "xxxxxxxxxxx",
         "ipaddr" : "192.168.5.101"
         "deviceID" : "xxxxxxxxx",
         "sdcardCapacity" : "9048",
         "AvailableSpace" : "6012"
         "upgrade" : "1",
         "isregister" : "1"
      }
```

***Remark***

# GetFavouriteList\*- urn:schemas-upnp-org:service:AVTransport:1*

获取红心收藏列表

***Arguments***

- *(in)* InstanceID：0
- *(out)* DeviceInfo：

格式：

```json
{
   "FavouriteList" :
[
      {
         "title" : "title1"
      },
      {
         "title" : "title2"
      }
   ]
}
```

***Remark***

# FavouriteDelete\*- urn:schemas-upnp-org:service:AVTransport:1*

删除红心收藏

***Arguments***

- *(in)* Title：名称

***Remark***

# GetInterList\*- urn:schemas-upnp-org:service:AVTransport:1*

获取设备内置播放列表

***Arguments***

- *(in)* Index：从0开始
- *(out)* InterList：

格式：

```json
{
   "InterList" :
 [
      {
         "title" : "title1"
      },
      {
         "title" : "title2"
      }
   ]
}
```

***Remark***

# InterListAdd\*- urn:schemas-upnp-org:service:AVTransport:1*

添加歌曲到设备内置播放列表

***Arguments***

- *(in)* Index：从0开始
- *(in)* TracksMetaData：

格式：

```json
{
   "InterListAdd" : [
      {
         "type" : 2,
         "uuid" : "uuid1"
         "url" : "url1"
         "title" : "title1"
         "metadata" : "metadata1-xxx"
      },
      {
         "type" : 2,
         "uuid" : "uuid2"
         "url" : "url2"
         "title" : "title2
         "metadata" : "metadata2-xxx"
      }
   ]
}
```

***Remark***

当数据来源于DMS时, type为2，uuid 有效，否则type（1-蜻蜓，3-天天动听，4-多听，5-豆瓣， 8 QQ音乐， 9 酷狗）

# PlayListItem\*- urn:schemas-upnp-org:service:AVTransport:1*

内置播放列表的播放

***Arguments***

- *(in)* Index：0：内置播放1 1：内置播放2 2：内置播放3 6：红心收藏
- *(in)* PlayListIndex：列表中的Index

***Remark***

# InterListDelete\*- urn:schemas-upnp-org:service:AVTransport:1*

删除内置播放列表

***Arguments***

- *(in)* Index：从0开始
- *(in)* TracksMetaData：
- \*(out)\*Result: 成功OK, 否则 ERROR

格式：

```json
{
   "InterListDelete" :
 [
      {
         "title" : "title1"
      },
      {
         "title" : "title2"
      }
   ]
}
```

***Remark***

# GetPlayListCount\*- urn:schemas-upnp-org:service:AVTransport:1*

获取内置播放列表个数，

***Arguments***

- *(in)* Index：0：内置播放1 1：内置播放2 2：内置播放3
- *(out)* Count：播放列表总数

***Remark***

# AddPlayList\*- urn:schemas-upnp-org:service:AVTransport:1*

添加正在播放的歌曲到内置播放列表

***Arguments***


- *(in)* Index：0：内置播放1 1：内置播放2 2：内置播放3

***Remark***

# GetInternetTime\*- urn:schemas-upnp-org:service:AVTransport:1*

获取Internet时间同步信息

***Arguments***

- *(in)* InstanceID：0
- *(out)* Enable： 1（Internet时间同步打开），0（Internet时间同步关闭）

***Remark***


# MusicBanding\*- urn:schemas-upnp-org:service:AVTransport:1*

将音乐源绑定到指定按键的播放列表中

***Arguments***

- *(in)* Index：从0开始（0,1,2,3，4，5），表示绑定到哪个按键
- *(in)* TracksMetaData：

格式：

**天天动听**

```
{
```

```
	MusicBanding:
```

```json
{
"type" : 3,
"base_url":"http://api.dongting.com/recommend/hotsong",
         "first_level" : "hotsong",	- 热门歌曲
"custom_id" : "f1580",
"kbps" : "192",   (要求取到特定码率的音频文件),
"first_play_url" : "http://192.168.5.200/xinyu.mp3",
"metadata" : "metadata-xxx"
}
}
{
```

MusicBanding:

```json
{
"type" : 3,
"base_url" :"http://api.dongting.com/recommend/quan_detail",
         "first_level" : "hotlist",  - 热门歌单
"custom_id" : "f1580",
			"id" : "78",	(音乐圈msg_id)
"kbps" : "192",   (要求取到特定码率的音频文件),
"first_play_url" : "http://192.168.5.200/xinyu.mp3",
"metadata" : "metadata-xxx"
}
}
{
```

MusicBanding:

```json
{
"type" : 3,
"base_url" :"http://api.dongting.com/recommend/radio_detail",
         "fist_level" : "radio",	- 电台
"custom_id" : "f1580",
			"id" : "8",	(电台msg_id),
"kbps" : "192",   (要求取到特定码率的音频文件),
"first_play_url" : "http://192.168.5.200/xinyu.mp3",
"metadata" : "metadata-xxx"
}
}
{
```

MusicBanding:

```json
{
"type" : 3,
"base_url" :"http://api.dongting.com/recommend/classify_detail",
         "fist_level" : "classify",	- 分类
"custom_id" : "f1580",
			"id" : "8",	(分类msg_id),
			"kbps" : "192",   (要求取到特定码率的音频文件),
"first_play_url" : "http://192.168.5.200/xinyu.mp3",
"metadata" : "metadata-xxx"
```

｝

```
}
{
```

MusicBanding:

```json
{
"type" : 3,
"base_url" :"http://api.dongting.com/recommend/quan_detail",
         "fist_level" : "newsong"	,	- 新歌首发
"custom_id" : "f1580",
			"id" : "8",   (音乐圈msg_id),
			"kbps" : "192",   (要求取到特定码率的音频文件),
"first_play_url" : "http://192.168.5.200/xinyu.mp3",
"metadata" : "metadata-xxx"
}
}
{
```

MusicBanding:

```json
{
"type" : 3,
"base_url" :"http://api.dongting.com/recommend/rank_detail",
         "fist_level" : "rank",	- 排行榜
"custom_id" : "f1580",
			"id" : "8",   (排行榜id),
			"kbps" : "192",   (要求取到特定码率的音频文件),
"first_play_url" : "http://192.168.5.200/xinyu.mp3",
"metadata" : "metadata-xxx"
}
}
{
```

MusicBanding:

```json
{
"type" : 3,
			"base_url" :							"http://api.dongting.com/recommend/singer_detail",
         "fist_level" : "singer_list",	- 歌手
"custom_id" : "f1580",
			"singer_name" : "张靓颖",   (歌手名singer_name),
"kbps" : "192",   (要求取到特定码率的音频文件),
"first_play_url" : "http://192.168.5.200/xinyu.mp3",
"metadata" : "metadata-xxx"
}
}
```

**多听音乐**

```
{
```

MusicBanding:

```json
{
"type" : 4,
"base_url":"http://a2m.duotin.com/platform/album/track",
"src" : "guoke",
"const" : ":album",
"sk" : "abedkolpoiuyebnmdsouy",
"id" : "2976",		(专辑id)
"kbps" : "192",   (要求取到特定码率的音频文件),
	"first_play_url": "http://192.168.5.200/xinyu.mp3",
"metadata" : "metadata-xxx"
}
}
```

**蜻蜓音乐**

```
{
```

MusicBanding:

```json
{
"type" : 1,
"base_url":"http://api.qingting.fm/api/sdzmkj/qtradiov2/items",
"id" : "2000067”,
"kbps" : "192",   (要求取到特定码率的音频文件),
"device_id" :"103",
"fm_name" : "蒲城广播电台FM95.8蒲城之声",
"first_play_url" : "http://192.168.5.200/xinyu.mp3",
"metadata" : "metadata-xxx”
}
}
```

**豆瓣FM**

```
{
```

MusicBanding:

```json
{
"type" : 5,
"base_url":"http://api.douban.com/v2/fm/playlist",
"id" : "189”,	(channel_id)
"channel_name" : "华语”,
"kbps" : "192",   (要求取到特定码率的音频文件)
"apikey" : "0b94a9b956eb5d0922bdfd2c04c2171b”,
"app_name" : "radio_geakmusic”,
"version" : "1”,
"source" : "mobile”,
"system" : "android”,
"fm_version" : "603”,
"market" : "Douban”,
"token_url":"https://www.douban.com/service/auth2/token",
"client_id" :"0b94a9b956eb5d0922bdfd2c04c2171b",
"client_secret" :"424fdef8dce36642",
"redirect_uri" :"https://www.example.com/back",
"grant_type" :"password",
"first_play_url" : "http://192.168.5.200/xinyu.mp3",
"metadata" : "metadata-xxx”
}
}
```

**喜马拉雅(分类)**

```
{
```

MusicBanding:

```json
{
"type" : 7,
"base_url":"http://3rd.ximalaya.com/albums",
"account" : "test20141119",
"id" : "300948",		(专辑id)
			"first_play_url": "http://192.168.5.200/xinyu.mp3",
"metadata" : "metadata-xxx"
}
}
```

**喜马拉雅(主播)**

```
{
```

MusicBanding:

```json
{
"type" : 8,
"base_url":"http://3rd.ximalaya.com/zhubo",
"account" : "test20141119",
"id" : "2342717",		(专辑id)
			"first_play_url": "http://192.168.5.200/xinyu.mp3",
"metadata" : "metadata-xxx"
}
}
```

**听听音乐台**

```
{
```

MusicBanding:

```json
{
"type" : 9,
"base_url":"http://open.api.tingtingfm.com/music/category",
"interface_addr" : "/music/category",
"account" : "geak_audio",
"secret" : "PuAVZSTzc98ZhlhrIpM2z21unxbFppEE",
"id_name" : "id",		(area_id,album_id, user_fm_id等)
"id" : "1019",
"fm_name" : "某某电台",
"is_radio" : 1,  (1-是，0-否)
			"first_play_url": "http://192.168.5.200/xinyu.mp3",
"metadata" : "metadata-xxx"
}
}
```

**听听FM台**

```
{
```

MusicBanding:

```json
{
"type" : 10,
"base_url":"http://open.api.tingtingfm.com/music/category",
"interface_addr" : "/music/category",
"account" : "geak_audio",
"secret" : "PuAVZSTzc98ZhlhrIpM2z21unxbFppEE",
"id_name" : "id",		(area_id,album_id, user_fm_id等)
"id" : "1019",
"fm_name" : "某某电台",
"is_radio" : 1,  (1-是，0-否)
			"first_play_url": "http://192.168.5.200/xinyu.mp3",
"metadata" : "metadata-xxx"
}
}
```

**荔枝FM**

```
{
```

MusicBanding:

```json
{
"type" : 11,
"base_url":"http://open.lizhi.fm/v1/audio/list",
"account" : "lingsheng",
"secret" : "7d3254f78d23a3409b1c753e705d9b52",
"id" : “6741044854849408”, 电台ID(注意是字符串)
	"first_play_url": "http://192.168.5.200/xinyu.mp3",
"metadata" : "metadata-xxx"
}
}
```

**当手机浏览豆瓣列表播放时，同样调用MusicBanding,只是index为199**

豆瓣的base_url中的https需改为http

**然后调用添加内置播放列表的接口InterListAdd把要绑定的音乐列表(最大长度为100条曲目，大于100条的只取前面100条)添加到指定按键对应的列表中**

InterListAdd\*- urn:schemas-upnp-org:service:AVTransport:1*

*Arguments*

- *(in)* Index：从0开始(0,1,2,3,4,5)播放列表索引(绑定到按键1,2,3,4,5,6,对应的index为0,1,2,3,4,5)
- *(in)* TracksMetaData：

格式：

```json
{
   "InterListAdd" : [
      {
         "type" : 3,
         "uuid" : "uuid"
         "url" : "url1"
         "title" : "title1"
         "metadata" : "metadata1-xxx"
      },
      {
         "type" : 3,
         "uuid" : "uuid"
         "url" : "url2"
         "title" : "title2
         "metadata" : "metadata2-xxx"
      }
   ]
}
```

***Remark***

type（1-蜻蜓，3-天天动听，4-多听，5-豆瓣，7-喜马拉雅(分类)，8-喜马拉雅(主播)）

对于豆瓣FM，调用完MusicBanding之后，无须再调用InterListAdd

# GetPlaylistInfo\*- urn:schemas-upnp-org:service:AVTransport:1*

获取播放列表信息

***Arguments***

- *(in)* InstanceID：0
- *(out)* PlaylistInfo：

格式：

```json
{
   "PlaylistInfo" :
 [
      {
"index" : 0,
"type" : 1,
			"playing" : 0,
"name" : "按键1-蜻蜓"
      },
      {
"index" : 1,
"type" : 3,
			"playing" : 0,
"name" : "按键2-天天动听"
      },
     {
"index" : 2,
"type" : 5,
			"playing" : 0,
"name" : "按键3-豆瓣FM-欧美"
      },
     {
"index" : 3,
         "type" : 1,
			"playing" : 0,
"name" : "按键4-蜻蜓"
      },
     {
"index" : 4,
         "type" : 3,
			"playing" : 0,
"name" : "按键5-天天动听"
      },
      {
"index" : 5,
         "type" : 5,
"playing" : 1,
"name" : "按键6-豆瓣FM-欧美"
      },
      {
"index" : 6,
         "type" : 6,
"playing" : 0,
"name" : "我的收藏"
      }
   ]
}
```

***Remark***

```
index = (0,1,2,3,4,5,…)
```

**type** = (1-绑定的蜻蜓播放列表, 3-绑定的天天动听播放列表, 4-绑定的多听播放列表, 5-绑定的豆瓣FM播放列表, 6-红心收藏列表)

```
playing = (0-不在播放，1-正在播放)
```

**name** = 播放列表名

# SetPlaylistInfo\*- urn:schemas-upnp-org:service:AVTransport:1*

设置播放列表名称

***Arguments***

- *(in)* InstanceID：0
- *(in)* PlaylistInfo：

格式：

```
{
```

```
	**PlaylistInfo**:
```

```json
{
	"index" : 0,
"list_name" : "天天动听-睡前歌曲"		//不允许为空
}
}
```

***Remark***

用户输入的列表名称不允许为空，手机需作判断

我的收藏 不允许用户修改名称

# GetAccountInfo\*- urn:schemas-upnp-org:service:AVTransport:1*

获取设备音乐源账户信息

***Arguments***

- *(in)* InstanceID：0
- *(out)* AccountInfo：

格式：

```json
{
   "AccountInfo" :
 [
      {
         "type" : 1,
"user_id" :"123456@qq.com",
"password" : "1qazxsw2",
"token" :"",
			"flag" : 0
      },
      {
         "type" : 3,
"user_id" :"123456@qq.com",
"password" : "1qazxsw2",
"token" :"",
			"flag" : 1
      },
     {
         "type" : 4,
"user_id" :"123456@qq.com",
"password" : "1qazxsw2",
"token" :"",
			"flag" : 0
      },
     {
         "type" : 5,
"user_id" :"123456@qq.com",
"password" : "1qazxsw2",
"token" : "qwertyuiop",
			"flag" : 1
      }
   ]
}
```

***Remark***

**type** = (1-蜻蜓帐号, 3-天天动听帐号, 4-多听帐号, 5-豆瓣FM帐号)，账户类型

**user_id**(帐号id)

**password** (账号密码)

```
flag = (0-未登录，1-已登录)
```

if (flag != 1)

```
 {
```

```
 //帐号未登录
```

```
 }
```

if (flag == 1 && token == "")

```
 {
```

```
 //帐号已登录，但未取到token，手机端需自己去豆瓣服务器取token,然后通过SetAccountInfo发给设备,如果手机也取不到token则不用执行SetAccountInfo给设备
```

```
 }
```

else if (flag == 1 && token != "")

```
 {
```

//帐号已登录，且取到token

```
 }
```

# SetAccountInfo\*- urn:schemas-upnp-org:service:AVTransport:1*

设置音乐源账户

***Arguments***

- *(in)* InstanceID：0
- *(in)* AccountInfo：

格式：

**天天动听**

```
{
```

```
	AccountInfo:
```

```json
{
	"type" : 5,
"user_id" :"888888@qq.com",
"password" : "123456",
"token" : "qwertyuiop"
}
}
```

***Remark***

一般情况下token为空，只有在由于网络不好设备未取到token的情况下，手机重新去取到token时才不为空

# GetPowerStatus\*- urn:schemas-upnp-org:service:AVTransport:1*

获取设备电量状态

***Arguments***

- *(in)* InstanceID：0
- *(out)* PowerStatus：当前设备电量状态

***Remark***

# ReportDoubanServer\*- urn:schemas-upnp-org:service:AVTransport:1*

上报豆瓣服务器(只在播放列表的type=5时调用)

***Arguments***

- *(in)* Index：播放列表索引 (3,4,5)
- *(in)* ActionType：3：喜欢4：取消喜欢5:不再播放

***Remark***

**手机推送播放列表到设备**

第一首歌曲url|playmode|playlist.xml|

playmode = 1(单曲循环)，2（顺序播放），3（随机播放）

例：

```
geakmusic://http://192.168.5.109:49155/emulated/0/Baidu_music/download/Remind Me.mp3|2|http://192.168.5.109:49155/emulated/0/music/PlayList.xml|
```

playlist.xml格式如下：

```json
{
   "TracksMetaData" : [
      {
         "type" : 2,
         "uuid" : "uuid1",
         "url" : "url1",
         "title" : "title1",
         "metadata" : "metadata1-xxx"
      },
      {
         "type" : 1,
         "uuid" : "uuid2",
         "url" : "url2",
         "title" : "title2",
         "metadata" : "metadata2-xxx"
      }
   ]
}
```

type说明: 1-蜻蜓，2-DMS，3-天天动听，4-多听，5-豆瓣

# FavouriteFindout *- urn:schemas-upnp-org:service:AVTransport:1*

获取当前播放的歌曲是否在红心收藏列表中，linein及电量状态

***Arguments***

- *(in)* InstanceID：0
- *(out)* Findout：

格式：

```json
    {
        "favourite" : 1,	// 0: 没有找到 1:找到
"linein" :0,	    //0 :关闭  1 ：打开 －1：不支持动态调整
"power" : “7100”
    },
```

***Remark***

**linein**：**0: 本机播放 , 1: linein输入**, -1-不支持该功能

# SetExtraInterface\*- urn:schemas-upnp-org:service:AVTransport:1*

设置扩展信息接口

***Arguments***

- *(in)* InstanceID：0
- *(in)* Paramater：

格式：

```
{
```

Paramater:

```json
{
"action_type" : 1,
"linein" :0	  // 0: 本机播放 , 1: linein输入
}
}
{
```

Paramater:

```json
{
"action_type" : 2,
"out_put" :0	  // 0: 无提示音 , 1: 有提示音
}
}
{
```

Paramater:

```json
{
"action_type" : 3,
"out_put" :0	  // 0: 非自动播放 , 1: 连上网络自动播放
}
}
{
```

Paramater:

```json
{
"action_type" : 9,	// 定时关机功能
"StartTime" : “16：35”,
```

**"Recurrence" :** 64,(关机频率，以int型按位来存储，第0位为星期1，第6位为星期日，依次类推，每位中1为有效，0为无效，当都为0时，表示闹钟只执行一次，同时参数StartDate有效)

```json
"Enabled" : 1	 (1-打开，0-关闭)
}
}
{
```

Paramater:

```json
{
"action_type" : 10,	// 手动添加隐藏SSID功能
"hide_ssid" : “Gmusic”,
"ssid_type" : 2,	(int型)
"secret" : “123456”
}
}
{
```

Paramater:

```json
{
"action_type" : 11,	// 修改AP热点配置
"ssid" : “GEAK”,
"channel" : 9,	(int型)
"ssid_type" : 2,	0或者2 (int型)
"secret" : “123456”
}
}
```

***Remark***

action_type：1-linein，

**linein**：**0: 本机播放 , 1: linein输入**, -1-不支持该功能

action_type：2-sound_switch

out_put：**0: 无提示音 , 1: 有提示音 , 2: 有提示音(06:00~22:00)**

action_type：3-autoplay_switch

out_put：**0: 非自动播放 , 1: 连上网络自动播放**

# GetExtraInterface\*- urn:schemas-upnp-org:service:AVTransport:1*

获取扩展信息接口

***Arguments***

- *(in)* ActionType：操作类型
- *(out)* Paramater：

格式：

```
{
```

ActionType：

```json
{
	    	"action_type" : 1
}
}
```

格式：

```
{
```

```
	Paramater :
```

```json
{
    		"action_type" : 1,
"linein" :0
}
}
{
```

Paramater:

```json
{
"action_type" : 9,	// 定时关机功能
"StartTime" : “16：35”,	// 如果未创建定时任务，则为notime
"CurrentTime" :”16：00”,
"WeekDay" : 2, (0~6)  // 0-星期日，1-星期一，2-星期二...
```

**"Recurrence" :** 64,(关机频率，以int型按位来存储，第0位为星期1，第6位为星期日，依次类推，每位中1为有效，0为无效，当都为0时，表示闹钟只执行一次，同时参数StartDate有效)

```json
"Enabled" : 1	 (1-打开，0-关闭)
}
}
{
```

Paramater:

```json
{
"action_type" : 11,	// 修改AP热点配置
"ssid" : “GEAK”,
"channel" : 9,	(int型)
"ssid_type" : 2,	0或者2 (int型)
"secret" : “123456”
}
}
```

***Remark***

action_type：1-linein

**linein**：**0: 本机播放 , 1: linein输入**, -1-不支持该功能

action_type：2-sound_switch

out_put：**0: 无提示音 , 1: 有提示音 , 2: 有提示音(06:00~22:00)**

action_type：3-autoplay_switch

out_put：**0: 非自动播放 , 1: 连上网络自动播放**
