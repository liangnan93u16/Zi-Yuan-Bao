import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { 
  Card, 
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription 
} from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Key, Lock, User, Calendar, Check, X, Clock, Shield } from "lucide-react";

// 定义登录日志类型
interface AdminLoginLog {
  id: number;
  admin_email: string;
  ip_address: string;
  login_time: string;
  user_agent: string;
  status: boolean;
}

export default function LoginLogs() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    // 只有特定管理员才能查看此页面
    if (!user || user.email !== '1034936667@qq.com') {
      toast({
        title: "权限不足",
        description: "您没有权限查看此页面",
        variant: "destructive",
      });
      setLocation("/");
    }
  }, [user, toast, setLocation]);

  // 获取登录日志
  const { 
    data: logs = [], 
    isLoading, 
    isError, 
    error 
  } = useQuery<AdminLoginLog[]>({
    queryKey: ['/api/admin/login-logs'],
    enabled: !!user && user.email === '1034936667@qq.com',
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  };

  const formatUserAgent = (userAgent: string) => {
    const maxLength = 60;
    return userAgent.length > maxLength 
      ? userAgent.substring(0, maxLength) + '...' 
      : userAgent;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-xl shadow-md overflow-hidden p-6">
          <div className="animate-pulse">
            <div className="h-7 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="h-5 bg-gray-200 rounded w-1/2 mb-8"></div>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-xl shadow-md overflow-hidden p-6">
          <div className="text-center text-red-600">
            <h2 className="text-xl font-bold mb-2">获取登录日志失败</h2>
            <p>{(error as any)?.message || '发生未知错误'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8">
        <div className="border-b border-neutral-200 px-6 py-4">
          <h2 className="text-xl font-bold">管理员登录日志</h2>
        </div>
        
        <Tabs value="login-logs" className="w-full">
          <div className="border-b border-neutral-200">
            <TabsList className="h-auto">
              <TabsTrigger 
                value="login-logs" 
                className="px-6 py-4 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
              >
                登录日志
              </TabsTrigger>
              <TabsTrigger 
                value="reviews" 
                className="px-6 py-4 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
              >
                <a href="/admin/reviews">评论审核</a>
              </TabsTrigger>
              <TabsTrigger 
                value="resources" 
                className="px-6 py-4 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
              >
                <a href="/admin/resources">资源管理</a>
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="login-logs" className="p-6">
            <div className="mb-6">
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div>
                  <h3 className="text-lg font-medium">登录记录</h3>
                  <p className="text-neutral-500 text-sm">显示管理员 ({user?.email}) 的登录历史记录</p>
                </div>
                <div className="flex gap-2">
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="bg-blue-100 p-2 rounded-lg">
                        <Clock className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-blue-700">总登录次数</p>
                        <p className="text-xl font-bold text-blue-800">{logs.length}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-green-50 border-green-200">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="bg-green-100 p-2 rounded-lg">
                        <Shield className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-green-700">成功登录</p>
                        <p className="text-xl font-bold text-green-800">{logs.filter(log => log.status).length}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
            
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableCaption>管理员 ({user?.email}) 的登录历史记录</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>登录时间</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>IP地址</TableHead>
                      <TableHead className="hidden md:table-cell">用户代理</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-neutral-500">
                          暂无登录记录
                        </TableCell>
                      </TableRow>
                    ) : (
                      logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-medium">
                            {formatDate(log.login_time)}
                          </TableCell>
                          <TableCell>
                            {log.status ? (
                              <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
                                <Check className="h-3 w-3 mr-1" /> 成功
                              </Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-800 hover:bg-red-200">
                                <X className="h-3 w-3 mr-1" /> 失败
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{log.ip_address}</TableCell>
                          <TableCell className="hidden md:table-cell">
                            <span className="text-xs text-neutral-500">{formatUserAgent(log.user_agent)}</span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}