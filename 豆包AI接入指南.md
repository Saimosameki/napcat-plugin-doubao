# 豆包 AI 接入指南

本指南将帮助你从零开始配置火山引擎豆包 AI，并成功接入 NapCat 插件。

## 📋 目录

1. [注册火山引擎账号](#1-注册火山引擎账号)
2. [开通豆包服务](#2-开通豆包服务)
3. [获取 API 密钥](#3-获取-api-密钥)
4. [配置模型接入点](#4-配置模型接入点)
5. [配置 Bots API（可选）](#5-配置-bots-api可选)
6. [完整配置示例](#6-完整配置示例)
7. [测试配置](#7-测试配置)
8. [常见问题](#8-常见问题)

---

## 1. 注册火山引擎账号

### 步骤 1.1：访问火山引擎官网

访问 [火山引擎官网](https://www.volcengine.com/)，点击右上角"注册"按钮。

### 步骤 1.2：完成注册

- 使用手机号或邮箱注册
- 完成实名认证（企业或个人）
- 绑定支付方式（用于后续计费）

### 步骤 1.3：领取新人优惠

火山引擎通常为新用户提供免费额度或优惠券，建议在控制台查看并领取。

---

## 2. 开通豆包服务

### 步骤 2.1：进入豆包控制台

1. 登录火山引擎控制台
2. 在产品列表中找到"豆包大模型"或"模型推理"
3. 点击进入豆包控制台

### 步骤 2.2：开通服务

1. 点击"立即开通"或"开始使用"
2. 阅读并同意服务协议
3. 选择计费方式（按量付费或资源包）

### 步骤 2.3：创建推理接入点

1. 在控制台左侧菜单选择"推理接入点"
2. 点击"创建推理接入点"
3. 选择模型：
   - **推荐模型**：`doubao-seed-2-0-pro-260215`（支持多模态）
   - 其他可选：`doubao-pro-32k`、`doubao-lite-32k` 等
4. 配置接入点名称（如：`my-doubao-api`）
5. 点击"确认创建"

### 步骤 2.4：记录接入点信息

创建成功后，记录以下信息：
- **接入点 ID**（Endpoint ID）
- **模型名称**（Model Name）

---

## 3. 获取 API 密钥

### 步骤 3.1：创建 API 密钥

1. 在控制台右上角点击用户头像
2. 选择"API 访问密钥"或"密钥管理"
3. 点击"新建密钥"
4. 输入密钥名称（如：`napcat-plugin`）
5. 点击"确认"

### 步骤 3.2：保存密钥

⚠️ **重要**：密钥只会显示一次，请立即保存到安全的地方！

```
API Key: sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 4. 配置模型接入点

### 步骤 4.1：获取 API 端点地址

火山引擎豆包提供以下 API 端点：

#### Chat API（基础对话）
```
https://ark.cn-beijing.volces.com/api/v3/chat/completions
```

#### Responses API（视频分析）
```
https://ark.cn-beijing.volces.com/api/v3/responses
```

#### Files API（文件上传）
```
https://ark.cn-beijing.volces.com/api/v3/files
```

### 步骤 4.2：配置插件

编辑 `config/plugins/napcat-plugin-doubao/config.json`：

```json
{
  "apiKey": "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "apiUrl": "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
  "responsesApiUrl": "https://ark.cn-beijing.volces.com/api/v3/responses",
  "filesApiUrl": "https://ark.cn-beijing.volces.com/api/v3/files",
  "model": "doubao-seed-2-0-pro-260215",
  "visionModel": "doubao-seed-2-0-pro-260215"
}
```

---

## 5. 配置 Bots API（可选）

Bots API 支持联网搜索和实时信息查询，是可选但推荐的功能。

### 步骤 5.1：创建 Bot

1. 在豆包控制台选择"智能体"或"Bots"
2. 点击"创建智能体"
3. 配置 Bot 信息：
   - **名称**：如 `NapCat助手`
   - **描述**：简要说明 Bot 用途
   - **能力**：勾选"联网搜索"
   - **模型**：选择 `doubao-seed-2-0-pro-260215`
4. 点击"创建"

### 步骤 5.2：获取 Bot ID

创建成功后，在 Bot 详情页找到 **Bot ID**（格式如：`bot-20260312224842-xxxxx`）

### 步骤 5.3：配置插件

在配置文件中添加 Bots API 配置：

```json
{
  "enableWebSearch": true,
  "useBotsAPI": true,
  "botId": "bot-20260312224842-xxxxx",
  "botsApiUrl": "https://ark.cn-beijing.volces.com/api/v3/bots/chat/completions"
}
```

---

## 6. 完整配置示例

### 基础配置（仅对话功能）

```json
{
  "apiKey": "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "apiUrl": "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
  "model": "doubao-seed-2-0-pro-260215",
  "prefix": "@Amadeus",
  "enablePrivateChat": true,
  "enableGroupChat": true,
  "maxTokens": 500,
  "temperature": 0.7,
  "systemPrompt": "你是一个友好的AI助手",
  "enableContext": true,
  "maxContextMessages": 10,
  "contextTimeout": 30
}
```

### 完整配置（所有功能）

```json
{
  "apiKey": "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "apiUrl": "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
  "responsesApiUrl": "https://ark.cn-beijing.volces.com/api/v3/responses",
  "filesApiUrl": "https://ark.cn-beijing.volces.com/api/v3/files",
  "botsApiUrl": "https://ark.cn-beijing.volces.com/api/v3/bots/chat/completions",
  "model": "doubao-seed-2-0-pro-260215",
  "visionModel": "doubao-seed-2-0-pro-260215",
  "botId": "bot-20260312224842-xxxxx",
  "prefix": "@Amadeus",
  "enablePrivateChat": true,
  "enableGroupChat": true,
  "maxTokens": 500,
  "temperature": 0.7,
  "systemPrompt": "你是一个友好的AI助手，具备强大的视频理解能力。",
  "enableImageRecognition": true,
  "enableVideoAnalysis": true,
  "downloadImages": true,
  "maxImageSize": 10485760,
  "maxVideoSize": 52428800,
  "supportedImageFormats": ["jpg", "jpeg", "png", "gif", "bmp", "webp"],
  "supportedVideoFormats": ["mp4", "avi", "mov"],
  "videoFps": 1.0,
  "useFilesAPI": true,
  "videoAnalysisTimeout": 60000,
  "enableWebSearch": true,
  "useBotsAPI": true,
  "enableContext": true,
  "maxContextMessages": 10,
  "contextTimeout": 30,
  "separateGroupContext": true
}
```

---

## 7. 测试配置

### 步骤 7.1：启动 NapCat

启动 NapCat 并查看日志，确认插件加载成功：

```
[info] Amadeus AI插件已初始化
```

### 步骤 7.2：测试基础对话

私聊机器人发送：
```
你好
```

预期响应：AI 正常回复

### 步骤 7.3：测试图片识别

发送一张图片，预期响应：AI 描述图片内容

### 步骤 7.4：测试视频分析

发送一个视频（小于 50MB），预期响应：AI 分析视频内容

### 步骤 7.5：测试联网搜索

发送：
```
现在几点了？
今天天气怎么样？
```

预期响应：AI 返回实时信息

---

## 8. 常见问题

### Q1：API 密钥无效

**错误信息**：`401 Unauthorized` 或 `Invalid API Key`

**解决方法**：
1. 检查 `apiKey` 是否正确复制（注意空格）
2. 确认密钥是否已激活
3. 检查密钥是否有足够的权限
4. 尝试重新创建密钥

### Q2：模型不存在

**错误信息**：`Model not found` 或 `Invalid model`

**解决方法**：
1. 确认模型名称拼写正确
2. 检查是否已创建对应的推理接入点
3. 确认模型是否已开通

### Q3：视频分析失败

**错误信息**：`Video processing failed`

**解决方法**：
1. 检查视频大小（默认限制 50MB）
2. 确认视频格式（支持 MP4、AVI、MOV）
3. 检查 `useFilesAPI` 是否启用
4. 确认 `filesApiUrl` 配置正确

### Q4：联网搜索不工作

**错误信息**：`Bot not found` 或无实时信息

**解决方法**：
1. 确认已创建 Bot 并获取 Bot ID
2. 检查 `enableWebSearch` 和 `useBotsAPI` 是否启用
3. 验证 `botId` 配置正确
4. 确认 Bot 已开启联网搜索能力

### Q5：上下文记忆不生效

**解决方法**：
1. 检查 `enableContext` 是否为 `true`
2. 确认 `maxContextMessages` 大于 0
3. 检查 `contextTimeout` 设置（单位：分钟）
4. 使用"查看记忆"命令检查状态

### Q6：费用问题

**如何控制成本**：
1. 设置合理的 `maxTokens`（建议 500-1000）
2. 调整 `maxContextMessages`（建议 5-10）
3. 关闭不需要的功能（图片/视频识别）
4. 使用更经济的模型（如 `doubao-lite-32k`）

**查看费用**：
- 登录火山引擎控制台
- 进入"费用中心"
- 查看"消费明细"

### Q7：API 端点区域问题

火山引擎在不同区域有不同的端点：

- **华北（北京）**：`ark.cn-beijing.volces.com`
- **华东（上海）**：`ark.cn-shanghai.volces.com`
- **华南（广州）**：`ark.cn-guangzhou.volces.com`

根据你的账号区域选择对应的端点。

---

## 📞 获取帮助

### 官方文档
- [火山引擎豆包文档](https://www.volcengine.com/docs/82379)
- [API 参考](https://www.volcengine.com/docs/82379/1099475)

### 社区支持
- [NapCat 社区](https://github.com/NapNeko/NapCatQQ)
- [火山引擎开发者社区](https://developer.volcengine.com/)

### 技术支持
- 火山引擎工单系统
- 在线客服

---

## 🎉 配置完成

恭喜！你已经成功配置了豆包 AI 插件。现在可以开始使用强大的 AI 对话、图片识别、视频分析和联网搜索功能了。

如果遇到问题，请参考上面的常见问题部分，或查看日志文件获取详细错误信息。
