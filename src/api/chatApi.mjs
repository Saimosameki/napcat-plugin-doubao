// Chat API 模块
import { getConfig } from '../config.mjs';
import { getContext, saveContext } from '../context.mjs';

export async function callChatAPI(messageContent, contextId, modelToUse, logger, userMessageId = null) {
  try {
    const config = getConfig();
    const messages = [
      {
        role: "system",
        content: config.systemPrompt
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
            messages.push({
              role: msg.role,
              content: msg.content
            });
          }
        }
        logger?.info(`加载上下文消息到Chat API: ${context.messages.length} 条`);
      }
    }

    messages.push({
      role: "user",
      content: Array.isArray(messageContent) ? messageContent : [
        {
          type: "text",
          text: messageContent
        }
      ]
    });

    const requestBody = {
      model: modelToUse,
      messages: messages,
      max_tokens: parseInt(config.maxTokens) || 1000,
      temperature: parseFloat(config.temperature) || 0.7
    };

    logger?.info(`Chat API请求: 模型=${modelToUse}, 消息数=${messages.length}`);

    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      logger?.error(`Chat API请求失败: ${response.status}`);
      const errorText = await response.text();
      logger?.error(`错误详情: ${errorText}`);
      return null;
    }

    const data = await response.json();
    
    if (data.choices && data.choices.length > 0) {
      const content = data.choices[0].message.content.trim();
      
      if (config.enableContext && contextId) {
        saveContext(contextId, messageContent, content, logger, userMessageId);
      }
      
      if (data.usage) {
        logger?.info(`Chat API Token使用: 输入${data.usage.prompt_tokens}, 输出${data.usage.completion_tokens}, 总计${data.usage.total_tokens}`);
      }
      
      return content;
    } else {
      logger?.error("Chat API返回格式异常:", data);
      return null;
    }
  } catch (error) {
    logger?.error("调用Chat API时发生错误:", error);
    return null;
  }
}
