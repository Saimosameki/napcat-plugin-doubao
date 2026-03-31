// 修复版本的processCQImage函数
async function processCQImage(cqParams) {
  try {
    // 解析CQ码参数
    const params = parseCQParams(cqParams);
    let imageUrl = params.url;
    let fileName = params.file;
    
    logger?.info(`解析CQ参数: url=${imageUrl}, file=${fileName}`);
    
    if (!imageUrl) {
      logger?.warn("CQ图片码缺少URL");
      return null;
    }

    // URL解码
    imageUrl = decodeURIComponent(imageUrl.replace(/&amp;/g, '&'));
    
    // 检查文件格式 - 优先从file参数中获取扩展名
    let fileExtension = '';
    if (fileName && fileName.includes('.')) {
      fileExtension = fileName.split('.').pop().toLowerCase();
      logger?.info(`从文件名获取扩展名: ${fileName} -> ${fileExtension}`);
    } else {
      // 如果file参数没有扩展名，默认为jpg（QQ图片通常是jpg）
      fileExtension = 'jpg';
      logger?.info(`使用默认扩展名: ${fileExtension}`);
    }
    
    if (!currentConfig.supportedImageFormats.includes(fileExtension)) {
      logger?.warn(`不支持的图片格式: ${fileExtension}`);
      return null;
    }

    logger?.info(`处理图片成功: ${imageUrl}, 格式: ${fileExtension}`);
    return imageUrl;
  } catch (error) {
    logger?.error("处理CQ图片码时出错:", error);
    return null;
  }
}