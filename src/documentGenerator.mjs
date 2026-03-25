// 文档生成模块
import XLSX from 'xlsx';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, WidthType, BorderStyle } from 'docx';
import fs from 'fs';
import path from 'path';

// 检测是否为文档生成请求
export function isDocumentGenerationRequest(messageContent) {
  if (!Array.isArray(messageContent)) {
    return false;
  }
  
  const textContent = messageContent
    .filter(item => item.type === "text")
    .map(item => item.text)
    .join(" ")
    .toLowerCase();
  
  // 文档生成关键词（只匹配明确的生成意图，避免误触发）
  const documentKeywords = [
    // Excel相关 - 必须有明确的生成动作
    '生成excel', '导出excel', '制作excel', '做成excel', '保存为excel', '输出excel', '整理成excel',
    '生成xlsx', '导出xlsx', '生成xls', '导出xls',
    '用excel', '以excel', '发excel', '发个excel', '发一个excel',
    
    // Word相关 - 必须有明确的生成动作
    '生成word', '导出word', '制作word', '做成word', '保存为word', '输出word', '整理成word',
    '生成docx', '导出docx', '生成doc', '导出doc',
    '用word', '以word', '发word', '发个word',
    
    // 通用表达 - 必须同时包含生成动作和文件类型
    '发送文件', '发送表格文件', '发送文档文件',
    '发给我excel', '发给我表格', '发给我文件',
    '用表格发', '用文件发', '整理成表格发', '整理后发'
  ];
  
  // 检查关键词匹配
  const hasKeywords = documentKeywords.some(keyword => 
    textContent.includes(keyword)
  );
  
  // 检查文档生成的句式模式（必须同时包含生成动作和明确的文件类型）
  const documentPatterns = [
    /(整理|导出|生成|制作|保存)(成|为|成为).*(excel|xlsx|xls|word|docx)/,
    /(帮我|请).*(整理|导出|生成|制作).*(excel|xlsx|xls|word|docx)/,
    /.*(数据|内容|信息).*(整理|导出|生成).*(excel|xlsx|xls|word|docx)/,
    /发送.*(excel|xlsx|xls|word|docx).*(文件|表格|文档)/,
    // 自然语言：整理出...用excel/表格发给我
    /(整理|提取|汇总|统计).*(用|以|发|生成).*(excel|xlsx|表格|文件)/,
    /(用|以).*(excel|xlsx|表格|文件).*(发|给|回复)/,
    /(excel|xlsx|表格|文件).*(发|给|回复|发给)/,
  ];
  
  const hasPatterns = documentPatterns.some(pattern => 
    pattern.test(textContent)
  );
  
  return hasKeywords || hasPatterns;
}

// 检测文档类型
export function detectDocumentType(messageContent) {
  if (!Array.isArray(messageContent)) {
    return null;
  }
  
  const textContent = messageContent
    .filter(item => item.type === "text")
    .map(item => item.text)
    .join(" ")
    .toLowerCase();
  
  // 先检查是否是文档生成请求
  if (!isDocumentGenerationRequest(messageContent)) {
    return null;
  }
  
  // Excel关键词
  const excelKeywords = ['excel', 'xlsx', 'xls', '生成表格', '导出表格', '制作表格'];
  const wordKeywords = ['word', 'docx', 'doc', 'word文档'];
  
  const hasExcelKeywords = excelKeywords.some(keyword => textContent.includes(keyword));
  const hasWordKeywords = wordKeywords.some(keyword => textContent.includes(keyword));
  
  if (hasExcelKeywords) {
    return 'excel';
  } else if (hasWordKeywords) {
    return 'word';
  } else {
    // 默认根据内容类型判断
    // 如果包含数字、表格数据等，优先Excel
    if (textContent.includes('数据') || textContent.includes('统计') || textContent.includes('列表')) {
      return 'excel';
    } else {
      return 'word';
    }
  }
}

// 生成Excel文档
export async function generateExcelDocument(data, filename, logger) {
  try {
    // 解析数据结构
    let worksheetData;
    
    if (typeof data === 'string') {
      // 如果是字符串，尝试解析为表格数据
      worksheetData = parseTextToTableData(data);
    } else if (Array.isArray(data)) {
      // 如果是数组，直接使用
      worksheetData = data;
    } else if (typeof data === 'object') {
      // 如果是对象，转换为键值对
      worksheetData = Object.entries(data).map(([key, value]) => [key, value]);
    } else {
      throw new Error('不支持的数据格式');
    }
    
    // 创建工作簿
    const workbook = XLSX.utils.book_new();
    
    // 创建工作表
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    
    // 添加工作表到工作簿
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    
    // 生成文件路径
    const timestamp = Date.now();
    const safeFilename = filename.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
    const fileName = `${safeFilename}_${timestamp}.xlsx`;
    const tempDir = path.join(process.cwd(), 'cache');
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const filePath = path.join(tempDir, fileName);
    
    // 写入文件
    XLSX.writeFile(workbook, filePath);
    
    logger?.info(`Excel文档生成成功: ${filePath}`);
    
    return {
      success: true,
      filePath: filePath,
      fileName: fileName,
      type: 'excel'
    };
    
  } catch (error) {
    logger?.error('生成Excel文档失败:', error);
    return {
      success: false,
      message: `生成Excel文档失败: ${error.message}`
    };
  }
}

// 生成Word文档（真正的 .docx 格式）
export async function generateWordDocument(content, filename, logger) {
  try {
    const children = parseContentToDocxElements(content);

    const doc = new Document({
      sections: [{
        children
      }]
    });

    const timestamp = Date.now();
    const safeFilename = filename.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
    const fileName = `${safeFilename}_${timestamp}.docx`;
    const tempDir = path.join(process.cwd(), 'cache');

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const filePath = path.join(tempDir, fileName);
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(filePath, buffer);

    logger?.info(`Word文档生成成功: ${filePath}`);

    return {
      success: true,
      filePath,
      fileName,
      type: 'word'
    };
  } catch (error) {
    logger?.error('生成Word文档失败:', error);
    return {
      success: false,
      message: `生成Word文档失败: ${error.message}`
    };
  }
}

// 将 AI 返回的文本内容解析为 docx 元素
function parseContentToDocxElements(content) {
  if (typeof content !== 'string') {
    content = String(content);
  }

  const lines = content.split('\n');
  const elements = [];
  let tableBuffer = []; // 缓存 markdown 表格行

  const flushTable = () => {
    if (tableBuffer.length < 2) {
      // 不足以构成表格，当普通段落处理
      tableBuffer.forEach(line => {
        elements.push(new Paragraph({ children: [new TextRun(line.trim())] }));
      });
      tableBuffer = [];
      return;
    }

    // 过滤掉分隔行（如 | --- | --- |）
    const dataRows = tableBuffer.filter(line => !/^\|[\s\-|:]+\|$/.test(line.trim()));

    const rows = dataRows.map((line, rowIndex) => {
      const cells = line.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
      return new TableRow({
        children: cells.map(cellText => new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: cellText, bold: rowIndex === 0 })]
          })],
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1 },
            bottom: { style: BorderStyle.SINGLE, size: 1 },
            left: { style: BorderStyle.SINGLE, size: 1 },
            right: { style: BorderStyle.SINGLE, size: 1 }
          }
        }))
      });
    });

    if (rows.length > 0) {
      elements.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows
      }));
    }

    tableBuffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // 检测 markdown 表格行
    if (/^\|.+\|$/.test(line.trim())) {
      tableBuffer.push(line);
      continue;
    } else if (tableBuffer.length > 0) {
      flushTable();
    }

    if (!line.trim()) {
      elements.push(new Paragraph({}));
      continue;
    }

    // 标题
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingMap = [
        HeadingLevel.HEADING_1,
        HeadingLevel.HEADING_2,
        HeadingLevel.HEADING_3,
        HeadingLevel.HEADING_4,
        HeadingLevel.HEADING_5,
        HeadingLevel.HEADING_6
      ];
      elements.push(new Paragraph({
        heading: headingMap[level - 1],
        children: [new TextRun(headingMatch[2])]
      }));
      continue;
    }

    // 普通段落（支持 **bold** 简单解析）
    const runs = parseBoldText(line.trim());
    elements.push(new Paragraph({ children: runs }));
  }

  // 处理末尾残留的表格
  if (tableBuffer.length > 0) {
    flushTable();
  }

  return elements;
}

// 简单解析 **bold** 文本
function parseBoldText(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  return parts.map(part => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return new TextRun({ text: part.slice(2, -2), bold: true });
    }
    return new TextRun(part);
  });
}

// 解析文本为表格数据
function parseTextToTableData(text) {
  const lines = text.split('\n').filter(line => line.trim());
  const data = [];
  
  // 优先尝试CSV格式（AI输出的标准格式）
  const isCSV = lines.length > 1 && lines[0].includes(',');
  if (isCSV) {
    lines.forEach(line => {
      // 简单CSV解析，支持带引号的字段
      const row = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
          row.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      row.push(current.trim());
      if (row.some(cell => cell !== '')) data.push(row);
    });
    if (data.length > 0) return data;
  }
  
  // 尝试Markdown表格格式
  if (text.includes('|')) {
    lines.forEach(line => {
      if (/^\|[\s\-|:]+\|$/.test(line.trim())) return; // 跳过分隔行
      if (line.includes('|')) {
        const row = line.split('|').map(cell => cell.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
        if (row.length > 0) data.push(row);
      }
    });
    if (data.length > 0) return data;
  }
  
  // Tab分隔
  if (text.includes('\t')) {
    lines.forEach(line => {
      const row = line.split('\t').map(cell => cell.trim());
      if (row.some(cell => cell !== '')) data.push(row);
    });
    if (data.length > 0) return data;
  }
  
  // 键值对格式
  const headers = ['项目', '内容'];
  data.push(headers);
  lines.forEach((line, index) => {
    if (line.includes(':') || line.includes('：')) {
      const parts = line.split(/[:：]/, 2);
      data.push([parts[0].trim(), parts[1]?.trim() || '']);
    } else {
      data.push([`项目${index + 1}`, line.trim()]);
    }
  });
  
  return data;
}

