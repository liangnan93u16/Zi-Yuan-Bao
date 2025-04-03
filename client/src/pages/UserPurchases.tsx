import { useEffect, useState } from 'react';
import { useLocation, Link } from 'wouter';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { ExternalLink, FileDown, ShoppingBag, FileText, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface PurchaseWithResource {
  id: number;
  user_id: number;
  resource_id: number;
  price: string;
  purchase_time: string;
  resource: {
    id: number;
    title: string;
    subtitle?: string;
    cover_image?: string;
    resource_url?: string;
  };
}

export default function UserPurchases() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [purchases, setPurchases] = useState<PurchaseWithResource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 如果用户未登录，跳转到登录页面
    if (!user) {
      setLocation('/login');
      return;
    }

    // 获取用户购买记录
    const fetchPurchases = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/user/purchases', {
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error('获取购买记录失败');
        }
        
        const data = await response.json();
        setPurchases(data);
      } catch (error) {
        console.error('Error fetching purchases:', error);
        toast({
          title: '获取失败',
          description: '无法加载您的购买记录，请稍后重试',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPurchases();
  }, [user, setLocation, toast]);

  const handleDownload = (url?: string) => {
    if (!url) {
      toast({
        title: '下载链接无效',
        description: '该资源暂无可用的下载链接',
        variant: 'destructive',
      });
      return;
    }
    
    window.open(url, '_blank');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center mb-6">
        <ShoppingBag className="h-6 w-6 mr-2" />
        <h1 className="text-2xl font-bold">我的购买记录</h1>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="ml-2">加载中...</p>
        </div>
      ) : purchases.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
            <ShoppingBag className="h-8 w-8 text-neutral-400" />
          </div>
          <h3 className="text-xl font-medium mb-2">您还没有购买记录</h3>
          <p className="text-neutral-500 mb-6">浏览资源并使用积分购买您感兴趣的内容</p>
          <Link href="/resources">
            <Button>
              浏览资源
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {purchases.map((purchase) => (
            <Card key={purchase.id} className="h-full flex flex-col">
              <CardHeader>
                <CardTitle className="line-clamp-1">{purchase.resource.title}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {purchase.resource.subtitle || '无描述'}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="flex-grow">
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center text-neutral-600">
                      <Calendar className="h-4 w-4 mr-1" />
                      <span>购买日期:</span>
                    </div>
                    <span>{format(new Date(purchase.purchase_time), 'yyyy-MM-dd')}</span>
                  </div>
                  
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center text-neutral-600">
                      <FileText className="h-4 w-4 mr-1" />
                      <span>消费积分:</span>
                    </div>
                    <span className="font-medium">
                      {parseFloat(purchase.price) === 0 ? '免费' : `${purchase.price} 积分`}
                    </span>
                  </div>
                </div>
              </CardContent>
              
              <CardFooter className="border-t pt-4">
                <Button 
                  onClick={() => handleDownload(purchase.resource.resource_url)} 
                  variant="default" 
                  className="w-full gap-1"
                >
                  <FileDown className="h-4 w-4" /> 
                  下载资源
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}