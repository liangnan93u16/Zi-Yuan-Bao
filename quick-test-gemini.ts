#!/usr/bin/env tsx

import { GeminiCLI } from './server/gemini-cli.js';

async function quickTest() {
    console.log("🚀 开始快速测试 Gemini CLI...\n");
    
    const cli = new GeminiCLI();

    try {
        // 只测试一个简单的文本生成
        console.log("📝 测试: 基本文本生成");
        const result = await cli.generateText("用一句话解释什么是AI");
        console.log("结果:", result);
        console.log("\n✅ 测试成功！Gemini CLI 工作正常。");
        
    } catch (error) {
        console.error("❌ 测试失败:", error);
        
        // 检查是否是配额限制错误
        if (error.message.includes('429') || error.message.includes('quota')) {
            console.log("\n💡 这是 API 配额限制，说明连接正常但达到了免费限制。");
            console.log("工具安装成功，等待配额恢复后即可正常使用。");
        }
    }
}

quickTest();