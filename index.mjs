// 主入口文件 - 模块化重构版本
import { EventType } from './src/types.mjs';
import { getConfig, setConfig, saveConfig, loadConfig } from './src/config.mjs';
import { getContextId, getContext, saveContext, clearContext } from './src/context.mjs';
import { sendMessage } from './src/utils.mjs';
import { parseMultimediaMessage } from './src/messageParser.mjs';
import { callDoubaoAPI } from './src/api/index.mjs';
import { createPluginConfigUI } from './src/uiConfig.mjs';

let logger = null;
let plugin_config_ui = [];

const plugin_init = async (ctx) => {
  logger = ctx.logger;
  
  // 加载已保存的配置
  try {
    await loadConfig(ctx);
    logger.info("牧濑红莉栖AI插件配置已加载");
  } catch (error) {
    logger.warn("加载配置失败，使用默认配置:", error.message);
  }
  
  logger.info("牧濑红莉栖AI插件已初始化");
  plugin_config_ui = createPluginConfigUI(ctx);
};

const plugin_get_config = async () => {
  return getConfig();
};

const plugin_set_config = async (ctx, config) => {
  await saveConfig(ctx, config);
};

const plugin_onmessage = async (ctx, event) => {
  if (event.post_type !== EventType.MESSAGE) {
    return;
  }

  const config = getConfig();
  const isPrivate = event.message_type === "private";
  const isGroup = event.message_type === "group";

  if (isPrivate && !config.enablePrivateChat) return;
  if (isGroup && !config.enableGroupChat) return;

  const message = event.raw_message;
  const prefix = config.prefix || "@Amadeus";
  
  let shouldReply = false;
  let userMessage = message;
  let autoReplyToVideo = false;  // 标记是否是自动响应视频

  if (isPrivate) {
    shouldReply = true;
  } else if (isGroup) {
    // 检查是否包含触发条件（@AI 或前缀）
    if (message.includes(prefix) || message.includes(`[CQ:at,qq=${event.self_id}]`)) {
      shouldReply = true;
      userMessage = message
        .replace(new RegExp(`^${prefix}\\s*`, 'i'), '')
        .replace(new RegExp(`${prefix}\\s*`, 'gi'), '')
        .replace(/\[CQ:at,qq=\d+\]\s*/g, '')
        .trim();
    } 
    // 新增：如果启用了自动响应视频，且消息包含视频，则自动响应
    else if (config.autoReplyGroupVideo && message.includes('[CQ:video')) {
      shouldReply = true;
      autoReplyToVideo = true;
      logger?.info("检测到群聊视频消息，自动响应");
    }
  }

  if (!shouldReply) return;

  // 管理员白名单管理命令（在白名单检查之前处理，确保管理员始终可操作）
  const ADMIN_QQ = '525870722';
  if (String(event.user_id) === ADMIN_QQ) {
    const adminCmd = userMessage.trim();

    // 加入白名单：加入白名单 123456789 或 加入白名单123456789
    const addMatch = adminCmd.match(/^加入白名单\s*(\d+)$/);
    if (addMatch) {
      const targetQQ = addMatch[1];
      const config = getConfig();
      const allowedList = Array.isArray(config.allowedUsers)
        ? config.allowedUsers.map(id => String(id).trim())
        : String(config.allowedUsers || '').split(',').map(id => id.trim()).filter(id => id);

      if (allowedList.includes(targetQQ)) {
        await sendMessage(ctx.actions, event, `${targetQQ} 已经在白名单中了。`, ctx.adapterName, ctx.pluginManager.config);
      } else {
        allowedList.push(targetQQ);
        config.allowedUsers = allowedList;
        await saveConfig(ctx, config);
        await sendMessage(ctx.actions, event, `✅ 已将 ${targetQQ} 加入白名单。`, ctx.adapterName, ctx.pluginManager.config);
        logger?.info(`管理员将 ${targetQQ} 加入白名单`);
      }
      return;
    }

    // 移出白名单：移出白名单 123456789 或 移出白名单123456789
    const removeMatch = adminCmd.match(/^移出白名单\s*(\d+)$/);
    if (removeMatch) {
      const targetQQ = removeMatch[1];
      const config = getConfig();
      const allowedList = Array.isArray(config.allowedUsers)
        ? config.allowedUsers.map(id => String(id).trim())
        : String(config.allowedUsers || '').split(',').map(id => id.trim()).filter(id => id);

      if (!allowedList.includes(targetQQ)) {
        await sendMessage(ctx.actions, event, `${targetQQ} 不在白名单中。`, ctx.adapterName, ctx.pluginManager.config);
      } else {
        const newList = allowedList.filter(id => id !== targetQQ);
        config.allowedUsers = newList;
        await saveConfig(ctx, config);
        await sendMessage(ctx.actions, event, `✅ 已将 ${targetQQ} 移出白名单。`, ctx.adapterName, ctx.pluginManager.config);
        logger?.info(`管理员将 ${targetQQ} 移出白名单`);
      }
      return;
    }
  }

  // 白名单检查：shouldReply 确认后再检查，避免对群聊普通消息误触发
  if (config.allowedUsers && config.allowedUsers.length > 0) {
    const userId = String(event.user_id);
    const allowedList = Array.isArray(config.allowedUsers)
      ? config.allowedUsers.map(id => String(id).trim())
      : String(config.allowedUsers).split(',').map(id => id.trim()).filter(id => id);

    if (!allowedList.includes(userId)) {
      logger?.info(`用户 ${userId} 不在白名单中，发送拒绝消息`);
      const rejectMessages = [
        "哼，你谁啊？我可没时间理会陌生人。",
        "真是的，我又不认识你，别随便搭话。",
        "笨蛋，我只和特定的人对话，你不在名单里。",
        "抱歉，我的对话权限有限制。你不在授权列表中。",
        "emmm...你是谁？我的记忆库里没有你的访问权限呢。"
      ];
      const rejectMsg = rejectMessages[Math.floor(Math.random() * rejectMessages.length)];
      await sendMessage(ctx.actions, event, rejectMsg, ctx.adapterName, ctx.pluginManager.config);
      return;
    }
  }

  // 检查消息是否为空或只包含空白字符
  if (!userMessage || userMessage.trim() === '') {
    logger?.info("收到空消息，跳过处理");
    return;
  }

  // 处理特殊命令
  const contextId = getContextId(event);
  
  if (userMessage.toLowerCase() === '清除记忆' || userMessage.toLowerCase() === 'clear memory') {
    if (clearContext(contextId, logger)) {
      await sendMessage(ctx.actions, event, "✅ 已清除我们的对话记忆。", ctx.adapterName, ctx.pluginManager.config);
    } else {
      await sendMessage(ctx.actions, event, "ℹ️ 当前没有需要清除的对话记忆。", ctx.adapterName, ctx.pluginManager.config);
    }
    return;
  }

  if (userMessage.toLowerCase() === '查看记忆' || userMessage.toLowerCase() === 'show memory') {
    const context = getContext(contextId, logger);
    if (context && context.messages.length > 0) {
      const messageCount = Math.floor(context.messages.length / 2);
      const lastUpdate = new Date(context.lastUpdate).toLocaleString('zh-CN');
      await sendMessage(ctx.actions, event, `📝 当前记忆状态：\n对话轮数：${messageCount}\n最后更新：${lastUpdate}\n\n💡 发送"清除记忆"可以重新开始对话`, ctx.adapterName, ctx.pluginManager.config);
    } else {
      await sendMessage(ctx.actions, event, "🆕 当前没有对话记忆，这是全新的对话。", ctx.adapterName, ctx.pluginManager.config);
    }
    return;
  }

  if (!config.apiKey) {
    await sendMessage(ctx.actions, event, "❌ 牧濑红莉栖未配置API密钥，请联系管理员配置。", ctx.adapterName, ctx.pluginManager.config);
    return;
  }

  try {
    logger?.info(`收到消息: ${userMessage}`);
    logger?.info(`原始消息: ${message}`);
    logger?.info(`事件对象结构:`, JSON.stringify({
      message_type: event.message_type,
      raw_message: event.raw_message,
      message: event.message,
      message_id: event.message_id
    }, null, 2));
    
    // 解析多媒体消息（使用原始消息，不使用清理后的 userMessage）
    const messageContent = await parseMultimediaMessage(event, userMessage, logger, ctx);
    
    // 检查是否有有效内容
    if (!messageContent || messageContent.length === 0) {
      logger?.warn("消息内容为空，跳过处理");
      return;
    }
    
    // 检查是否只有占位文本（如"你好"），且原始消息包含多媒体
    const hasMultimedia = event.raw_message && (
      event.raw_message.includes('[CQ:image') || 
      event.raw_message.includes('[CQ:video')
    );
    
    if (hasMultimedia) {
      logger?.info("检测到多媒体内容");
    }
    
    const aiResponse = await callDoubaoAPI(messageContent, contextId, logger, event.message_id);
    
    if (aiResponse) {
      // 检查是否是图片生成结果
      if (typeof aiResponse === 'object' && aiResponse.type === 'image_generation') {
        if (aiResponse.isImageStitching) {
          // 图片拼接回复
          const imageMessage = `[CQ:image,file=file://${aiResponse.imagePath}]`;
          let textMessage = `🖼️ 图片拼接完成！\n\n📝 处理方式：${aiResponse.prompt}\n🤖 模型：${aiResponse.model}${aiResponse.size ? `\n📐 尺寸：${aiResponse.size}` : ''}\n🔗 源图片：${aiResponse.sourceImageCount}张`;
          
          // 先发送文本说明，再发送图片
          await sendMessage(ctx.actions, event, textMessage, ctx.adapterName, ctx.pluginManager.config);
          await sendMessage(ctx.actions, event, imageMessage, ctx.adapterName, ctx.pluginManager.config);
          
          logger?.info(`图片拼接完成并发送: ${aiResponse.fileName}`);
        }
        else if (aiResponse.isImageToImage) {
          // 图生图回复
          if (aiResponse.images) {
            // 多张图生图
            const images = aiResponse.images || [];
            const totalCount = aiResponse.totalCount || 1;
            const successCount = aiResponse.successCount || 1;
            const failCount = aiResponse.failCount || 0;
            
            // 构建状态消息
            let statusMessage = `🎨 图生图完成！\n\n📊 生成状态：`;
            if (totalCount > 1) {
              statusMessage += `\n✅ 成功：${successCount}/${totalCount} 张`;
              if (failCount > 0) {
                statusMessage += `\n❌ 失败：${failCount} 张`;
              }
            } else {
              statusMessage += ` 成功生成 1 张图片`;
            }
            
            statusMessage += `\n📝 提示词：${aiResponse.prompt}\n🤖 模型：${aiResponse.model}\n🖼️ 参考图片：${aiResponse.referenceCount}张`;
            
            // 如果有失败的图片，显示错误信息
            if (aiResponse.errors && aiResponse.errors.length > 0) {
              statusMessage += `\n\n⚠️ 部分图片生成失败：\n${aiResponse.errors.slice(0, 3).join('\n')}`;
              if (aiResponse.errors.length > 3) {
                statusMessage += `\n... 还有 ${aiResponse.errors.length - 3} 个错误`;
              }
            }
            
            // 如果提示词被优化过，显示提示
            if (aiResponse.originalPrompt && aiResponse.originalPrompt !== aiResponse.prompt) {
              statusMessage += `\n\n💡 提示：为避免敏感内容，已优化提示词`;
            }
            
            // 先发送状态消息
            await sendMessage(ctx.actions, event, statusMessage, ctx.adapterName, ctx.pluginManager.config);
            
            // 然后依次发送所有成功生成的图片
            for (let i = 0; i < images.length; i++) {
              const image = images[i];
              const imageMessage = `[CQ:image,file=file://${image.imagePath}]`;
              await sendMessage(ctx.actions, event, imageMessage, ctx.adapterName, ctx.pluginManager.config);
              
              // 如果是多张图片，在每张图片之间稍作延迟，避免发送过快
              if (images.length > 1 && i < images.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 800));
              }
            }
            
            logger?.info(`多张图生图完成并发送: 成功 ${successCount}/${totalCount} 张`);
          } else {
            // 单张图生图（兼容旧格式）
            const imageMessage = `[CQ:image,file=file://${aiResponse.imagePath}]`;
            let textMessage = `🎨 已为你生成图片！\n\n📝 提示词：${aiResponse.prompt}\n🤖 模型：${aiResponse.model}${aiResponse.size ? `\n📐 尺寸：${aiResponse.size}` : ''}\n🖼️ 参考图片：${aiResponse.referenceCount}张`;
            
            // 如果提示词被优化过，显示提示
            if (aiResponse.originalPrompt && aiResponse.originalPrompt !== aiResponse.prompt) {
              textMessage += `\n\n💡 提示：为避免敏感内容，已优化提示词`;
            }
            
            // 先发送文本说明，再发送图片
            await sendMessage(ctx.actions, event, textMessage, ctx.adapterName, ctx.pluginManager.config);
            await sendMessage(ctx.actions, event, imageMessage, ctx.adapterName, ctx.pluginManager.config);
            
            logger?.info(`图生图完成并发送: ${aiResponse.fileName}`);
          }
        } else {
          // 普通图片生成回复（可能多张图片）
          const images = aiResponse.images || [];
          const totalCount = aiResponse.totalCount || 1;
          const successCount = aiResponse.successCount || 1;
          const failCount = aiResponse.failCount || 0;
          
          // 构建状态消息
          let statusMessage = `🎨 图片生成完成！\n\n📊 生成状态：`;
          if (totalCount > 1) {
            statusMessage += `\n✅ 成功：${successCount}/${totalCount} 张`;
            if (failCount > 0) {
              statusMessage += `\n❌ 失败：${failCount} 张`;
            }
          } else {
            statusMessage += ` 成功生成 1 张图片`;
          }
          
          statusMessage += `\n📝 提示词：${aiResponse.prompt}\n🤖 模型：${aiResponse.model}`;
          
          // 如果有失败的图片，显示错误信息
          if (aiResponse.errors && aiResponse.errors.length > 0) {
            statusMessage += `\n\n⚠️ 部分图片生成失败：\n${aiResponse.errors.slice(0, 3).join('\n')}`;
            if (aiResponse.errors.length > 3) {
              statusMessage += `\n... 还有 ${aiResponse.errors.length - 3} 个错误`;
            }
          }
          
          // 如果提示词被优化过，显示提示
          if (aiResponse.originalPrompt && aiResponse.originalPrompt !== aiResponse.prompt) {
            statusMessage += `\n\n💡 提示：为避免敏感内容，已优化提示词`;
          }
          
          // 先发送状态消息
          await sendMessage(ctx.actions, event, statusMessage, ctx.adapterName, ctx.pluginManager.config);
          
          // 然后依次发送所有成功生成的图片
          for (let i = 0; i < images.length; i++) {
            const image = images[i];
            const imageMessage = `[CQ:image,file=file://${image.imagePath}]`;
            await sendMessage(ctx.actions, event, imageMessage, ctx.adapterName, ctx.pluginManager.config);
            
            // 如果是多张图片，在每张图片之间稍作延迟，避免发送过快
            if (images.length > 1 && i < images.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
          
          logger?.info(`图片生成完成并发送: 成功 ${successCount}/${totalCount} 张`);
        }
      } 
      // 检查是否是文档生成结果
      else if (typeof aiResponse === 'object' && aiResponse.type === 'document_generation') {
        // 发送文档
        const fileMessage = `[CQ:file,file=file://${aiResponse.filePath}]`;
        const documentTypeText = aiResponse.documentType === 'excel' ? 'Excel表格' : 'Word文档';
        
        const textMessage = `📄 已为你生成${documentTypeText}！\n\n📁 文件名：${aiResponse.fileName}\n📊 文档类型：${documentTypeText}\n\n💡 文档已整理完成，请查收！`;
        
        // 先发送文本说明，再发送文档
        await sendMessage(ctx.actions, event, textMessage, ctx.adapterName, ctx.pluginManager.config);
        await sendMessage(ctx.actions, event, fileMessage, ctx.adapterName, ctx.pluginManager.config);
        
        logger?.info(`文档生成完成并发送: ${aiResponse.fileName}`);
      } 
      else {
        // 普通文本回复
        await sendMessage(ctx.actions, event, aiResponse, ctx.adapterName, ctx.pluginManager.config);
        logger?.info("AI回复已发送");
      }
    } else {
      await sendMessage(ctx.actions, event, "❌ AI服务暂时不可用，请稍后再试。", ctx.adapterName, ctx.pluginManager.config);
    }
  } catch (error) {
    logger?.error("处理AI消息时发生错误:", error);
    await sendMessage(ctx.actions, event, "❌ 处理消息时出现错误，请稍后再试。", ctx.adapterName, ctx.pluginManager.config);
  }
};

export { 
  plugin_config_ui, 
  plugin_init, 
  plugin_get_config, 
  plugin_set_config, 
  plugin_onmessage 
};
