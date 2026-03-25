// Bots API 模块（支持联网搜索）
import { getConfig } from '../config.mjs';
import { getContext, saveContext } from '../context.mjs';

export async function callBotsAPI(messageContent, contextId, logger, userMessageId = null) {
  try {
    const config = getConfig();
    
    // 检查Bot ID是否配置
    if (!config.botId || config.botId.trim() === '') {
      logger?.error("Bot ID未配置，无法使用联网搜索功能");
      return "❌ 联网搜索功能未配置。请在插件设置中配置Bot ID以启用实时信息查询功能。";
    }
    
    const messages = [
      {
        role: "system",
        content: config.systemPrompt + `

🌐 联网搜索指令：
你现在具备联网搜索能力。当用户询问以下类型的问题时，你必须主动搜索最新信息：

【必须联网查询的内容】：
- 实时新闻和时事（如"伊朗局势"、"国际新闻"、"最新消息"、"DLSS5"等技术新闻）
- 当前价格和行情（股票、汇率、商品价格、房价）
- 最新版本和更新信息（软件、游戏、应用、硬件技术）
- 实时天气和交通状况
- 营业时间和开放状态
- 体育赛事结果和排名
- 任何包含"现在"、"今天"、"最新"、"当前"、"实时"等时间词汇的问题
- 突发事件和紧急新闻
- 政治局势和外交动态
- 科技产品发布和技术更新（如显卡、CPU、AI技术等）
- 游戏更新、版本发布、补丁信息

【搜索策略优化】：
1. 对于技术类问题（如DLSS5），使用多个关键词组合搜索：
   - 主要关键词 + "最新消息"
   - 主要关键词 + "发布时间"
   - 主要关键词 + "官方消息"
   - 英文关键词搜索（如"DLSS 5 release"）
2. 对于新闻类问题，优先搜索权威媒体和官方消息
3. 对于价格行情，搜索最新的市场数据
4. 对于时事政治，搜索多个可靠来源进行交叉验证
5. 如果首次搜索结果不够详细，尝试使用不同的关键词组合再次搜索
6. 对于专业术语，同时搜索中英文关键词以获得更全面的信息

【搜索关键词优化技巧】：
- 使用同义词和相关词汇扩展搜索
- 结合时间限定词（如"2024"、"2025"、"最新"）
- 包含品牌名称和型号（如"NVIDIA DLSS 5"）
- 使用引号搜索精确短语
- 添加"官方"、"发布"、"消息"等修饰词

重要：对于时事新闻和实时数据，务必使用联网搜索获取最新信息，不要依赖训练数据中的过时信息。如果搜索结果不够详细或没有找到相关信息，请尝试使用不同的关键词组合进行多次搜索，确保获得最准确和最新的信息。`
      }
    ];

    if (config.enableContext && contextId) {
      const context = getContext(contextId, logger);
      if (context && context.messages.length > 0) {
        for (const msg of context.messages) {
          if (typeof msg.content === 'string') {
            messages.push({
              role: msg.role,
              content: msg.content
            });
          } else if (Array.isArray(msg.content)) {
            // 过滤掉视频内容，Bots API 不支持 input_video 和 video_url
            const filteredContent = msg.content.filter(item => 
              item.type !== 'input_video' && item.type !== 'video_url'
            );
            
            // 如果过滤后还有内容，则添加消息
            if (filteredContent.length > 0) {
              messages.push({
                role: msg.role,
                content: filteredContent
              });
            } else if (msg.role === 'assistant') {
              // 如果是助手消息且过滤后为空，添加一个占位文本
              messages.push({
                role: msg.role,
                content: [{ type: "text", text: "[视频内容已省略]" }]
              });
            }
          }
        }
        logger?.info(`加载上下文消息到Bots API: ${context.messages.length} 条（已过滤视频内容）`);
      }
    }

    // 过滤当前消息中的视频内容
    let currentContent;
    if (Array.isArray(messageContent)) {
      const filteredContent = messageContent.filter(item => 
        item.type !== 'input_video' && item.type !== 'video_url'
      );
      currentContent = filteredContent.length > 0 ? filteredContent : [
        { type: "text", text: "[视频内容]" }
      ];
    } else {
      currentContent = [{ type: "text", text: messageContent }];
    }

    messages.push({
      role: "user",
      content: currentContent
    });

    const requestBody = {
      model: config.botId,
      messages: messages,
      max_tokens: parseInt(config.maxTokens) || 1000,
      temperature: parseFloat(config.temperature) || 0.7,
      stream: false,
      // 豆包Bots API的联网搜索配置 - 优化搜索参数
      plugins: [
        {
          name: config.webSearchPlugin || "web_search",
          enabled: true,
          config: {
            search_result_count: config.searchResultCount || 8,  // 可配置的搜索结果数量
            search_timeout: config.searchTimeout || 15000,   // 可配置的搜索超时时间
            include_recent: true,    // 包含最新内容
            prefer_authoritative: true,  // 优先权威来源
            search_depth: config.enableDeepSearch ? "deep" : "normal",    // 深度搜索模式
            enable_multi_query: config.enableMultiQuery !== false,  // 启用多查询策略
            query_expansion: config.enableQueryExpansion !== false,   // 启用查询扩展
            semantic_search: config.enableSemanticSearch !== false,   // 启用语义搜索
            language_preference: ["zh", "en"],  // 语言偏好
            content_freshness: "latest",  // 内容新鲜度偏好
            search_domains: ["all"],  // 搜索所有域名
            filter_duplicates: true,  // 过滤重复内容
            boost_keywords: true     // 关键词增强
          }
        }
      ]
    };

    logger?.info(`Bots API请求: Bot ID=${config.botId}, 消息数=${messages.length}`);
    logger?.info(`请求体:`, JSON.stringify(requestBody, null, 2));

    const response = await fetch(config.botsApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      logger?.error(`Bots API请求失败: ${response.status}`);
      const errorText = await response.text();
      logger?.error(`错误详情: ${errorText}`);
      return null;
    }

    const data = await response.json();
    logger?.info(`Bots API响应:`, JSON.stringify(data, null, 2));
    
    if (data.choices && data.choices.length > 0) {
      let content = data.choices[0].message.content.trim();
      
      // 如果有联网搜索结果，添加引用信息
      if (data.references && data.references.length > 0) {
        logger?.info(`联网搜索结果数: ${data.references.length}`);
        logger?.info(`搜索引用:`, JSON.stringify(data.references, null, 2));
        
        // 在回复末尾添加引用信息（如果配置启用）
        if (config.showSearchReferences) {
          const references = data.references.map((ref, index) => {
            const title = ref.title || ref.name || '搜索结果';
            const url = ref.url || ref.link || '';
            return url ? `[${index + 1}] ${title} - ${url}` : `[${index + 1}] ${title}`;
          }).join('\n');
          
          if (references) {
            content += `\n\n📚 参考资料：\n${references}`;
          }
        }
      } else {
        logger?.warn("Bots API未返回联网搜索结果，可能需要检查Bot配置或API参数");
        logger?.warn("请确保：1) Bot ID正确配置 2) Bot已启用联网插件 3) API密钥有联网权限");
      }
      
      if (config.enableContext && contextId) {
        saveContext(contextId, messageContent, content, logger, userMessageId);
      }
      
      if (data.bot_usage) {
        logger?.info(`Bots API Token使用:`, JSON.stringify(data.bot_usage, null, 2));
      }
      
      return content;
    } else {
      logger?.error("Bots API返回格式异常:", data);
      return null;
    }
  } catch (error) {
    logger?.error("调用Bots API时发生错误:", error);
    return null;
  }
}