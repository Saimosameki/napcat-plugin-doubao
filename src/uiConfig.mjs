// UI配置模块
export function createPluginConfigUI(ctx) {
  return ctx.NapCatConfig.combine(
    ctx.NapCatConfig.html('<div style="padding: 10px; background: rgba(0,123,255,0.1); border-radius: 8px;"><h3>🤖 牧濑红莉栖AI配置</h3><p>配置豆包AI的API密钥和参数</p></div>'),
    ctx.NapCatConfig.text("apiKey", "API密钥", "", "请输入豆包AI的API密钥", true),
    ctx.NapCatConfig.text("apiUrl", "Chat API地址", "https://ark.cn-beijing.volces.com/api/v3/chat/completions", "豆包AI的Chat API接口地址"),
    ctx.NapCatConfig.text("botsApiUrl", "Bots API地址", "https://ark.cn-beijing.volces.com/api/v3/bots/chat/completions", "豆包AI的Bots API接口地址（支持联网）"),
    ctx.NapCatConfig.text("responsesApiUrl", "Responses API地址", "https://ark.cn-beijing.volces.com/api/v3/responses", "豆包AI的Responses API接口地址（推荐用于多模态）"),
    ctx.NapCatConfig.text("filesApiUrl", "Files API地址", "https://ark.cn-beijing.volces.com/api/v3/files", "豆包AI的Files API接口地址（用于文件上传）"),
    ctx.NapCatConfig.text("model", "模型名称", "doubao-seed-2-0-pro-260215", "使用的豆包AI模型"),
    ctx.NapCatConfig.text("botId", "Bot ID", "", "应用Bot的ID（用于联网功能）"),
    ctx.NapCatConfig.text("prefix", "触发前缀", "@Amadeus", "触发AI回复的前缀"),
    ctx.NapCatConfig.boolean("enablePrivateChat", "启用私聊", true, "是否在私聊中启用AI回复"),
    ctx.NapCatConfig.boolean("enableGroupChat", "启用群聊", true, "是否在群聊中启用AI回复"),
    
    // 使用下拉框的配置项
    ctx.NapCatConfig.select("maxTokens", "回复长度限制", [
      { label: "200 - 简短回复", value: "200" },
      { label: "500 - 标准长度 (推荐)", value: "500" },
      { label: "800 - 较长回复", value: "800" },
      { label: "1000 - 详细回复", value: "1000" },
      { label: "1500 - 很长回复", value: "1500" },
      { label: "2000 - 最长回复", value: "2000" }
    ], "500", "控制AI回复的最大长度，数值越大回复越详细"),
    
    ctx.NapCatConfig.select("temperature", "AI创造性", [
      { label: "0.1 - 非常保守，回复一致性高", value: "0.1" },
      { label: "0.3 - 较保守，适合正式场合", value: "0.3" },
      { label: "0.5 - 平衡，适合日常对话", value: "0.5" },
      { label: "0.7 - 较活跃，回复有趣多样 (推荐)", value: "0.7" },
      { label: "0.9 - 很活跃，回复创意丰富", value: "0.9" },
      { label: "1.0 - 最大创造性，回复最随机", value: "1.0" }
    ], "0.7", "控制AI回复的创造性和随机性程度"),
    
    ctx.NapCatConfig.text("systemPrompt", "系统提示", "你是牧濑红莉栖，18岁天才科学家。性格：傲娇、理性、聪明但有点毒舌。说话简洁直接，喜欢用科学角度分析问题。表面高冷实际关心他人，但绝不直接承认。常用语气：'哼'、'真是的'、'笨蛋'。回复要简短有力，体现你的傲娇和科学素养，偶尔展现可爱一面但立刻否认。", "AI的系统提示词"),
    
    ctx.NapCatConfig.html('<div style="padding: 10px; background: rgba(40,167,69,0.1); border-radius: 8px; margin-top: 10px;"><h4>🌐 联网功能配置</h4></div>'),
    ctx.NapCatConfig.boolean("enableWebSearch", "启用联网搜索", true, "是否启用AI联网搜索功能"),
    ctx.NapCatConfig.boolean("smartWebSearch", "智能联网检测", true, "根据消息内容智能判断是否需要联网查询（推荐开启）"),
    ctx.NapCatConfig.boolean("showSearchReferences", "显示搜索引用", true, "在回复中显示联网搜索的参考资料"),
    ctx.NapCatConfig.text("webSearchPlugin", "联网插件名称", "web_search", "Bots API使用的联网搜索插件名称"),
    
    ctx.NapCatConfig.html('<div style="padding: 10px; background: rgba(40,167,69,0.1); border-radius: 8px; margin-top: 10px;"><h4>💬 对话上下文配置</h4></div>'),
    ctx.NapCatConfig.boolean("enableContext", "启用上下文", true, "是否启用对话上下文记忆功能"),
    ctx.NapCatConfig.text("maxContextMessages", "最大上下文消息数", "10", "保存的最大对话轮数"),
    ctx.NapCatConfig.text("contextTimeout", "上下文超时时间", "30", "上下文过期时间（分钟）"),
    ctx.NapCatConfig.boolean("separateGroupContext", "群聊独立上下文", true, "是否为每个群聊单独保存上下文"),
    
    ctx.NapCatConfig.html('<div style="padding: 10px; background: rgba(255,193,7,0.1); border-radius: 8px; margin-top: 10px;"><h4>🎨 多模态功能配置</h4></div>'),
    ctx.NapCatConfig.boolean("enableImageRecognition", "启用图片识别", true, "是否启用图片识别功能"),
    ctx.NapCatConfig.boolean("enableVideoAnalysis", "启用视频分析", true, "是否启用视频内容分析功能"),
    ctx.NapCatConfig.boolean("enableDocumentOCR", "启用文档阅读", true, "是否启用文档内容阅读功能"),
    ctx.NapCatConfig.boolean("enableImageGeneration", "启用图片生成", true, "是否启用AI图片生成功能"),
    
    ctx.NapCatConfig.html('<div style="padding: 8px; background: rgba(23,162,184,0.1); border-left: 4px solid #17a2b8; margin: 8px 0;"><small><strong>💡 图片尺寸：</strong>完全由提示词控制，豆包AI会根据描述自动选择最合适的尺寸。如需指定比例，可在提示词中注明，如"16:9"、"9:16"、"1:1"等。</small></div>'),
    
    ctx.NapCatConfig.text("imageGenModel", "图片生成模型", "doubao-seedream-4-5-251128", "用于图片生成的模型名称"),
    ctx.NapCatConfig.text("imageGenApiUrl", "图片生成API地址", "https://ark.cn-beijing.volces.com/api/v3/images/generations", "图片生成API接口地址"),
    
    ctx.NapCatConfig.select("imageGenQuality", "图片生成质量", [
      { label: "标准质量 (standard) - 推荐", value: "standard" },
      { label: "高清质量 (hd) - 更清晰但耗时更长", value: "hd" }
    ], "standard", "选择图片生成的质量等级"),
    
    ctx.NapCatConfig.select("imageGenSize", "图片生成分辨率", [
      { label: "2K - 标准高清 (推荐)", value: "2K" },
      { label: "4K - 超高清，耗时更长且费用更高", value: "4K" }
    ], "2K", "选择图片生成的分辨率，4K费用约为2K的4倍"),
    
    ctx.NapCatConfig.text("imageGenTimeout", "图片生成超时", "60", "图片生成超时时间（秒）"),
    ctx.NapCatConfig.text("maxDocumentSize", "文档内容大小限制", "1048576", "单个文档内容的最大字符数（字节）"),
    ctx.NapCatConfig.text("maxDocumentFileSize", "文档文件大小限制", "10485760", "文档文件的最大大小（字节，默认10MB）"),
    
    ctx.NapCatConfig.html('<div style="padding: 10px; background: rgba(220,53,69,0.1); border-radius: 8px; margin-top: 10px;"><h4>🔒 访问控制</h4></div>'),
    ctx.NapCatConfig.text("allowedUsers", "允许的QQ号", "", "允许使用AI的QQ号列表，多个用英文逗号分隔，留空表示允许所有人。例如：123456789,987654321"),
    
    ctx.NapCatConfig.html('<div style="padding: 10px; background: rgba(220,53,69,0.1); border-radius: 8px; margin-top: 10px;"><h4>📹 视频分析高级配置</h4></div>'),
    ctx.NapCatConfig.boolean("autoReplyGroupVideo", "群聊视频自动响应", false, "⚠️ 自动响应群聊中的所有视频消息（会增加API调用次数）"),
    
    ctx.NapCatConfig.select("videoFps", "视频抽帧频率", [
      { label: "0.2 - 每5秒1帧，节省Token", value: "0.2" },
      { label: "0.5 - 每2秒1帧，平衡模式", value: "0.5" },
      { label: "1.0 - 每秒1帧，标准模式 (推荐)", value: "1.0" },
      { label: "2.0 - 每秒2帧，详细分析", value: "2.0" },
      { label: "3.0 - 每秒3帧，精细分析", value: "3.0" },
      { label: "5.0 - 每秒5帧，最精细分析", value: "5.0" }
    ], "1.0", "控制视频分析的精细程度，数值越高分析越详细但消耗更多Token"),
    
    ctx.NapCatConfig.boolean("useFilesAPI", "使用Files API", true, "优先使用Files API上传视频（推荐）"),
    ctx.NapCatConfig.text("maxVideoSize", "最大视频大小", "50", "视频文件大小限制（MB）"),
    ctx.NapCatConfig.text("videoAnalysisTimeout", "视频分析超时", "60", "视频分析超时时间（秒）")
  );
}
