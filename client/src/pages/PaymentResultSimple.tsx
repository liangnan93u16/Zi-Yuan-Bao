import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function PaymentResultSimple() {
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderNo = params.get('out_trade_no');
    const tradeStatus = params.get('trade_status');
    
    console.log('支付结果页面参数:', { orderNo, tradeStatus });
    
    // 短暂延迟后显示结果并关闭弹窗
    setTimeout(() => {
      setLoading(false);
      
      // 如果支付成功，尝试关闭弹窗并通知父窗口
      if (tradeStatus === 'TRADE_SUCCESS') {
        try {
          if (window.opener) {
            window.opener.postMessage({ type: 'paymentSuccess', orderNo }, '*');
            window.close();
          }
        } catch (e) {
          console.log('无法关闭弹窗:', e);
        }
      }
    }, 1500); // 1.5秒后处理
  }, []);

  const params = new URLSearchParams(window.location.search);
  const tradeStatus = params.get('trade_status');
  const orderNo = params.get('out_trade_no');
  const money = params.get('money');
  const isSuccess = tradeStatus === 'TRADE_SUCCESS';

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
        <h2 className="text-xl font-semibold">正在处理支付结果...</h2>
        <p className="text-muted-foreground mt-2">请稍候，窗口将自动关闭</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center">
            {isSuccess ? (
              <CheckCircle className="w-8 h-8 mr-2 text-green-500" />
            ) : (
              <XCircle className="w-8 h-8 mr-2 text-red-500" />
            )}
            {isSuccess ? '支付成功' : '支付失败'}
          </CardTitle>
          {orderNo && (
            <CardDescription>
              订单号: {orderNo}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {money && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground">支付金额</p>
                <p className="text-2xl font-semibold">{money} 元</p>
              </div>
            )}
            
            <div className="text-center">
              <p className="text-lg">
                {isSuccess ? (
                  <span className="text-green-600">支付已完成，积分已充值到您的账户</span>
                ) : (
                  <span className="text-red-600">支付未成功，请重试</span>
                )}
              </p>
            </div>
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