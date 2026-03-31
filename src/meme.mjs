// 表情包模块 - 根据回复内容自动选择表情包
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getConfig } from './config.mjs';

// 插件根目录（plugins/napcat-plugin-doubao/）
const PLUGIN_DIR = path.resolve(fileURLToPath(import.meta.url), '../../');

// 情绪关键词映射表
// key = 情绪名（对应子目录名），value = 触发关键词数组
const EMOTION_KEYWORDS = {
  happy: [
    '哈哈', '开心', '高兴', '太好了', '棒', '厉害', '不错', '好的', '好啊',
    '成功', '完成', '搞定', '耶', '赞', '妙', '可以', '没问题', '当然'
  ],
  angry: [
    '哼', '烦', '讨厌', '真是的', '笨蛋', '蠢', '无语', '气死', '滚',
    '不行', '不可以', '绝对不', '拒绝', '算了', '随便你'
  ],
  sad: [
    '可惜', '遗憾', '抱歉', '对不起', '失败', '错误', '无法', '不能',
    '没办法', '难过', '伤心', '呜', '唉', '哎'
  ],
  surprised: [
    '什么', '居然', '竟然', '真的吗', '不会吧', '没想到', '意外', '惊',
    '哇', '天啊', '我的天', '不敢相信', '震惊'
  ],
  shy: [
    '才不是', '才没有', '谁说的', '哪有', '不要误会', '别这样说',
    '人家', '才不承认', '哼哼', '嗯嗯'
  ],
  thinking: [
    '让我想想', '嗯', '这个嘛', '也许', '可能', '大概', '应该',
    '分析', '根据', '理论上', '从科学角度', '计算'
  ],
  default: []
};

/**
 * 分析文本情绪，返回情绪名
 * @param {string} text
 * @returns {string} 情绪名
 */
function detectEmotion(text) {
  if (!text) return 'default';

  const scores = {};
  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
    if (emotion === 'default') continue;
    scores[emotion] = keywords.filter(kw => text.includes(kw)).length;
  }

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (best && best[1] > 0) return best[0];
  return 'default';
}

/**
 * 从指定目录随机选一张图片
 * @param {string} dir
 * @returns {string|null} 文件绝对路径
 */
function pickRandomImage(dir) {
  try {
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir).filter(f =>
      /\.(jpg|jpeg|png|gif|webp)$/i.test(f)
    );
    if (files.length === 0) return null;
    const chosen = files[Math.floor(Math.random() * files.length)];
    return path.join(dir, chosen);
  } catch {
    return null;
  }
}

/**
 * 根据 AI 回复内容选择表情包路径
 * @param {string} replyText - AI 回复文本
 * @param {object} logger
 * @returns {string|null} 表情包文件绝对路径，无则返回 null
 */
export function selectMeme(replyText, logger) {
  const config = getConfig();
  if (!config.enableMeme || !config.memeDir) return null;

  const memeBaseDir = path.isAbsolute(config.memeDir)
    ? config.memeDir
    : path.join(PLUGIN_DIR, config.memeDir);

  if (!fs.existsSync(memeBaseDir)) {
    logger?.warn(`表情包目录不存在: ${memeBaseDir}`);
    return null;
  }

  // 按概率决定是否发送表情包（避免每条消息都发）
  const chance = typeof config.memeChance === 'number' ? config.memeChance : 0.4;
  if (Math.random() > chance) return null;

  const emotion = detectEmotion(replyText);
  logger?.info(`检测到情绪: ${emotion}`);

  // 优先找对应情绪目录，找不到则用 default 目录，再找不到就从根目录随机
  const emotionDir = path.join(memeBaseDir, emotion);
  const defaultDir = path.join(memeBaseDir, 'default');

  let imagePath = pickRandomImage(emotionDir);
  if (!imagePath) imagePath = pickRandomImage(defaultDir);
  if (!imagePath) imagePath = pickRandomImage(memeBaseDir);

  if (imagePath) {
    logger?.info(`选中表情包: ${imagePath}`);
  } else {
    logger?.info('未找到可用表情包');
  }

  return imagePath;
}
