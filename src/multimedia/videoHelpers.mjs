// 视频辅助函数
import { getConfig } from '../config.mjs';
import { getMimeType } from '../utils.mjs';

let FormData;
try {
  FormData = globalThis.FormData || (await import('form-data')).default;
} catch (e) {
  FormData = globalThis.FormData;
}

export async function downloadVideoBuffer(videoUrl, logger) {
  try {
    logger?.info(`开始下载视频: ${videoUrl}`);
    
    const requestOptions = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'video/mp4,video/webm,video/*,*/*;q=0.8'
      }
    };
    
    const response = await fetch(videoUrl, requestOptions);
    
    if (!response.ok) {
      logger?.error(`视频下载失败: ${response.status}`);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    logger?.info(`视频下载成功，大小: ${buffer.length} bytes`);
    return buffer;
    
  } catch (error) {
    logger?.error("下载视频失败:", error);
    return null;
  }
}

export async function uploadVideoToFilesAPI(videoBuffer, fileName, fileExtension, logger) {
  try {
    logger?.info(`开始上传视频到Files API，大小: ${videoBuffer.length} bytes, 文件名: ${fileName}`);
    
    const formData = new FormData();
    const mimeType = getMimeType(fileExtension, 'video');
    logger?.info(`视频MIME类型: ${mimeType}`);
    
    if (typeof Blob !== 'undefined') {
      const videoBlob = new Blob([videoBuffer], { type: mimeType });
      formData.append('file', videoBlob, fileName || `video.${fileExtension}`);
      logger?.info(`使用Blob方式上传（浏览器环境）`);
    } else {
      formData.append('file', videoBuffer, {
        filename: fileName || `video.${fileExtension}`,
        contentType: mimeType
      });
      logger?.info(`使用Buffer方式上传（Node.js环境）`);
    }
    
    const config = getConfig();
    formData.append('purpose', 'user_data');
    
    const fps = parseFloat(config.videoFps) || 1.0;
    formData.append('preprocess_configs[video][fps]', fps.toString());
    logger?.info(`视频FPS设置: ${fps}`);
    
    const headers = {
      'Authorization': `Bearer ${config.apiKey}`
    };
    
    if (formData.getHeaders) {
      Object.assign(headers, formData.getHeaders());
      logger?.info(`添加FormData headers`);
    }
    
    logger?.info(`开始发送Files API请求到: ${config.filesApiUrl}`);
    const response = await fetch(config.filesApiUrl, {
      method: 'POST',
      headers: headers,
      body: formData
    });
    
    logger?.info(`Files API响应状态: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      logger?.error(`Files API上传失败: ${errorText}`);
      return null;
    }
    
    const data = await response.json();
    logger?.info(`Files API上传成功，响应数据:`, JSON.stringify(data, null, 2));
    
    if (data.id) {
      const processed = await waitForFileProcessing(data.id, logger);
      if (processed) {
        logger?.info(`文件已就绪，File ID: ${data.id}`);
        return data.id;
      } else {
        logger?.error(`文件处理失败或超时，File ID: ${data.id}`);
        return data.id;
      }
    }
    
    logger?.error(`Files API响应中没有file ID`);
    return null;
    
  } catch (error) {
    logger?.error("上传视频到Files API时出错:", error);
    logger?.error("错误堆栈:", error.stack);
    return null;
  }
}

export async function waitForFileProcessing(fileId, logger, maxWaitTime = 60000) {
  const startTime = Date.now();
  const checkInterval = 2000;
  
  logger?.info(`等待文件处理完成: ${fileId}`);
  
  const config = getConfig();
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      const response = await fetch(`${config.filesApiUrl}/${fileId}`, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`
        }
      });
      
      if (response.ok) {
        const fileInfo = await response.json();
        logger?.info(`文件状态: ${fileInfo.status || 'unknown'}, 详情:`, JSON.stringify(fileInfo, null, 2));
        
        if (fileInfo.status === 'processed' || fileInfo.status === 'active') {
          logger?.info(`文件处理完成: ${fileId}, 状态: ${fileInfo.status}`);
          return true;
        } else if (fileInfo.status === 'failed' || fileInfo.status === 'error') {
          logger?.error(`文件处理失败: ${fileId}`);
          return false;
        }
      } else {
        logger?.warn(`检查文件状态失败: ${response.status}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      
    } catch (error) {
      logger?.error("检查文件状态时出错:", error);
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
  }
  
  logger?.warn(`文件处理超时: ${fileId}`);
  return true;
}
