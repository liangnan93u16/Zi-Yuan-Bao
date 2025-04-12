/**
 * 修复资源描述中的Markdown格式
 * 
 * 这个脚本用于修复从菲菲资源导入到资源库时，
 * 描述字段中被错误包装为```markdown代码块的HTML内容
 */

import { db } from './db';
import { resources } from '@shared/schema';
import { eq, like } from 'drizzle-orm';
import { fixMarkdownContent } from './html-to-markdown';

/**
 * 主函数：扫描并修复资源描述中的Markdown格式
 */
export async function fixResourceDescriptions() {
  console.log('开始修复资源描述中的Markdown格式...');
  
  try {
    // 查找可能有问题的资源 (描述中包含```markdown的资源)
    const potentialProblematicResources = await db
      .select()
      .from(resources)
      .where(like(resources.description, '%```markdown%'));
    
    console.log(`找到 ${potentialProblematicResources.length} 个可能有问题的资源`);
    
    // 修复每个资源的描述
    for (const resource of potentialProblematicResources) {
      console.log(`正在修复资源 ID=${resource.id}, 标题="${resource.title}"`);
      
      // 使用修复函数处理描述内容
      const fixedDescription = fixMarkdownContent(resource.description || '');
      
      // 更新资源描述
      await db
        .update(resources)
        .set({ 
          description: fixedDescription,
          updated_at: new Date()
        })
        .where(eq(resources.id, resource.id));
      
      console.log(`已修复资源 ID=${resource.id} 的描述`);
    }
    
    console.log(`成功修复 ${potentialProblematicResources.length} 个资源的描述`);
    return {
      success: true,
      count: potentialProblematicResources.length,
      message: `成功修复 ${potentialProblematicResources.length} 个资源的描述`
    };
  } catch (error) {
    console.error('修复资源描述时出错:', error);
    return {
      success: false,
      count: 0,
      message: `修复资源描述时出错: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

// 如果直接运行此脚本，执行修复
// 检查是否是直接运行的脚本（ES模块版本）
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 如果是直接运行的脚本
if (import.meta.url === `file://${__filename}`) {
  fixResourceDescriptions()
    .then(result => {
      console.log(result.message);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('运行修复脚本时出错:', error);
      process.exit(1);
    });
}