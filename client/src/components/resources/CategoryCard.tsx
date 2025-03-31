import { Category } from '@shared/schema';
import { Link } from 'wouter';

type IconMap = {
  [key: string]: {
    icon: JSX.Element;
    bg: string;
    textColor: string;
  };
};

const defaultIcons: IconMap = {
  'programming': {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="16 18 22 12 16 6"></polyline>
        <polyline points="8 6 2 12 8 18"></polyline>
      </svg>
    ),
    bg: 'bg-blue-100',
    textColor: 'text-primary'
  },
  'design': {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10"></circle>
        <circle cx="12" cy="12" r="6"></circle>
        <circle cx="12" cy="12" r="2"></circle>
      </svg>
    ),
    bg: 'bg-green-100',
    textColor: 'text-green-600'
  },
  'business': {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="12" y1="1" x2="12" y2="23"></line>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
      </svg>
    ),
    bg: 'bg-amber-100',
    textColor: 'text-amber-600'
  },
  'video': {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
        <line x1="7" y1="2" x2="7" y2="22"></line>
        <line x1="17" y1="2" x2="17" y2="22"></line>
        <line x1="2" y1="12" x2="22" y2="12"></line>
        <line x1="2" y1="7" x2="7" y2="7"></line>
        <line x1="2" y1="17" x2="7" y2="17"></line>
        <line x1="17" y1="17" x2="22" y2="17"></line>
        <line x1="17" y1="7" x2="22" y2="7"></line>
      </svg>
    ),
    bg: 'bg-red-100',
    textColor: 'text-red-600'
  },
  'language': {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 8h14M5 12h14M5 16h6"></path>
      </svg>
    ),
    bg: 'bg-purple-100',
    textColor: 'text-purple-600'
  },
  'other': {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="1"></circle>
        <circle cx="12" cy="5" r="1"></circle>
        <circle cx="12" cy="19" r="1"></circle>
      </svg>
    ),
    bg: 'bg-indigo-100',
    textColor: 'text-indigo-600'
  }
};

interface CategoryCardProps {
  category: Category;
  count: number;
}

export default function CategoryCard({ category, count }: CategoryCardProps) {
  // Determine which icon to use based on category name or icon property
  let iconKey = 'other';
  
  // Try to match category name with predefined icons
  const categoryNameLower = category.name.toLowerCase();
  if (categoryNameLower.includes('程序') || categoryNameLower.includes('编程') || categoryNameLower.includes('开发')) {
    iconKey = 'programming';
  } else if (categoryNameLower.includes('设计') || categoryNameLower.includes('创意')) {
    iconKey = 'design';
  } else if (categoryNameLower.includes('商业') || categoryNameLower.includes('管理') || categoryNameLower.includes('营销')) {
    iconKey = 'business';
  } else if (categoryNameLower.includes('视频') || categoryNameLower.includes('影视') || categoryNameLower.includes('摄影')) {
    iconKey = 'video';
  } else if (categoryNameLower.includes('语言') || categoryNameLower.includes('英语') || categoryNameLower.includes('外语')) {
    iconKey = 'language';
  }
  
  const { icon, bg, textColor } = defaultIcons[iconKey];

  return (
    <Link href={`/resources?category=${category.id}`}>
      <a className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition flex flex-col items-center justify-center text-center">
        <div className={`w-12 h-12 ${bg} rounded-full flex items-center justify-center mb-3`}>
          <div className={textColor}>{icon}</div>
        </div>
        <h3 className="font-medium text-neutral-900">{category.name}</h3>
        <p className="text-xs text-neutral-500 mt-1">{count} 个资源</p>
      </a>
    </Link>
  );
}
