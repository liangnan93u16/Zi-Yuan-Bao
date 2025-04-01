import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle } from "lucide-react";

// 表单验证模式
const formSchema = z.object({
  email: z.string().email("请输入有效的邮箱地址"),
  description: z.string().min(10, "请详细描述您需要的资源，至少10个字符")
});

type FormValues = z.infer<typeof formSchema>;

export default function ResourceRequest() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      description: ""
    },
    mode: "onSubmit"
  });
  
  // 添加日志查看表单验证状态
  console.log("表单错误状态:", form.formState.errors);

  async function onSubmit(data: FormValues) {
    console.log("表单提交数据:", data);
    setIsSubmitting(true);
    try {
      console.log("开始发送API请求...");
      const result = await apiRequest("POST", "/api/resource-requests", data);
      console.log("API请求成功:", result);
      
      setIsSuccess(true);
      toast({
        title: "提交成功",
        description: "您的资源请求已成功提交，我们将尽快处理！",
      });
    } catch (error: any) {
      console.error("提交资源请求失败:", error);
      
      // 检查是否是速率限制错误
      if (error.message && error.message.includes("429")) {
        toast({
          title: "提交频率过高",
          description: "您的提交频率过高，请等待一段时间后再试。系统限制每个IP每小时最多提交5次请求。",
          variant: "destructive"
        });
      } else {
        toast({
          title: "提交失败",
          description: "提交资源请求失败，请稍后再试",
          variant: "destructive"
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSuccess) {
    return (
      <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">提交成功</CardTitle>
            <CardDescription className="text-center">您的资源请求已经成功提交</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <p className="text-lg mb-2">感谢您的资源需求提交!</p>
            <p className="text-center text-muted-foreground">
              我们已收到您的需求，工作人员将尽快处理。如需提交更多需求，请点击下方按钮。
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button onClick={() => setIsSuccess(false)}>
              提交新的资源需求
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">资源求助</h1>
          <p className="text-muted-foreground">
            找不到想要的资源？告诉我们您的需求，我们会尽力为您寻找或制作！
          </p>
        </div>
        
        <Alert className="mb-8">
          <AlertDescription>
            您可以在这里提交您需要的资源信息，我们的团队会根据大家的需求优先上架热门资源。提交后请保持联系方式畅通，以便我们联系您。
            <div className="mt-2 text-sm text-yellow-600 dark:text-yellow-400">
              <p><strong>注意：</strong>为了防止恶意提交，每个IP地址在1小时内最多可提交5次资源请求。请确保提交前仔细填写内容。</p>
            </div>
          </AlertDescription>
        </Alert>
        
        <Card>
          <CardHeader>
            <CardTitle>提交资源需求</CardTitle>
            <CardDescription>请填写以下表单，尽可能详细地描述您需要的资源</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>您的邮箱</FormLabel>
                      <FormControl>
                        <Input placeholder="请输入您的邮箱地址" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>详细描述</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="请详细描述您需要的资源，包括标题、版本、内容要求等信息" 
                          rows={8}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isSubmitting}
                  onClick={() => {
                    console.log("提交按钮被点击");
                    console.log("表单是否有效:", form.formState.isValid);
                    console.log("表单错误:", form.formState.errors);
                  }}
                >
                  {isSubmitting ? "提交中..." : "提交需求"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}