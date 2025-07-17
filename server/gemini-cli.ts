import * as fs from "fs";
import { GoogleGenAI, Modality } from "@google/genai";

// 初始化 Gemini AI 客户端
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export class GeminiCLI {
    private model: string;

    constructor(model: string = "gemini-2.5-flash") {
        this.model = model;
    }

    // 基本文本生成
    async generateText(prompt: string): Promise<string> {
        try {
            const response = await ai.models.generateContent({
                model: this.model,
                contents: prompt,
            });

            return response.text || "生成失败";
        } catch (error) {
            throw new Error(`文本生成失败: ${error}`);
        }
    }

    // 总结文章
    async summarizeArticle(text: string): Promise<string> {
        const prompt = `请简洁地总结以下文本，保留关键要点：\n\n${text}`;

        try {
            const response = await ai.models.generateContent({
                model: this.model,
                contents: prompt,
            });

            return response.text || "总结失败";
        } catch (error) {
            throw new Error(`文章总结失败: ${error}`);
        }
    }

    // 情感分析
    async analyzeSentiment(text: string): Promise<{ rating: number; confidence: number; explanation: string }> {
        try {
            const systemPrompt = `你是一个情感分析专家。
分析文本的情感并提供：
1. 评分（1-5星，1为非常负面，5为非常正面）
2. 置信度（0-1之间）
3. 简短解释

请以JSON格式回复：
{'rating': number, 'confidence': number, 'explanation': string}`;

            const response = await ai.models.generateContent({
                model: "gemini-2.5-pro",
                config: {
                    systemInstruction: systemPrompt,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "object",
                        properties: {
                            rating: { type: "number" },
                            confidence: { type: "number" },
                            explanation: { type: "string" },
                        },
                        required: ["rating", "confidence", "explanation"],
                    },
                },
                contents: text,
            });

            const rawJson = response.text;
            if (rawJson) {
                const data = JSON.parse(rawJson);
                return data;
            } else {
                throw new Error("响应为空");
            }
        } catch (error) {
            throw new Error(`情感分析失败: ${error}`);
        }
    }

    // 图片分析
    async analyzeImage(imagePath: string): Promise<string> {
        try {
            if (!fs.existsSync(imagePath)) {
                throw new Error(`图片文件不存在: ${imagePath}`);
            }

            const imageBytes = fs.readFileSync(imagePath);
            const mimeType = imagePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

            const contents = [
                {
                    inlineData: {
                        data: imageBytes.toString("base64"),
                        mimeType: mimeType,
                    },
                },
                `请详细分析这张图片，描述其关键元素、内容、风格和任何值得注意的方面。`,
            ];

            const response = await ai.models.generateContent({
                model: "gemini-2.5-pro",
                contents: contents,
            });

            return response.text || "图片分析失败";
        } catch (error) {
            throw new Error(`图片分析失败: ${error}`);
        }
    }

    // 生成图片
    async generateImage(prompt: string, outputPath: string): Promise<void> {
        try {
            const response = await ai.models.generateContent({
                model: "gemini-2.0-flash-preview-image-generation",
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                config: {
                    responseModalities: [Modality.TEXT, Modality.IMAGE],
                },
            });

            const candidates = response.candidates;
            if (!candidates || candidates.length === 0) {
                throw new Error("未生成任何候选结果");
            }

            const content = candidates[0].content;
            if (!content || !content.parts) {
                throw new Error("响应内容为空");
            }

            let imageGenerated = false;
            for (const part of content.parts) {
                if (part.text) {
                    console.log(`生成描述: ${part.text}`);
                } else if (part.inlineData && part.inlineData.data) {
                    const imageData = Buffer.from(part.inlineData.data, "base64");
                    fs.writeFileSync(outputPath, imageData);
                    console.log(`图片已保存到: ${outputPath}`);
                    imageGenerated = true;
                }
            }

            if (!imageGenerated) {
                throw new Error("未生成图片数据");
            }
        } catch (error) {
            throw new Error(`图片生成失败: ${error}`);
        }
    }

    // 翻译文本
    async translateText(text: string, targetLanguage: string = "中文"): Promise<string> {
        const prompt = `请将以下文本翻译成${targetLanguage}：\n\n${text}`;

        try {
            const response = await ai.models.generateContent({
                model: this.model,
                contents: prompt,
            });

            return response.text || "翻译失败";
        } catch (error) {
            throw new Error(`翻译失败: ${error}`);
        }
    }

    // 代码解释
    async explainCode(code: string, language: string = "JavaScript"): Promise<string> {
        const prompt = `请解释以下${language}代码的功能和工作原理：\n\n\`\`\`${language.toLowerCase()}\n${code}\n\`\`\``;

        try {
            const response = await ai.models.generateContent({
                model: this.model,
                contents: prompt,
            });

            return response.text || "代码解释失败";
        } catch (error) {
            throw new Error(`代码解释失败: ${error}`);
        }
    }

    // 问答对话
    async chat(message: string, context: string = ""): Promise<string> {
        const prompt = context ? `${context}\n\n用户问题: ${message}` : message;

        try {
            const response = await ai.models.generateContent({
                model: this.model,
                contents: prompt,
            });

            return response.text || "回复失败";
        } catch (error) {
            throw new Error(`对话失败: ${error}`);
        }
    }
}

// CLI 测试函数
export async function testGeminiCLI(): Promise<void> {
    console.log("🚀 开始测试 Gemini CLI...\n");
    
    const cli = new GeminiCLI();

    try {
        // 测试 1: 基本文本生成
        console.log("📝 测试 1: 基本文本生成");
        const textResult = await cli.generateText("用简单的话解释什么是人工智能");
        console.log("结果:", textResult.substring(0, 100) + "...\n");

        // 测试 2: 文章总结
        console.log("📄 测试 2: 文章总结");
        const article = "人工智能（AI）是计算机科学的一个分支，致力于创造能够执行通常需要人类智能的任务的机器。这包括学习、推理、问题解决、感知和语言理解。AI技术已经广泛应用于各个领域，包括医疗保健、金融、交通和娱乐。机器学习是AI的一个重要子领域，它使计算机能够从数据中学习而无需明确编程。深度学习是机器学习的一个更专门的分支，使用神经网络来模拟人脑的工作方式。";
        const summary = await cli.summarizeArticle(article);
        console.log("总结:", summary, "\n");

        // 测试 3: 情感分析
        console.log("😊 测试 3: 情感分析");
        const sentimentText = "我今天非常开心！新的项目进展顺利，团队合作也很愉快。";
        const sentiment = await cli.analyzeSentiment(sentimentText);
        console.log("情感分析结果:", sentiment, "\n");

        // 测试 4: 翻译
        console.log("🌐 测试 4: 翻译");
        const translation = await cli.translateText("Hello, how are you today?", "中文");
        console.log("翻译结果:", translation, "\n");

        // 测试 5: 代码解释
        console.log("💻 测试 5: 代码解释");
        const code = `
        function fibonacci(n) {
            if (n <= 1) return n;
            return fibonacci(n - 1) + fibonacci(n - 2);
        }
        `;
        const codeExplanation = await cli.explainCode(code, "JavaScript");
        console.log("代码解释:", codeExplanation.substring(0, 150) + "...\n");

        // 测试 6: 对话
        console.log("💬 测试 6: 对话");
        const chatResponse = await cli.chat("什么是最好的学习编程的方法？");
        console.log("对话回复:", chatResponse.substring(0, 150) + "...\n");

        console.log("✅ 所有测试完成！Gemini CLI 工作正常。");

    } catch (error) {
        console.error("❌ 测试失败:", error);
        throw error;
    }
}