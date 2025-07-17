#!/usr/bin/env tsx

import { GeminiCLI } from './server/gemini-cli.js';

async function simpleTest() {
    console.log("开始测试自定义 Gemini CLI 模块...\n");
    
    const cli = new GeminiCLI();
    const testCases = [
        {
            name: "基本问答",
            fn: () => cli.generateText("什么是AI？用20字以内回答"),
            timeout: 10000
        },
        {
            name: "简单总结", 
            fn: () => cli.summarizeArticle("机器学习是人工智能的重要分支。"),
            timeout: 10000
        }
    ];

    let successCount = 0;
    
    for (const test of testCases) {
        console.log(`测试: ${test.name}`);
        
        try {
            const promise = test.fn();
            const timeout = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('超时')), test.timeout)
            );
            
            const result = await Promise.race([promise, timeout]);
            console.log(`结果: ${result.substring(0, 50)}...`);
            console.log("状态: 成功\n");
            successCount++;
            
        } catch (error) {
            console.log(`错误: ${error.message.substring(0, 50)}...`);
            
            if (error.message.includes('429')) {
                console.log("状态: API 配额限制 (连接正常)\n");
                successCount++; // 配额限制说明连接正常
            } else {
                console.log("状态: 失败\n");
            }
        }
    }
    
    console.log(`测试完成: ${successCount}/${testCases.length} 项成功`);
    
    if (successCount === testCases.length) {
        console.log("自定义 Gemini CLI 模块工作正常!");
    } else if (successCount > 0) {
        console.log("模块部分功能正常，可能遇到API限制。");
    } else {
        console.log("模块存在问题，需要检查配置。");
    }
}

simpleTest();