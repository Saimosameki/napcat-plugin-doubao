// API 调用统一入口
import { getConfig } from '../config.mjs';
import { getContext } from '../context.mjs';
import { needsWebSearch } from '../utils.mjs';
import { callResponsesAPI } from './responsesApi.mjs';
import { callBotsAPI } from './botsApi.mjs';
import { callChatAPI } from './chatApi.mjs';
import { generateImage, isImageGenerationRequest, extractImagePrompt, extractImageCount, isImageToImageRequest, extractReferenceImages, generateImageFromImage, isSimpleImageToImageTrigger, isImageStitchingRequest, generateStitchingPrompt, isInpaintingInstruction } from './imageGenApi.mjs';
import { isDocumentGenerationRequest, detectDocumentType, generateExcelDocument, generateWordDocument } from '../documentGenerator.mjs';

// 待处理参考图缓存：key=contextId, value={ images, timestamp }
const pendingReferenceImages = new Map();
const PENDING_IMAGE_TTL = 5 * 60 * 1000; // 5分钟有效期

function setPendingImages(contextId, images) {
  pendingReferenceImages.set(contextId, { images, timestamp: Date.now() });
}

function getPendingImages(contextId) {
  const entry = pendingReferenceImages.get(contextId);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > PENDING_IMAGE_TTL) {
    pendingReferenceImages.delete(contextId);
    return null;
  }
  return entry.images;
}

function clearPendingImages(contextId) {
  pendingReferenceImages.delete(contextId);
}

export async function callDoubaoAPI(messageContent, contextId, logger, userMessageId = null, userKey = null) {
  try {
    const config = getConfig();
    // 局部修改缓存始终按用户维度隔离，避免群聊共享上下文时互相干扰
    const inpaintKey = userKey || contextId;

    // === 局部修改缓存逻辑 ===
    // 触发条件：图片 + 文字"局部修改"关键词 → 暂存图片，等待下一条修改指令
    // 其余情况（纯图片、图片+其他文字）不受影响，走正常识别/图生图流程
    if (config.enableImageGeneration) {
      const imagesInMsg = Array.isArray(messageContent)
        ? messageContent.filter(item => item.type === "image_url")
        : [];
      const textsInMsg = Array.isArray(messageContent)
        ? messageContent.filter(item => item.type === "text")
        : [];
      const textContent = textsInMsg.map(t => t.text).join(' ').trim();
      const hasInpaintingTrigger = /局部修改/.test(textContent);

      // 情况1：图片 + "局部修改" → 暂存图片，提示发修改指令
      if (imagesInMsg.length > 0 && hasInpaintingTrigger) {
        const imageUrls = imagesInMsg.map(item => item.image_url.url);
        setPendingImages(inpaintKey, imageUrls);
        logger?.info(`局部修改模式：暂存 ${imageUrls.length} 张参考图`);
        return `🖼️ 已收到参考图片（${imageUrls.length}张），进入局部修改模式！\n\n请发送具体的修改指令，例如：\n• 把背景改成星空\n• 改成动漫风格\n• 把人物服装换成红色\n• 把头发改成金色\n\n💡 参考图将在5分钟内有效。`;
      }

      // 情况2：无图片 + 有缓存图 → 直接执行局部修改（用户已进入局部修改模式，任何文字都是修改指令）
      if (imagesInMsg.length === 0) {
        const cachedImages = getPendingImages(inpaintKey);
        if (cachedImages && cachedImages.length > 0) {
          logger?.info(`执行局部修改，使用缓存的 ${cachedImages.length} 张参考图`);
          clearPendingImages(inpaintKey);

          const prompt = textContent;
          const imageCount = extractImageCount(messageContent);
          const result = await generateImageFromImage(prompt, cachedImages, logger, imageCount);

          if (result.success) {
            if (result.images) {
              return {
                type: 'image_generation',
                images: result.images,
                totalCount: result.totalCount,
                successCount: result.successCount,
                failCount: result.failCount,
                errors: result.errors,
                prompt: result.prompt,
                originalPrompt: result.originalPrompt,
                model: result.model,
                isImageToImage: true,
                referenceCount: cachedImages.length
              };
            } else {
              return {
                type: 'image_generation',
                imagePath: result.imagePath,
                fileName: result.fileName,
                prompt: result.prompt,
                originalPrompt: result.originalPrompt,
                model: result.model,
                size: result.size,
                isImageToImage: true,
                referenceCount: cachedImages.length
              };
            }
          } else {
            return `❌ ${result.message}`;
          }
        }
      }
    }
    // === 局部修改缓存逻辑结束 ===
    
    // 首先检查是否为图片拼接请求（多张图片+拼接指令）
    if (config.enableImageGeneration && isImageStitchingRequest(messageContent)) {
      logger?.info("检测到图片拼接请求");
      
      const referenceImages = extractReferenceImages(messageContent);
      const stitchingPrompt = generateStitchingPrompt(messageContent);
      
      if (referenceImages.length < 2) {
        return "❌ 图片拼接功能需要至少2张图片。";
      }
      
      logger?.info(`图片拼接提示词: ${stitchingPrompt}`);
      logger?.info(`参考图片数量: ${referenceImages.length}`);
      
      const result = await generateImageFromImage(stitchingPrompt, referenceImages, logger, 1);
      
      if (result.success) {
        // 返回特殊格式，让主程序知道这是图片拼接结果
        return {
          type: 'image_generation',
          imagePath: result.imagePath,
          fileName: result.fileName,
          prompt: result.prompt,
          originalPrompt: stitchingPrompt,
          model: result.model,
          size: result.size,
          isImageStitching: true,
          sourceImageCount: referenceImages.length
        };
      } else {
        return `❌ ${result.message}`;
      }
    }
    // 然后检查是否为图生图请求（图片+生成文本）
    else if (config.enableImageGeneration && isImageToImageRequest(messageContent)) {
      logger?.info("检测到图生图请求");
      
      const prompt = extractImagePrompt(messageContent);
      const referenceImages = extractReferenceImages(messageContent);
      
      if (referenceImages.length === 0) {
        return "❌ 图生图功能需要参考图片，请发送图片后再试。";
      }
      
      // 检查是否为简单的图生图触发词（需要用户提供详细提示词）
      if (isSimpleImageToImageTrigger(prompt)) {
        logger?.info("检测到简单图生图触发，提示用户输入详细提示词");
        return "🎨 检测到图生图请求！\n\n请复制参考图片+生成提示词：\n\n例如：\n• 生成一个动漫风格的美少女\n• 改成赛博朋克风格\n• 转换成水彩画风格\n• 生成同样构图的风景画\n\n💡 提示：描述越详细，生成效果越好！";
      }
      
      // 如果用户提供了具体的提示词，继续执行图生图
      if (!prompt || prompt.trim().length < 3) {
        return "❌ 请提供更详细的图片生成描述。";
      }
      
      // 提取用户请求的图片数量（图生图也支持多张）
      const imageCount = extractImageCount(messageContent);
      logger?.info(`提取的图生图提示词: ${prompt}`);
      logger?.info(`参考图片数量: ${referenceImages.length}`);
      logger?.info(`请求生成图片数量: ${imageCount}`);
      
      const result = await generateImageFromImage(prompt, referenceImages, logger, imageCount);
      
      if (result.success) {
        // 返回特殊格式，让主程序知道这是图生图结果
        if (result.images) {
          // 多张图生图
          return {
            type: 'image_generation',
            images: result.images,
            totalCount: result.totalCount,
            successCount: result.successCount,
            failCount: result.failCount,
            errors: result.errors,
            prompt: result.prompt,
            originalPrompt: result.originalPrompt,
            model: result.model,
            isImageToImage: true,
            referenceCount: result.referenceCount
          };
        } else {
          // 单张图生图（保持兼容性）
          return {
            type: 'image_generation',
            imagePath: result.imagePath,
            fileName: result.fileName,
            prompt: result.prompt,
            originalPrompt: result.originalPrompt,
            model: result.model,
            size: result.size,
            isImageToImage: true,
            referenceCount: result.referenceCount
          };
        }
      } else {
        return `❌ ${result.message}`;
      }
    }
    // 然后检查是否为普通图片生成请求
    else if (config.enableImageGeneration && isImageGenerationRequest(messageContent)) {
      logger?.info("检测到图片生成请求");
      
      const prompt = extractImagePrompt(messageContent);
      if (!prompt) {
        return "❌ 无法识别图片描述，请提供更详细的描述。";
      }
      
      // 提取用户请求的图片数量
      const imageCount = extractImageCount(messageContent);
      logger?.info(`提取的图片提示词: ${prompt}`);
      logger?.info(`请求生成图片数量: ${imageCount}`);
      
      const result = await generateImage(prompt, logger, imageCount);
      
      if (result.success) {
        // 返回特殊格式，让主程序知道这是图片生成结果
        return {
          type: 'image_generation',
          images: result.images || [{ imagePath: result.imagePath, fileName: result.fileName }],
          totalCount: result.totalCount || 1,
          successCount: result.successCount || 1,
          failCount: result.failCount || 0,
          errors: result.errors,
          prompt: result.prompt,
          originalPrompt: result.originalPrompt,
          model: result.model
        };
      } else {
        return `❌ ${result.message}`;
      }
    }
    
    // 先定义所有需要的变量
    const hasMultimedia = Array.isArray(messageContent) && 
      messageContent.some(item => item.type !== "text");
    
    const hasVideo = Array.isArray(messageContent) && 
      messageContent.some(item => item.type === "input_video" || item.type === "video_url");
    
    let contextHasVideo = false;
    if (config.enableContext && contextId) {
      const context = getContext(contextId, logger);
      if (context && context.messages.length > 0) {
        contextHasVideo = context.messages.some(msg => 
          Array.isArray(msg.content) && msg.content.some(item => 
            item.type === "input_video" || item.type === "video_url"
          )
        );
      }
    }
    
    let modelToUse = config.model;
    if (hasMultimedia) {
      const hasVisual = messageContent.some(item => 
        item.type === "image_url" || item.type === "video_url" || item.type === "input_video"
      );
      if (hasVisual) {
        modelToUse = config.visionModel || "doubao-seed-2-0-pro-260215";
      }
    }
    
    // 检查是否为文档生成请求
    // 只检查用户输入的文字部分，排除引用的文档内容，避免误触发
    const userTextOnly = Array.isArray(messageContent)
      ? messageContent.filter(item => item.type === "text" && !item.text?.startsWith('📄 文档分析'))
      : messageContent;
    if (isDocumentGenerationRequest(userTextOnly)) {
      logger?.info("检测到文档生成请求");
      
      // 先调用AI获取要整理的内容
      const documentType = detectDocumentType(userTextOnly);
      logger?.info(`检测到文档类型: ${documentType}`);
      
      // 构建AI请求，让AI整理数据为CSV格式便于生成Excel
      const aiPrompt = documentType === 'excel'
        ? `请根据用户的要求，从上述文档内容中整理出所需数据，并以CSV格式输出（用逗号分隔列，换行分隔行，第一行为表头）。只输出CSV数据，不要有任何额外说明文字。`
        : `请根据用户的要求，从上述文档内容中整理出所需内容，以清晰的结构化格式输出。`;
      
      // 修改消息内容，添加整理指令
      const modifiedContent = Array.isArray(messageContent) ? [...messageContent] : [{ type: "text", text: messageContent }];
      modifiedContent.push({ type: "text", text: `\n\n${aiPrompt}` });
      
      // 调用AI获取整理后的内容（使用临时上下文，避免污染对话历史）
      let aiResponse;
      const tempContextId = `${contextId}_temp_doc_${Date.now()}`;
      
      if (hasVideo) {
        aiResponse = await callResponsesAPI(modifiedContent, tempContextId, modelToUse, logger, userMessageId);
      } else if (contextHasVideo) {
        aiResponse = await callResponsesAPI(modifiedContent, tempContextId, modelToUse, logger, userMessageId);
      } else if (config.enableWebSearch && config.botId && needsWebSearch(modifiedContent)) {
        aiResponse = await callBotsAPI(modifiedContent, tempContextId, logger, userMessageId);
      } else {
        aiResponse = await callChatAPI(modifiedContent, tempContextId, modelToUse, logger, userMessageId);
      }
      
      if (!aiResponse) {
        return "❌ 无法获取AI整理的内容，文档生成失败。";
      }
      
      // 生成文档
      const filename = `AI整理文档_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}`;
      let result;
      
      if (documentType === 'excel') {
        result = await generateExcelDocument(aiResponse, filename, logger);
      } else {
        result = await generateWordDocument(aiResponse, filename, logger);
      }
      
      if (result.success) {
        // 手动保存正确的上下文（用户请求 + 文档生成成功）
        if (config.enableContext && contextId) {
          const { saveContext } = await import('../context.mjs');
          const successMessage = `📄 已为你生成${documentType === 'excel' ? 'Excel表格' : 'Word文档'}！文件名：${result.fileName}`;
          saveContext(contextId, messageContent, successMessage, logger, userMessageId);
        }
        
        return {
          type: 'document_generation',
          filePath: result.filePath,
          fileName: result.fileName,
          documentType: result.type,
          content: aiResponse
        };
      } else {
        return `❌ ${result.message}`;
      }
    }

    // API选择逻辑（优化后）：
    // 1. 当前消息包含视频 → 必须使用 Responses API（专门处理视频）
    // 2. 上下文包含视频历史 → 使用 Responses API 保持连贯性
    // 3. 智能联网检测：只有在明确需要联网时才使用 Bots API
    // 4. 默认使用 Chat API（更快、更稳定）
    if (hasVideo) {
      logger?.info("当前消息包含视频，使用Responses API");
      return await callResponsesAPI(messageContent, contextId, modelToUse, logger, userMessageId);
    } else if (contextHasVideo) {
      logger?.info("上下文中包含视频历史，使用Responses API保持连贯性");
      return await callResponsesAPI(messageContent, contextId, modelToUse, logger, userMessageId);
    } else if (config.enableWebSearch && config.botId && needsWebSearch(messageContent)) {
      // 只有在智能检测到确实需要联网查询时才使用 Bots API
      logger?.info("智能检测到需要联网查询，使用Bots API");
      return await callBotsAPI(messageContent, contextId, logger, userMessageId);
    } else {
      // 默认使用 Chat API（包括禁用联网搜索的情况）
      logger?.info("使用Chat API（默认选择或无需联网查询）");
      return await callChatAPI(messageContent, contextId, modelToUse, logger, userMessageId);
    }

  } catch (error) {
    logger?.error("调用豆包API时发生错误:", error);
    return null;
  }
}
