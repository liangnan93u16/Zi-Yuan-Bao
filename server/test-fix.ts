/**
 * 修复资源描述中的Markdown格式
 * 
 * 这个脚本用于修复资源ID 107的描述格式
 */

import { db } from './db';
import { resources } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { fixMarkdownContent } from './html-to-markdown';

async function fixResource107() {
  try {
    console.log("开始修复资源ID 107的描述...");
    
    // 获取资源107
    const [resource] = await db
      .select()
      .from(resources)
      .where(eq(resources.id, 107));
    
    if (!resource) {
      console.error("未找到资源ID 107");
      return;
    }
    
    console.log("原始描述:", resource.description);
    
    // 使用修复函数处理描述内容
    const fixedDescription = fixMarkdownContent(resource.description || '');
    console.log("修复后的描述:", fixedDescription);
    
    // 更新资源描述
    await db
      .update(resources)
      .set({ 
        description: fixedDescription,
        updated_at: new Date()
      })
      .where(eq(resources.id, 107));
    
    console.log("已成功修复资源ID 107的描述");
  } catch (error) {
    console.error("修复资源时出错:", error);
  }
}

// 执行修复
fixResource107().then(() => {
  console.log("修复脚本执行完成");
  process.exit(0);
}).catch(error => {
  console.error("运行修复脚本时出错:", error);
  process.exit(1);
});