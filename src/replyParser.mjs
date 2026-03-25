// 引用消息解析模块
import { getConfig } from './config.mjs';
import { getContext, getContextId } from './context.mjs';
import { processCQImage } from './multimedia/image.mjs';
import { processCQVideo } from './multimedia/video.mjs';

/**
 * 解析引用消息的 CQ 码
 * @param {string} cqParams - CQ 码参数
 * @returns {object|null} 引用消息信息
 */
export function parseReplyParams(cqParams) {
  try {
    const params = {};
    const pairs = cqParams.split(',');
    
    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      if (key && value) {
        params[key.trim()] = value.trim();
      }
    }
    
    return params;
  } catch (error) {
    return null;
  }
}

/**
 * 从上下文记忆中查找消息
 * @param {object} event - 消息事件
 * @param {string} messageId - 消息 ID
 * @param {object} logger - 日志对象
 * @returns {object|null} 找到的消息对象
 */
function findMessageInContext(event, messageId, logger) {
  try {
    const contextId = getContextId(event);
    const context = getContext(contextId, logger);
    
    if (!context) {
      logger?.info("上下文为空，无法从记忆中查找消息");
      return null;
    }
    
    logger?.info(`在上下文中查找消息 ID: ${messageId}`);
    
    // 首先尝试从 messageIdMap 中查找
    if (context.messageIdMap && context.messageIdMap.has(String(messageId))) {
      const msg = context.messageIdMap.get(String(messageId));
      logger?.info(`在消息ID映射中找到匹配的消息`);
      
      // 将消息内容转换为可解析的格式
      let rawMessage = '';
      if (typeof msg.content === 'string') {
        rawMessage = msg.content;
      } else if (Array.isArray(msg.content)) {
        // 提取文本内容
        const textParts = msg.content
          .filter(item => item.type === 'text')
          .map(item => item.text);
        rawMessage = textParts.join(' ');
      }
      
      return {
        raw_message: rawMessage,
        message: rawMessage,
        content: msg.content,
        message_id: messageId
      };
    }
    
    // 如果没有 messageIdMap，尝试遍历消息数组
    if (context.messages && context.messages.length > 0) {
      logger?.info(`遍历上下文消息数组，消息数: ${context.messages.length}`);
      for (const msg of context.messages) {
        if (msg.messageId === messageId || msg.message_id === messageId || 
            String(msg.messageId) === String(messageId)) {
          logger?.info(`在消息数组中找到匹配的消息`);
          
          let rawMessage = '';
          if (typeof msg.content === 'string') {
            rawMessage = msg.content;
          } else if (Array.isArray(msg.content)) {
            const textParts = msg.content
              .filter(item => item.type === 'text')
              .map(item => item.text);
            rawMessage = textParts.join(' ');
          }
          
          return {
            raw_message: rawMessage,
            message: rawMessage,
            content: msg.content,
            message_id: messageId
          };
        }
      }
    }
    
    logger?.info("在上下文中未找到匹配的消息");
    return null;
  } catch (error) {
    logger?.error("从上下文查找消息时出错:", error);
    return null;
  }
}

/**
 * 从 event.message 数组中提取引用消息的完整内容
 * @param {object} event - 消息事件
 * @param {string} messageId - 消息 ID
 * @param {object} logger - 日志对象
 * @returns {object|null} 引用消息对象
 */
function extractReplyFromEventMessage(event, messageId, logger) {
  try {
    if (!event.message || !Array.isArray(event.message)) {
      return null;
    }
    
    // 查找 reply 类型的消息段
    const replySegment = event.message.find(seg => seg.type === 'reply');
    if (!replySegment || !replySegment.data) {
      return null;
    }
    
    // 检查 ID 是否匹配
    if (replySegment.data.id !== messageId && String(replySegment.data.id) !== String(messageId)) {
      return null;
    }
    
    logger?.info(`从 event.message 中找到 reply 段:`, JSON.stringify(replySegment.data));
    
    // NapCat 可能在 reply.data 中包含被引用消息的完整内容
    // 检查是否有 message 或 content 字段
    if (replySegment.data.message) {
      logger?.info(`reply 段包含 message 字段`);
      return {
        message_id: messageId,
        raw_message: typeof replySegment.data.message === 'string' 
          ? replySegment.data.message 
          : JSON.stringify(replySegment.data.message),
        message: replySegment.data.message,
        content: replySegment.data.message
      };
    }
    
    // 检查是否有 seq 字段（可能需要通过 seq 查找）
    if (replySegment.data.seq) {
      logger?.info(`reply 段包含 seq: ${replySegment.data.seq}`);
    }
    
    return null;
  } catch (error) {
    logger?.error("从 event.message 提取引用消息时出错:", error);
    return null;
  }
}

/**
 * 获取被引用的消息内容
 * @param {object} ctx - NapCat 上下文
 * @param {object} event - 消息事件
 * @param {string} messageId - 被引用的消息 ID
 * @param {object} logger - 日志对象
 * @returns {object|null} 被引用的消息对象
 */
export async function getReplyMessage(ctx, event, messageId, logger) {
  try {
    // 方法1: 从 event.message 数组中提取引用消息的完整内容
    logger?.info("尝试从 event.message 中提取引用消息内容");
    const eventMessage = extractReplyFromEventMessage(event, messageId, logger);
    if (eventMessage) {
      return eventMessage;
    }
    
    // 方法2: 检查 event.message 数组中是否包含 reply 类型的消息段
    if (event.message && Array.isArray(event.message)) {
      for (const segment of event.message) {
        if (segment.type === 'reply' && segment.data) {
          logger?.info(`从消息段中找到引用信息:`, JSON.stringify(segment.data));
          
          // 检查是否有文本内容
          if (segment.data.text) {
            return {
              message_id: segment.data.id,
              raw_message: segment.data.text,
              message: segment.data.text,
              sender: {
                user_id: segment.data.qq || segment.data.uin
              }
            };
          }
          
          // 如果没有文本，尝试从其他字段获取
          if (segment.data.content) {
            return {
              message_id: segment.data.id,
              raw_message: segment.data.content,
              message: segment.data.content
            };
          }
        }
      }
    }
    
    // 方法3: 从上下文记忆中查找
    logger?.info("尝试从上下文记忆中查找引用消息");
    const contextMessage = findMessageInContext(event, messageId, logger);
    if (contextMessage) {
      return contextMessage;
    }
    
    // 方法4: 尝试使用 get_msg API
    if (ctx && ctx.actions) {
      logger?.info(`尝试使用 get_msg API 获取消息: ${messageId}`);
      
      // 尝试不同的 API 调用方式
      const methods = [
        () => ctx.actions.get_msg({ message_id: messageId }),
        () => ctx.actions.get_msg({ id: messageId }),
        () => ctx.actions.getMsg({ message_id: messageId }),
        () => ctx.actions.getMsg({ id: messageId })
      ];
      
      for (const method of methods) {
        try {
          const result = await method();
          if (result && result.data) {
            logger?.info(`成功获取引用消息:`, JSON.stringify(result.data));
            return result.data;
          }
        } catch (e) {
          // 继续尝试下一个方法
        }
      }
    }
    
    logger?.warn(`无法通过任何方法获取引用消息: ${messageId}`);
    logger?.warn(`提示：被引用的消息可能未被 AI 处理过，无法从上下文中找到`);
    logger?.warn(`建议：在群聊中先 @AI 发送消息，或者引用已经被 AI 处理过的消息`);
    return null;
  } catch (error) {
    logger?.error(`获取引用消息失败: ${messageId}`, error);
    return null;
  }
}

/**
 * 解析被引用消息中的多媒体内容
 * @param {object} replyMessage - 被引用的消息对象
 * @param {object} logger - 日志对象
 * @returns {array} 解析后的内容数组
 */
export async function parseReplyContent(replyMessage, logger) {
  const content = [];
  const config = getConfig();
  
  if (!replyMessage) {
    return content;
  }
  
  logger?.info(`解析引用消息，消息对象:`, JSON.stringify(replyMessage, null, 2));
  
  // 如果引用消息的 content 是数组（多模态内容），直接使用
  if (Array.isArray(replyMessage.content)) {
    logger?.info(`引用消息包含多模态内容，项数: ${replyMessage.content.length}`);
    
    // 检查是否包含视频或图片
    const hasVideo = replyMessage.content.some(item => 
      item.type === 'input_video' || item.type === 'video_url'
    );
    const hasImage = replyMessage.content.some(item => 
      item.type === 'image_url'
    );
    
    if (hasVideo || hasImage) {
      // 直接返回多模态内容，添加引用标记
      content.push({
        type: "text",
        text: "[引用的消息包含多媒体内容]"
      });
      
      // 添加所有多模态内容
      for (const item of replyMessage.content) {
        if (item.type === 'text') {
          if (item.text && item.text.trim()) {
            content.push({
              type: "text",
              text: `[引用消息文本: ${item.text}]`
            });
          }
        } else if (item.type === 'image_url') {
          content.push(item);
          logger?.info(`添加引用消息中的图片`);
        } else if (item.type === 'input_video') {
          content.push(item);
          logger?.info(`添加引用消息中的视频: ${item.file_id}`);
        } else if (item.type === 'video_url') {
          content.push(item);
          logger?.info(`添加引用消息中的视频URL`);
        }
      }
      
      logger?.info(`成功解析引用消息的多模态内容，共 ${content.length} 项`);
      return content;
    }
    
    // 如果只有文本，提取文本内容
    const textParts = replyMessage.content
      .filter(item => item.type === 'text')
      .map(item => item.text);
    
    if (textParts.length > 0) {
      const text = textParts.join(' ');
      content.push({
        type: "text",
        text: `[引用的消息: ${text}]`
      });
      logger?.info(`提取引用消息的文本内容: ${text}`);
      return content;
    }
  }
  
  // 获取消息文本（兼容旧格式）
  let messageText = '';
  if (replyMessage.raw_message) {
    messageText = replyMessage.raw_message;
  } else if (replyMessage.message) {
    messageText = replyMessage.message;
  }
  
  if (!messageText) {
    logger?.warn("引用消息没有文本内容");
    return content;
  }
  
  logger?.info(`解析引用消息的 raw_message: ${messageText}`);
  
  // 解析 CQ 码
  const cqCodeRegex = /\[CQ:([^,\]]+)([^\]]*)\]/g;
  let match;
  let hasMultimedia = false;
  
  while ((match = cqCodeRegex.exec(messageText)) !== null) {
    const cqType = match[1];
    const cqParams = match[2];
    
    try {
      if (cqType === "image" && config.enableImageRecognition) {
        hasMultimedia = true;
        logger?.info(`引用消息包含图片: ${cqParams}`);
        const imageUrl = await processCQImage(cqParams, logger);
        if (imageUrl === "IMAGE_DETECTED_BUT_UNAVAILABLE") {
          content.push({
            type: "text",
            text: "[引用消息中的图片无法识别]"
          });
        } else if (imageUrl) {
          content.push({
            type: "image_url",
            image_url: {
              url: imageUrl
            }
          });
          logger?.info("添加引用消息中的图片");
        }
      } else if (cqType === "video" && config.enableVideoAnalysis) {
        hasMultimedia = true;
        logger?.info(`引用消息包含视频: ${cqParams}`);
        const videoResult = await processCQVideo(cqParams, logger);
        if (videoResult === "VIDEO_DETECTED_BUT_UNAVAILABLE") {
          content.push({
            type: "text",
            text: "[引用消息中的视频无法下载]"
          });
        } else if (videoResult && videoResult.type === 'file_id') {
          content.push({
            type: "input_video",
            file_id: videoResult.fileId,
            fps: videoResult.fps
          });
          logger?.info(`添加引用消息中的视频，File ID: ${videoResult.fileId}`);
        } else if (videoResult && videoResult.type === 'base64') {
          content.push({
            type: "video_url",
            video_url: {
              url: videoResult.url,
              fps: videoResult.fps
            }
          });
          logger?.info("添加引用消息中的视频（Base64）");
        } else if (videoResult && videoResult.type === 'size_limit_exceeded') {
          content.push({
            type: "text",
            text: `[引用消息中的视频过大: ${videoResult.message}]`
          });
        }
      }
    } catch (error) {
      logger?.error(`处理引用消息中的CQ码时出错: ${cqType}`, error);
    }
  }
  
  // 提取纯文本（移除 CQ 码）
  const cleanText = messageText.replace(/\[CQ:[^\]]+\]/g, '').trim();
  if (cleanText) {
    content.unshift({
      type: "text",
      text: `[引用的消息: ${cleanText}]`
    });
  } else if (hasMultimedia) {
    content.unshift({
      type: "text",
      text: "[引用的消息包含多媒体内容]"
    });
  }
  
  return content;
}

/**
 * 检测并处理引用消息
 * @param {object} ctx - NapCat 上下文
 * @param {object} event - 消息事件
 * @param {string} rawMessage - 原始消息
 * @param {object} logger - 日志对象
 * @returns {array|null} 引用消息的内容数组，如果没有引用则返回 null
 */
export async function handleReplyMessage(ctx, event, rawMessage, logger) {
  try {
    // 检测是否包含引用 CQ 码
    const replyRegex = /\[CQ:reply,id=([^\]]+)\]/;
    const match = rawMessage.match(replyRegex);
    
    if (!match) {
      return null;
    }
    
    const messageId = match[1];
    logger?.info(`检测到引用消息，ID: ${messageId}`);
    
    // 获取被引用的消息
    const replyMessage = await getReplyMessage(ctx, event, messageId, logger);
    
    if (!replyMessage) {
      logger?.warn("无法获取引用消息内容");
      return [{
        type: "text",
        text: "[检测到引用消息，但无法获取原始内容]"
      }];
    }
    
    // 解析引用消息的内容
    const replyContent = await parseReplyContent(replyMessage, logger);
    
    if (replyContent.length > 0) {
      logger?.info(`成功解析引用消息，包含 ${replyContent.length} 个内容项`);
      return replyContent;
    }
    
    return [{
      type: "text",
      text: "[引用消息内容为空]"
    }];
  } catch (error) {
    logger?.error("处理引用消息时出错:", error);
    return null;
  }
}
