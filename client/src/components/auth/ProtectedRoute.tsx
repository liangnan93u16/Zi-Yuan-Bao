import React, { ReactNode, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  adminOnly?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  adminOnly = false 
}) => {
  const { user, loading } = useAuth();
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        // 用户未登录，重定向到登录页面，并记住原始URL
        navigate(`/login?redirect=${encodeURIComponent(location)}`);
      } else if (adminOnly && user.role !== 'admin') {
        // 用户已登录但不是管理员，重定向到首页
        navigate('/');
      }
    }
  }, [user, loading, navigate, location, adminOnly]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <span className="ml-2 text-lg text-neutral-700">加载中...</span>
      </div>
    );
  }

  // 如果用户已登录且满足管理员角色要求（如果有），则渲染子组件
  if (user && (!adminOnly || user.role === 'admin')) {
    return <>{children}</>;
  }

  // 在重定向完成前，显示加载状态
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
      <span className="ml-2 text-lg text-neutral-700">正在验证权限...</span>
    </div>
  );
};

export default ProtectedRoute;