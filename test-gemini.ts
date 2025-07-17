#!/usr/bin/env tsx

import { testGeminiCLI } from './server/gemini-cli.js';

// 运行 Gemini CLI 测试
async function main() {
    try {
        await testGeminiCLI();
    } catch (error) {
        console.error('测试失败:', error);
        process.exit(1);
    }
}

main();