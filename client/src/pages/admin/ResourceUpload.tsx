import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { insertResourceSchema } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { 
  ImagePlus, 
  FileVideo,
  FileText
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Extended schema with client validations
const resourceFormSchema = z.object({
  title: z.string().min(2, "标题至少需要2个字符").max(255, "标题不能超过255个字符"),
  subtitle: z.string().optional(),
  cover_image: z.string().optional(),
  category_id: z.coerce.number().optional(),
  price: z.coerce.number().min(0, "价格不能为负数").default(0),
  video_url: z.string().optional(),
  video_duration: z.coerce.number().optional(),
  video_size: z.coerce.number().optional(),
  language: z.string().optional(),
  subtitle_languages: z.string().optional(),
  resolution: z.string().optional(),
  source_type: z.string().optional(),
  status: z.coerce.number().default(1),
  is_free: z.boolean().default(false),
  description: z.string().optional(),
  contents: z.string().optional(), // 课程目录，Markdown格式
});

type ResourceFormValues = z.infer<typeof resourceFormSchema>;

export default function ResourceUpload() {
  const [tab, setTab] = useState("upload");
  const [_, navigate] = useLocation();
  const { toast } = useToast();

  // Fetch categories
  const { data: categories, isLoading: isCategoriesLoading } = useQuery({
    queryKey: ['/api/categories'],
  }) as { data: any[], isLoading: boolean };

  // Form setup
  const form = useForm<ResourceFormValues>({
    resolver: zodResolver(resourceFormSchema),
    defaultValues: {
      title: "",
      subtitle: "",
      cover_image: "",
      price: 0,
      video_url: "",
      video_duration: 0,
      video_size: 0,
      language: "中文",
      subtitle_languages: "中文",
      resolution: "1080p",
      source_type: "original",
      status: 1,
      is_free: false,
      description: "",
      contents: "",
    },
  });

  // Create resource mutation
  const createResourceMutation = useMutation({
    mutationFn: async (data: ResourceFormValues) => {
      return apiRequest("POST", "/api/resources", data);
    },
    onSuccess: () => {
      toast({
        title: "资源创建成功",
        description: "新资源已成功添加到系统。",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/resources'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/resources'] });
      navigate("/admin/resources");
    },
    onError: (error) => {
      toast({
        title: "创建失败",
        description: `添加资源时出错: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const onSubmit = (data: ResourceFormValues) => {
    createResourceMutation.mutate(data);
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8">
        <div className="border-b border-neutral-200 px-6 py-4">
          <h2 className="text-xl font-bold">上传新资源</h2>
        </div>
        
        <Tabs value={tab} onValueChange={setTab}>
          <div className="border-b border-neutral-200">
            <TabsList className="h-auto">
              <TabsTrigger 
                value="upload" 
                className="px-6 py-4 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
              >
                上传资源
              </TabsTrigger>
              <TabsTrigger 
                value="resources" 
                className="px-6 py-4 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
              >
                <a href="/admin/resources">资源列表</a>
              </TabsTrigger>
              <TabsTrigger 
                value="categories" 
                className="px-6 py-4 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
              >
                分类管理
              </TabsTrigger>
              <TabsTrigger 
                value="users" 
                className="px-6 py-4 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
              >
                <a href="/admin/users">用户管理</a>
              </TabsTrigger>
              <TabsTrigger 
                value="stats" 
                className="px-6 py-4 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
              >
                统计分析
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="upload" className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>资源标题 *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="subtitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>副标题</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="category_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>所属分类 *</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value?.toString()}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择分类" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {isCategoriesLoading ? (
                              <SelectItem value="" disabled>
                                加载分类中...
                              </SelectItem>
                            ) : (
                              Array.isArray(categories) ? categories.map((category: any) => (
                                <SelectItem 
                                  key={category.id} 
                                  value={category.id.toString()}
                                >
                                  {category.name}
                                </SelectItem>
                              )) : <SelectItem value="" disabled>没有可用分类</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>资源价格 (积分) *</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input {...field} type="number" step="1" placeholder="输入积分数量" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="language"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>资源语言</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择语言" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="中文">中文</SelectItem>
                            <SelectItem value="英文">英文</SelectItem>
                            <SelectItem value="中英双语">中英双语</SelectItem>
                            <SelectItem value="其他">其他</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="subtitle_languages"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>字幕语言</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择字幕语言" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="中文">中文</SelectItem>
                            <SelectItem value="英文">英文</SelectItem>
                            <SelectItem value="中英双语">中英双语</SelectItem>
                            <SelectItem value="无字幕">无字幕</SelectItem>
                            <SelectItem value="其他">其他</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="video_duration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>视频时长 (分钟)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="video_size"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>视频大小 (GB)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="resolution"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>视频分辨率</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择分辨率" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="720p">720p</SelectItem>
                            <SelectItem value="1080p">1080p</SelectItem>
                            <SelectItem value="1440p">1440p</SelectItem>
                            <SelectItem value="4K">4K</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="source_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>来源类型</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择来源" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="original">原创</SelectItem>
                            <SelectItem value="udemy">Udemy</SelectItem>
                            <SelectItem value="coursera">Coursera</SelectItem>
                            <SelectItem value="lynda">Lynda</SelectItem>
                            <SelectItem value="pluralsight">Pluralsight</SelectItem>
                            <SelectItem value="other">其他</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="is_free"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>免费资源</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={(value) => field.onChange(value === "true")}
                            defaultValue={field.value ? "true" : "false"}
                            className="flex space-x-4"
                          >
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="true" />
                              </FormControl>
                              <FormLabel className="cursor-pointer font-normal">是</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="false" />
                              </FormControl>
                              <FormLabel className="cursor-pointer font-normal">否</FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>状态</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={(value) => field.onChange(parseInt(value))}
                            defaultValue={field.value.toString()}
                            className="flex space-x-4"
                          >
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="1" />
                              </FormControl>
                              <FormLabel className="cursor-pointer font-normal">上架</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="0" />
                              </FormControl>
                              <FormLabel className="cursor-pointer font-normal">下架</FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="cover_image"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>封面图片</FormLabel>
                      <div className="flex items-center space-x-6">
                        <div 
                          className="w-40 h-28 bg-neutral-100 rounded-lg border-2 border-dashed border-neutral-300 flex flex-col items-center justify-center cursor-pointer"
                          onClick={() => {
                            // In a real implementation, this would trigger a file upload dialog
                            field.onChange("https://images.unsplash.com/photo-1516116216624-53e697fedbea?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1528&q=80");
                            toast({
                              title: "模拟上传",
                              description: "在实际应用中，这里会打开文件选择器。已设置默认图片URL。",
                            });
                          }}
                        >
                          <ImagePlus className="text-neutral-400 mb-1" />
                          <span className="text-xs text-neutral-500">点击上传图片</span>
                        </div>
                        <div>
                          <p className="text-sm text-neutral-500 mb-1">支持 JPG, PNG 格式，建议尺寸 1280x720 像素</p>
                          <p className="text-sm text-neutral-500">图片大小不超过 2MB</p>
                          {field.value && (
                            <p className="text-sm text-neutral-500 mt-1">当前图片: {field.value.substring(0, 40)}...</p>
                          )}
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="video_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>视频文件</FormLabel>
                      <div className="flex items-center space-x-6">
                        <div 
                          className="w-40 h-28 bg-neutral-100 rounded-lg border-2 border-dashed border-neutral-300 flex flex-col items-center justify-center cursor-pointer"
                          onClick={() => {
                            // In a real implementation, this would trigger a file upload dialog
                            toast({
                              title: "模拟上传",
                              description: "在实际应用中，这里会打开文件选择器。",
                            });
                          }}
                        >
                          <FileVideo className="text-neutral-400 mb-1" />
                          <span className="text-xs text-neutral-500">点击上传视频</span>
                        </div>
                        <div>
                          <p className="text-sm text-neutral-500 mb-1">支持 MP4, MKV 格式</p>
                          <p className="text-sm text-neutral-500">或提供视频外链地址:</p>
                          <Input 
                            {...field} 
                            placeholder="https://" 
                            className="mt-1 w-full sm:w-80" 
                          />
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        资源描述 (支持Markdown)
                      </FormLabel>
                      <Tabs defaultValue="edit" className="border rounded-md">
                        <TabsList className="bg-muted">
                          <TabsTrigger value="edit">编辑</TabsTrigger>
                          <TabsTrigger value="preview">预览</TabsTrigger>
                        </TabsList>
                        <TabsContent value="edit" className="p-4">
                          <FormControl>
                            <Textarea 
                              {...field} 
                              rows={12}
                              placeholder="请详细描述该资源的内容、特点和适用人群，支持Markdown格式"
                              className="font-mono text-sm"
                            />
                          </FormControl>
                        </TabsContent>
                        <TabsContent value="preview" className="p-4 border-t prose max-w-none">
                          {field.value ? (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {field.value}
                            </ReactMarkdown>
                          ) : (
                            <div className="text-neutral-500 italic">无内容预览</div>
                          )}
                        </TabsContent>
                      </Tabs>
                      <FormDescription>
                        支持Markdown语法，包括标题、列表、链接、表格等
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="contents"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        课程目录 (支持Markdown)
                      </FormLabel>
                      <Tabs defaultValue="edit" className="border rounded-md">
                        <TabsList className="bg-muted">
                          <TabsTrigger value="edit">编辑</TabsTrigger>
                          <TabsTrigger value="preview">预览</TabsTrigger>
                        </TabsList>
                        <TabsContent value="edit" className="p-4">
                          <FormControl>
                            <Textarea 
                              {...field} 
                              rows={12}
                              placeholder="请输入课程目录内容，支持Markdown格式。例如：## 第一章：入门\n1. 章节1\n2. 章节2\n\n## 第二章：进阶"
                              className="font-mono text-sm"
                            />
                          </FormControl>
                        </TabsContent>
                        <TabsContent value="preview" className="p-4 border-t prose max-w-none">
                          {field.value ? (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {field.value}
                            </ReactMarkdown>
                          ) : (
                            <div className="text-neutral-500 italic">无内容预览</div>
                          )}
                        </TabsContent>
                      </Tabs>
                      <FormDescription>
                        输入课程的章节目录，支持Markdown格式化
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex justify-end space-x-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => navigate("/admin/resources")}
                  >
                    取消
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createResourceMutation.isPending}
                  >
                    {createResourceMutation.isPending ? "保存中..." : "保存资源"}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
