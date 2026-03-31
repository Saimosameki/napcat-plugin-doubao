// 图片生成 API 模块
import { getConfig } from '../config.mjs';
import fs from 'fs';
import path from 'path';

export async function generateImage(prompt, logger, count = 1) {
  try {
    const config = getConfig();
    
    if (!config.enableImageGeneration) {
      logger?.info("图片生成功能已禁用");
      return {
        success: false,
        message: "图片生成功能已禁用，请在插件设置中启用。"
      };
    }

    if (!config.apiKey) {
      logger?.error("API密钥未配置");
      return {
        success: false,
        message: "API密钥未配置，无法生成图片。"
      };
    }

    // 限制生成数量
    const imageCount = Math.min(Math.max(count, 1), 10);
    logger?.info(`准备生成 ${imageCount} 张图片`);

    const results = [];
    const errors = [];

    // 根据提示词内容智能补充比例提示，避免全身人物被压缩
    const finalPrompt = appendAspectRatioHint(prompt, logger);

    // 并发生成多张图片
    const generatePromises = Array.from({ length: imageCount }, async (_, index) => {
      try {
        const requestBody = {
          model: config.imageGenModel,
          prompt: finalPrompt,
          size: config.imageGenSize || "2K",
          watermark: false,
          response_format: "url"
        };

        logger?.info(`开始生成第 ${index + 1} 张图片，提示词: ${finalPrompt}`);

        const response = await fetch(config.imageGenApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(parseInt(config.imageGenTimeout) || 120000)
        });

        if (!response.ok) {
          const errorText = await response.text();
          logger?.error(`第 ${index + 1} 张图片生成API请求失败: ${response.status} ${response.statusText}`);
          
          // 解析错误信息
          let errorMessage = `第 ${index + 1} 张图片生成失败: ${response.status} ${response.statusText}`;
          try {
            const errorData = JSON.parse(errorText);
            if (errorData.error) {
              const errorCode = errorData.error.code;
              const errorMsg = errorData.error.message;
              
              switch (errorCode) {
                case 'InputImageSensitiveContentDetected':
                  errorMessage = `🚫 第 ${index + 1} 张图片被拒绝：参考图片可能包含敏感内容。`;
                  break;
                case 'OutputImageSensitiveContentDetected':
                  errorMessage = `🚫 第 ${index + 1} 张图片被拒绝：提示词可能包含敏感内容。`;
                  break;
                case 'InvalidParameter':
                  errorMessage = `⚠️ 第 ${index + 1} 张图片参数错误：${errorMsg}`;
                  break;
                case 'InsufficientQuota':
                  errorMessage = `💳 第 ${index + 1} 张图片配额不足：API调用次数已用完。`;
                  break;
                case 'RateLimitExceeded':
                  errorMessage = `⏰ 第 ${index + 1} 张图片请求过于频繁：请稍等片刻再试。`;
                  break;
                default:
                  errorMessage = `❌ 第 ${index + 1} 张图片生成失败：${errorMsg || errorCode}`;
              }
            }
          } catch (parseError) {
            // 使用默认错误消息
          }
          
          throw new Error(errorMessage);
        }

        const data = await response.json();
        logger?.info(`第 ${index + 1} 张图片API响应成功`);

        // 检查响应格式
        if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
          throw new Error(`第 ${index + 1} 张图片API返回格式异常`);
        }

        const imageData = data.data[0];
        
        if (imageData.url) {
          // 下载图片
          const imageResponse = await fetch(imageData.url);
          if (!imageResponse.ok) {
            throw new Error(`第 ${index + 1} 张图片下载失败: ${imageResponse.status}`);
          }
          
          const imageBuffer = await imageResponse.arrayBuffer();
          const timestamp = Date.now();
          const fileName = `generated_image_${timestamp}_${index + 1}.png`;
          const tempDir = path.join(process.cwd(), 'cache');
          
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }
          
          const filePath = path.join(tempDir, fileName);
          fs.writeFileSync(filePath, Buffer.from(imageBuffer));
          
          logger?.info(`第 ${index + 1} 张图片已下载并保存到: ${filePath}`);
          
          return {
            success: true,
            imagePath: filePath,
            fileName: fileName,
            prompt: prompt,
            originalPrompt: prompt,
            model: config.imageGenModel,
            index: index + 1
          };
        } else {
          throw new Error(`第 ${index + 1} 张图片API返回的数据格式不支持`);
        }
      } catch (error) {
        logger?.error(`生成第 ${index + 1} 张图片时发生错误:`, error);
        return {
          success: false,
          message: error.message,
          index: index + 1
        };
      }
    });

    // 等待所有图片生成完成
    const allResults = await Promise.allSettled(generatePromises);
    
    // 处理结果
    allResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          results.push(result.value);
        } else {
          errors.push(result.value.message);
        }
      } else {
        errors.push(`第 ${index + 1} 张图片生成异常: ${result.reason?.message || result.reason}`);
      }
    });

    // 返回结果
    if (results.length > 0) {
      return {
        success: true,
        images: results,
        totalCount: imageCount,
        successCount: results.length,
        failCount: errors.length,
        errors: errors.length > 0 ? errors : undefined,
        prompt: prompt,
        originalPrompt: prompt,
        model: config.imageGenModel
      };
    } else {
      return {
        success: false,
        message: `所有图片生成都失败了：\n${errors.join('\n')}`
      };
    }

  } catch (error) {
    logger?.error("生成图片时发生错误:", error);
    
    if (error.name === 'AbortError') {
      return {
        success: false,
        message: "图片生成超时，请稍后重试"
      };
    }
    
    return {
      success: false,
      message: `生成图片时发生错误: ${error.message}`
    };
  }
}

// 检测是否为简单的图生图触发词（需要用户提供详细提示词）
export function isSimpleImageToImageTrigger(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    return true; // 没有提示词，需要用户输入
  }
  
  const cleanPrompt = prompt.trim().toLowerCase();
  
  // 简单触发词列表（这些词汇表示用户想要图生图，但没有提供具体描述）
  const simpleTriggers = [
    // 单个词汇
    '类似', '相似', '一样', '这样', '参考', '模仿', '仿照', '照着',
    
    // 简单短语
    '类似的', '相似的', '一样的', '这样的', '参考的',
    '类似图', '相似图', '一样图', '这样图',
    '类似图片', '相似图片', '一样图片', '这样图片',
    
    // 生成相关的简单表达
    '生成', '画', '做', '创作', '制作', '绘制',
    '生成图', '画图', '做图', '创作图', '制作图',
    '生成图片', '画图片', '做图片', '创作图片', '制作图片',
    
    // 组合的简单表达
    '生成类似', '画类似', '做类似', '创作类似', '制作类似',
    '生成相似', '画相似', '做相似', '创作相似', '制作相似',
    '生成一样', '画一样', '做一样', '创作一样', '制作一样',
    
    // 带"的"的表达
    '生成类似的', '画类似的', '做类似的', '创作类似的', '制作类似的',
    '生成相似的', '画相似的', '做相似的', '创作相似的', '制作相似的',
    '生成一样的', '画一样的', '做一样的', '创作一样的', '制作一样的'
  ];
  
  // 检查是否完全匹配简单触发词
  if (simpleTriggers.includes(cleanPrompt)) {
    return true;
  }
  
  // 检查是否是简单的句式（长度很短且没有具体描述）
  if (cleanPrompt.length <= 8) {
    // 短文本，检查是否包含简单触发词
    return simpleTriggers.some(trigger => cleanPrompt.includes(trigger));
  }
  
  // 检查是否是"帮我生成/画一个类似的"这类表达（没有具体描述内容）
  const simplePatterns = [
    /^(帮我|请)?(生成|画|做|创作|制作)(一个|一张|一幅)?(类似|相似|一样)(的)?(图片?|图)?$/,
    /^(类似|相似|一样)(的)?(图片?|图)?$/,
    /^(参考|模仿|仿照|照着)(这个?|这张?|这幅?)?(图片?|图)?$/,
    /^(生成|画|做|创作|制作)(类似|相似|一样)(的)?$/
  ];
  
  return simplePatterns.some(pattern => pattern.test(cleanPrompt));
}

// 检测纯文字消息是否为局部修改/图生图指令（用于配合待处理参考图缓存）
export function isInpaintingInstruction(messageContent) {
  if (!Array.isArray(messageContent)) return false;

  const hasImage = messageContent.some(item => item.type === "image_url");
  if (hasImage) return false; // 有图片的走正常图生图流程

  const textContent = messageContent
    .filter(item => item.type === "text")
    .map(item => item.text)
    .join(" ")
    .trim();

  if (!textContent || textContent.length < 2) return false;

  const lower = textContent.toLowerCase();

  // 局部修改/图生图相关关键词
  const keywords = [
    '改成', '改为', '变成', '修改成', '转换成', '风格转换',
    '重新画', '重新生成', '再画一张', '换个风格', '换成',
    '把图', '将图', '图片改', '图中改',
    '人物改', '角色改', '姿势改', '动作改', '表情改',
    '背景改', '场景改', '服装改', '发型改', '颜色改',
    '局部修改', '局部编辑', '局部替换',
    '生成类似', '生成相似', '生成一样', '生成同款',
    '画类似', '画相似', '画一张类似',
    '参考这张', '基于这张', '根据这张', '按照这张',
    '动漫风格', '写实风格', '水彩风格', '油画风格', '赛博朋克',
    '卡通风格', '素描风格', '像素风格', '二次元风格',
  ];

  if (keywords.some(kw => lower.includes(kw))) return true;

  // 句式模式
  const patterns = [
    /(把|将).*(改成|改为|变成|换成)/,
    /(改成|改为|变成|转换成).*(风格|样子|姿势|动作|颜色|背景)/,
    /(生成|画|做|创作|制作).*(类似|相似|一样|同款)/,
    /(局部|部分).*(修改|编辑|替换|改变)/,
    /(换|改).*(背景|发型|服装|表情|姿势|动作)/,
  ];

  return patterns.some(p => p.test(lower));
}

// 检测是否为图生图请求（消息中包含图片+生成请求）
export function isImageToImageRequest(messageContent) {
  if (!Array.isArray(messageContent)) {
    return false;
  }
  
  // 检查是否同时包含图片和文本
  const hasImage = messageContent.some(item => item.type === "image_url");
  const hasText = messageContent.some(item => item.type === "text");
  
  if (!hasImage || !hasText) {
    return false;
  }
  
  // 检查文本是否包含图生图关键词
  const textContent = messageContent
    .filter(item => item.type === "text")
    .map(item => item.text)
    .join(" ")
    .toLowerCase();
  
  const imageToImageKeywords = [
    // 直接的图生图表达
    '生成类似', '生成一个类似', '画类似', '类似的图', '相似的图',
    '帮我生成一个类似', '帮我画一个类似', '生成相似',
    '做一个类似', '创作类似', '制作类似',
    
    // 参考图片的表达
    '基于这张图', '参考这张图', '模仿这张图', '仿照这张图',
    '根据这张图', '按照这张图', '照着这张图',
    
    // 风格转换和修改的表达
    '改成', '改为', '变成', '修改成', '转换成', '风格转换',
    '重新画', '重新生成', '再画一张', '换个风格',
    '把...改成', '把...改为', '把...变成', '将...改为', '将...改成',
    
    // 图片编辑相关表达（必须有明确的修改动作）
    '把图片改', '把图中改', '将图片改', '将图中改',
    '人物改', '角色改', '姿势改', '动作改', '表情改',
    '背景改', '场景改', '服装改', '发型改', '颜色改',
    
    // 图片拼接相关表达
    '拼接', '合并', '组合', '拼合', '连接', '合成',
    '拼接成', '合并成', '组合成', '拼合成', '连接成', '合成一张',
    '拼在一起', '合在一起', '组合在一起', '连在一起',
    '拼成一张', '合成一张', '组合一张', '制作拼图',
    // 融合相关
    '融合', '完美融合', '自然融合', '混合', '结合', '整合',
    
    // 更多常见表达
    '画个类似', '做个类似', '生成个类似', '创建类似',
    '参考图片', '参考这个', '照这个样子', '按这个风格',
    '像这样的', '这种风格', '这个样子', '这种类型',
    
    // 简化表达（当有图片时）
    '类似', '相似', '一样', '同样', '这样',
    '参考', '模仿', '仿照', '照着',
    
    // 当有图片时的生成表达（必须明确是生成/绘制图片）
    '生成图片', '画一张', '画一幅', '重新画', '重新生成',
    '绘制', '创作一张', '制作一张'
  ];
  
  // 检查关键词匹配
  const hasKeywords = imageToImageKeywords.some(keyword => textContent.includes(keyword));
  
  // 检查图生图的句式模式
  const imageToImagePatterns = [
    /帮我.*?生成.*?(类似|相似|一样)/,
    /帮我.*?画.*?(类似|相似|一样)/,
    /(生成|画|做|创作|制作).*?(类似|相似|一样).*?(图|的)/,
    /(参考|基于|根据|按照|照着).*?(图|这)/,
    /.*?(类似|相似|一样).*?(图|的)/,
    
    // 图片编辑相关的模式
    /(把|将).*?(图片?|图中).*?(改成|改为|变成)/,
    /(把|将).*?(人物|角色|姿势|动作|表情|背景|场景).*?(改|变)/,
    /图片?中的.*?(改|变|换)/,
    /图中.*?(改|变|换)/,
    /(改成|改为|变成|转换成).*?(风格|样子|姿势|动作)/,
    
    // 图片拼接/融合相关的模式
    /(拼接|合并|组合|拼合|连接|合成|融合|混合|结合|整合).*?(图片?|照片|图)/,
    /(拼|合|组合|融合|混合|结合).*?(成|在一起)/,
    /.*?(拼接|合并|组合|拼合|连接|合成|融合|混合|结合).*?(一张|成一张)/,
    // 跨图片人物/元素融合
    /(第[一二三四五六七八九十\d]+张).*?(人物|角色|元素).*?(融合|合并|结合|放到|放入)/,
    /(人物|角色|元素).*?(融合|合并|结合|放到|放入).*?(图片?|照片|背景)/
  ];
  
  const hasPatterns = imageToImagePatterns.some(pattern => pattern.test(textContent));
  
  return hasKeywords || hasPatterns;
}

// 检测是否为图片拼接请求
export function isImageStitchingRequest(messageContent) {
  if (!Array.isArray(messageContent)) {
    return false;
  }
  
  // 检查是否有多张图片（至少2张）
  const imageCount = messageContent.filter(item => item.type === "image_url").length;
  const hasText = messageContent.some(item => item.type === "text");
  
  if (imageCount < 2 || !hasText) {
    return false;
  }
  
  // 检查文本是否包含拼接关键词
  const textContent = messageContent
    .filter(item => item.type === "text")
    .map(item => item.text)
    .join(" ")
    .toLowerCase();
  
  const stitchingKeywords = [
    // 拼接相关
    '拼接', '拼接成', '拼接在一起', '拼接成一张',
    '合并', '合并成', '合并在一起', '合并成一张',
    '组合', '组合成', '组合在一起', '组合成一张',
    '拼合', '拼合成', '拼合在一起', '拼合成一张',
    '连接', '连接成', '连接在一起', '连接成一张',
    '合成', '合成一张', '合成在一起',
    
    // 融合相关
    '融合', '融合在一起', '融合成', '完美融合', '自然融合',
    '混合', '混合在一起', '混合成一张',
    '结合', '结合在一起', '结合成',
    '整合', '整合成', '整合在一起',
    
    // 拼图相关
    '拼图', '制作拼图', '做成拼图', '拼成拼图',
    '拼在一起', '合在一起', '组在一起', '连在一起',
    '拼成一张', '合成一张', '组成一张', '连成一张',
    
    // 排列相关
    '排列', '排列成', '排列在一起', '排成一张',
    '排版', '排版成', '布局', '布局成',
    
    // 多张图片处理
    '多张图', '几张图', '这些图', '所有图',
    '多张照片', '几张照片', '这些照片', '所有照片'
  ];
  
  const hasStitchingKeywords = stitchingKeywords.some(keyword => 
    textContent.includes(keyword)
  );
  
  // 检查拼接的句式模式
  const stitchingPatterns = [
    /(拼接|合并|组合|拼合|连接|合成|融合|混合|结合|整合).*?(图片?|照片|图)/,
    /(拼|合|组合|连|融合|混合|结合).*?(成|在一起)/,
    /.*?(拼接|合并|组合|拼合|连接|合成|融合|混合|结合).*?(一张|成一张)/,
    /(把|将).*?(图片?|照片).*?(拼接|合并|组合|拼合|连接|合成|融合|混合|结合)/,
    /(这|所有|多张|几张).*?(图片?|照片).*?(拼接|合并|组合|融合|混合|结合)/,
    /(\d+)张.*?(图片?|照片).*?(拼接|合并|组合|融合|混合|结合)/,
    // 跨图片人物/元素融合的表达
    /(第[一二三四五六七八九十\d]+张).*?(人物|角色|元素|内容).*?(融合|合并|结合|放到|放入|加入)/,
    /(人物|角色|元素).*?(融合|合并|结合|放到|放入|加入).*?(图片?|照片|背景)/
  ];
  
  const hasStitchingPattern = stitchingPatterns.some(pattern => 
    pattern.test(textContent)
  );
  
  return hasStitchingKeywords || hasStitchingPattern;
}

// 生成图片拼接的提示词
export function generateStitchingPrompt(messageContent) {
  if (!Array.isArray(messageContent)) {
    return "请将这些图片拼接成一张图片";
  }
  
  const imageCount = messageContent.filter(item => item.type === "image_url").length;
  const textContent = messageContent
    .filter(item => item.type === "text")
    .map(item => item.text.replace(/@\S+/g, '').trim())  // 清理 @提及
    .join(" ")
    .trim();
  
  const lowerText = textContent.toLowerCase();
  
  // 检测是否为创意融合请求（而非简单拼接）
  const isFusionRequest = ['融合', '混合', '结合', '整合'].some(kw => lowerText.includes(kw));
  
  if (isFusionRequest) {
    // 创意融合：直接使用用户的原始描述作为提示词，更准确地传达意图
    let prompt = textContent.trim();
    // 移除触发词前缀
    prompt = prompt.replace(/^(帮我|请|麻烦)?\s*/gi, '').trim();
    if (prompt.length > 10) {
      return prompt;
    }
    // 如果清理后太短，生成默认融合提示词
    return `将第一张图片中的人物与第二张图片的场景完美融合，保持自然真实的效果，高质量输出。`;
  }
  
  // 提取用户的原始提示词（去掉纯触发词前缀）
  const userOriginalPrompt = textContent
    .replace(/^(帮我|请|麻烦)?\s*/gi, '')
    .trim();
  
  // 如果用户提供了足够详细的原始提示词，直接使用，不做裁切
  const stitchingTriggerWords = ['拼接', '合并', '组合', '拼合', '连接', '合成', '拼图', '拼在一起', '合在一起'];
  const hasDetailedPrompt = userOriginalPrompt.length > 8 &&
    !stitchingTriggerWords.every(kw => userOriginalPrompt.replace(new RegExp(kw, 'g'), '').trim().length < 5);
  
  if (hasDetailedPrompt) {
    return userOriginalPrompt;
  }
  let prompt = `请将这${imageCount}张图片拼接成一张完整的图片。`;
  
  // 检查用户是否有特殊要求
  // 排列方式
  if (lowerText.includes('横向') || lowerText.includes('水平') || lowerText.includes('左右')) {
    prompt += "请按照水平方向（从左到右）排列拼接。";
  } else if (lowerText.includes('纵向') || lowerText.includes('垂直') || lowerText.includes('上下')) {
    prompt += "请按照垂直方向（从上到下）排列拼接。";
  } else if (lowerText.includes('网格') || lowerText.includes('方格') || lowerText.includes('2x2') || lowerText.includes('田字')) {
    prompt += "请按照网格方式（2x2或合适的网格布局）排列拼接。";
  } else {
    if (imageCount === 2) {
      prompt += "请按照水平方向排列拼接。";
    } else if (imageCount === 3) {
      prompt += "请按照水平方向排列拼接，或者采用合适的布局方式。";
    } else if (imageCount === 4) {
      prompt += "请按照2x2网格方式排列拼接。";
    } else {
      prompt += "请采用合适布局方式排列拼接。";
    }
  }
  
  // 图片质量要求
  if (lowerText.includes('高清') || lowerText.includes('高质量') || lowerText.includes('清晰')) {
    prompt += "请保持高清画质。";
  }
  
  // 边框和间距
  if (lowerText.includes('无缝') || lowerText.includes('紧密')) {
    prompt += "请无缝拼接，不要留边框或间距。";
  } else if (lowerText.includes('边框') || lowerText.includes('间距')) {
    prompt += "请在图片之间保留适当的边框或间距。";
  } else {
    prompt += "请保持图片之间的自然过渡。";
  }
  
  // 尺寸比例
  if (lowerText.includes('16:9') || lowerText.includes('16：9')) {
    prompt += "最终图片比例为16:9。";
  } else if (lowerText.includes('4:3') || lowerText.includes('4：3')) {
    prompt += "最终图片比例为4:3。";
  } else if (lowerText.includes('1:1') || lowerText.includes('1：1') || lowerText.includes('正方形')) {
    prompt += "最终图片为正方形比例。";
  }
  
  return prompt;
}
export function extractReferenceImages(messageContent) {
  if (!Array.isArray(messageContent)) {
    return [];
  }
  
  return messageContent
    .filter(item => item.type === "image_url")
    .map(item => {
      // 如果是base64格式的data URL，直接返回
      if (item.image_url.url.startsWith('data:')) {
        return item.image_url.url;
      }
      // 如果是普通URL，返回URL（后续需要下载转换）
      return item.image_url.url;
    });
}

// 图生图功能
export async function generateImageFromImage(prompt, referenceImages, logger, count = 1) {
  try {
    const config = getConfig();
    
    if (!config.enableImageGeneration) {
      logger?.info("图片生成功能已禁用");
      return {
        success: false,
        message: "图片生成功能已禁用，请在插件设置中启用。"
      };
    }

    if (!config.apiKey) {
      logger?.error("API密钥未配置");
      return {
        success: false,
        message: "API密钥未配置，无法生成图片。"
      };
    }

    // 限制生成数量
    const imageCount = Math.min(Math.max(count, 1), 10);
    logger?.info(`准备生成 ${imageCount} 张图生图`);

    if (!referenceImages || referenceImages.length === 0) {
      logger?.error("没有参考图片");
      return {
        success: false,
        message: "图生图功能需要参考图片。"
      };
    }

    // 处理参考图片：确保都是base64格式
    const processedImages = [];
    for (const imageUrl of referenceImages) {
      if (imageUrl.startsWith('data:')) {
        // 已经是base64格式，直接使用
        processedImages.push(imageUrl);
        logger?.info(`使用已转换的base64参考图片，大小: ${Math.round(imageUrl.length * 0.75)} bytes`);
      } else {
        // 是普通URL，需要下载并转换为base64
        try {
          logger?.info(`下载参考图片: ${imageUrl}`);
          const response = await fetch(imageUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
            }
          });
          
          if (!response.ok) {
            logger?.error(`下载参考图片失败: ${response.status} ${response.statusText}`);
            continue; // 跳过这张图片
          }
          
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          
          // 检查图片大小
          const config = getConfig();
          if (buffer.length > config.maxImageSize) {
            logger?.warn(`参考图片文件过大: ${buffer.length} bytes，跳过`);
            continue;
          }
          
          if (buffer.length < 100) {
            logger?.warn(`参考图片文件太小: ${buffer.length} bytes，跳过`);
            continue;
          }
          
          const base64 = buffer.toString('base64');
          
          // 检测图片格式
          let mimeType = 'image/jpeg'; // 默认
          if (imageUrl.toLowerCase().includes('.png')) {
            mimeType = 'image/png';
          } else if (imageUrl.toLowerCase().includes('.gif')) {
            mimeType = 'image/gif';
          } else if (imageUrl.toLowerCase().includes('.webp')) {
            mimeType = 'image/webp';
          }
          
          const dataUrl = `data:${mimeType};base64,${base64}`;
          processedImages.push(dataUrl);
          logger?.info(`参考图片转换为base64成功，大小: ${buffer.length} bytes`);
        } catch (downloadError) {
          logger?.error(`处理参考图片失败: ${downloadError.message}`);
          continue; // 跳过这张图片
        }
      }
    }

    if (processedImages.length === 0) {
      logger?.error("所有参考图片处理失败");
      return {
        success: false,
        message: "无法处理参考图片，请重新发送图片。"
      };
    }

    // 根据提示词内容智能补充比例提示
    const finalPrompt = appendAspectRatioHint(prompt, logger);

    const results = [];
    const errors = [];

    // 判断模式：
    // - 多图融合模式：多张参考图，每次请求传所有图的数组，生成 imageCount 次
    // - 批量生成模式：单张参考图，用 sequential_image_generation: "auto" 一次请求生成多张
    const isMultiRefFusion = processedImages.length > 1;

    logger?.info(`图生图模式: ${isMultiRefFusion ? `多图融合（${processedImages.length} 张参考图 → 生成 ${imageCount} 张）` : `单图批量生成（sequential_image_generation: auto, max_images: ${imageCount}）`}`);
    logger?.info(`原始提示词: ${prompt}`);
    logger?.info(`参考图片数量: ${processedImages.length}`);
    processedImages.forEach((img, imgIndex) => {
      const isBase64 = img.startsWith('data:');
      const mimeType = isBase64 ? img.split(';')[0].replace('data:', '') : 'unknown';
      const sizeEstimate = isBase64 ? Math.round(img.length * 0.75) : 'unknown';
      logger?.info(`  图片 ${imgIndex + 1}: ${isBase64 ? 'base64' : 'url'}, 类型: ${mimeType}, 大小: ~${sizeEstimate} bytes`);
    });

    // 解析API错误信息的辅助函数
    const parseApiError = (errorData, label) => {
      if (!errorData?.error) return null;
      const { code, message: msg } = errorData.error;
      switch (code) {
        case 'InputImageSensitiveContentDetected':
          return `🚫 ${label}被拒绝：参考图片可能包含敏感内容。`;
        case 'OutputImageSensitiveContentDetected':
          return `🚫 ${label}被拒绝：提示词可能包含敏感内容。`;
        case 'InvalidParameter':
          return `⚠️ ${label}参数错误：${msg}`;
        case 'InsufficientQuota':
          return `💳 ${label}配额不足：API调用次数已用完。`;
        case 'RateLimitExceeded':
          return `⏰ ${label}请求过于频繁：请稍等片刻再试。`;
        default:
          return `❌ ${label}失败：${msg || code}`;
      }
    };

    // 下载并保存图片的辅助函数
    const downloadAndSave = async (url, index) => {
      const imageResponse = await fetch(url);
      if (!imageResponse.ok) throw new Error(`图片下载失败: ${imageResponse.status}`);
      const imageBuffer = await imageResponse.arrayBuffer();
      const timestamp = Date.now();
      const fileName = `generated_image_i2i_${timestamp}_${index}.png`;
      const tempDir = path.join(process.cwd(), 'cache');
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      const filePath = path.join(tempDir, fileName);
      fs.writeFileSync(filePath, Buffer.from(imageBuffer));
      logger?.info(`第 ${index} 张图生图已保存到: ${filePath}`);
      return { filePath, fileName };
    };

    // 统一用一次请求生成多张：单图或多图融合都走 sequential_image_generation: "auto"
    // 多图融合时 image 传数组，模型按 prompt 描述理解各图角色（如"第一张图的人物"、"第二张图的背景"）
    try {
      const imageField = isMultiRefFusion ? processedImages : processedImages[0];
      const requestBody = {
        model: config.imageGenModel,
        prompt: finalPrompt,
        image: imageField,
        size: config.imageGenSize || "2K",
        sequential_image_generation: imageCount > 1 ? "auto" : "disabled",
        ...(imageCount > 1 && { sequential_image_generation_options: { max_images: imageCount } }),
        watermark: false,
        response_format: "url"
      };

      logger?.info(`开始图生图，模式: ${isMultiRefFusion ? '多图融合' : '单图'}，数量: ${imageCount}，提示词: ${finalPrompt}`);

      const response = await fetch(config.imageGenApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout((parseInt(config.imageGenTimeout) || 120000) * (imageCount > 1 ? 2 : 1))
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `图生图失败: ${response.status}`;
        try {
          const parsed = parseApiError(JSON.parse(errorText), '图生图');
          if (parsed) errorMessage = parsed;
        } catch (_) {}
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
        throw new Error('图生图API返回格式异常');
      }

      logger?.info(`API返回 ${data.data.length} 张图片`);

      for (let i = 0; i < data.data.length; i++) {
        const item = data.data[i];
        if (!item.url) continue;
        try {
          const { filePath, fileName } = await downloadAndSave(item.url, i + 1);
          results.push({ success: true, imagePath: filePath, fileName, prompt, originalPrompt: prompt, model: config.imageGenModel, type: 'image_to_image', referenceCount: processedImages.length, index: i + 1 });
        } catch (dlErr) {
          errors.push(`第 ${i + 1} 张图片下载失败: ${dlErr.message}`);
        }
      }
    } catch (error) {
      logger?.error('图生图失败:', error);
      errors.push(error.message);
    }

    // 返回结果
    if (results.length > 0) {
      if (imageCount === 1) {
        // 单张图片，保持原有格式兼容性
        const result = results[0];
        return {
          success: true,
          imagePath: result.imagePath,
          fileName: result.fileName,
          prompt: result.prompt,
          originalPrompt: result.originalPrompt,
          model: result.model,
          size: result.size,
          type: 'image_to_image',
          referenceCount: result.referenceCount
        };
      } else {
        // 多张图片，返回新格式
        return {
          success: true,
          images: results,
          totalCount: imageCount,
          successCount: results.length,
          failCount: errors.length,
          errors: errors.length > 0 ? errors : undefined,
          prompt: prompt,
          originalPrompt: prompt,
          model: config.imageGenModel,
          type: 'image_to_image',
          referenceCount: processedImages.length
        };
      }
    } else {
      return {
        success: false,
        message: `所有图生图都失败了：\n${errors.join('\n')}`
      };
    }

  } catch (error) {
    logger?.error("图生图时发生错误:", error);
    
    if (error.name === 'AbortError') {
      return {
        success: false,
        message: "图生图超时，请稍后重试"
      };
    }
    
    return {
      success: false,
      message: `图生图时发生错误: ${error.message}`
    };
  }
}

// 检测是否为图片生成请求
export function isImageGenerationRequest(messageContent) {
  if (!Array.isArray(messageContent)) {
    return false;
  }
  
  // 提取文本内容
  const textContent = messageContent
    .filter(item => item.type === "text")
    .map(item => item.text)
    .join(" ")
    .toLowerCase();
  
  // 图片生成关键词
  const imageGenKeywords = [
    // 图片/图相关
    '生成图片', '画一张', '画个', '画出', '绘制', '创作图片',
    '帮我画', '帮我生成', '制作图片', '做一张图', '生成一张',
    '画一个', '画一幅', '创建图片', '设计图片', '图片生成',
    // 照片相关（之前缺失）
    '生成照片', '生成一张照片', '帮我生成照片', '做一张',
    '制作照片', '做一张照片', '创作照片', '生成写真', '生成一张写真',
    // 英文
    'generate image', 'create image', 'draw', 'paint', 'make image',
    'generate photo', 'create photo', 'take a photo'
  ];
  
  // 检查是否包含图片生成关键词
  const hasImageGenKeywords = imageGenKeywords.some(keyword => 
    textContent.includes(keyword)
  );
  
  // 检查是否是图片生成的句式模式
  const imageGenPatterns = [
    /帮我.*?生成.*?图/,
    /帮我.*?画.*?图/,
    /生成.*?图片/,
    /生成.*?照片/,
    /生成.*?写真/,
    /画.*?图片/,
    /制作.*?图/,
    /创作.*?图/,
    /绘制.*?图/,
    /设计.*?图/,
    /帮我.*?生成.*?照/,
    /帮我.*?拍.*?照/
  ];
  
  const hasImageGenPattern = imageGenPatterns.some(pattern => 
    pattern.test(textContent)
  );
  
  return hasImageGenKeywords || hasImageGenPattern;
}

// 提取图片生成的提示词
export function extractImagePrompt(messageContent) {
  if (!Array.isArray(messageContent)) {
    return null;
  }
  
  const textContent = messageContent
    .filter(item => item.type === "text")
    .map(item => item.text.replace(/@\S+/g, '').trim())  // 清理 @提及
    .join(" ")
    .trim();
  
  // 检查是否是图生图请求
  const hasImage = messageContent.some(item => item.type === "image_url");
  
  if (hasImage) {
    // 图生图情况：保留更多描述性内容，但要清理数量词
    let prompt = textContent
    return prompt;
  } else {
    // 普通图片生成：直接返回原始文本内容，不进行清理
    return textContent;
  }
}

// 提取用户请求的图片数量
export function extractImageCount(messageContent) {
  if (!Array.isArray(messageContent)) {
    return 1;
  }
  
  const textContent = messageContent
    .filter(item => item.type === "text")
    .map(item => item.text)
    .join(" ")
    .toLowerCase();
  
  // 匹配明确的生成数量指令，避免匹配描述性内容
  const countPatterns = [
    // 明确的生成指令
    /生成\s*(\d+)\s*(张|个|幅|副)/,
    /画\s*(\d+)\s*(张|个|幅|副)/,
    /做\s*(\d+)\s*(张|个|幅|副)/,
    /创作\s*(\d+)\s*(张|个|幅|副)/,
    /制作\s*(\d+)\s*(张|个|幅|副)/,
    // 并生成X张的模式
    /并\s*生成\s*(\d+)\s*(张|个|幅|副)/,
    /，\s*生成\s*(\d+)\s*(张|个|幅|副)/,
    // 结尾的数量表达
    /(\d+)\s*(张|个|幅|副)\s*(图片?|图|画)?$/,
    // 请X张的模式
    /请\s*(\d+)\s*(张|个|幅|副)/
  ];
  
  for (const pattern of countPatterns) {
    const match = textContent.match(pattern);
    if (match) {
      const count = parseInt(match[1]);
      // 限制最大数量，避免过多请求
      return Math.min(Math.max(count, 1), 10); // 最少1张，最多10张
    }
  }
  
  // 检查中文数字（只匹配明确的生成指令）
  const chineseNumbers = {
    '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
    '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
    '两': 2, '俩': 2
  };
  
  const chinesePatterns = [
    // 明确的生成指令
    /生成\s*(一|二|三|四|五|六|七|八|九|十|两|俩)\s*(张|个|幅|副)/,
    /画\s*(一|二|三|四|五|六|七|八|九|十|两|俩)\s*(张|个|幅|副)/,
    /做\s*(一|二|三|四|五|六|七|八|九|十|两|俩)\s*(张|个|幅|副)/,
    /创作\s*(一|二|三|四|五|六|七|八|九|十|两|俩)\s*(张|个|幅|副)/,
    /制作\s*(一|二|三|四|五|六|七|八|九|十|两|俩)\s*(张|个|幅|副)/,
    // 并生成X张的模式
    /并\s*生成\s*(一|二|三|四|五|六|七|八|九|十|两|俩)\s*(张|个|幅|副)/,
    /，\s*生成\s*(一|二|三|四|五|六|七|八|九|十|两|俩)\s*(张|个|幅|副)/,
    // 结尾的数量表达
    /(一|二|三|四|五|六|七|八|九|十|两|俩)\s*(张|个|幅|副)\s*(图片?|图|画)?$/,
    // 请X张的模式
    /请\s*(一|二|三|四|五|六|七|八|九|十|两|俩)\s*(张|个|幅|副)/
  ];
  
  for (const pattern of chinesePatterns) {
    const match = textContent.match(pattern);
    if (match) {
      const chineseNum = match[1];
      return chineseNumbers[chineseNum] || 1;
    }
  }
  
  // 默认返回1张
  return 1;
}

/**
 * 根据提示词内容智能追加比例提示。
 * - 已有明确比例（1:1 / 2:3 / 9:16 等）→ 不处理
 * - 检测到全身人物关键词 → 追加 2:3 竖向比例提示
 * - 检测到横向场景关键词 → 追加 16:9 横向比例提示
 * - 其他情况 → 不追加，由豆包自行决定
 */
function appendAspectRatioHint(prompt, logger) {
  if (!prompt || typeof prompt !== 'string') return prompt;

  // 已有明确比例，不干预（兼容全角冒号、书名号、括号等各种包裹形式）
  const hasRatio = /(1[：:：]1|2[：:：]3|3[：:：]4|4[：:：]3|9[：:：]16|16[：:：]9)/.test(prompt);
  if (hasRatio) return prompt;

  // 全身人物关键词 → 2:3 竖向
  const fullBodyKeywords = [
    '全身', '全身照', '全身图', '站立', '站姿', '站着',
    'full body', 'full-body', 'standing', 'full shot',
    '人物全身', '角色全身', '整体造型', '从头到脚'
  ];
  if (fullBodyKeywords.some(kw => prompt.toLowerCase().includes(kw.toLowerCase()))) {
    const result = `${prompt}，画面比例2:3`;
    logger?.info(`检测到全身人物，自动追加竖向比例提示: 2:3`);
    return result;
  }

  // 横向场景关键词 → 16:9
  const landscapeKeywords = [
    '风景', '全景', '横幅', '宽屏', '电影感', '场景', '背景图',
    'landscape', 'panorama', 'widescreen', 'cinematic', 'wide shot'
  ];
  if (landscapeKeywords.some(kw => prompt.toLowerCase().includes(kw.toLowerCase()))) {
    const result = `${prompt}，画面比例16:9`;
    logger?.info(`检测到横向场景，自动追加横向比例提示: 16:9`);
    return result;
  }

  return prompt;
}
