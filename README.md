# NapCat 豆包 AI 插件

一个功能强大的 NapCat 插件，集成火山引擎豆包 AI，支持智能对话、图片识别、视频分析和联网搜索。（默认牧濑红莉栖人设）

## ✨ 核心特性

### 🤖 多 API 支持
- **Chat API**：基础对话功能，快速响应
- **Bots API**：支持联网搜索和实时信息查询
- **Responses API**：专业视频分析能力

### 🎯 智能 API 选择
插件会根据消息内容自动选择最合适的 API：
- 当前消息包含视频 → Responses API（专业视频处理）
- 启用联网搜索 + 纯文本/图片 → Bots API（实时信息查询）
- 其他情况 → Chat API（快速响应）

### 🖼️ 多模态支持
- **图片识别**：支持 JPG、PNG、GIF、BMP、WEBP 等格式
- **视频分析**：支持 MP4、AVI、MOV 格式，最大 50MB
- **文本对话**：流畅的自然语言交互

### 🔍 联网搜索
- 实时信息查询（天气、时间、新闻等）
- 最新资讯获取
- 知识库扩展

### 💬 上下文记忆
- 多轮对话支持
- 可配置记忆时长
- 群聊/私聊独立上下文
- 支持清除和查看记忆

### 🔗 引用消息支持
- 读取引用消息中的文本
- 识别引用消息中的图片
- 分析引用消息中的视频
- 群聊中通过引用让 AI 分析他人发送的内容

## 📦 安装

### 1. 下载插件

将插件文件夹放置到 NapCat 的 `plugins` 目录：

```
NapCat/
├── plugins/
│   └── napcat-plugin-doubao/
│       ├── src/
│       ├── index.mjs
│       ├── package.json
│       └── config-example.json
└── config/
    └── plugins/
        └── napcat-plugin-doubao/
            └── config.json
```

### 2. 配置插件

复制 `config-example.json` 到 NapCat 配置目录：

```bash
# Windows
copy plugins\napcat-plugin-doubao\config-example.json config\plugins\napcat-plugin-doubao\config.json

# Linux/Mac
cp plugins/napcat-plugin-doubao/config-example.json config/plugins/napcat-plugin-doubao/config.json
```

### 3. 编辑配置

编辑 `config/plugins/napcat-plugin-doubao/config.json`，填入你的 API 密钥和配置。

详细配置说明请参考 [豆包 AI 接入指南](./豆包AI接入指南.md)。

## ⚙️ 配置说明

### 基础配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `apiKey` | string | - | 火山引擎 API 密钥（必填） |
| `model` | string | `doubao-seed-2-0-pro-260215` | 默认模型 |
| `prefix` | string | `@Amadeus` | 触发前缀（群聊） |
| `systemPrompt` | string | - | 系统提示词 |

### API 端点配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `apiUrl` | string | - | Chat API 地址 |
| `botsApiUrl` | string | - | Bots API 地址（联网搜索） |
| `responsesApiUrl` | string | - | Responses API 地址（视频分析） |
| `filesApiUrl` | string | - | Files API 地址（文件上传） |

### 功能开关

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `enablePrivateChat` | boolean | `true` | 启用私聊 |
| `enableGroupChat` | boolean | `true` | 启用群聊 |
| `enableImageRecognition` | boolean | `true` | 启用图片识别 |
| `enableVideoAnalysis` | boolean | `true` | 启用视频分析 |
| `enableWebSearch` | boolean | `true` | 启用联网搜索 |
| `useBotsAPI` | boolean | `true` | 使用 Bots API |
| `useFilesAPI` | boolean | `true` | 使用 Files API（视频上传） |
| `autoReplyGroupVideo` | boolean | `false` | ⚠️ 自动响应群聊视频（会增加 API 调用） |

### 多模态配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `downloadImages` | boolean | `true` | 下载图片/视频 |
| `maxImageSize` | number | `10485760` | 最大图片大小（10MB） |
| `maxVideoSize` | number | `52428800` | 最大视频大小（50MB） |
| `videoFps` | number | `1.0` | 视频帧率 |
| `supportedImageFormats` | array | `["jpg","jpeg","png"...]` | 支持的图片格式 |
| `supportedVideoFormats` | array | `["mp4","avi","mov"]` | 支持的视频格式 |

### 上下文配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `enableContext` | boolean | `true` | 启用上下文记忆 |
| `maxContextMessages` | number | `10` | 最大记忆轮数 |
| `contextTimeout` | number | `30` | 上下文超时（分钟） |
| `separateGroupContext` | boolean | `true` | 群聊独立上下文 |

### 模型参数

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `maxTokens` | number | `500` | 最大输出 Token |
| `temperature` | number | `0.7` | 温度参数（0-1） |
| `visionModel` | string | - | 视觉模型（图片/视频） |

## 🎮 使用方法

### 私聊模式

直接发送消息即可：

```
你好
现在几点了？
[发送图片]
[发送视频]
```

### 群聊模式

使用前缀或 @机器人：

```
@Amadeus 你好
@机器人 现在几点了？
```

### 引用消息模式

在群聊中引用他人的消息并 @AI：

```
[引用群友的视频消息]
@Amadeus 这个视频是哪里？

[引用群友的图片消息]
@Amadeus 这是什么？
```

详细使用方法请参考 [引用消息功能使用指南](./引用消息功能使用指南.md)。

### 特殊命令

| 命令 | 说明 |
|------|------|
| `清除记忆` / `clear memory` | 清除当前对话记忆 |
| `查看记忆` / `show memory` | 查看记忆状态 |

## 🔧 高级功能

### 联网搜索

启用 Bots API 后，AI 可以：
- 查询实时信息（天气、时间、汇率等）
- 搜索最新新闻和资讯
- 获取实时数据

配置方法：
```json
{
  "enableWebSearch": true,
  "useBotsAPI": true,
  "botId": "your-bot-id",
  "botsApiUrl": "https://ark.cn-beijing.volces.com/api/v3/bots/chat/completions"
}
```

### 视频分析

支持分析视频内容，识别场景、物体、文字等：

```json
{
  "enableVideoAnalysis": true,
  "useFilesAPI": true,
  "videoFps": 1.0,
  "maxVideoSize": 52428800
}
```

### 上下文管理

智能记忆对话历史：

```json
{
  "enableContext": true,
  "maxContextMessages": 10,
  "contextTimeout": 30,
  "separateGroupContext": true
}
```

## 📝 API 选择逻辑

插件会根据以下规则自动选择 API：

```
1. 当前消息包含视频？
   ├─ 是 → Responses API（专业视频处理）
   └─ 否 → 继续判断

2. 启用了联网搜索？
   ├─ 是 → Bots API（支持联网+多模态）
   └─ 否 → 继续判断

3. 上下文中有视频历史？
   ├─ 是 → Responses API（保持连贯性）
   └─ 否 → Chat API（快速响应）
```

## 🐛 故障排除

### 视频分析失败

1. 检查视频大小是否超过限制（默认 50MB）
2. 确认视频格式是否支持（MP4、AVI、MOV）
3. 查看 `useFilesAPI` 是否启用
4. 检查 `filesApiUrl` 配置是否正确

### 联网搜索不工作

1. 确认 `enableWebSearch` 和 `useBotsAPI` 已启用
2. 检查 `botId` 是否配置
3. 验证 `botsApiUrl` 是否正确
4. 查看日志中的错误信息

### 上下文记忆丢失

1. 检查 `enableContext` 是否启用
2. 确认 `contextTimeout` 设置是否合理
3. 使用"查看记忆"命令检查状态

## 📚 相关文档

- [豆包 AI 接入指南](./豆包AI接入指南.md) - 详细的 API 配置教程
- [引用消息功能使用指南](./引用消息功能使用指南.md) - 如何使用引用消息功能
- [CHANGELOG.md](./CHANGELOG.md) - 版本更新记录
- [火山引擎文档](https://www.volcengine.com/docs/82379) - 官方 API 文档

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🔗 链接

- [NapCat](https://github.com/NapNeko/NapCatQQ)
- [火山引擎](https://www.volcengine.com/)
- [豆包 AI](https://www.doubao.com/)
