import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { AlertCircle, Save } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface RateLimitConfig {
  global: {
    windowMs: number;
    max: number;
  };
  resourceRequest: {
    windowMs: number;
    max: number;
  };
  development: {
    enabled: boolean;
    global: {
      windowMs: number;
      max: number;
    };
    resourceRequest: {
      windowMs: number;
      max: number;
    };
  };
}

export default function RateLimitConfig() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [config, setConfig] = useState<RateLimitConfig>({
    global: {
      windowMs: 15 * 60 * 1000, // 15分钟
      max: 100,
    },
    resourceRequest: {
      windowMs: 60 * 60 * 1000, // 1小时
      max: 5,
    },
    development: {
      enabled: true,
      global: {
        windowMs: 15 * 60 * 1000,
        max: 1000,
      },
      resourceRequest: {
        windowMs: 60 * 60 * 1000,
        max: 1000,
      },
    },
  });
  
  // 获取当前配置
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/admin/rate-limit-config'],
    enabled: !!user && user.role === 'admin',
    retry: false,
  });
  
  // 更新配置
  const { mutate: updateConfig, isPending } = useMutation({
    mutationFn: async (newConfig: RateLimitConfig) => {
      return apiRequest(
        'POST',
        '/api/admin/rate-limit-config',
        newConfig
      );
    },
    onSuccess: () => {
      toast({
        title: "配置已更新",
        description: "速率限制配置已成功保存",
      });
    },
    onError: (error) => {
      console.error("保存配置失败:", error);
      toast({
        title: "保存失败",
        description: "无法保存速率限制配置",
        variant: "destructive",
      });
    },
  });
  
  // 当获取到数据后，更新本地状态
  useEffect(() => {
    if (data && typeof data === 'object') {
      setConfig(data as RateLimitConfig);
    }
  }, [data]);
  
  // 处理表单提交
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateConfig(config);
  };
  
  // 处理输入变更
  const handleChange = (
    section: 'global' | 'resourceRequest' | 'development.global' | 'development.resourceRequest',
    field: 'windowMs' | 'max',
    value: string
  ) => {
    const numValue = parseInt(value);
    if (isNaN(numValue)) return;
    
    const newConfig = { ...config };
    
    if (section === 'global') {
      newConfig.global[field] = numValue;
    } else if (section === 'resourceRequest') {
      newConfig.resourceRequest[field] = numValue;
    } else if (section === 'development.global') {
      newConfig.development.global[field] = numValue;
    } else if (section === 'development.resourceRequest') {
      newConfig.development.resourceRequest[field] = numValue;
    }
    
    setConfig(newConfig);
  };
  
  // 处理开发模式启用/禁用
  const handleDevModeToggle = (enabled: boolean) => {
    setConfig({
      ...config,
      development: {
        ...config.development,
        enabled,
      },
    });
  };
  
  // 如果用户不是管理员，重定向
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/');
    }
  }, [user, navigate]);
  
  // 返回小时表示
  const hoursFromMs = (ms: number) => (ms / (1000 * 60 * 60)).toString();
  
  // ms从小时转换
  const msFromHours = (hours: string) => {
    const h = parseFloat(hours);
    return h * 60 * 60 * 1000;
  };
  
  if (!user) {
    return null;
  }
  
  return (
    <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">速率限制配置</h1>
          <p className="text-muted-foreground">
            在这里配置应用的速率限制设置，保护系统免受恶意请求的攻击
          </p>
        </div>
        
        <Alert className="mb-8">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>管理员功能</AlertTitle>
          <AlertDescription>
            此页面用于配置应用的速率限制。在开发环境中可以设置更宽松的限制，在生产环境中应该设置更严格的限制。
          </AlertDescription>
        </Alert>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-8">
            {/* 生产环境设置 */}
            <Card>
              <CardHeader>
                <CardTitle>生产环境配置</CardTitle>
                <CardDescription>配置生产环境的速率限制参数</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-medium mb-2">全局请求限制</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="global-window">时间窗口 (小时)</Label>
                      <Input 
                        id="global-window"
                        type="number" 
                        step="0.1"
                        value={hoursFromMs(config.global.windowMs)} 
                        onChange={(e) => {
                          const newMs = msFromHours(e.target.value);
                          handleChange('global', 'windowMs', newMs.toString());
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="global-max">最大请求数</Label>
                      <Input 
                        id="global-max"
                        type="number" 
                        value={config.global.max} 
                        onChange={(e) => handleChange('global', 'max', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h3 className="font-medium mb-2">资源请求限制</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="resource-window">时间窗口 (小时)</Label>
                      <Input 
                        id="resource-window"
                        type="number" 
                        step="0.1"
                        value={hoursFromMs(config.resourceRequest.windowMs)} 
                        onChange={(e) => {
                          const newMs = msFromHours(e.target.value);
                          handleChange('resourceRequest', 'windowMs', newMs.toString());
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="resource-max">最大请求数</Label>
                      <Input 
                        id="resource-max"
                        type="number" 
                        value={config.resourceRequest.max} 
                        onChange={(e) => handleChange('resourceRequest', 'max', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* 开发环境设置 */}
            <Card>
              <CardHeader>
                <CardTitle>开发环境配置</CardTitle>
                <CardDescription>配置开发环境的速率限制参数</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center space-x-2 mb-4">
                  <Switch 
                    id="dev-mode-enabled"
                    checked={config.development.enabled}
                    onCheckedChange={handleDevModeToggle}
                  />
                  <Label htmlFor="dev-mode-enabled">开发模式下应用不同的速率限制</Label>
                </div>
                
                <div className={config.development.enabled ? "" : "opacity-50 pointer-events-none"}>
                  <h3 className="font-medium mb-2">全局请求限制</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dev-global-window">时间窗口 (小时)</Label>
                      <Input 
                        id="dev-global-window"
                        type="number" 
                        step="0.1"
                        value={hoursFromMs(config.development.global.windowMs)} 
                        onChange={(e) => {
                          const newMs = msFromHours(e.target.value);
                          handleChange('development.global', 'windowMs', newMs.toString());
                        }}
                        disabled={!config.development.enabled}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dev-global-max">最大请求数</Label>
                      <Input 
                        id="dev-global-max"
                        type="number" 
                        value={config.development.global.max} 
                        onChange={(e) => handleChange('development.global', 'max', e.target.value)}
                        disabled={!config.development.enabled}
                      />
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className={config.development.enabled ? "" : "opacity-50 pointer-events-none"}>
                  <h3 className="font-medium mb-2">资源请求限制</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dev-resource-window">时间窗口 (小时)</Label>
                      <Input 
                        id="dev-resource-window"
                        type="number" 
                        step="0.1"
                        value={hoursFromMs(config.development.resourceRequest.windowMs)} 
                        onChange={(e) => {
                          const newMs = msFromHours(e.target.value);
                          handleChange('development.resourceRequest', 'windowMs', newMs.toString());
                        }}
                        disabled={!config.development.enabled}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dev-resource-max">最大请求数</Label>
                      <Input 
                        id="dev-resource-max"
                        type="number" 
                        value={config.development.resourceRequest.max} 
                        onChange={(e) => handleChange('development.resourceRequest', 'max', e.target.value)}
                        disabled={!config.development.enabled}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <div className="flex justify-end">
              <Button 
                type="submit" 
                disabled={isPending}
                className="flex items-center"
              >
                {isPending ? '保存中...' : (
                  <>
                    <Save className="mr-2 h-4 w-4" /> 保存配置
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}