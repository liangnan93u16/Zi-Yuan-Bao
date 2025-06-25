import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { apiRequest } from '../lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

interface Order {
  id: number;
  order_no: string;
  amount: string;
  status: string;
  payment_method: string;
  created_at: string;
  pay_time: string | null;
}

interface Resource {
  id: number;
  title: string;
  resource_url: string | null;
}

interface OrderResponse {
  success: boolean;
  order: Order;
  resource: Resource | null;
}

export default function PaymentResult() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderData, setOrderData] = useState<OrderResponse | null>(null);
  
  // 从URL中获取订单号
  const params = new URLSearchParams(window.location.search);
  const orderNo = params.get('out_trade_no');
  
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 10; // 最多重试10次
    const retryInterval = 3000; // 每3秒重试一次
    
    const fetchOrderStatus = async () => {
      if (!orderNo) {
        setError('缺少订单号参数');
        setLoading(false);
        return;
      }
      
      try {
        const response = await apiRequest<OrderResponse>('GET', `/api/payment/order/${orderNo}`);
        
        // 如果订单状态是已支付，直接显示成功
        if (response.order.status === 'paid') {
          setOrderData(response);
          setLoading(false);
          return;
        }
        
        // 如果订单状态还是pending，且重试次数未超限，继续重试
        if (response.order.status === 'pending' && retryCount < maxRetries) {
          retryCount++;
          console.log(`订单状态查询中，第${retryCount}次重试...`);
          setTimeout(fetchOrderStatus, retryInterval);
          return;
        }
        
        // 其他情况直接设置数据
        setOrderData(response);
        setLoading(false);
        
      } catch (error) {
        console.error('获取订单状态失败', error);
        
        // 如果是网络错误且重试次数未超限，继续重试
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`网络错误，第${retryCount}次重试...`);
          setTimeout(fetchOrderStatus, retryInterval);
          return;
        }
        
        // 重试次数已满，显示错误
        setError('获取订单状态失败，请稍后再试');
        setLoading(false);
      }
    };
    
    fetchOrderStatus();
  }, [orderNo]);
  
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
        <h2 className="text-xl font-semibold">正在验证支付结果...</h2>
        <p className="text-muted-foreground mt-2">请稍候，系统正在确认您的支付状态</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <XCircle className="w-12 h-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">{error}</h2>
        <Button 
          variant="outline" 
          className="mt-6"
          onClick={() => setLocation('/')}
        >
          返回首页
        </Button>
      </div>
    );
  }
  
  if (!orderData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <XCircle className="w-12 h-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">订单不存在</h2>
        <Button 
          variant="outline" 
          className="mt-6"
          onClick={() => setLocation('/')}
        >
          返回首页
        </Button>
      </div>
    );
  }
  
  const { order, resource } = orderData;
  const isPaid = order.status === 'paid';
  
  // 如果支付成功，显示成功提示并关闭弹出窗口
  useEffect(() => {
    if (isPaid && orderData) {
      toast({
        title: "支付成功",
        description: `您已成功购买资源，积分已到账`,
        variant: "default",
      });
      
      // 延迟2秒后关闭弹出窗口（如果是在弹出窗口中）
      setTimeout(() => {
        if (window.opener) {
          // 通知父窗口支付成功
          window.opener.postMessage({ 
            type: 'payment_success', 
            orderNo: orderData.order.order_no,
            resourceId: orderData.resource?.id 
          }, '*');
          // 关闭弹出窗口
          window.close();
        }
      }, 2000);
    }
  }, [isPaid, orderData, toast]);
  
  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center">
            {isPaid ? (
              <CheckCircle className="w-8 h-8 mr-2 text-green-500" />
            ) : (
              <Loader2 className="w-8 h-8 mr-2 text-orange-500" />
            )}
            {isPaid ? '支付成功' : '正在确认支付结果'}
          </CardTitle>
          <CardDescription>
            订单号: {order.order_no}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">支付金额</p>
                <p className="text-xl font-semibold">{order.amount} 元</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">支付状态</p>
                <p className="text-xl font-semibold">
                  {isPaid ? (
                    <span className="text-green-500">支付成功</span>
                  ) : (
                    <span className="text-orange-500">确认中</span>
                  )}
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">创建时间</p>
                <p>{new Date(order.created_at).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">支付时间</p>
                <p>{order.pay_time ? new Date(order.pay_time).toLocaleString() : '未支付'}</p>
              </div>
            </div>
            
            {resource && (
              <div className="mt-6 pt-6 border-t">
                <h3 className="text-lg font-medium mb-2 flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  资源信息
                </h3>
                <p className="mb-2">
                  <span className="text-muted-foreground">资源名称:</span>{' '}
                  <span className="font-medium">{resource.title}</span>
                </p>
                
                {isPaid && resource.resource_url && (
                  <p className="mt-4">
                    <Link to={`/resources/${resource.id}`}>
                      <Button variant="outline">查看资源详情</Button>
                    </Link>
                  </p>
                )}
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-between space-y-2 sm:space-y-0">
          <Button 
            variant="default"
            onClick={() => setLocation('/')}
          >
            返回首页
          </Button>
          
          {!isPaid && (
            <Button 
              variant="outline"
              onClick={() => window.location.reload()}
            >
              刷新支付状态
            </Button>
          )}
          
          {isPaid && resource && (
            <Link to={`/resources/${resource.id}`}>
              <Button variant="default">
                查看已购买资源
              </Button>
            </Link>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}