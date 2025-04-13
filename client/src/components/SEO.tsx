import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  ogType?: 'website' | 'article';
  path?: string;
  schema?: string; // JSON-LD schema
}

/**
 * SEO组件：用于在页面上设置各种SEO相关的元标签
 */
export default function SEO({
  title = '资源宝 - 精品学习资源分享平台',
  description = '资源宝-精品学习资源分享平台, 提供高质量的视频教程、电子书和学习资料，助您快速学习新技能',
  keywords = '学习资源,教程,视频教程,电子书,学习材料,技能提升,设计教程,编程教程',
  ogImage = 'https://resourcetreasure.replit.app/images/og-image.jpg',
  ogType = 'website',
  path = '',
  schema,
}: SEOProps) {
  const siteUrl = 'https://resourcetreasure.replit.app';
  const url = path ? `${siteUrl}/${path}` : siteUrl;

  return (
    <Helmet>
      {/* 基本元标签 */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      
      {/* 规范URL */}
      <link rel="canonical" href={url} />
      
      {/* Open Graph 标签 */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={ogImage} />
      
      {/* 结构化数据 - JSON-LD */}
      {schema && (
        <script type="application/ld+json">
          {schema}
        </script>
      )}
    </Helmet>
  );
}