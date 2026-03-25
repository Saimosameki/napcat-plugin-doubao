// Responses API 模块
import { getConfig } from '../config.mjs';
import { getContext, saveContext } from '../context.mjs';

export async function callResponsesAPI(messageContent, contextId, modelToUse, logger, userMessageId = null) {
  try {
    const config = getConfig();
    const input = [];

    if (config.systemPrompt) {
      input.push({
        type: "message",
        role: "system",
        content: [
          {
            type: "input_text",
            text: config.systemPrompt
          }
        ],
        status: "completed"
      });
    }

    if (config.enableContext && contextId) {
      const context = getContext(contextId, logger);
      if (context && context.messages.length > 0) {
        for (const msg of context.messages) {
          const msgContent = [];
          
          if (typeof msg.content === 'string') {
            msgContent.push({
              type: msg.role === "user" ? "input_text" : "output_text",
              text: msg.content
            });
          } else if (Array.isArray(msg.content)) {
            for (const item of msg.content) {
              if (item.type === "text") {
                msgContent.push({
                  type: msg.role === "user" ? "input_text" : "output_text",
                  text: item.text
                });
              } else if (item.type === "image_url") {
                msgContent.push({
                  type: "input_image",
                  image_url: item.image_url.url
                });
              } else if (item.type === "input_video") {
                msgContent.push({
                  type: "input_video",
                  file_id: item.file_id,
                  fps: item.fps
                });
              } else if (item.type === "video_url") {
                msgContent.push({
                  type: "input_video",
                  video_url: item.video_url.url,
                  fps: item.video_url.fps
                });
              }
            }
          }
          
          if (msgContent.length > 0) {
            input.push({
              type: "message",
              role: msg.role,
              content: msgContent,
              status: "completed"
            });
          }
        }
        logger?.info(`加载上下文消息到Responses API: ${context.messages.length} 条`);
      }
    }

    const userContent = [];
    if (Array.isArray(messageContent)) {
      for (const item of messageContent) {
        if (item.type === "text") {
          userContent.push({
            type: "input_text",
            text: item.text
          });
        } else if (item.type === "image_url") {
          userContent.push({
            type: "input_image",
            image_url: item.image_url.url
          });
        } else if (item.type === "input_video") {
          const videoContent = {
            type: "input_video",
            file_id: item.file_id
          };
          if (item.fps) {
            videoContent.fps = item.fps;
          }
          userContent.push(videoContent);
          logger?.info(`添加视频: file_id=${item.file_id}, fps=${item.fps}`);
        } else if (item.type === "video_url") {
          const videoContent = {
            type: "input_video",
            video_url: item.video_url.url
          };
          if (item.video_url.fps) {
            videoContent.fps = item.video_url.fps;
          }
          userContent.push(videoContent);
        }
      }
    } else {
      userContent.push({
        type: "input_text",
        text: messageContent
      });
    }

    input.push({
      type: "message",
      role: "user",
      content: userContent,
      status: "completed"
    });

    const requestBody = {
      model: modelToUse,
      input: input,
      max_output_tokens: parseInt(config.maxTokens) || 1000,
      temperature: parseFloat(config.temperature) || 0.7
    };

    logger?.info(`Responses API请求: 模型=${modelToUse}, 输入项数=${input.length}`);
    
    const logBody = JSON.parse(JSON.stringify(requestBody));
    logBody.input = logBody.input.map(item => {
      if (item.content) {
        item.content = item.content.map(c => {
          if (c.type === 'input_video' && c.video_url && c.video_url.startsWith('data:')) {
            return { ...c, video_url: '[BASE64_VIDEO_DATA]' };
          }
          if (c.type === 'input_image' && c.image_url && c.image_url.startsWith('data:')) {
            return { ...c, image_url: '[BASE64_IMAGE_DATA]' };
          }
          return c;
        });
      }
      return item;
    });
    logger?.info(`请求体预览:`, JSON.stringify(logBody, null, 2));

    const response = await fetch(config.responsesApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      logger?.error(`Responses API请求失败: ${response.status}`);
      const errorText = await response.text();
      logger?.error(`错误详情: ${errorText}`);
      return null;
    }

    const data = await response.json();
    logger?.info(`Responses API响应:`, JSON.stringify(data, null, 2));
    
    return parseResponsesOutput(data, messageContent, contextId, logger, userMessageId);
  } catch (error) {
    logger?.error("调用Responses API时发生错误:", error);
    return null;
  }
}

function parseResponsesOutput(data, messageContent, contextId, logger, userMessageId = null) {
  const config = getConfig();
  
  if (data.output && data.output.length > 0) {
    let content = '';
    
    logger?.info(`输出数组长度: ${data.output.length}`);
    
    // 首先查找标准的 assistant 消息
    const assistantMessage = data.output.find(item => 
      item.type === "message" && item.role === "assistant"
    );
    
    if (assistantMessage) {
      logger?.info(`找到assistant消息:`, JSON.stringify(assistantMessage, null, 2));
      if (assistantMessage.content && assistantMessage.content.length > 0) {
        const textContent = assistantMessage.content.find(item => item.type === "output_text");
        if (textContent && textContent.text) {
          content = textContent.text.trim();
          logger?.info(`从assistant消息提取内容成功`);
        }
      }
    } else {
      logger?.info(`未找到标准的assistant消息，尝试其他解析方式`);
    }
    
    // 如果没有找到内容，尝试从 reasoning 的 summary 中提取
    if (!content) {
      const reasoningItem = data.output.find(item => item.type === "reasoning");
      if (reasoningItem && reasoningItem.summary && reasoningItem.summary.length > 0) {
        const summaryText = reasoningItem.summary.find(s => s.type === "summary_text");
        if (summaryText && summaryText.text) {
          // reasoning 的 summary 通常包含思考过程，我们需要提取有用的部分
          const text = summaryText.text.trim();
          logger?.info(`从reasoning summary中提取内容，长度: ${text.length}`);
          
          // 尝试提取最后的结论部分（通常在"对，"或"所以"之后）
          const patterns = [
            /(?:对，|所以|因此|总结：|回复：)(.+?)(?:\n|$)/s,
            /这个视频[是描述展示](.+?)$/s,
            /(?:初始画面|画面|视频)(.+?)$/s
          ];
          
          for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
              content = match[1].trim();
              logger?.info(`使用模式匹配提取内容成功`);
              break;
            }
          }
          
          // 如果模式匹配失败，使用整个 summary（但限制长度）
          if (!content && text.length > 50) {
            // 查找最后一个完整的句子或段落
            const sentences = text.split(/[。！？\n]/);
            const meaningfulSentences = sentences.filter(s => s.trim().length > 20);
            if (meaningfulSentences.length > 0) {
              // 取最后几句有意义的内容
              content = meaningfulSentences.slice(-3).join('。') + '。';
              logger?.info(`使用最后几句内容作为回复`);
            } else {
              content = text.substring(0, 500) + '...';
              logger?.info(`使用截断的summary内容`);
            }
          }
        }
      }
    }
    
    // 如果还是没有内容，尝试其他方式
    if (!content) {
      for (const item of data.output) {
        logger?.info(`检查输出项类型: ${item.type}`);
        
        if (item.type === "output_text" && item.text) {
          content = item.text.trim();
          logger?.info(`从output_text类型提取内容成功`);
          break;
        } else if (item.role === "assistant" && item.content) {
          if (typeof item.content === 'string') {
            content = item.content.trim();
            logger?.info(`从assistant.content字符串提取内容成功`);
            break;
          } else if (Array.isArray(item.content)) {
            const textItem = item.content.find(c => c.type === "output_text" || c.type === "text");
            if (textItem && textItem.text) {
              content = textItem.text.trim();
              logger?.info(`从assistant.content数组提取内容成功`);
              break;
            }
          }
        } else if (typeof item === 'string') {
          content = item.trim();
          logger?.info(`从字符串类型提取内容成功`);
          break;
        } else if (item.text) {
          content = item.text.trim();
          logger?.info(`从text字段提取内容成功`);
          break;
        }
      }
    }
    
    if (!content) {
      logger?.warn("所有解析方法都失败");
      
      // 检查是否是 incomplete 状态
      if (data.status === "incomplete") {
        content = "视频分析未完成（响应被截断）。这可能是因为分析内容过长。建议查看日志中的 reasoning summary 获取部分分析结果。";
      } else {
        content = "视频分析完成，但响应格式异常。请查看日志获取详细信息。";
      }
    }
    
    logger?.info(`最终提取的内容: ${content.substring(0, 100)}...`);
    
    if (config.enableContext && contextId) {
      saveContext(contextId, messageContent, content, logger, userMessageId);
    }
    
    if (data.usage) {
      logger?.info(`Token使用: 输入${data.usage.input_tokens}, 输出${data.usage.output_tokens}, 总计${data.usage.total_tokens}`);
    }
    
    return content;
  } else if (data.error) {
    logger?.error("Responses API返回错误:", JSON.stringify(data.error, null, 2));
    return `API错误: ${data.error.message || '未知错误'}`;
  } else {
    logger?.error("Responses API返回格式异常:", data);
    return null;
  }
}
