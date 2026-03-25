// 消息解析模块
import { getConfig } from './config.mjs';
import { processCQImage } from './multimedia/image.mjs';
import { processCQVideo } from './multimedia/video.mjs';
import { processCQFile, formatDocumentForAI } from './multimedia/document.mjs';
import { handleReplyMessage } from './replyParser.mjs';

export async function parseMultimediaMessage(event, textMessage, logger, ctx = null) {
  const content = [];
  const config = getConfig();
  
  // 首先检测并处理引用消息
  if (ctx && event.raw_message) {
    const replyContent = await handleReplyMessage(ctx, event, event.raw_message, logger);
    if (replyContent && replyContent.length > 0) {
      content.push(...replyContent);
      logger?.info(`已添加引用消息内容，共 ${replyContent.length} 项`);
    }
  }
  
  if (event.raw_message) {
    const cqCodeRegex = /\[CQ:([^,\]]+)([^\]]*)\]/g;
    let match;
    
    while ((match = cqCodeRegex.exec(event.raw_message)) !== null) {
      const cqType = match[1];
      const cqParams = match[2];
      
      try {
        if (cqType === "image" && config.enableImageRecognition) {
          const imageUrl = await processCQImage(cqParams, logger);
          if (imageUrl === "IMAGE_DETECTED_BUT_UNAVAILABLE") {
            content.push({
              type: "text",
              text: "[检测到图片，但当前无法识别图片内容]"
            });
            logger?.info("检测到图片但无法处理");
          } else if (imageUrl) {
            content.push({
              type: "image_url",
              image_url: {
                url: imageUrl
              }
            });
            logger?.info("添加图片到消息内容");
          }
        } else if (cqType === "video" && config.enableVideoAnalysis) {
          const videoResult = await processCQVideo(cqParams, logger);
          if (videoResult === "VIDEO_DETECTED_BUT_UNAVAILABLE") {
            content.push({
              type: "text",
              text: "[检测到视频，但当前无法下载视频内容进行分析]"
            });
            logger?.info("检测到视频但无法处理");
          } else if (videoResult && videoResult.type === 'file_id') {
            content.push({
              type: "input_video",
              file_id: videoResult.fileId,
              fps: videoResult.fps
            });
            logger?.info(`添加视频到消息内容，File ID: ${videoResult.fileId}`);
          } else if (videoResult && videoResult.type === 'base64') {
            content.push({
              type: "video_url",
              video_url: {
                url: videoResult.url,
                fps: videoResult.fps
              }
            });
            logger?.info("添加视频到消息内容，使用Base64");
          } else if (videoResult && videoResult.type === 'size_limit_exceeded') {
            content.push({
              type: "text",
              text: `[${videoResult.message}]`
            });
            logger?.info("视频文件过大");
          }
        } else if (cqType === "file" && config.enableDocumentOCR) {
          const docResult = await processCQFile(cqParams, logger, ctx);
          if (docResult === "DOCUMENT_PROCESSING_DISABLED") {
            content.push({
              type: "text",
              text: "[检测到文档，但文档处理功能已禁用]"
            });
            logger?.info("检测到文档但处理功能已禁用");
          } else if (docResult && typeof docResult === 'object' && docResult.type === 'document') {
            const formattedDoc = formatDocumentForAI(docResult);
            content.push({
              type: "text",
              text: formattedDoc
            });
            logger?.info(`添加文档内容到消息: ${docResult.fileName}`);
          } else if (typeof docResult === 'string') {
            content.push({
              type: "text",
              text: docResult
            });
            logger?.info("添加文档错误信息到消息");
          } else {
            content.push({
              type: "text",
              text: "[检测到文档，但无法读取文档内容]"
            });
            logger?.info("检测到文档但无法处理");
          }
        }
      } catch (error) {
        logger?.error(`处理CQ码时出错: ${cqType}`, error);
      }
    }
  }
  
  // 处理文本消息
  if (textMessage && textMessage.trim()) {
    const cleanText = textMessage.replace(/\[CQ:[^\]]+\]/g, '').trim();
    if (cleanText) {
      if (content.length > 0) {
        // 如果已经有多媒体内容，文本放在前面
        content.unshift({
          type: "text",
          text: cleanText
        });
      } else {
        content.push({
          type: "text",
          text: cleanText
        });
      }
    }
  }

  // 如果没有任何内容，添加默认文本
  // 但如果原始消息包含多媒体 CQ 码，说明多媒体处理失败，不添加默认文本
  if (content.length === 0) {
    const hasMultimediaCQ = event.raw_message && (
      event.raw_message.includes('[CQ:image') || 
      event.raw_message.includes('[CQ:video') ||
      event.raw_message.includes('[CQ:file')
    );
    
    if (hasMultimediaCQ) {
      logger?.warn("检测到多媒体CQ码但未能成功处理");
      content.push({
        type: "text",
        text: "[检测到多媒体内容但处理失败]"
      });
    } else {
      content.push({
        type: "text",
        text: "你好"
      });
    }
  }

  logger?.info(`消息解析完成，内容项数: ${content.length}`);
  return content;
}
