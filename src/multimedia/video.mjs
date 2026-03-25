// 视频处理模块
import { getConfig } from '../config.mjs';
import { parseCQParams } from '../utils.mjs';
import { processVideoWithFilesAPI, processVideoWithBase64 } from './videoUpload.mjs';

export async function processCQVideo(cqParams, logger) {
  try {
    logger?.info(`处理视频CQ参数: ${cqParams}`);
    const params = parseCQParams(cqParams);
    logger?.info(`解析后的视频参数:`, JSON.stringify(params, null, 2));
    
    let videoUrl = params.url;
    let fileName = params.file;
    let fileSize = parseInt(params.file_size) || 0;
    
    logger?.info(`解析视频CQ参数: url=${videoUrl}, file=${fileName}, size=${fileSize}`);
    
    if (!videoUrl) {
      logger?.warn("CQ视频码缺少URL");
      return null;
    }

    videoUrl = decodeURIComponent(videoUrl.replace(/&amp;/g, '&'));
    logger?.info(`解码后的视频URL: ${videoUrl}`);
    
    const config = getConfig();
    let fileExtension = '';
    if (fileName && fileName.includes('.')) {
      fileExtension = fileName.split('.').pop().toLowerCase();
      logger?.info(`从文件名获取扩展名: ${fileName} -> ${fileExtension}`);
    } else {
      fileExtension = 'mp4';
      logger?.info(`使用默认扩展名: ${fileExtension}`);
    }
    
    if (!config.supportedVideoFormats.includes(fileExtension)) {
      logger?.warn(`不支持的视频格式: ${fileExtension}`);
      return null;
    }

    if (config.useFilesAPI) {
      logger?.info("使用Files API处理视频");
      return await processVideoWithFilesAPI(videoUrl, fileName, fileExtension, fileSize, logger);
    } else {
      logger?.info("使用Base64编码处理视频");
      return await processVideoWithBase64(videoUrl, fileName, fileExtension, fileSize, logger);
    }
    
  } catch (error) {
    logger?.error("处理CQ视频码时出错:", error);
    return null;
  }
}
