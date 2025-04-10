import { ResourceWithCategory } from '@/lib/types';
import { Link } from 'wouter';
import { Badge } from '@/components/ui/badge';
import { Star, Clock, FileText, Globe, Heart } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';

interface ResourceCardProps {
  resource: ResourceWithCategory;
  isLoggedIn?: boolean;
}

export default function ResourceCard({ resource, isLoggedIn = false }: ResourceCardProps) {
  const isFree = resource.is_free;
  const isHot = Math.random() > 0.7; // This would be based on actual data in a real app
  const isNew = Math.random() > 0.8; // This would be based on actual data in a real app
  const rating = (Math.random() * (5 - 4) + 4).toFixed(1); // Random rating between 4.0 and 5.0
  const isPreorder = resource.status === 1 && !resource.resource_url; // 预售状态：已上架但没有下载链接
  
  const [isFavorited, setIsFavorited] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  
  // 检查是否已收藏
  useEffect(() => {
    if (!isLoggedIn || !resource.id) return;
    
    const checkFavorite = async () => {
      try {
        const response = await apiRequest('GET', `/api/resources/${resource.id}/favorite/check`);
        
        if (response.success) {
          setIsFavorited(response.favorited);
        }
      } catch (error) {
        console.error('Error checking favorite status:', error);
      }
    };
    
    checkFavorite();
  }, [resource.id, isLoggedIn]);
  
  // 处理收藏/取消收藏
  const handleFavoriteToggle = async (e: React.MouseEvent) => {
    e.preventDefault(); // 防止点击事件冒泡
    e.stopPropagation();
    
    if (!isLoggedIn) {
      toast({
        title: "请先登录",
        description: "您需要登录后才能收藏资源",
        variant: "destructive",
      });
      return;
    }
    
    if (isLoading) return;
    
    setIsLoading(true);
    
    try {
      if (isFavorited) {
        // 取消收藏
        const response = await apiRequest('DELETE', `/api/resources/${resource.id}/favorite`, undefined);
        
        if (response.success) {
          setIsFavorited(false);
          toast({
            title: "已取消收藏",
            description: "资源已从您的收藏夹中移除",
          });
        }
      } else {
        // 添加收藏
        const response = await apiRequest('POST', `/api/resources/${resource.id}/favorite`, undefined);
        
        if (response.success) {
          setIsFavorited(true);
          toast({
            title: "收藏成功",
            description: "资源已添加到您的收藏夹",
          });
        }
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast({
        title: "操作失败",
        description: "请稍后再试",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
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
          src={
            // 优先使用本地图片路径，如果存在
            resource.local_image_path 
              ? `/uploads${resource.local_image_path}` 
              : (resource.cover_image || 'https://via.placeholder.com/640x360/e2e8f0/1a202c?text=No+Image')
          } 
          alt={resource.title} 
          onError={(e) => {
            // 如果本地图片加载失败，回退到远程图片
            const target = e.target as HTMLImageElement;
            if (resource.local_image_path && target.src.includes('/uploads')) {
              console.log('本地图片加载失败，切换到远程图片');
              target.src = resource.cover_image || 'https://via.placeholder.com/640x360/e2e8f0/1a202c?text=No+Image';
            }
          }}
        />
        
        {isHot && (
          <span className="absolute top-3 left-3 bg-primary text-white text-xs font-medium px-2 py-1 rounded">
            热门
          </span>
        )}
        
        {isPreorder && !isHot && (
          <span className="absolute top-3 left-3 bg-purple-600 text-white text-xs font-medium px-2 py-1 rounded">
            预售
          </span>
        )}
        
        {isNew && !isHot && !isPreorder && (
          <span className="absolute top-3 left-3 bg-blue-600 text-white text-xs font-medium px-2 py-1 rounded">
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
          <div className="flex items-center gap-2">
            <span className={`${isFree ? 'text-primary' : 'text-neutral-900'} font-bold`}>
              {isFree ? '免费' : `${getFormattedPrice()} 积分`}
            </span>
            
            <Button 
              variant="ghost" 
              size="icon" 
              className={`p-0 h-8 w-8 ${isFavorited ? 'text-red-500' : 'text-gray-400'}`}
              onClick={handleFavoriteToggle}
              disabled={isLoading}
              title={isFavorited ? "取消收藏" : "收藏"}
            >
              <Heart className={`h-5 w-5 ${isFavorited ? 'fill-current' : ''}`} />
            </Button>
          </div>
          
          <Link href={`/resources/${resource.id}`} className="bg-primary hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm font-medium transition">
            查看详情
          </Link>
        </div>
      </div>
    </div>
  );
}
