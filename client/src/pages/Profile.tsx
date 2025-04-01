import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Icons
import { User, Settings, Clock, Gift, CoinsIcon, Camera, AlertTriangle, CheckCircle2, Shield } from "lucide-react";

// Define the update profile schema
const updateProfileSchema = z.object({
  email: z.string().email("请输入有效的邮箱地址").optional(),
  avatar: z.string().optional(),
});

type UpdateProfileFormValues = z.infer<typeof updateProfileSchema>;

export default function Profile() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // We should handle the redirect in the rendered component
  // to avoid React hooks errors

  // Format membership expiration date if it exists
  const formatExpirationDate = (dateValue: string | Date | null | undefined) => {
    if (!dateValue) return "无到期日期";
    try {
      if (dateValue instanceof Date) {
        return format(dateValue, "yyyy-MM-dd");
      }
      return format(new Date(dateValue), "yyyy-MM-dd");
    } catch (e) {
      return "日期格式错误";
    }
  };

  // Get membership status and badge
  const getMembershipBadge = () => {
    if (!user?.membership_type) {
      return <Badge variant="outline">免费用户</Badge>;
    }
    
    if (user.membership_type === "premium") {
      return <Badge className="bg-amber-500 hover:bg-amber-600">高级会员</Badge>;
    }
    
    if (user.membership_type === "vip") {
      return <Badge className="bg-purple-600 hover:bg-purple-700">VIP会员</Badge>;
    }
    
    return <Badge>{user.membership_type}</Badge>;
  };

  // Update profile form
  const form = useForm<UpdateProfileFormValues>({
    resolver: zodResolver(updateProfileSchema),
    // Default values depend on if user is loaded
    defaultValues: {
      email: "",
      avatar: "",
    },
  });
  
  // Update form values when user data changes
  useEffect(() => {
    if (user) {
      form.reset({
        email: user.email || "",
        avatar: user.avatar || "",
      });
    }
  }, [form, user]);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: UpdateProfileFormValues) => {
      return await apiRequest("PATCH", `/api/users/${user?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: "资料更新成功",
        description: "您的个人资料已成功更新。",
      });
      setIsUpdatingProfile(false);
    },
    onError: (error: any) => {
      toast({
        title: "更新失败",
        description: error.message || "更新个人资料时发生错误，请重试。",
        variant: "destructive",
      });
    },
  });

  async function onSubmit(data: UpdateProfileFormValues) {
    updateProfileMutation.mutate(data);
  }

  // Handle loading state and authentication redirect
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 flex justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-32 w-32 bg-neutral-200 rounded-full mb-4"></div>
          <div className="h-8 w-64 bg-neutral-200 rounded-md mb-2"></div>
          <div className="h-4 w-40 bg-neutral-200 rounded-md"></div>
        </div>
      </div>
    );
  }
  
  // Redirect if not authenticated
  if (!user) {
    // Use effect instead of directly setting location to avoid hooks issues
    setTimeout(() => setLocation("/login"), 0);
    return (
      <div className="container mx-auto px-4 py-12 flex justify-center">
        <div className="text-center">
          <h2 className="text-xl font-medium mb-2">需要登录</h2>
          <p className="text-neutral-600 mb-4">请先登录以访问个人中心</p>
          <Button onClick={() => setLocation("/login")}>登录</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-center mb-8">个人中心</h1>

      <Tabs 
        defaultValue={activeTab} 
        onValueChange={setActiveTab}
        className="max-w-4xl mx-auto"
      >
        <TabsList className="grid grid-cols-4 mb-8">
          <TabsTrigger value="overview" className="text-center py-2">
            <User className="h-4 w-4 mr-2" />
            <span>基本信息</span>
          </TabsTrigger>
          <TabsTrigger value="membership" className="text-center py-2">
            <Gift className="h-4 w-4 mr-2" />
            <span>会员信息</span>
          </TabsTrigger>
          <TabsTrigger value="coins" className="text-center py-2">
            <CoinsIcon className="h-4 w-4 mr-2" />
            <span>积分</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="text-center py-2">
            <Settings className="h-4 w-4 mr-2" />
            <span>账号设置</span>
          </TabsTrigger>
        </TabsList>

        {/* 基本信息 */}
        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
              <CardDescription>
                查看您的账号基本信息
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={user?.avatar || ""} alt={user?.email} />
                  <AvatarFallback className="text-2xl">{user?.email?.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                
                <div className="space-y-3 text-center sm:text-left">
                  <div>
                    <h3 className="text-lg font-medium flex items-center justify-center sm:justify-start gap-2">
                      {user?.email}
                      {user?.role === "admin" && (
                        <Badge variant="secondary" className="ml-2 flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          管理员
                        </Badge>
                      )}
                    </h3>
                    <div className="flex items-center justify-center sm:justify-start mt-1">
                      {getMembershipBadge()}
                    </div>
                  </div>
                  
                  <div className="text-sm text-neutral-600">
                    <p className="flex items-center justify-center sm:justify-start gap-1 mb-1">
                      <Clock className="h-4 w-4 opacity-70" />
                      注册时间: {user?.created_at ? formatExpirationDate(user.created_at) : "未知"}
                    </p>
                    <p className="flex items-center justify-center sm:justify-start gap-1">
                      <CoinsIcon className="h-4 w-4 opacity-70" />
                      积分: {user?.coins || 0}
                    </p>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h4 className="font-medium mb-2">账号状态</h4>
                <Alert variant="default" className="bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertTitle>账号状态正常</AlertTitle>
                  <AlertDescription>
                    您的账号状态良好，可以正常使用所有功能。
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button 
                variant="outline" 
                onClick={() => setActiveTab("settings")}
              >
                编辑资料
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* 会员信息 */}
        <TabsContent value="membership">
          <Card>
            <CardHeader>
              <CardTitle>会员信息</CardTitle>
              <CardDescription>
                查看您的会员状态和权益
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="bg-primary/10 p-3 rounded-full">
                  <Gift className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">{user?.membership_type ? `${user.membership_type} 会员` : "免费用户"}</h3>
                  <p className="text-sm text-neutral-500">
                    {user?.membership_expire_time ? (
                      <>到期时间: {formatExpirationDate(user.membership_expire_time)}</>
                    ) : (
                      user?.membership_type ? "永久会员" : "未开通会员服务"
                    )}
                  </p>
                </div>
              </div>

              <Separator />

              {!user?.membership_type ? (
                <div className="p-4 rounded-lg bg-neutral-50 text-center">
                  <h3 className="font-medium mb-2">尚未开通会员服务</h3>
                  <p className="text-sm text-neutral-600 mb-4">
                    开通会员，享受更多资源下载权益和专属客户服务
                  </p>
                  <Button onClick={() => setLocation("/membership")}>立即开通</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="font-medium">会员权益</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-neutral-50 p-3 rounded-lg">
                      <h4 className="font-medium text-sm mb-1">专属资源</h4>
                      <p className="text-xs text-neutral-600">获取会员专属优质资源</p>
                    </div>
                    <div className="bg-neutral-50 p-3 rounded-lg">
                      <h4 className="font-medium text-sm mb-1">无限下载</h4>
                      <p className="text-xs text-neutral-600">无限制下载平台资源</p>
                    </div>
                    <div className="bg-neutral-50 p-3 rounded-lg">
                      <h4 className="font-medium text-sm mb-1">优先客服</h4>
                      <p className="text-xs text-neutral-600">享受优先客服咨询服务</p>
                    </div>
                    <div className="bg-neutral-50 p-3 rounded-lg">
                      <h4 className="font-medium text-sm mb-1">定制需求</h4>
                      <p className="text-xs text-neutral-600">专属定制资源服务</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button onClick={() => setLocation("/membership")}>
                {user?.membership_type ? "管理会员" : "开通会员"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* 积分 */}
        <TabsContent value="coins">
          <Card>
            <CardHeader>
              <CardTitle>积分</CardTitle>
              <CardDescription>
                查看并管理您的积分
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-center p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                <div>
                  <p className="text-sm text-neutral-600 mb-1">当前积分数量</p>
                  <p className="text-3xl font-bold text-neutral-900">{user?.coins || 0}</p>
                </div>
                <Button className="mt-4 sm:mt-0">充值积分</Button>
              </div>

              <Separator />

              <div>
                <h3 className="font-medium mb-3">积分明细</h3>
                <div className="text-center text-neutral-500 py-8">
                  暂无积分交易记录
                </div>
              </div>

              <div className="rounded-lg bg-neutral-50 p-4">
                <h4 className="font-medium mb-2">积分使用规则</h4>
                <ul className="text-sm text-neutral-600 space-y-1">
                  <li>积分可用于购买站内资源</li>
                  <li>不同等级会员可享受不同比例的积分优惠</li>
                  <li>通过签到、完成任务等方式可获得免费积分</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 账号设置 */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>账号设置</CardTitle>
              <CardDescription>
                更新您的账号信息和个人资料
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="flex flex-col items-center mb-6">
                    <Avatar className="h-24 w-24 mb-4">
                      <AvatarImage src={user?.avatar || ""} alt={user?.email} />
                      <AvatarFallback className="text-2xl">{user?.email?.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    
                    <div className="flex gap-2">
                      <FormField
                        control={form.control}
                        name="avatar"
                        render={({ field }) => (
                          <FormItem className="hidden">
                            <FormControl>
                              <Input {...field} id="avatar-input" type="hidden" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <Button variant="outline" type="button" className="flex items-center gap-2">
                        <Camera className="h-4 w-4" />
                        更换头像
                      </Button>
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>邮箱地址</FormLabel>
                        <FormControl>
                          <Input {...field} disabled placeholder="您的邮箱地址" />
                        </FormControl>
                        <FormDescription>
                          邮箱为账号唯一标识，暂不支持修改
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" type="button" className="w-full">修改密码</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>修改密码</DialogTitle>
                        <DialogDescription>
                          请输入您的当前密码和新密码
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <FormLabel htmlFor="current-password">当前密码</FormLabel>
                          <Input id="current-password" type="password" />
                        </div>
                        <div className="space-y-2">
                          <FormLabel htmlFor="new-password">新密码</FormLabel>
                          <Input id="new-password" type="password" />
                        </div>
                        <div className="space-y-2">
                          <FormLabel htmlFor="confirm-password">确认新密码</FormLabel>
                          <Input id="confirm-password" type="password" />
                        </div>
                      </div>
                      
                      <DialogFooter>
                        <Button type="button" variant="outline">取消</Button>
                        <Button type="button">确认修改</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  
                  <div className="pt-4">
                    <Button 
                      type="submit" 
                      disabled={updateProfileMutation.isPending}
                      className="w-full"
                    >
                      {updateProfileMutation.isPending ? "保存中..." : "保存更改"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}