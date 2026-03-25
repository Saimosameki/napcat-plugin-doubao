// 图片处理模块
import fs from 'fs';
import { Buffer } from 'buffer';
import { getConfig } from '../config.mjs';
import { getMimeType, parseCQParams, tryGetLocalFile } from '../utils.mjs';

export async function processCQImage(cqParams, logger) {
  try {
    logger?.info(`原始CQ参数: ${cqParams}`);
    const params = parseCQParams(cqParams);
    logger?.info(`解析后的参数:`, JSON.stringify(params, null, 2));
    
    let imageUrl = params.url;
    let fileName = params.file;
    
    logger?.info(`解析CQ参数: url=${imageUrl}, file=${fileName}`);
    
    if (!imageUrl) {
      logger?.warn("CQ图片码缺少URL");
      return null;
    }

    imageUrl = decodeURIComponent(imageUrl.replace(/&amp;/g, '&'));
    logger?.info(`解码后的URL: ${imageUrl}`);
    
    const config = getConfig();
    let fileExtension = '';
    if (fileName && fileName.includes('.')) {
      fileExtension = fileName.split('.').pop().toLowerCase();
      logger?.info(`从文件名获取扩展名: ${fileName} -> ${fileExtension}`);
    } else {
      fileExtension = 'jpg';
      logger?.info(`使用默认扩展名: ${fileExtension}`);
    }
    
    if (!config.supportedImageFormats.includes(fileExtension)) {
      logger?.warn(`不支持的图片格式: ${fileExtension}`);
      return null;
    }

    const localImagePath = await tryGetLocalFile(fileName, 'image');
    if (localImagePath) {
      logger?.info(`找到本地缓存图片: ${localImagePath}`);
      try {
        const buffer = fs.readFileSync(localImagePath);
        const base64 = buffer.toString('base64');
        const mimeType = getMimeType(fileExtension, 'image');
        const dataUrl = `data:${mimeType};base64,${base64}`;
        
        logger?.info(`本地图片转换为base64成功，大小: ${buffer.length} bytes`);
        return dataUrl;
      } catch (localError) {
        logger?.warn("读取本地图片失败:", localError);
      }
    }

    if (config.downloadImages) {
      return await downloadImage(imageUrl, fileExtension, logger);
    } else {
      logger?.info("检测到图片但未启用下载功能");
      return "IMAGE_DETECTED_BUT_UNAVAILABLE";
    }
    
  } catch (error) {
    logger?.error("处理CQ图片码时出错:", error);
    return null;
  }
}

async function downloadImage(imageUrl, fileExtension, logger) {
  try {
    logger?.info(`开始下载图片: ${imageUrl}`);
    
    const requestOptions = [
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
        }
      },
      {
        headers: {
          'User-Agent': 'QQ/9.9.15.28131',
          'Accept': '*/*'
        }
      }
    ];
    
    let response = null;
    
    for (let i = 0; i < requestOptions.length; i++) {
      try {
        logger?.info(`尝试请求配置 ${i + 1}/${requestOptions.length}`);
        response = await fetch(imageUrl, requestOptions[i]);
        
        if (response.ok) {
          logger?.info(`请求成功，状态码: ${response.status}`);
          break;
        } else {
          response = null;
        }
      } catch (error) {
        logger?.warn(`请求配置 ${i + 1} 失败:`, error.message);
        response = null;
      }
    }
    
    if (!response || !response.ok) {
      logger?.error("所有请求配置都失败了");
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const config = getConfig();
    if (buffer.length > config.maxImageSize) {
      logger?.warn(`图片文件过大: ${buffer.length} bytes`);
      return null;
    }
    
    if (buffer.length < 100) {
      logger?.warn(`图片文件太小: ${buffer.length} bytes`);
      return null;
    }
    
    const base64 = buffer.toString('base64');
    const mimeType = getMimeType(fileExtension, 'image');
    const dataUrl = `data:${mimeType};base64,${base64}`;
    
    logger?.info(`图片转换为base64成功，大小: ${buffer.length} bytes`);
    return dataUrl;
    
  } catch (downloadError) {
    logger?.error("下载图片失败:", downloadError);
    return null;
  }
}
