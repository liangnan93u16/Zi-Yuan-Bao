/**
 * 简单的HTML到Markdown转换工具
 * 
 * 这个文件提供一个基本的HTML到Markdown的转换函数，
 * 用于处理从菲菲资源导入到资源库时的数据转换
 */

/**
 * 将HTML内容转换为Markdown格式
 * @param html HTML内容
 * @returns Markdown格式的内容
 */
export function convertHtmlToMarkdown(html: string): string {
  if (!html) return '';
  
  let markdown = html;
  
  // 移除HTML注释
  markdown = markdown.replace(/<!--[\s\S]*?-->/g, '');
  
  // 移除空div和多余的div结束标签
  markdown = markdown.replace(/<\/?div[^>]*>/g, '');
  
  // 替换HTML标题标签
  markdown = markdown.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/g, '# $1\n\n');
  markdown = markdown.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/g, '## $1\n\n');
  markdown = markdown.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/g, '### $1\n\n');
  markdown = markdown.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/g, '#### $1\n\n');
  markdown = markdown.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/g, '##### $1\n\n');
  markdown = markdown.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/g, '###### $1\n\n');
  
  // 移除span标签但保留内容
  markdown = markdown.replace(/<span[^>]*>([\s\S]*?)<\/span>/g, '$1');
  
  // 替换段落标签
  markdown = markdown.replace(/<p[^>]*>([\s\S]*?)<\/p>/g, '$1\n\n');
  
  // 替换粗体标签
  markdown = markdown.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/g, '**$1**');
  markdown = markdown.replace(/<b[^>]*>([\s\S]*?)<\/b>/g, '**$1**');
  
  // 替换斜体标签
  markdown = markdown.replace(/<em[^>]*>([\s\S]*?)<\/em>/g, '*$1*');
  markdown = markdown.replace(/<i[^>]*>([\s\S]*?)<\/i>/g, '*$1*');
  
  // 替换链接
  markdown = markdown.replace(/<a[^>]*href=["'](.*?)["'][^>]*>([\s\S]*?)<\/a>/g, '[$2]($1)');
  
  // 替换图片
  markdown = markdown.replace(/<img[^>]*src=["'](.*?)["'][^>]*alt=["'](.*?)["'][^>]*\/?>/g, '![$2]($1)');
  markdown = markdown.replace(/<img[^>]*alt=["'](.*?)["'][^>]*src=["'](.*?)["'][^>]*\/?>/g, '![$1]($2)');
  markdown = markdown.replace(/<img[^>]*src=["'](.*?)["'][^>]*\/?>/g, '![]($1)');
  
  // 替换无序列表
  markdown = markdown.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/g, function(_match: string, content: string) {
    // 替换列表项
    return content.replace(/<li[^>]*>([\s\S]*?)<\/li>/g, '- $1\n');
  });
  
  // 替换有序列表
  markdown = markdown.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/g, function(_match: string, content: string) {
    let index = 1;
    // 替换列表项并添加序号
    return content.replace(/<li[^>]*>([\s\S]*?)<\/li>/g, function(_match: string, item: string) {
      return `${index++}. ${item}\n`;
    });
  });
  
  // 替换水平线
  markdown = markdown.replace(/<hr[^>]*\/?>/g, '---\n\n');
  
  // 替换引用
  markdown = markdown.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/g, function(_match: string, content: string) {
    // 在每一行前加上 >
    return content.split('\n').map((line: string) => `> ${line}`).join('\n') + '\n\n';
  });
  
  // 替换换行标签
  markdown = markdown.replace(/<br[^>]*\/?>/g, '\n');
  
  // 清理额外的换行符
  markdown = markdown.replace(/\n{3,}/g, '\n\n');
  
  // 移除所有剩余的HTML标签
  markdown = markdown.replace(/<[^>]*>/g, '');
  
  // 解码HTML实体
  markdown = markdown.replace(/&amp;/g, '&');
  markdown = markdown.replace(/&lt;/g, '<');
  markdown = markdown.replace(/&gt;/g, '>');
  markdown = markdown.replace(/&quot;/g, '"');
  markdown = markdown.replace(/&#39;/g, "'");
  
  return markdown.trim();
}

/**
 * 判断一个字符串是否为HTML格式
 * @param str 要检查的字符串
 * @returns 如果字符串包含HTML标签则返回true
 */
export function isHtml(str: string): boolean {
  if (!str) return false;
  
  // 简单检查是否包含HTML标签
  const htmlTagRegex = /<[a-z][\s\S]*>/i;
  return htmlTagRegex.test(str);
}

/**
 * 修复错误格式的Markdown内容
 * @param content 可能包含错误格式的内容
 * @returns 修复后的Markdown内容
 */
export function fixMarkdownContent(content: string): string {
  if (!content) return '';
  
  // 检查是否是常见错误模式：```markdown开头的HTML
  if (content.trim().startsWith('```markdown') && isHtml(content)) {
    // 移除```markdown和可能的结束```
    let cleanedContent = content.replace(/^```markdown/, '').replace(/```$/, '').trim();
    // 然后将HTML转换为Markdown
    return convertHtmlToMarkdown(cleanedContent);
  }
  
  // 如果内容看起来像HTML，转换它
  if (isHtml(content)) {
    return convertHtmlToMarkdown(content);
  }
  
  // 内容看起来已经是Markdown或纯文本，直接返回
  return content;
}