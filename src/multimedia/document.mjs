// 文档处理模块
import fs from 'fs';
import path from 'path';
import { getConfig } from '../config.mjs';
import { parseCQParams, tryGetLocalFile } from '../utils.mjs';

// 动态导入Office文档解析库
let mammoth = null;
let XLSX = null;
let pdfParse = null;

// 初始化解析库
async function initParsers() {
  try {
    if (!mammoth) {
      mammoth = (await import('mammoth')).default;
    }
    if (!XLSX) {
      XLSX = (await import('xlsx')).default;
    }
    if (!pdfParse) {
      pdfParse = (await import('pdf-parse')).default;
    }
  } catch (error) {
    // 如果导入失败，解析器保持null，会使用基础处理
  }
}

// 通过file_id下载文件
async function downloadFileById(fileId, fileName, logger) {
  try {
    // 这里需要调用NapCat的文件下载API
    // 由于我们在插件环境中，需要通过ctx.actions来调用
    // 暂时返回null，需要在调用处传入ctx参数
    logger?.warn(`需要通过file_id下载文件: ${fileId}`);
    return null;
  } catch (error) {
    logger?.error('下载文件失败:', error);
    return null;
  }
}

// 通过NapCat API下载文件
async function downloadFileViaAPI(fileId, fileName, ctx, logger) {
  try {
    if (!ctx || !ctx.actions) {
      logger?.error('缺少ctx参数，无法调用文件下载API');
      return null;
    }

    // 调用get_file API获取文件信息和下载链接
    logger?.info(`调用get_file API，file_id: ${fileId}`);
    const fileInfo = await ctx.actions.call('get_file', { file_id: fileId });
    
    if (!fileInfo || !fileInfo.file) {
      logger?.error('获取文件信息失败，返回数据:', fileInfo);
      return null;
    }

    const filePath = fileInfo.file;
    logger?.info(`获取到文件路径: ${filePath}`);

    // 检查是否是本地文件路径
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      // 如果是HTTP URL，使用fetch下载
      logger?.info('检测到HTTP URL，使用fetch下载');
      return await downloadFromURL(filePath, fileName, logger);
    } else {
      // 如果是本地路径，直接读取文件
      logger?.info('检测到本地文件路径，直接读取');
      const result = await readLocalFile(filePath, fileName, logger);
      
      // 标记这是已经处理过的内容，避免重复处理
      if (result && typeof result === 'string') {
        return {
          type: 'processed_content',
          content: result
        };
      }
      return result;
    }

  } catch (error) {
    logger?.error('通过API获取文件失败:', error);
    return null;
  }
}

// 从URL下载文件
async function downloadFromURL(fileUrl, fileName, logger) {
  try {
    const response = await fetch(fileUrl);
    if (!response.ok) {
      logger?.error(`下载文件失败: ${response.status} ${response.statusText}`);
      return null;
    }

    return await processResponseBuffer(response, fileName, logger);
  } catch (error) {
    logger?.error('从URL下载文件失败:', error);
    return null;
  }
}

// 读取本地文件
async function readLocalFile(filePath, fileName, logger) {
  try {
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      logger?.error(`本地文件不存在: ${filePath}`);
      return null;
    }

    // 获取文件扩展名以判断处理方式
    const ext = path.extname(fileName).toLowerCase().substring(1);
    
    // 对于Office文档和PDF，直接使用对应的处理器
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'pdf'].includes(ext)) {
      logger?.info(`检测到Office/PDF文档，使用专用处理器: ${ext}`);
      const processor = DOCUMENT_PROCESSORS[ext];
      return await processor(filePath, logger);
    }
    
    // 对于文本文件，尝试不同的编码
    if (DOCUMENT_PROCESSORS[ext] === processTextFile) {
      const buffer = fs.readFileSync(filePath);
      
      // 尝试UTF-8编码
      try {
        const content = buffer.toString('utf-8');
        // 检查是否有无效字符（简单检测）
        if (content.includes('\uFFFD')) {
          throw new Error('UTF-8 decode failed');
        }
        logger?.info(`成功使用UTF-8读取本地文件，大小: ${buffer.length} bytes`);
        return content;
      } catch (utf8Error) {
        logger?.warn('UTF-8读取失败，尝试其他编码');
        
        try {
          const content = buffer.toString('latin1'); // 临时方案
          logger?.info(`使用latin1编码读取本地文件，大小: ${buffer.length} bytes`);
          return content;
        } catch (error) {
          logger?.warn('编码转换失败，使用原始buffer');
          const content = buffer.toString('utf-8', 0, Math.min(buffer.length, 1024 * 1024)); // 限制1MB
          return content;
        }
      }
    } else {
      // 对于其他文件类型，使用默认处理
      const content = fs.readFileSync(filePath, 'utf-8');
      logger?.info(`成功读取本地文件，大小: ${content.length} 字符`);
      return content;
    }

  } catch (error) {
    logger?.error('读取本地文件失败:', error);
    return null;
  }
}

// 处理响应缓冲区
async function processResponseBuffer(response, fileName, logger) {
  try {
    const ext = path.extname(fileName).toLowerCase().substring(1);
    
    // 对于文本文件，尝试不同的编码
    if (DOCUMENT_PROCESSORS[ext] === processTextFile) {
      const buffer = await response.arrayBuffer();
      
      // 尝试UTF-8编码
      try {
        const content = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
        logger?.info(`成功使用UTF-8解码文件，大小: ${buffer.byteLength} bytes`);
        return content;
      } catch (utf8Error) {
        logger?.warn('UTF-8解码失败，尝试其他编码');
        // 强制使用UTF-8，忽略错误字符
        const content = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
        logger?.info(`使用UTF-8容错解码文件，大小: ${buffer.byteLength} bytes`);
        return content;
      }
    } else {
      // 对于其他文件类型，使用默认处理
      const buffer = await response.arrayBuffer();
      const content = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
      logger?.info(`成功下载文件，大小: ${buffer.byteLength} bytes`);
      return content;
    }
  } catch (error) {
    logger?.error('处理响应缓冲区失败:', error);
    return null;
  }
}

// 支持的文档格式及其处理方法
const DOCUMENT_PROCESSORS = {
  // 纯文本文件
  'txt': processTextFile,
  'md': processTextFile,
  'json': processTextFile,
  'xml': processTextFile,
  'csv': processTextFile,
  'log': processTextFile,
  'ini': processTextFile,
  'cfg': processTextFile,
  'conf': processTextFile,
  
  // 代码文件
  'js': processTextFile,
  'mjs': processTextFile,
  'ts': processTextFile,
  'py': processTextFile,
  'java': processTextFile,
  'cpp': processTextFile,
  'c': processTextFile,
  'h': processTextFile,
  'css': processTextFile,
  'html': processTextFile,
  'php': processTextFile,
  'go': processTextFile,
  'rs': processTextFile,
  'sh': processTextFile,
  'bat': processTextFile,
  'ps1': processTextFile,
  
  // 配置文件
  'yaml': processTextFile,
  'yml': processTextFile,
  'toml': processTextFile,
  'properties': processTextFile,
  
  // 其他文档格式
  'pdf': processPDFFile,
  'doc': processWordFile,
  'docx': processWordFile,
  'xls': processExcelFile,
  'xlsx': processExcelFile,
  'ppt': processPowerPointFile,
  'pptx': processPowerPointFile
};

// 处理纯文本文件
async function processTextFile(filePath, logger) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const config = getConfig();
    
    // 限制文件大小（默认1MB）
    const maxSize = config.maxDocumentSize || 1024 * 1024;
    if (content.length > maxSize) {
      const truncated = content.substring(0, maxSize);
      logger?.warn(`文档内容过长，已截取前 ${maxSize} 字符`);
      return `${truncated}\n\n[文档内容过长，已截取显示]`;
    }
    
    return content;
  } catch (error) {
    logger?.error('读取文本文件失败:', error);
    return null;
  }
}

// 处理PDF文件
async function processPDFFile(filePath, logger) {
  try {
    await initParsers();
    
    if (!pdfParse) {
      logger?.warn('PDF解析库未安装，返回基础信息');
      const stats = fs.statSync(filePath);
      return `[PDF文档] 文件大小: ${Math.round(stats.size / 1024)}KB\n注意：PDF内容解析功能需要安装pdf-parse库。`;
    }

    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      logger?.error(`PDF文档文件不存在: ${filePath}`);
      return `[PDF文档文件不存在: ${path.basename(filePath)}]`;
    }

    // 检查文件是否为空
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      logger?.error(`PDF文档文件为空: ${filePath}`);
      return `[PDF文档文件为空: ${path.basename(filePath)}]`;
    }

    let dataBuffer;
    try {
      dataBuffer = fs.readFileSync(filePath);
    } catch (readError) {
      logger?.error(`读取PDF文件失败: ${readError.message}`);
      return `[PDF文档读取失败] 文件: ${path.basename(filePath)}\n错误: ${readError.message}`;
    }

    // 验证PDF文件头
    if (dataBuffer.length < 4 || !dataBuffer.subarray(0, 4).equals(Buffer.from('%PDF'))) {
      logger?.error(`不是有效的PDF文件: ${filePath}`);
      return `[PDF文档格式错误] 文件: ${path.basename(filePath)}\n该文件不是有效的PDF格式`;
    }

    let data;
    try {
      data = await pdfParse(dataBuffer);
    } catch (parseError) {
      logger?.error(`PDF解析失败: ${parseError.message}`);
      return `[PDF文档解析失败] 文件: ${path.basename(filePath)}, 大小: ${Math.round(stats.size / 1024)}KB\n错误: ${parseError.message}\n\n建议：该PDF可能已损坏、加密或使用了不支持的格式。`;
    }
    
    if (!data.text || data.text.trim().length === 0) {
      logger?.warn(`PDF文档无文本内容或为图片PDF: ${filePath}`);
      return `[PDF文档] 文件: ${path.basename(filePath)}, 大小: ${Math.round(stats.size / 1024)}KB\n该PDF文档可能是扫描版或图片PDF，无法提取文本内容。如需处理图片PDF，请使用OCR功能。`;
    }
    
    logger?.info(`成功解析PDF文件，提取文本长度: ${data.text.length} 字符`);
    return data.text;
    
  } catch (error) {
    logger?.error('解析PDF文件失败:', error);
    try {
      const stats = fs.statSync(filePath);
      return `[PDF文档解析失败] 文件: ${path.basename(filePath)}, 大小: ${Math.round(stats.size / 1024)}KB\n错误: ${error.message}`;
    } catch (statError) {
      return `[PDF文档处理失败] 文件: ${path.basename(filePath)}\n错误: ${error.message}`;
    }
  }
}

// 处理Word文档
async function processWordFile(filePath, logger) {
  try {
    await initParsers();
    
    if (!mammoth) {
      logger?.warn('Word解析库未安装，返回基础信息');
      const stats = fs.statSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const docType = ext === '.docx' ? 'Word文档(DOCX)' : 'Word文档(DOC)';
      return `[${docType}] 文件大小: ${Math.round(stats.size / 1024)}KB\n注意：Word文档内容解析功能需要安装mammoth库。`;
    }

    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      logger?.error(`Word文档文件不存在: ${filePath}`);
      return `[Word文档文件不存在: ${path.basename(filePath)}]`;
    }

    // 检查文件是否为空或损坏
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      logger?.error(`Word文档文件为空: ${filePath}`);
      return `[Word文档文件为空: ${path.basename(filePath)}]`;
    }

    // 对于DOCX文件，先验证是否为有效的ZIP文件
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.docx') {
      try {
        // 读取文件头部，检查ZIP文件签名
        const buffer = fs.readFileSync(filePath);
        const zipSignature = buffer.subarray(0, 4);
        const validZipSignatures = [
          Buffer.from([0x50, 0x4B, 0x03, 0x04]), // 标准ZIP
          Buffer.from([0x50, 0x4B, 0x05, 0x06]), // 空ZIP
          Buffer.from([0x50, 0x4B, 0x07, 0x08])  // 跨卷ZIP
        ];
        
        const isValidZip = validZipSignatures.some(sig => zipSignature.equals(sig));
        if (!isValidZip) {
          logger?.error(`DOCX文件不是有效的ZIP格式: ${filePath}`);
          return `[DOCX文件格式错误] 文件: ${path.basename(filePath)}\n该文件不是有效的DOCX格式（ZIP压缩包）`;
        }
        
        logger?.info(`DOCX文件ZIP格式验证通过: ${filePath}`);
      } catch (zipError) {
        logger?.error(`DOCX文件格式验证失败: ${zipError.message}`);
        return `[DOCX文件格式验证失败] 文件: ${path.basename(filePath)}\n错误: ${zipError.message}`;
      }
    }

    // 使用mammoth解析文档
    let result;
    try {
      result = await mammoth.extractRawText({ path: filePath });
    } catch (mammothError) {
      logger?.error(`Mammoth解析失败: ${mammothError.message}`);
      
      // 如果是DOCX文件且mammoth失败，尝试备用方案
      if (ext === '.docx') {
        logger?.info('尝试使用备用DOCX解析方案');
        try {
          // 读取文件为buffer，然后传递给mammoth
          const buffer = fs.readFileSync(filePath);
          result = await mammoth.extractRawText({ buffer: buffer });
          logger?.info('备用DOCX解析方案成功');
        } catch (bufferError) {
          logger?.error(`备用DOCX解析也失败: ${bufferError.message}`);
          throw mammothError; // 抛出原始错误
        }
      } else {
        throw mammothError;
      }
    }
    
    if (result.messages && result.messages.length > 0) {
      logger?.warn('Word文档解析警告:', result.messages);
    }
    
    logger?.info(`成功解析Word文档，提取文本长度: ${result.value.length} 字符`);
    return result.value;
    
  } catch (error) {
    logger?.error('解析Word文档失败:', error);
    
    // 尝试获取文件信息作为备用
    try {
      const stats = fs.statSync(filePath);
      return `[Word文档解析失败] 文件: ${path.basename(filePath)}, 大小: ${Math.round(stats.size / 1024)}KB\n错误: ${error.message}\n\n建议：请确保文件是有效的Word文档格式，或尝试重新保存文件。`;
    } catch (statError) {
      return `[Word文档处理失败] 文件: ${path.basename(filePath)}\n错误: ${error.message}`;
    }
  }
}

// 处理Excel文档
async function processExcelFile(filePath, logger) {
  try {
    await initParsers();
    
    if (!XLSX) {
      logger?.warn('Excel解析库未安装，返回基础信息');
      const stats = fs.statSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const docType = ext === '.xlsx' ? 'Excel表格(XLSX)' : 'Excel表格(XLS)';
      return `[${docType}] 文件大小: ${Math.round(stats.size / 1024)}KB\n注意：Excel文档内容解析功能需要安装xlsx库。`;
    }

    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      logger?.error(`Excel文档文件不存在: ${filePath}`);
      return `[Excel文档文件不存在: ${path.basename(filePath)}]`;
    }

    // 检查文件是否为空
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      logger?.error(`Excel文档文件为空: ${filePath}`);
      return `[Excel文档文件为空: ${path.basename(filePath)}]`;
    }

    let workbook;
    try {
      workbook = XLSX.readFile(filePath);
    } catch (xlsxError) {
      logger?.error(`XLSX解析失败: ${xlsxError.message}`);
      return `[Excel文档解析失败] 文件: ${path.basename(filePath)}, 大小: ${Math.round(stats.size / 1024)}KB\n错误: ${xlsxError.message}\n\n建议：请确保文件是有效的Excel格式，或尝试重新保存文件。`;
    }
    
    let content = '';
    
    // 遍历所有工作表
    workbook.SheetNames.forEach((sheetName, index) => {
      try {
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) {
          logger?.warn(`工作表 ${sheetName} 为空，跳过`);
          return;
        }
        
        const sheetData = XLSX.utils.sheet_to_csv(worksheet);
        
        content += `\n=== 工作表 ${index + 1}: ${sheetName} ===\n`;
        content += sheetData;
        content += '\n';
      } catch (sheetError) {
        logger?.error(`处理工作表 ${sheetName} 失败:`, sheetError);
        content += `\n=== 工作表 ${index + 1}: ${sheetName} ===\n`;
        content += `[工作表处理失败: ${sheetError.message}]\n`;
      }
    });
    
    logger?.info(`成功解析Excel文档，工作表数: ${workbook.SheetNames.length}，内容长度: ${content.length} 字符`);
    return content;
    
  } catch (error) {
    logger?.error('解析Excel文档失败:', error);
    try {
      const stats = fs.statSync(filePath);
      return `[Excel文档解析失败] 文件: ${path.basename(filePath)}, 大小: ${Math.round(stats.size / 1024)}KB\n错误: ${error.message}`;
    } catch (statError) {
      return `[Excel文档处理失败] 文件: ${path.basename(filePath)}\n错误: ${error.message}`;
    }
  }
}

// 处理PowerPoint文档
async function processPowerPointFile(filePath, logger) {
  try {
    // PowerPoint解析比较复杂，暂时返回基础信息
    logger?.warn('PowerPoint文档解析功能暂未实现');
    const stats = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const docType = ext === '.pptx' ? 'PowerPoint演示(PPTX)' : 'PowerPoint演示(PPT)';
    return `[${docType}] 文件大小: ${Math.round(stats.size / 1024)}KB\n注意：PowerPoint文档内容解析功能正在开发中。`;
  } catch (error) {
    logger?.error('处理PowerPoint文档失败:', error);
    const stats = fs.statSync(filePath);
    return `[PowerPoint文档处理失败] 文件大小: ${Math.round(stats.size / 1024)}KB\n错误: ${error.message}`;
  }
}

// 主要的文档处理函数
export async function processCQFile(cqParams, logger, ctx = null) {
  try {
    const config = getConfig();
    
    if (!config.enableDocumentOCR) {
      logger?.info("文档处理功能已禁用");
      return "DOCUMENT_PROCESSING_DISABLED";
    }
    
    const params = parseCQParams(cqParams);
    logger?.info('解析文件CQ参数:', params);
    
    // 获取文件信息
    const fileName = params.file || params.name || '';
    const fileId = params.file_id || '';
    const fileSize = parseInt(params.file_size || '0');
    const fileUrl = params.url || '';
    
    if (!fileName && !fileUrl && !fileId) {
      logger?.warn('文件CQ码缺少必要参数');
      return null;
    }
    
    // 获取文件扩展名
    const ext = path.extname(fileName).toLowerCase().substring(1);
    
    // 检查是否支持该文件格式
    if (!DOCUMENT_PROCESSORS[ext]) {
      logger?.info(`不支持的文档格式: ${ext}`);
      return `[不支持的文档格式: ${ext}]`;
    }
    
    // 检查文件大小
    const maxFileSize = config.maxDocumentFileSize || 10 * 1024 * 1024; // 默认10MB
    
    if (fileSize > maxFileSize) {
      logger?.warn(`文档文件过大: ${Math.round(fileSize / 1024 / 1024)}MB`);
      return `[文档文件过大: ${Math.round(fileSize / 1024 / 1024)}MB，超过限制 ${Math.round(maxFileSize / 1024 / 1024)}MB]`;
    }
    
    let content = null;
    let actualFileSize = fileSize;
    
    // 优先尝试通过file_id下载文件
    if (fileId && ctx) {
      logger?.info(`尝试通过file_id下载文件: ${fileId}`);
      const result = await downloadFileViaAPI(fileId, fileName, ctx, logger);
      
      if (result) {
        if (result.type === 'processed_content') {
          // 已经处理过的内容，直接使用
          content = result.content;
          actualFileSize = Buffer.byteLength(content, 'utf8');
          logger?.info(`通过file_id成功获取已处理内容，大小: ${actualFileSize} bytes`);
        } else if (typeof result === 'string') {
          // 原始文本内容
          content = result;
          actualFileSize = Buffer.byteLength(content, 'utf8');
          logger?.info(`通过file_id成功获取文本内容，大小: ${actualFileSize} bytes`);
        } else {
          // 二进制数据，需要进一步处理
          content = result;
          actualFileSize = result.length || fileSize;
          logger?.info(`通过file_id获取二进制内容，大小: ${actualFileSize} bytes`);
        }
      }
    }
    
    // 如果file_id下载失败，尝试本地文件
    if (!content) {
      let filePath = null;
      
      // 首先尝试直接路径
      if (fileName && fs.existsSync(fileName)) {
        filePath = fileName;
      } else {
        // 尝试在常见位置查找文件
        filePath = await tryGetLocalFile(fileName, 'document');
      }
      
      if (!filePath) {
        logger?.warn(`无法找到文档文件: ${fileName}`);
        return `[无法访问文档: ${fileName}，请确保文件可访问或重新发送文件]`;
      }
      
      // 从本地文件处理内容
      try {
        const processor = DOCUMENT_PROCESSORS[ext];
        content = await processor(filePath, logger);
        const stats = fs.statSync(filePath);
        actualFileSize = stats.size;
        logger?.info(`通过本地文件处理完成，大小: ${actualFileSize} bytes`);
      } catch (error) {
        logger?.error('处理本地文件失败:', error);
        return `[无法处理文档内容: ${fileName}，错误: ${error.message}]`;
      }
    }
    
    if (!content) {
      return `[无法获取文档内容: ${fileName}]`;
    }
    
    // 如果内容是字符串，说明已经处理过了，直接使用
    if (typeof content === 'string') {
      // 检查内容大小限制
      const maxContentSize = config.maxDocumentSize || 1024 * 1024;
      if (content.length > maxContentSize) {
        content = content.substring(0, maxContentSize) + '\n\n[文档内容过长，已截取显示]';
        logger?.warn(`文档内容过长，已截取前 ${maxContentSize} 字符`);
      }
    } else {
      // 如果不是字符串，说明是二进制数据，需要处理
      logger?.error('收到非字符串内容，可能是处理逻辑错误');
      return `[文档内容格式错误: ${fileName}]`;
    }
    
    // 返回格式化的文档内容
    return {
      type: 'document',
      fileName: fileName,
      fileSize: actualFileSize,
      extension: ext,
      content: content
    };
    
  } catch (error) {
    logger?.error('处理文档时发生错误:', error);
    return `[处理文档时发生错误: ${error.message}]`;
  }
}

// 格式化文档内容用于AI分析
export function formatDocumentForAI(docResult) {
  if (typeof docResult === 'string') {
    return docResult; // 错误消息或简单文本
  }
  
  if (docResult.type === 'document') {
    const { fileName, fileSize, extension, content } = docResult;
    const sizeKB = Math.round(fileSize / 1024);
    
    return `📄 文档分析：${fileName}
文件类型：${extension.toUpperCase()}
文件大小：${sizeKB}KB

文档内容：
${content}

请分析上述文档内容并回答相关问题。`;
  }
  
  return '[文档格式错误]';
}