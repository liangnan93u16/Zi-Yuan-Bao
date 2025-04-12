import { Category } from '@shared/schema';
import { Link } from 'wouter';
import { IconDisplay } from '@/components/IconSelector';

// 分类图标主题颜色映射
const categoryColorMap: Record<string, { bg: string, textColor: string }> = {
  'blue': { bg: 'bg-blue-100', textColor: 'text-blue-600' },
  'green': { bg: 'bg-green-100', textColor: 'text-green-600' },
  'amber': { bg: 'bg-amber-100', textColor: 'text-amber-600' },
  'red': { bg: 'bg-red-100', textColor: 'text-red-600' },
  'purple': { bg: 'bg-purple-100', textColor: 'text-purple-600' },
  'indigo': { bg: 'bg-indigo-100', textColor: 'text-indigo-600' },
  'pink': { bg: 'bg-pink-100', textColor: 'text-pink-600' },
  'sky': { bg: 'bg-sky-100', textColor: 'text-sky-600' },
  'orange': { bg: 'bg-orange-100', textColor: 'text-orange-600' },
  'teal': { bg: 'bg-teal-100', textColor: 'text-teal-600' },
  'emerald': { bg: 'bg-emerald-100', textColor: 'text-emerald-600' },
  'rose': { bg: 'bg-rose-100', textColor: 'text-rose-600' },
  'violet': { bg: 'bg-violet-100', textColor: 'text-violet-600' },
  'cyan': { bg: 'bg-cyan-100', textColor: 'text-cyan-600' },
  'fuchsia': { bg: 'bg-fuchsia-100', textColor: 'text-fuchsia-600' }
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
  
  // 根据分类 ID 分配不同的颜色
  const categoryColorKeys = Object.keys(categoryColorMap);
  // 使用分类ID模以颜色数量，确保每个分类有固定的颜色
  const colorIndex = category.id % categoryColorKeys.length;
  const colorKey = categoryColorKeys[colorIndex];
  const { bg, textColor } = categoryColorMap[colorKey];

  return (
    <Link href={`/resources?category_id=${category.id}`}>
      <a className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition flex flex-col items-center justify-center text-center">
        <div className={`w-12 h-12 ${bg} rounded-full flex items-center justify-center mb-3`}>
          <div className={`${textColor} flex items-center justify-center`}>
            <IconDisplay iconId={iconId} className="h-5 w-5" />
          </div>
        </div>
        <h3 className="font-medium text-neutral-900">{category.name}</h3>
        <p className="text-xs text-neutral-500 mt-1">{count} 个资源</p>
      </a>
    </Link>
  );
}
