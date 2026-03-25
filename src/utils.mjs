// 工具函数模块
import fs from 'fs';
import path from 'path';

// 检测消息是否需要联网查询
export function needsWebSearch(messageContent) {
  // 如果消息内容不是数组或为空，返回false
  if (!Array.isArray(messageContent) || messageContent.length === 0) {
    return false;
  }
  
  // 提取所有文本内容
  const textContent = messageContent
    .filter(item => item.type === "text")
    .map(item => item.text)
    .join(" ")
    .toLowerCase();
  
  // 联网查询关键词列表
  const webSearchKeywords = [
    // 时间相关
    '今天', '明天', '昨天', '现在', '当前', '最新', '最近', '今年', '今日',
    '实时', '即时', '刚刚', '刚才', '目前', '此时', '此刻', '当下', '近期',
    
    // 查询相关
    '搜索', '查找', '查询', '搜一下', '搜搜', '找一下', '找找',
    '帮我查', '帮我搜', '查一查', '搜一搜', '了解一下',
    
    // 新闻资讯
    '新闻', '资讯', '消息', '报道', '头条', '热点', '事件', '突发',
    '发生了什么', '什么情况', '怎么回事', '局势', '形势', '动态', '进展',
    '冲突', '战争', '政治', '外交', '国际', '军事', '制裁', '谈判',
    '选举', '政府', '总统', '首相', '议会', '国会', '联合国',
    
    // 价格股票
    '价格', '股价', '汇率', '行情', '涨跌', '市值', '股票', '基金',
    '多少钱', '什么价', '价位', '报价', '成交价', '开盘', '收盘',
    '房价', '油价', '金价', '币价', '比特币', '以太坊',
    
    // 天气相关
    '天气', '气温', '温度', '下雨', '晴天', '阴天', '雾霾', '台风',
    '天气预报', '气象', '降雨', '降温', '升温', '湿度', '风力',
    
    // 交通出行
    '路况', '堵车', '交通', '地铁', '公交', '航班', '火车', '高铁',
    '怎么去', '路线', '导航', '出行', '班次', '时刻表',
    
    // 营业时间
    '营业时间', '开门时间', '关门时间', '几点开门', '几点关门',
    '营业', '开放时间', '工作时间', '服务时间', '办公时间',
    
    // 在线状态
    '在线', '离线', '状态', '是否开放', '能否访问', '可用性',
    
    // 版本更新
    '版本', '更新', '升级', '发布', '上线', '下线', '推出',
    '最新版本', '新版本', '版本号', '更新日志', '发布时间',
    
    // 比赛赛事
    '比赛', '赛事', '比分', '结果', '胜负', '排名', '积分',
    '世界杯', '奥运会', '联赛', '锦标赛', '决赛', '半决赛',
    
    // 疫情健康
    '疫情', '确诊', '感染', '病例', '疫苗', '防疫', '隔离',
    
    // 经济金融
    '经济', '通胀', 'gdp', '失业率', '利率', '央行', '货币政策',
    
    // 科技产品
    '发布会', '新品', '苹果', '华为', '小米', '特斯拉', 'ai', '人工智能'
  ];
  
  // 检查是否包含联网查询关键词
  const hasWebKeywords = webSearchKeywords.some(keyword => 
    textContent.includes(keyword)
  );
  
  // 检查是否是问句且可能需要实时信息
  const questionPatterns = [
    /现在.*?怎么样/,
    /今天.*?如何/,
    /最新.*?是什么/,
    /.*?的价格/,
    /.*?多少钱/,
    /.*?什么时候/,
    /.*?在哪里/,
    /.*?怎么去/,
    /.*?营业时间/,
    /.*?开门.*?时间/,
    /.*?什么情况/,
    /.*?发生.*?什么/
  ];
  
  const hasQuestionPattern = questionPatterns.some(pattern => 
    pattern.test(textContent)
  );
  
  return hasWebKeywords || hasQuestionPattern;
}

export function getMimeType(extension, mediaType) {
  const mimeTypes = {
    image: {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'bmp': 'image/bmp',
      'webp': 'image/webp'
    },
    video: {
      'mp4': 'video/mp4',
      'avi': 'video/x-msvideo',
      'mov': 'video/quicktime',
      'mkv': 'video/x-matroska',
      'flv': 'video/x-flv'
    },
    audio: {
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'flac': 'audio/flac',
      'aac': 'audio/aac',
      'ogg': 'audio/ogg'
    }
  };
  
  return mimeTypes[mediaType]?.[extension.toLowerCase()] || `${mediaType}/${extension}`;
}

export function parseCQParams(paramString) {
  const params = {};
  if (!paramString) return params;
  
  const cleanParams = paramString.startsWith(',') ? paramString.substring(1) : paramString;
  
  const regex = /([^=,]+)=([^,]*(?:,[^=]*)*?)(?=,[^=]+=|$)/g;
  let match;
  
  while ((match = regex.exec(cleanParams)) !== null) {
    const key = match[1].trim();
    const value = match[2].trim();
    if (key && value) {
      params[key] = value;
    }
  }
  
  if (Object.keys(params).length === 0) {
    const pairs = cleanParams.split(',');
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      const equalIndex = pair.indexOf('=');
      if (equalIndex > 0) {
        const key = pair.substring(0, equalIndex).trim();
        let value = pair.substring(equalIndex + 1).trim();
        
        if (key === 'url' && value.startsWith('https://')) {
          for (let j = i + 1; j < pairs.length; j++) {
            if (!pairs[j].includes('=')) {
              value += ',' + pairs[j];
              i = j;
            } else {
              break;
            }
          }
        }
        
        params[key] = value;
      }
    }
  }
  
  return params;
}

export async function tryGetLocalFile(fileName, fileType = 'image') {
  if (!fileName) return null;
  
  const possiblePaths = [
    path.join(process.cwd(), 'cache', fileName),
    path.join(process.cwd(), 'data', fileType, fileName),
    path.join(process.cwd(), 'temp', fileName),
    path.join(process.cwd(), `${fileType}s`, fileName),
    path.join(process.cwd(), 'files', fileName),
    path.join(process.cwd(), 'documents', fileName),
    path.join(process.env.APPDATA || '', 'Tencent', 'QQ', 'Misc', fileName),
    path.join(process.env.LOCALAPPDATA || '', 'Tencent', 'QQ', 'UserDataInfo', 'Cache', fileName),
    // 添加更多可能的文档路径
    path.join(process.env.USERPROFILE || '', 'Downloads', fileName),
    path.join(process.env.USERPROFILE || '', 'Documents', fileName)
  ];
  
  for (const filePath of possiblePaths) {
    try {
      if (fs.existsSync(filePath)) {
        return filePath;
      }
    } catch (error) {
      // 忽略权限错误等
    }
  }
  
  return null;
}

export async function sendMessage(actions, event, message, adapter, config) {
  const params = {
    message,
    message_type: event.message_type,
    ...event.message_type === "group" && event.group_id ? { group_id: String(event.group_id) } : {},
    ...event.message_type === "private" && event.user_id ? { user_id: String(event.user_id) } : {}
  };

  try {
    await actions.call("send_msg", params, adapter, config);
  } catch (error) {
    console.error("发送消息失败:", error);
  }
}
