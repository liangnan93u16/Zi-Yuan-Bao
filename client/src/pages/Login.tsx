import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// 定义登录表单验证
const formSchema = z.object({
  email: z.string().email({
    message: '请输入有效的邮箱地址'
  }),
  password: z.string().min(6, {
    message: '密码至少需要6个字符'
  })
});

type LoginFormValues = z.infer<typeof formSchema>;

export default function Login() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAccountLocked, setIsAccountLocked] = useState(false);
  const { toast } = useToast();

  // 登录表单
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  });

  async function onSubmit(data: LoginFormValues) {
    // 清除之前的错误信息
    setErrorMessage(null);
    setIsAccountLocked(false);
    setIsLoading(true);
    
    try {
      await login(data.email, data.password);
      toast({
        title: '登录成功',
        description: '欢迎回来！'
      });
      
      // 检查URL是否有redirect参数，如果有则跳转到该URL
      const searchParams = new URLSearchParams(window.location.search);
      const redirectUrl = searchParams.get('redirect');
      if (redirectUrl) {
        setLocation(decodeURIComponent(redirectUrl));
      } else {
        setLocation('/');
      }
    } catch (error: any) {
      // 判断是否是账号锁定错误
      if (error.message && (error.message.includes('账号已被锁定') || error.message.includes('账号已被禁用'))) {
        setIsAccountLocked(true);
        setErrorMessage(error.message);
      } else if (error.message && error.message.includes('密码错误次数过多')) {
        setIsAccountLocked(true);
        setErrorMessage(error.message);
      } else {
        // 普通错误
        setErrorMessage(error.message || '账号或密码错误，请重试');
      }
      
      toast({
        title: '登录失败',
        description: error.message || '账号或密码错误，请重试',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="container max-w-md mx-auto py-10 px-4">
      <Card className="shadow-md">
        <CardHeader className="text-center space-y-1">
          <CardTitle className="text-2xl font-bold">用户登录</CardTitle>
          <CardDescription>
            请输入您的邮箱和密码
          </CardDescription>
        </CardHeader>
        <CardContent>
          {errorMessage && (
            <Alert variant={isAccountLocked ? "destructive" : "default"} className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{isAccountLocked ? '账号已锁定' : '登录失败'}</AlertTitle>
              <AlertDescription>
                {errorMessage}
              </AlertDescription>
            </Alert>
          )}
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>邮箱</FormLabel>
                    <FormControl>
                      <Input placeholder="请输入邮箱地址" {...field} disabled={isLoading || isAccountLocked} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>密码</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="请输入密码" {...field} disabled={isLoading || isAccountLocked} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading || isAccountLocked}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    登录中...
                  </>
                ) : isAccountLocked ? (
                  '账号已锁定'
                ) : (
                  '登录'
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-center text-sm text-neutral-600 mt-2">
            还没有账号？ 
            <Button variant="link" onClick={() => setLocation('/register')} className="p-0 font-semibold">
              立即注册
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}