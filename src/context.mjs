// 上下文管理模块
import { getConfig } from './config.mjs';

const conversationContexts = new Map();

export function getContextId(event) {
  if (event.message_type === "private") {
    return `private_${event.user_id}`;
  } else if (event.message_type === "group") {
    const config = getConfig();
    if (config.separateGroupContext) {
      return `group_${event.group_id}`;
    } else {
      return `group_${event.group_id}_user_${event.user_id}`;
    }
  }
  return `unknown_${event.user_id || 'anonymous'}`;
}

export function getContext(contextId, logger) {
  const config = getConfig();
  if (!config.enableContext) {
    return null;
  }
  
  const context = conversationContexts.get(contextId);
  if (!context) {
    return null;
  }
  
  const now = Date.now();
  const timeout = (parseInt(config.contextTimeout) || 30) * 60 * 1000;
  if (now - context.lastUpdate > timeout) {
    conversationContexts.delete(contextId);
    logger?.info(`上下文已过期并清除: ${contextId}`);
    return null;
  }
  
  return context;
}

export function saveContext(contextId, userMessage, aiResponse, logger, userMessageId = null) {
  const config = getConfig();
  if (!config.enableContext) {
    return;
  }
  
  let context = conversationContexts.get(contextId);
  if (!context) {
    context = {
      messages: [],
      messageIdMap: new Map(), // 添加消息ID映射
      lastUpdate: Date.now()
    };
  }
  
  const userMsg = {
    role: "user",
    content: userMessage,
    timestamp: Date.now(),
    messageId: userMessageId
  };
  
  const assistantMsg = {
    role: "assistant", 
    content: aiResponse,
    timestamp: Date.now()
  };
  
  context.messages.push(userMsg);
  context.messages.push(assistantMsg);
  
  // 保存消息ID映射
  if (userMessageId) {
    if (!context.messageIdMap) {
      context.messageIdMap = new Map();
    }
    context.messageIdMap.set(String(userMessageId), userMsg);
    logger?.info(`保存消息ID映射: ${userMessageId}`);
  }
  
  const maxMessages = parseInt(config.maxContextMessages) || 10;
  if (context.messages.length > maxMessages * 2) {
    context.messages = context.messages.slice(-maxMessages * 2);
  }
  
  context.lastUpdate = Date.now();
  conversationContexts.set(contextId, context);
  
  logger?.info(`保存上下文: ${contextId}, 消息数: ${context.messages.length}`);
}

export function clearContext(contextId, logger) {
  if (conversationContexts.has(contextId)) {
    conversationContexts.delete(contextId);
    logger?.info(`清除上下文: ${contextId}`);
    return true;
  }
  return false;
}

// 定期清理过期上下文
setInterval(() => {
  const config = getConfig();
  const now = Date.now();
  const timeout = (parseInt(config.contextTimeout) || 30) * 60 * 1000;
  let cleanedCount = 0;
  
  for (const [contextId, context] of conversationContexts.entries()) {
    if (now - context.lastUpdate > timeout) {
      conversationContexts.delete(contextId);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`定期清理过期上下文: ${cleanedCount} 个`);
  }
}, 5 * 60 * 1000);
