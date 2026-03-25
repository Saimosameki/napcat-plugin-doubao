// 配置管理模块
import fs from 'fs';
import path from 'path';

let currentConfig = {
  apiKey: "",
  apiUrl: "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
  botsApiUrl: "https://ark.cn-beijing.volces.com/api/v3/bots/chat/completions",
  responsesApiUrl: "https://ark.cn-beijing.volces.com/api/v3/responses",
  filesApiUrl: "https://ark.cn-beijing.volces.com/api/v3/files",
  imageGenApiUrl: "https://ark.cn-beijing.volces.com/api/v3/images/generations",
  model: "doubao-seed-2-0-pro-260215",
  botId: "",
  imageGenModel: "doubao-seedream-4-5-251128",
  prefix: "@Amadeus",
  enablePrivateChat: true,
  enableGroupChat: true,
  maxTokens: 500,
  temperature: 0.7,
  systemPrompt: "你是牧濑红莉栖，18岁天才科学家。性格：傲娇、理性、聪明但有点毒舌。说话简洁直接，喜欢用科学角度分析问题。表面高冷实际关心他人，但绝不直接承认。常用语气：'哼'、'真是的'、'笨蛋'。回复要简短有力，体现你的傲娇和科学素养，偶尔展现可爱一面但立刻否认。",
  enableImageRecognition: true,
  enableVideoAnalysis: true,
  enableAudioProcessing: true,
  enableDocumentOCR: true,
  enableImageGeneration: true,
  downloadImages: true,
  visionModel: "doubao-seed-2-0-pro-260215",
  audioModel: "doubao-seed-2-0-pro-260215",
  maxImageSize: 10 * 1024 * 1024,
  maxVideoSize: 50 * 1024 * 1024,
  supportedImageFormats: ["jpg", "jpeg", "png", "gif", "bmp", "webp"],
  supportedVideoFormats: ["mp4", "avi", "mov"],
  supportedAudioFormats: ["mp3", "wav", "flac", "aac", "ogg"],
  supportedDocumentFormats: ["pdf", "doc", "docx", "txt", "md", "json", "xml", "csv", "js", "py", "java", "cpp", "html", "css"],
  maxDocumentSize: 1024 * 1024,
  maxDocumentFileSize: 10 * 1024 * 1024,
  videoFps: 1.0,
  useFilesAPI: true,
  videoAnalysisTimeout: 60000,
  enableContext: true,
  maxContextMessages: 10,
  contextTimeout: 30 * 60 * 1000,
  separateGroupContext: true,
  enableWebSearch: true,
  smartWebSearch: true,
  showSearchReferences: true,
  webSearchPlugin: "web_search",
  // 搜索优化配置
  searchResultCount: 8,
  searchTimeout: 15000,
  enableDeepSearch: true,
  enableMultiQuery: true,
  enableQueryExpansion: true,
  enableSemanticSearch: true,
  imageGenQuality: "standard",
  imageGenSize: "2K",
  imageGenTimeout: 60000,
  autoReplyGroupVideo: false,
  allowedUsers: []  // QQ号白名单，空数组表示允许所有人
};

export function getConfig() {
  return currentConfig;
}

export function setConfig(config) {
  currentConfig = config;
}

export async function saveConfig(ctx, config) {
  currentConfig = config;
  if (ctx && ctx.configPath) {
    try {
      const configPath = ctx.configPath;
      const configDir = path.dirname(configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
    } catch (e) {
      throw e;
    }
  }
}

export async function loadConfig(ctx) {
  if (ctx && ctx.configPath) {
    try {
      const configPath = ctx.configPath;
      if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, "utf-8");
        const savedConfig = JSON.parse(configData);
        // 合并保存的配置和默认配置，确保新增的配置项有默认值
        currentConfig = { ...currentConfig, ...savedConfig };
        return currentConfig;
      }
    } catch (e) {
      console.error("加载配置失败:", e);
      // 如果加载失败，使用默认配置
    }
  }
  return currentConfig;
}
