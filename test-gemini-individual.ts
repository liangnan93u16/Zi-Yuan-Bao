#!/usr/bin/env tsx

import { GeminiCLI } from './server/gemini-cli.js';

async function testIndividualFunctions() {
    console.log("🚀 开始分项测试 Gemini CLI 功能...\n");
    
    const cli = new GeminiCLI();
    const tests = [
        {
            name: "基本文本生成",
            test: () => cli.generateText("什么是机器学习？用一句话回答"),
        },
        {
            name: "文章总结",
            test: () => cli.summarizeArticle("人工智能是计算机科学的一个重要分支，它致力于创造能够执行通常需要人类智能的任务的机器和软件。"),
        },
        {
            name: "情感分析",
            test: () => cli.analyzeSentiment("今天天气真好，我很开心！"),
        },
        {
            name: "翻译功能",
            test: () => cli.translateText("Hello world", "中文"),
        },
        {
            name: "代码解释",
            test: () => cli.explainCode("console.log('Hello World');", "JavaScript"),
        }
    ];

    for (let i = 0; i < tests.length; i++) {
        const { name, test } = tests[i];
        console.log(`📝 测试 ${i + 1}: ${name}`);
        
        try {
            const result = await test();
            console.log("结果:", typeof result === 'string' ? result.substring(0, 100) + "..." : JSON.stringify(result));
            console.log("✅ 成功\n");
        } catch (error) {
            console.log("❌ 失败:", error.message.substring(0, 100) + "...");
            
            if (error.message.includes('429') || error.message.includes('quota')) {
                console.log("💡 API 配额限制 - 连接正常\n");
                break; // 如果遇到配额限制，停止后续测试
            } else {
                console.log("");
            }
        }
        
        // 添加延迟避免触发速率限制
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log("🎯 测试完成！");
}

testIndividualFunctions();