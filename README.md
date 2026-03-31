# NapCat 豆包 AI 插件

一个功能丰富的 NapCat 插件，集成火山引擎豆包 AI，支持智能对话、图片识别、视频分析、联网搜索、图片生成、文档生成以及表情包自动回复。

## ✨ 核心特性

- 🤖 **多 API 支持**：Chat / Bots（联网）/ Responses（视频）自动切换
- 🖼️ **多模态**：图片识别、视频分析、文档阅读
- 🎨 **图片生成**：文生图、图生图、图片拼接、局部修改
- 📄 **文档生成**：自动生成 Excel 表格 / Word 文档
- 🔍 **联网搜索**：实时信息查询，智能判断是否需要联网
- 💬 **上下文记忆**：多轮对话，群聊/私聊独立上下文
- 🔗 **引用消息**：识别引用消息中的文本、图片、视频
- 😄 **表情包回复**：根据回复内容情绪自动附带表情包
- 🔒 **访问控制**：QQ 号白名单管理

## � 安装

将插件文件夹放置到 NapCat 的 `plugins` 目录：

```
NapCat/
├── plugins/
│   └── napcat-plugin-doubao/
│       ├── src/
│       ├── memes/          ← 表情包目录
│       ├── index.mjs
│       └── package.json
└── config/
    └── plugins/
        └── napcat-plugin-doubao/
            └── config.json
```

然后在 NapCat WebUI 的插件配置界面填入 API 密钥即可。详细配置参考 [豆包 AI 接入指南](./豆包AI接入指南.md)。

## ⚙️ 配置说明

所有配置均可在 WebUI 插件配置界面操作，以下为完整配置项说明。

### 基础

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `apiKey` | - | 火山引擎 API 密钥（必填） |
| `model` | `doubao-seed-2-0-pro-260215` | 默认对话模型 |
| `prefix` | `@Amadeus` | 群聊触发前缀 |
| `systemPrompt` | - | 系统提示词（角色设定） |
| `maxTokens` | `500` | 最大输出 Token |
| `temperature` | `0.7` | 创造性参数（0~1） |
| `enablePrivateChat` | `true` | 启用私聊 |
| `enableGroupChat` | `true` | 启用群聊 |

### 多模态

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `enableImageRecognition` | `true` | 图片识别 |
| `enableVideoAnalysis` | `true` | 视频分析 |
| `enableDocumentOCR` | `true` | 文档阅读 |
| `enableImageGeneration` | `true` | 图片生成 |
| `maxImageSize` | `10MB` | 最大图片大小 |
| `maxVideoSize` | `50MB` | 最大视频大小 |
| `videoFps` | `1.0` | 视频抽帧频率 |
| `useFilesAPI` | `true` | 使用 Files API 上传视频 |
| `imageGenModel` | `doubao-seedream-4-5-251128` | 图片生成模型 |
| `imageGenQuality` | `standard` | 图片质量（standard / hd） |
| `imageGenSize` | `2K` | 图片分辨率（2K / 4K） |

### 联网搜索

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `enableWebSearch` | `true` | 启用联网搜索 |
| `smartWebSearch` | `true` | 智能判断是否需要联网 |
| `showSearchReferences` | `true` | 显示搜索引用来源 |
| `botId` | - | Bots API 的 Bot ID |

### 上下文记忆

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `enableContext` | `true` | 启用上下文记忆 |
| `maxContextMessages` | `10` | 最大记忆轮数 |
| `contextTimeout` | `30` | 上下文超时（分钟） |
| `separateGroupContext` | `true` | 群聊独立上下文 |

### 表情包

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `enableMeme` | `false` | 启用表情包功能 |
| `memeDir` | `memes` | 表情包根目录（相对于插件目录） |
| `memeChance` | `0.4` | 触发概率（0~1） |

### 访问控制

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `allowedUsers` | `[]` | QQ 号白名单，留空允许所有人 |
| `autoReplyGroupVideo` | `false` | ⚠️ 自动响应群聊所有视频消息 |

## 🎮 使用方法

### 私聊

直接发消息即可，支持文字、图片、视频、文件。

### 群聊

使用前缀或 @ 机器人触发：

```
@Amadeus 你好
@Amadeus [发送图片] 这是什么？
```

### 引用消息

引用他人消息后 @ AI，AI 会分析被引用的内容：

```
[引用群友的图片] @Amadeus 这是哪里？
[引用群友的视频] @Amadeus 这个视频讲了什么？
```

### 图片生成

```
画一只猫
生成一张赛博朋克风格的城市夜景
生成3张不同风格的山水画
```

### 图生图

发送图片 + 描述：

```
[发送图片] 改成动漫风格
[发送图片] 把背景换成星空
```

### 局部修改

```
第一步：发送图片 + "局部修改"
第二步：发送修改指令，如"把头发改成金色"
```

### 文档生成

```
帮我把这些数据整理成 Excel 表格
生成一份 Word 格式的会议记录
```

### 特殊命令

| 命令 | 说明 |
|------|------|
| `清除记忆` / `clear memory` | 清除当前对话记忆 |
| `查看记忆` / `show memory` | 查看记忆状态 |
| `加入白名单 QQ号` | 管理员添加白名单（仅管理员） |
| `移出白名单 QQ号` | 管理员移除白名单（仅管理员） |

## 😄 表情包功能

在插件配置中开启 `enableMeme` 后，AI 每次文字回复时会根据内容情绪自动附带一张表情包。

**目录结构**（放在 `plugins/napcat-plugin-doubao/memes/` 下）：

```
memes/
  happy/      ← 开心、棒、成功等
  angry/      ← 哼、笨蛋、讨厌等
  sad/        ← 抱歉、失败、无法等
  surprised/  ← 居然、什么、惊等
  shy/        ← 才不是、才没有等傲娇词
  thinking/   ← 分析、也许、让我想想等
  default/    ← 兜底，无匹配时使用
```

把对应情绪的表情包图片（jpg/png/gif/webp）放入对应子目录即可，每个目录可放多张，每次随机选一张。

## 🐛 故障排除

**表情包不发送**
- 确认 `enableMeme` 已开启
- 检查 `memes/` 目录下对应子目录中有图片文件
- 注意 `memeChance` 概率，设为 `1.0` 可确保每次触发

**视频分析失败**
- 检查视频大小是否超过限制（默认 50MB）
- 确认格式支持（MP4、AVI、MOV）
- 确认 `useFilesAPI` 已启用

**联网搜索不工作**
- 确认 `enableWebSearch` 已开启
- 检查 `botId` 是否配置
- 开启 `smartWebSearch` 让插件自动判断何时联网

**上下文记忆丢失**
- 检查 `enableContext` 是否启用
- 确认 `contextTimeout` 设置合理
- 使用"查看记忆"命令检查状态

## 📚 相关文档

- [豆包 AI 接入指南](./豆包AI接入指南.md)
- [CHANGELOG.md](./CHANGELOG.md)
- [火山引擎文档](https://www.volcengine.com/docs/82379)
- [NapCat](https://github.com/NapNeko/NapCatQQ)
