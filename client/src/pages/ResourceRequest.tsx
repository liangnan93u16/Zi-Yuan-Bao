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
  requestor_name: z.string().min(2, "请输入您的姓名，至少2个字符"),
  contact_info: z.string().min(6, "请输入联系方式，可以是邮箱或手机号"),
  resource_title: z.string().min(3, "请输入资源标题，至少3个字符"),
  resource_type: z.string().optional(),
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
      requestor_name: "",
      contact_info: "",
      resource_title: "",
      resource_type: "",
      description: ""
    }
  });

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true);
    try {
      await apiRequest("/api/resource-requests", "POST", data);
      
      setIsSuccess(true);
      toast({
        title: "提交成功",
        description: "您的资源请求已成功提交，我们将尽快处理！",
      });
    } catch (error) {
      console.error("提交资源请求失败:", error);
      toast({
        title: "提交失败",
        description: "提交资源请求失败，请稍后再试",
        variant: "destructive"
      });
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
                  name="requestor_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>您的姓名</FormLabel>
                      <FormControl>
                        <Input placeholder="请输入您的姓名" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="contact_info"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>联系方式</FormLabel>
                      <FormControl>
                        <Input placeholder="请输入您的邮箱或手机号" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="resource_title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>资源标题</FormLabel>
                      <FormControl>
                        <Input placeholder="您需要的资源标题，例如：Adobe Photoshop 2023 课程" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="resource_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>资源类型 (可选)</FormLabel>
                      <FormControl>
                        <Input placeholder="例如：视频教程、软件资源、电子书等" {...field} />
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
                          placeholder="请详细描述您需要的资源，包括版本、内容要求等信息" 
                          rows={5}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button type="submit" className="w-full" disabled={isSubmitting}>
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