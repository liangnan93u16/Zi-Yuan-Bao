import { useEffect, useState } from 'react';
import { Link } from 'wouter';
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

export default function PaymentResultSimple() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderData, setOrderData] = useState<OrderResponse | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderNo = params.get('out_trade_no');
    
    if (!orderNo) {
      setError('缺少订单号参数');
      setLoading(false);
      return;
    }

    console.log('开始查询订单状态，订单号:', orderNo);
    
    // 直接fetch请求，不使用任何认证
    fetch(`/api/payment/order/${orderNo}`)
      .then(response => {
        console.log('收到响应状态:', response.status);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      })
      .then((data: OrderResponse) => {
        console.log('订单数据:', data);
        setOrderData(data);
        setLoading(false);
        
        // 如果支付成功，尝试关闭弹窗并通知父窗口
        if (data.order.status === 'paid') {
          try {
            if (window.opener) {
              window.opener.postMessage({ type: 'paymentSuccess', orderNo }, '*');
              window.close();
            }
          } catch (e) {
            console.log('无法关闭弹窗:', e);
          }
        }
      })
      .catch(error => {
        console.error('获取订单状态失败:', error);
        setError('获取订单状态失败，请稍后再试');
        setLoading(false);
      });
  }, []);

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
        <Button asChild variant="outline" className="mt-6">
          <Link href="/">返回首页</Link>
        </Button>
      </div>
    );
  }

  if (!orderData) {
    return null;
  }

  const { order, resource } = orderData;
  const isPaid = order.status === 'paid';

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center">
            {isPaid ? (
              <CheckCircle className="w-8 h-8 mr-2 text-green-500" />
            ) : (
              <XCircle className="w-8 h-8 mr-2 text-orange-500" />
            )}
            {isPaid ? '支付成功' : '支付状态确认中'}
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
                    <span className="text-orange-500">处理中</span>
                  )}
                </p>
              </div>
            </div>
            
            {isPaid && resource && (
              <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
                <h3 className="font-semibold text-green-800 mb-2">购买成功</h3>
                <p className="text-green-700 mb-3">{resource.title}</p>
                {resource.resource_url && (
                  <Button asChild size="sm">
                    <a href={resource.resource_url} target="_blank" rel="noopener noreferrer">
                      <FileText className="w-4 h-4 mr-2" />
                      查看资源
                    </a>
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button asChild className="w-full">
            <Link href="/">返回首页</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}