// 调试 Responses API 的正确格式

const config = {
  apiKey: "your-api-key-here", // 请替换为实际的API密钥
  responsesApiUrl: "https://ark.cn-beijing.volces.com/api/v3/responses",
  model: "doubao-seed-2-0-pro-260215"
};

async function testResponsesAPIFormat() {
  console.log("🔍 测试 Responses API 的正确格式...");
  
  if (config.apiKey === "your-api-key-here") {
    console.error("❌ 请先配置正确的API密钥！");
    return;
  }
  
  // 测试1: 纯文本输入
  console.log("\n=== 测试1: 纯文本输入 ===");
  await testTextOnly();
  
  // 测试2: 带文件ID的视频输入（需要先上传文件）
  console.log("\n=== 测试2: 文件ID视频输入 ===");
  console.log("注意: 需要先通过Files API上传视频文件获取file_id");
  
  // 测试3: 检查API文档中的示例格式
  console.log("\n=== 测试3: 官方文档格式 ===");
  await testOfficialFormat();
}

async function testTextOnly() {
  const requestBody = {
    model: config.model,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: "你好，这是一个Responses API的测试。"
          }
        ]
      }
    ],
    max_output_tokens: 100
  };
  
  try {
    console.log("发送请求:", JSON.stringify(requestBody, null, 2));
    
    const response = await fetch(config.responsesApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log(`响应状态: ${response.status} ${response.statusText}`);
    
    const data = await response.json();
    console.log("响应数据:", JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log("✅ 纯文本测试成功！");
    } else {
      console.log("❌ 纯文本测试失败");
    }
  } catch (error) {
    console.error("❌ 纯文本测试出错:", error.message);
  }
}

async function testOfficialFormat() {
  // 根据官方文档的格式
  const requestBody = {
    model: config.model,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: "请你描述下这个测试请求的格式是否正确。"
          }
        ]
      }
    ]
  };
  
  try {
    console.log("官方格式请求:", JSON.stringify(requestBody, null, 2));
    
    const response = await fetch(config.responsesApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log(`响应状态: ${response.status} ${response.statusText}`);
    
    const data = await response.json();
    console.log("响应数据:", JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log("✅ 官方格式测试成功！");
      
      // 分析响应格式
      if (data.output) {
        console.log("响应输出格式:");
        console.log("- output类型:", typeof data.output);
        console.log("- output是数组:", Array.isArray(data.output));
        if (Array.isArray(data.output) && data.output.length > 0) {
          console.log("- 第一个输出项:", typeof data.output[0]);
          console.log("- 第一个输出项内容:", data.output[0]);
        }
      }
    } else {
      console.log("❌ 官方格式测试失败");
    }
  } catch (error) {
    console.error("❌ 官方格式测试出错:", error.message);
  }
}

async function testWithFileId(fileId) {
  console.log(`\n=== 测试文件ID: ${fileId} ===`);
  
  const requestBody = {
    model: config.model,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_video",
            file_id: fileId
          },
          {
            type: "input_text",
            text: "请分析这个视频的内容。"
          }
        ]
      }
    ]
  };
  
  try {
    console.log("文件ID请求:", JSON.stringify(requestBody, null, 2));
    
    const response = await fetch(config.responsesApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log(`响应状态: ${response.status} ${response.statusText}`);
    
    const data = await response.json();
    console.log("响应数据:", JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log("✅ 文件ID测试成功！");
    } else {
      console.log("❌ 文件ID测试失败");
    }
  } catch (error) {
    console.error("❌ 文件ID测试出错:", error.message);
  }
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
  testResponsesAPIFormat().catch(console.error);
}

module.exports = {
  testTextOnly,
  testOfficialFormat,
  testWithFileId,
  testResponsesAPIFormat
};