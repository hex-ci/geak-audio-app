# 云听 App 接口说明

## 网关

```
https://ytmsout.radio.cn          # 生产
```

备用域名 `https://ytmsotherout.radio.cn` 同样可用。

> 网关会限流：短时间内大批量请求（几百上千次）会开始返回 `HTTP 418`，
> 之后一段时间所有请求都 418。批量探测要控速、设并发上限。

## 签名

所有请求都带这几个 header：

| header | 值 |
| --- | --- |
| `Content-Type` | `application/json` |
| `equipmentId` | `0000`（H5 用的是随机 UUID，服务端不校验） |
| `platformCode` | `ANDROID` |
| `equipmentSource` | `ANDROID` |
| `timestamp` | 毫秒时间戳 |
| `sign` | 见下 |

```
sign = md5( 按 key 升序拼接的参数 + '&timestamp=' + ts + '&key=' + 分组密钥 )   // 小写 hex
```

没有参数时就是 `md5('timestamp=' + ts + '&key=' + 密钥)`。

**参数值参与签名时不做 URL 编码**，而 URL 上的查询串要编码 —— 两者不是一回事。
纯数字参数（`provinceCode=110000`）看不出区别，但中文参数会露馅：
签名用 `searchWord=交通`、URL 用 `searchWord=%E4%BA%A4%E9%80%9A`；若签名也用编码后的值，
网关返回「参数验签错误」。`RadioCn.vue` 里的 `getParamsOrderByKey` 正是按原始值拼接。

密钥按**接口分组**（与云听 App `com.linker.xlyt.util.ParamSignUtils` 里的密钥表一致）：

| 分组 | 路径特征 | 密钥 |
| --- | --- | --- |
| `format` | 路径含 `/format/` | `40359b279ed420d0643e12df721e6c4d` |
| `contentBiz` | 路径含 `/contentBiz/` | `3196d2bb67a730342382ce8f690c8c44` |
| `search` | 路径含 `/search/` | `68e251be8b49f462be367df22b212ee3` |
| `news` | 其它（默认） | `652e16dd26f38ac3d306b31e4839a8e3` |
| `publish` | 路径含 `/publish/` | `c1e49740f86d3126561c51131c4e384b` |
| `series` | 路径含 `/series/` | `58325b785b752dd7d9c0281dd2befa6a` |
| `live` | 路径含 `/live/`（YTMSOUT 环境） | `732abfe93639060ea6fc8a5f406d08a1` |
| （Web 版）| `/web/*` | `f0fc4c668392f9f9a447e48584c214ee` |

> 密钥取自 App dex / H5 bundle。签名密钥不匹配时网关返回
> `{"code":1001,"message":"网关拦截GET参数验签错误"}`（无参数则是「无参数验签错误」）。
> 注意：**带参数时网关先验签、再路由**，所以「参数验签错误」并不代表路径存在 ——
> 只有签名通过后的 404 才是「路径不存在」。

## 接口

### 地区列表

```
GET /format/appProvince/list/all          # 无参数
→ {"code":0,"message":"SUCCESS","data":[{"provinceName":"安徽","provinceCode":340000}, ...]}
```

返回 31 个省级行政区，**不含**「国家/全部」项。

### 央广频率（国家台）

```
GET /contentBiz/appBroadcast/all/group/1  # 无参数
→ {"code":0,"data":[{"contentId":"639","title":"中国之声","subtitle":"正在直播：昨日新闻重现",
    "image":"...","tagName":"中央","playUrlLow":"https://ytlive.radio.cn/130/radios/10639/index_10639.m3u8?...",
    "mp3PlayUrlLow":"...","listenCount":3098873076}, ...]}   # 19 个
```

`groupType` 只在 1（央广全部 19 个频率）、7（南海之声等 2 个）、9（大湾区/神州/台海等 7 个）
有数据，其余返回空数组。

### 按省份的电台列表

```
GET /contentBiz/appBroadcast/allByProvince?provinceCode=110000
→ {"code":0,"data":[{"contentId":"357","title":"北京城市广播副中心之声","subtitle":"正在直播",
    "image":"...","contentType":5,"listenCount":5106821,
    "playUrlLow":"https://ytcast.radio.cn/62/radios/10357/index_10357.m3u8?type=1&key=..&time=..",
    "mp3PlayUrlLow":"...","tagName":"北京市台"}, ...]}
```

- `provinceCode` 省略时服务端默认返回北京（8 个），**不是**全国列表；`provinceCode=0` 返回 `data:null`。
- 省级列表里**不含央广国家台**（`中国之声` 等只在 `all/group/1` 里）。
  全国电台 = 央广 19 个 + 31 个省各请求一次再合并，实测去重后 **941 个**。
- 不支持的参数（返回结果完全一致，等于被忽略）：`categoryId`、`categoryIds`、`tagName`、`contentType`、
  `pageIndex`、`pageSize`、`regionCode` 等。云听 App 里没有「电台分类」列表接口，
  App 的浏览维度就是「央广频率 + 各省」。

### 电台详情（最新地址 / 高清地址）

```
GET /contentBiz/appBroadcast/detail/357   # 无参数
→ {"code":0,"data":{"id":"357","name":"北京城市广播副中心之声","image":"...",
    "playUrlLow":"http://ytcast.radio.cn/62/radios/10357/index_10357.m3u8?...",
    "playUrlHigh":"http://ytcast.radio.cn/62/radios/20357/index_20357.m3u8?...",
    "mp3PlayUrlLow":"...","mp3PlayUrlHigh":"...",
    "defaultHighFlag":0,"listenBackFlag":0,"province":"北京市","isLiving":1}}
```

- 返回的是 `name`，不是列表里的 `title`。
- 列表接口**只给 `playUrlLow` / `mp3PlayUrlLow`**，高清地址只有这个接口才有 ——
  所以要用高清，就得在推送时按 `contentId` 补一次详情请求。

### 音质

同一路直播有 4 个地址。随机抽 40 个电台实测：**4 个字段全都有值**，没遇到「没有高清」的电台。

| 字段 | 说明 | 例（中国之声 639） |
| --- | --- | --- |
| `playUrlLow` | 低码率 m3u8 | `ytlive.radio.cn/130/radios/`**1**`0639/index_10639.m3u8` |
| `playUrlHigh` | 高码率 m3u8 | `ytlive.radio.cn/131/radios/`**2**`0639/index_20639.m3u8` |
| `mp3PlayUrlLow` | mp3 线路低码率 | `ytcast.radio.cn/128/radios/1`**1**`0357/…` |
| `mp3PlayUrlHigh` | mp3 线路高码率 | `ytcast.radio.cn/129/radios/2`**2**`1046/…` |

- 地址里的 `time=` 是时效令牌，必须现取现用。
- `mp3PlayUrlHigh` 有时是真 `.mp3`（`http://ytcastmp3.radio.cn/73/stream_22054.mp3?...`），
  有时仍是 `.m3u8`（`/129/radios/221046/index_221046.m3u8`）—— 按字段名判断不了，要看实际后缀；
  两种都能交给音响的 ffmpeg 解。
- `defaultHighFlag` 抽样 40 个全是 `0`（App 默认并不走高清，是客户端自己选的）。

`RadioCn.vue` 的选择顺序：`playUrlHigh` > `mp3PlayUrlHigh` > `playUrlLow` > `mp3PlayUrlLow`。
推送成功/失败的提示统一由 `App.vue` 的 `pushPlaylist()` 发出 —— 它 `await` 了主进程的 UPnP 调用，
只有它知道音响是否真的接受了本次推送；组件自己只在「连可用地址都没有、根本没发生推送」时提示一条，
否则一次推送会弹两条通知（而且组件那条早于音响应答，可能谎报成功）。

### 搜索

App 里的搜索路径是 `/search/search/findSearchResourceList`（`search` 分组密钥可用、签名能过），
但**没能试出它的关键词参数名**：

- 试过 `keyword` / `keyWord` / `searchWord` / `searchKey` / `searchContent` / `searchValue` /
  `searchParam` / `searchTextParam` / `query` / `words` / `text` / `q` / `name` 等 40 多个名字，
  一律返回 `{"code":0,"data":{"totalNum":0,"data":[]}}` —— 不报错，但搜不到东西。
- POST JSON 到该路径在 `ytmsout` 上返回 `503`。
- 拿 APK 字符串池里 1 万多个标识符穷举时被网关限流（`418`），此路不通。
- `search/searchTopInfo/findAllTopInfo`（热搜词）、`search/searchBanner/allByProductId` 同样没试出参数。

**所以 `RadioCn.vue` 的搜索是本地索引**：首次搜索时把「央广频率 + 31 个省」拉一遍
（941 个电台，并发 6，实测约 1.4 秒），在内存里按 `title` / `tagName` / `subtitle` 过滤。
只搜电台、结果全部来自 App 接口、不再额外打扰网关；代价是搜索范围限于这 941 个电台。

UI 上是两个模式（`按地区浏览` / `搜索电台`，用 `el-button-group` 切换）：地区下拉只在浏览模式里出现，
搜索模式里**没有任何地区控件** —— 否则用户会以为搜索是按地区过滤的。搜索按钮内嵌在输入框右侧
（`el-input` 的 `append` 插槽），点按钮才发请求，输入本身不触发搜索。

### 节目单（昨日回放，仅供参考）

```
GET /contentBiz/v1/appProgram/listByDate?date=2026-10-11&broadcastId=357
→ {"code":0,"data":[{"id":"978192013","programName":"健康投资家",
    "startTime":1791669600000,"endTime":1791671400000,"playFlag":0,...}]}   # 24 条
```

**没有 `downloadUrl` / 播放地址字段**（Web 版的 `appProgram/listByDate` 才有），
所以推送昨日回放的播放列表这条路走不通；`RadioCn.vue` 里该功能保持注释状态。

## 其它接口（本应用没有采用，及原因）

这一段列的是我在 APK / H5 里翻到、但 `RadioCn.vue` 没有调用的接口 —— 写下来是为了下次再改这个 tab 时
知道它们存在、以及为什么没用（**不代表它们不是电台**）。

- `POST https://ytapi.radio.cn/ytsrv/srv/interactive/broadcastList` —— H5/App「直播」tab 的**电台列表**，
  但实测是本文档那套的**严格子集**：它返回 170 个（早前测到 189 / 195，随电台上下线浮动），
  `broadCastId` 与 `contentBiz/appBroadcast/allByProvince` 的 `contentId` 同一 id 空间，
  **170 / 170 全部已包含在「31 省 + 央广 group/1」的 941 个里，0 个独有**；反过来那 941 个里有 771 个它没有。
  它也只认 `categoryId`（5 音乐 / 7 热门 / 9 新闻 / 11 财经 / 13 生活 / 15 交通 / 17 综艺 / 19 故事 / 21 民族），
  **没有省份维度**，用它只会让列表更窄，所以未采用。
  唯一它多给的东西：`playUrlMp3` 字段里 91 / 170 是**真 `.mp3` 直链**
  （`http://ytcastmp3.radio.cn/67/stream_13337.mp3?...`），不是 m3u8 ——
  如果哪天音响解不了 m3u8，这是个现成的兼容后备。它还额外带 `playUrl`(m3u8) 和 `con.name`(当前节目)。
- 另外还翻到但未使用：`contentBiz/appBroadcastMiddle/*`、`chinaRedioIndex/getRedioList`
  （App 新版电台列表，需要未知参数）、`liveInteractive/getLiveBroadcastProgram`、
  `search/searchTopInfo/findAllTopInfo`（热搜词）。
