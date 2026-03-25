// 视频上传模块
import { Buffer } from 'buffer';
import { getConfig } from '../config.mjs';
import { getMimeType, tryGetLocalFile } from '../utils.mjs';
import { downloadVideoBuffer, uploadVideoToFilesAPI, waitForFileProcessing } from './videoHelpers.mjs';

let FormData;
try {
  FormData = globalThis.FormData || (await import('form-data')).default;
} catch (e) {
  FormData = globalThis.FormData;
}

export async function processVideoWithFilesAPI(videoUrl, fileName, fileExtension, fileSize, logger) {
  try {
    const localVideoPath = await tryGetLocalFile(fileName, 'video');
    let videoBuffer = null;
    
    if (localVideoPath) {
      logger?.info(`找到本地缓存视频: ${localVideoPath}`);
      try {
        const fs = await import('fs');
        videoBuffer = fs.default.readFileSync(localVideoPath);
        logger?.info(`本地视频大小: ${videoBuffer.length} bytes`);
      } catch (localError) {
        logger?.warn("读取本地视频失败:", localError);
      }
    }

    const config = getConfig();
    if (!videoBuffer && config.downloadImages) {
      videoBuffer = await downloadVideoBuffer(videoUrl, logger);
    }

    if (!videoBuffer) {
      logger?.info("无法获取视频数据");
      return "VIDEO_DETECTED_BUT_UNAVAILABLE";
    }

    const maxSize = Math.min(config.maxVideoSize * 1024 * 1024, 512 * 1024 * 1024);
    if (videoBuffer.length > maxSize) {
      logger?.warn(`视频文件过大: ${videoBuffer.length} bytes`);
      return {
        type: 'size_limit_exceeded',
        message: `视频文件过大(${Math.round(videoBuffer.length / 1024 / 1024)}MB)`
      };
    }

    const fileId = await uploadVideoToFilesAPI(videoBuffer, fileName, fileExtension, logger);
    if (!fileId) {
      logger?.error("上传视频到Files API失败");
      return null;
    }

    logger?.info(`视频上传成功，File ID: ${fileId}`);
    return {
      type: 'file_id',
      fileId: fileId,
      fps: parseFloat(config.videoFps) || 1.0
    };

  } catch (error) {
    logger?.error("使用Files API处理视频时出错:", error);
    return null;
  }
}

export async function processVideoWithBase64(videoUrl, fileName, fileExtension, fileSize, logger) {
  try {
    const localVideoPath = await tryGetLocalFile(fileName, 'video');
    let videoBuffer = null;
    
    if (localVideoPath) {
      logger?.info(`找到本地缓存视频: ${localVideoPath}`);
      try {
        const fs = await import('fs');
        videoBuffer = fs.default.readFileSync(localVideoPath);
      } catch (localError) {
        logger?.warn("读取本地视频失败:", localError);
      }
    }

    const config = getConfig();
    if (!videoBuffer && config.downloadImages) {
      videoBuffer = await downloadVideoBuffer(videoUrl, logger);
    }

    if (!videoBuffer) {
      return "VIDEO_DETECTED_BUT_UNAVAILABLE";
    }

    const maxSize = Math.min(config.maxVideoSize * 1024 * 1024, 50 * 1024 * 1024);
    if (videoBuffer.length > maxSize) {
      return {
        type: 'size_limit_exceeded',
        message: `视频文件过大(${Math.round(videoBuffer.length / 1024 / 1024)}MB)`
      };
    }

    const base64 = videoBuffer.toString('base64');
    const mimeType = getMimeType(fileExtension, 'video');
    const dataUrl = `data:${mimeType};base64,${base64}`;
    
    logger?.info(`视频转换为base64成功`);
    return {
      type: 'base64',
      url: dataUrl,
      fps: parseFloat(config.videoFps) || 1.0
    };

  } catch (error) {
    logger?.error("使用Base64处理视频时出错:", error);
    return null;
  }
}
