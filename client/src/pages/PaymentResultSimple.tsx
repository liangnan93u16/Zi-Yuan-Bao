import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function PaymentResultSimple() {
  const [orderStatus, setOrderStatus] = useState<string>('loading');
  const [orderData, setOrderData] = useState<any>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 10;

  useEffect(() => {
    console.log('PaymentResultSimple 组件已加载');
    
    // 从URL获取订单号
    const urlParams = new URLSearchParams(window.location.search);
    const outTradeNo = urlParams.get('out_trade_no');
    
    console.log('URL参数:', Object.fromEntries(urlParams.entries()));
    
    if (!outTradeNo) {
      console.log('未找到订单号参数');
      setOrderStatus('error');
      return;
    }

    // 查询订单状态
    const checkOrder = async () => {
      try {
        console.log(`查询订单状态 (第${retryCount + 1}次):`, outTradeNo);
        
        const response = await fetch(`/api/payment/order/${outTradeNo}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          console.log('订单查询结果:', data);
          setOrderData(data);
          
          if (data.order && data.order.status === 1) {
            // 支付成功
            setOrderStatus('success');
            
            // 通知父窗口支付成功
            if (window.opener) {
              window.opener.postMessage({
                type: 'payment_success',
                status: 'success',
                orderData: data
              }, '*');
            }
          } else if (retryCount < maxRetries) {
            // 继续重试
            setRetryCount(prev => prev + 1);
            setTimeout(checkOrder, 2000);
          } else {
            // 超过重试次数，显示等待状态
            setOrderStatus('pending');
          }
        } else {
          console.log('订单查询失败:', response.status);
          if (retryCount < maxRetries) {
            setRetryCount(prev => prev + 1);
            setTimeout(checkOrder, 2000);
          } else {
            setOrderStatus('error');
          }
        }
      } catch (error) {
        console.error('查询订单时发生错误:', error);
        if (retryCount < maxRetries) {
          setRetryCount(prev => prev + 1);
          setTimeout(checkOrder, 2000);
        } else {
          setOrderStatus('error');
        }
      }
    };

    checkOrder();
  }, [retryCount]);

  const handleClose = () => {
    if (window.opener) {
      window.close();
    } else {
      window.location.href = '/';
    }
  };

  const handleRetry = () => {
    setRetryCount(0);
    setOrderStatus('loading');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          {orderStatus === 'loading' && (
            <div className="text-center">
              <RefreshCw className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-spin" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                查询支付结果中...
              </h2>
              <p className="text-gray-600 mb-4">
                正在确认您的支付状态，请稍候
              </p>
              <p className="text-sm text-gray-500">
                重试次数: {retryCount + 1}/{maxRetries + 1}
              </p>
            </div>
          )}

          {orderStatus === 'success' && (
            <div className="text-center">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                支付成功！
              </h2>
              <p className="text-gray-600 mb-4">
                您的积分已到账，资源购买成功
              </p>
              {orderData?.resource && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-green-800">
                    <strong>资源：</strong>{orderData.resource.title}
                  </p>
                </div>
              )}
              <Button onClick={handleClose} className="w-full">
                确定
              </Button>
            </div>
          )}

          {orderStatus === 'pending' && (
            <div className="text-center">
              <Clock className="h-12 w-12 text-yellow-600 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                处理中...
              </h2>
              <p className="text-gray-600 mb-4">
                支付正在处理中，请稍后再试
              </p>
              <div className="space-y-2">
                <Button onClick={handleRetry} variant="outline" className="w-full">
                  重新查询
                </Button>
                <Button onClick={handleClose} variant="ghost" className="w-full">
                  关闭窗口
                </Button>
              </div>
            </div>
          )}

          {orderStatus === 'error' && (
            <div className="text-center">
              <XCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                查询失败
              </h2>
              <p className="text-gray-600 mb-4">
                无法获取支付状态，请稍后重试
              </p>
              <div className="space-y-2">
                <Button onClick={handleRetry} variant="outline" className="w-full">
                  重新查询
                </Button>
                <Button onClick={handleClose} variant="ghost" className="w-full">
                  关闭窗口
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}