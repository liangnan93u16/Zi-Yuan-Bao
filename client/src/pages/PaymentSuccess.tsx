import { useEffect } from "react";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PaymentSuccess() {
  useEffect(() => {
    // 添加调试信息
    console.log('PaymentSuccess 组件已加载');
    console.log('当前 URL:', window.location.href);
    const urlParams = new URLSearchParams(window.location.search);
    console.log('URL 参数:', Object.fromEntries(urlParams.entries()));
    console.log('window.location.pathname:', window.location.pathname);
    
    // 检查支付结果参数
    const tradeStatus = urlParams.get('trade_status');
    const outTradeNo = urlParams.get('out_trade_no');
    if (tradeStatus && outTradeNo) {
      console.log('检测到支付结果参数:', { tradeStatus, outTradeNo });
    }
    
    // 尝试通知父窗口支付成功
    try {
      if (window.opener) {
        console.log('检测到父窗口，发送支付成功消息');
        window.opener.postMessage({ 
          type: 'payment_success',
          status: 'success'
        }, '*');
        
        // 延迟关闭窗口，给用户看到成功信息的时间
        setTimeout(() => {
          console.log('2秒后自动关闭窗口');
          window.close();
        }, 2000);
      } else {
        console.log('未检测到父窗口，可能是直接访问');
      }
    } catch (e) {
      console.log('无法通知父窗口或关闭窗口:', e);
    }
  }, []);

  const handleClose = () => {
    try {
      if (window.opener) {
        window.opener.postMessage({ 
          type: 'payment_success',
          status: 'success'
        }, '*');
        window.close();
      } else {
        // 如果不是弹窗，跳转到首页
        window.location.href = '/';
      }
    } catch (e) {
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            支付成功！
          </h1>
          <p className="text-gray-600">
            您的支付已完成，积分将很快到账
          </p>
        </div>
        
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-800">
              <strong>温馨提示：</strong>
              <br />
              积分到账后，系统将自动为您购买对应资源。
              <br />
              请返回原页面查看购买结果。
            </p>
          </div>
          
          <Button 
            onClick={handleClose}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            确定
          </Button>
          
          <p className="text-xs text-gray-500">
            {window.opener ? '窗口将在2秒后自动关闭' : '点击确定返回首页'}
          </p>
        </div>
      </div>
    </div>
  );
}