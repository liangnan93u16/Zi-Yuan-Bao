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
import { Loader2 } from 'lucide-react';

// 定义注册表单验证
const formSchema = z.object({
  username: z.string().min(3, {
    message: '用户名至少需要3个字符'
  }),
  email: z.string().email({
    message: '请输入有效的电子邮件地址'
  }),
  password: z.string().min(6, {
    message: '密码至少需要6个字符'
  }),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "密码不匹配",
  path: ["confirmPassword"],
});

type RegisterFormValues = z.infer<typeof formSchema>;

export default function Register() {
  const { register } = useAuth();
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // 注册表单
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: ''
    }
  });

  async function onSubmit(data: RegisterFormValues) {
    setIsLoading(true);
    try {
      await register(data.username, data.email, data.password);
      toast({
        title: '注册成功',
        description: '欢迎加入我们！'
      });
      setLocation('/login');
    } catch (error: any) {
      toast({
        title: '注册失败',
        description: error.message || '注册时发生错误，请稍后再试',
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
          <CardTitle className="text-2xl font-bold">用户注册</CardTitle>
          <CardDescription>
            创建一个账号开始访问全部资源
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>用户名</FormLabel>
                    <FormControl>
                      <Input placeholder="请输入用户名" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>电子邮件</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="请输入电子邮件" {...field} disabled={isLoading} />
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
                      <Input type="password" placeholder="请输入密码" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>确认密码</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="请再次输入密码" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    注册中...
                  </>
                ) : (
                  '注册'
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-center text-sm text-neutral-600 mt-2">
            已有账号？ 
            <Button variant="link" onClick={() => setLocation('/login')} className="p-0 font-semibold">
              立即登录
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}