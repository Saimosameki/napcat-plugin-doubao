// 图片尺寸优化器 - 完全由提示词控制图片比例
// 支持的比例，同时匹配英文冒号和中文冒号（：）
const RATIO_PATTERN = /\b(1[：:]1|2[：:]3|3[：:]4|4[：:]3|9[：:]16|16[：:]9)\b/;

/**
 * 检测提示词中是否包含明确的比例要求
 * @param {string} prompt
 * @param {Object} logger
 * @returns {null} 始终返回 null，让豆包AI根据提示词自行决定图片尺寸
 */
export function getOptimalImageSize(prompt, logger) {
  if (prompt && RATIO_PATTERN.test(prompt)) {
    logger?.info(`检测到比例要求，让豆包AI处理图片尺寸`);
  } else {
    logger?.info(`未指定比例，由豆包AI根据提示词自动决定图片尺寸`);
  }
  return null; // 始终不传 image_size，完全由豆包AI决定
}
