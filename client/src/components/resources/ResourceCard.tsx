import { ResourceWithCategory } from '@/lib/types';
import { Link } from 'wouter';
import { Badge } from '@/components/ui/badge';
import { Star, Clock, FileText, Globe } from 'lucide-react';

interface ResourceCardProps {
  resource: ResourceWithCategory;
}

export default function ResourceCard({ resource }: ResourceCardProps) {
  const isFree = resource.is_free;
  const isHot = Math.random() > 0.7; // This would be based on actual data in a real app
  const isNew = Math.random() > 0.8; // This would be based on actual data in a real app
  const rating = (Math.random() * (5 - 4) + 4).toFixed(1); // Random rating between 4.0 and 5.0
  
  // Format price as integer
  const getFormattedPrice = (): string => {
    let priceValue = 0;
    
    if (resource.price) {
      // Try to convert to number whatever the type is
      const numericPrice = Number(resource.price);
      if (!isNaN(numericPrice)) {
        priceValue = numericPrice;
      }
    }
    
    // Format as integer
    return Math.round(priceValue).toString();
  };

  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition">
      <div className="relative">
        <img 
          className="h-48 w-full object-cover" 
          src={resource.cover_image || 'https://via.placeholder.com/640x360/e2e8f0/1a202c?text=No+Image'} 
          alt={resource.title} 
        />
        
        {isHot && (
          <span className="absolute top-3 left-3 bg-primary text-white text-xs font-medium px-2 py-1 rounded">
            热门
          </span>
        )}
        
        {isNew && !isHot && (
          <span className="absolute top-3 left-3 bg-secondary text-white text-xs font-medium px-2 py-1 rounded">
            新课
          </span>
        )}
        
        {isFree && (
          <span className="absolute top-3 right-3 bg-green-500 text-white text-xs font-medium px-2 py-1 rounded">
            免费
          </span>
        )}
      </div>
      
      <div className="p-4">
        <div className="flex items-center mb-2">
          {resource.category && (
            <Badge variant="outline" className="bg-blue-100 text-primary border-0">
              {resource.category.name}
            </Badge>
          )}
          
          <div className="ml-auto flex items-center text-amber-500 text-sm">
            <Star className="h-4 w-4 mr-1 fill-current" />
            <span>{rating}</span>
          </div>
        </div>
        
        <h3 className="font-semibold text-lg mb-1 line-clamp-1">{resource.title}</h3>
        
        <p className="text-neutral-600 text-sm mb-2 line-clamp-2">
          {resource.subtitle || 'No description available'}
        </p>
        
        <div className="flex items-center text-xs text-neutral-500 mb-3 flex-wrap">
          {resource.video_duration && (
            <span className="flex items-center mr-3">
              <Clock className="h-3 w-3 mr-1" /> {resource.video_duration} 分钟
            </span>
          )}
          
          {resource.video_url && (
            <span className="flex items-center mr-3">
              <FileText className="h-3 w-3 mr-1" /> {Math.floor(Math.random() * 180 + 20)} 讲
            </span>
          )}
          
          {resource.language && (
            <span className="flex items-center">
              <Globe className="h-3 w-3 mr-1" /> {resource.language}
            </span>
          )}
        </div>
        
        <div className="flex justify-between items-center">
          <span className={`${isFree ? 'text-primary' : 'text-neutral-900'} font-bold`}>
            {isFree ? '免费' : `${getFormattedPrice()} 积分`}
          </span>
          
          <Link href={`/resources/${resource.id}`} className="bg-primary hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm font-medium transition">
            查看详情
          </Link>
        </div>
      </div>
    </div>
  );
}
