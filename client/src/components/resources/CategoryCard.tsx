import { Category } from '@shared/schema';
import { Link } from 'wouter';
import { IconDisplay } from '@/components/IconSelector';

// 分类图标主题颜色映射
const categoryColorMap: Record<string, { bg: string, textColor: string }> = {
  'code': { bg: 'bg-blue-100', textColor: 'text-primary' },
  'palette': { bg: 'bg-green-100', textColor: 'text-green-600' },
  'dollar-sign': { bg: 'bg-amber-100', textColor: 'text-amber-600' },
  'video': { bg: 'bg-red-100', textColor: 'text-red-600' },
  'book-open': { bg: 'bg-purple-100', textColor: 'text-purple-600' },
  'music': { bg: 'bg-indigo-100', textColor: 'text-indigo-600' },
  'heart': { bg: 'bg-pink-100', textColor: 'text-pink-600' },
  'monitor': { bg: 'bg-sky-100', textColor: 'text-sky-600' },
  'camera': { bg: 'bg-orange-100', textColor: 'text-orange-600' },
  'database': { bg: 'bg-teal-100', textColor: 'text-teal-600' }
};

// 默认图标映射（基于分类名称关键词）
const defaultIconMap: Record<string, string> = {
  'programming': 'code',
  'design': 'palette',
  'business': 'dollar-sign',
  'video': 'video',
  'language': 'book-open',
  'other': 'star'
};

interface CategoryCardProps {
  category: Category;
  count: number;
}

export default function CategoryCard({ category, count }: CategoryCardProps) {
  // 优先使用数据库中的图标
  let iconId = category.icon || '';
  
  // 如果数据库中没有图标，根据分类名称推断
  if (!iconId) {
    // 确定要使用的图标基于分类名称
    let iconType = 'other';
    
    // 尝试根据分类名称匹配预定义图标
    const categoryNameLower = category.name.toLowerCase();
    if (categoryNameLower.includes('程序') || categoryNameLower.includes('编程') || categoryNameLower.includes('开发')) {
      iconType = 'programming';
    } else if (categoryNameLower.includes('设计') || categoryNameLower.includes('创意')) {
      iconType = 'design';
    } else if (categoryNameLower.includes('商业') || categoryNameLower.includes('管理') || categoryNameLower.includes('营销')) {
      iconType = 'business';
    } else if (categoryNameLower.includes('视频') || categoryNameLower.includes('影视') || categoryNameLower.includes('摄影')) {
      iconType = 'video';
    } else if (categoryNameLower.includes('语言') || categoryNameLower.includes('英语') || categoryNameLower.includes('外语')) {
      iconType = 'language';
    }
    
    // 设置默认图标ID
    iconId = defaultIconMap[iconType];
  }
  
  // 获取图标颜色
  const colorKey = Object.keys(categoryColorMap).find(key => iconId.includes(key)) || 'code';
  const { bg, textColor } = categoryColorMap[colorKey];

  return (
    <Link href={`/resources?category=${category.id}`}>
      <a className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition flex flex-col items-center justify-center text-center">
        <div className={`w-12 h-12 ${bg} rounded-full flex items-center justify-center mb-3`}>
          <div className={textColor}>
            <IconDisplay iconId={iconId} className="h-5 w-5" />
          </div>
        </div>
        <h3 className="font-medium text-neutral-900">{category.name}</h3>
        <p className="text-xs text-neutral-500 mt-1">{count} 个资源</p>
      </a>
    </Link>
  );
}
