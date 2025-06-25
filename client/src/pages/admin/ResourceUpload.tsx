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
  FileText,
  Info,
  BookOpen,
  CircleDollarSign,
  Link as LinkIcon,
  ArrowLeft
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Extended schema with client validations
const resourceFormSchema = z.object({
  title: z.string().min(2, "标题至少需要2个字符").max(255, "标题不能超过255个字符"),
  subtitle: z.string().optional(),
  cover_image: z.string().optional(),
  category_id: z.coerce.number().optional(),
  author_id: z.coerce.number().optional(), // 作者ID
  price: z.coerce.number().min(0, "价格不能为负数").default(0),
  video_url: z.string().optional(),
  video_duration: z.coerce.number().optional(),
  video_size: z.coerce.number().optional(),
  language: z.string().optional(),
  subtitle_languages: z.string().optional(),
  resolution: z.string().optional(),
  source_type: z.string().optional(),
  status: z.coerce.number().default(0), // 默认状态为下架
  is_free: z.boolean().default(false),
  description: z.string().optional(),
  contents: z.string().optional(), // 课程目录，JSON格式
  faq_content: z.string().optional(), // 常见问题，Markdown格式
  resource_url: z.string().optional(), // 资源下载链接
  resource_type: z.string().optional(), // 资源类型
});

type ResourceFormValues = z.infer<typeof resourceFormSchema>;

export default function ResourceUpload() {
  const [activeTab, setActiveTab] = useState("basic");
  const [_, navigate] = useLocation();
  const { toast } = useToast();

  // Fetch categories
  const { data: categories, isLoading: isCategoriesLoading } = useQuery({
    queryKey: ['/api/categories'],
  }) as { data: any[], isLoading: boolean };
  
  // Fetch authors
  const { data: authors, isLoading: isAuthorsLoading } = useQuery({
    queryKey: ['/api/authors'],
  }) as { data: any[], isLoading: boolean };

  // Form setup
  const form = useForm<ResourceFormValues>({
    resolver: zodResolver(resourceFormSchema),
    defaultValues: {
      title: "",
      subtitle: "",
      cover_image: "",
      category_id: undefined,
      author_id: undefined,
      price: 0,
      video_url: "",
      video_duration: 0,
      video_size: 0,
      language: "中文",
      subtitle_languages: "中文",
      resolution: "1920x1080", // 默认1080p分辨率
      source_type: "original",
      status: 0, // 默认下架状态
      is_free: false,
      description: "",
      contents: "",
      faq_content: "",
      resource_url: "", // 新增资源下载链接字段
      resource_type: "video", // 新增资源类型字段
    },
  });

  // Create resource mutation
  const createResourceMutation = useMutation({
    mutationFn: async (data: ResourceFormValues) => {
      // 将数字转为字符串以匹配后端期望格式
      const formattedData = {
        ...data,
        price: data.price?.toString(),
        video_size: data.video_size?.toString()
      };
      return apiRequest("POST", "/api/resources", formattedData);
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
        <div className="border-b border-neutral-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">上传新资源</h2>
          <Button 
            variant="outline" 
            onClick={() => {
              navigate("/admin/resources");
            }}
            className="text-sm gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            返回资源列表
          </Button>
        </div>
        
        <div className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="basic" className="flex gap-1 items-center">
                    <Info className="h-4 w-4" />
                    <span>基本信息</span>
                  </TabsTrigger>
                  <TabsTrigger value="media" className="flex gap-1 items-center">
                    <FileVideo className="h-4 w-4" />
                    <span>媒体信息</span>
                  </TabsTrigger>
                  <TabsTrigger value="content" className="flex gap-1 items-center">
                    <BookOpen className="h-4 w-4" />
                    <span>内容详情</span>
                  </TabsTrigger>
                  <TabsTrigger value="pricing" className="flex gap-1 items-center">
                    <CircleDollarSign className="h-4 w-4" />
                    <span>价格与状态</span>
                  </TabsTrigger>
                  <TabsTrigger value="links" className="flex gap-1 items-center">
                    <LinkIcon className="h-4 w-4" />
                    <span>链接与下载</span>
                  </TabsTrigger>
                </TabsList>
                
                {/* 基本信息标签页 */}
                <TabsContent value="basic" className="pt-6">
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
                                <SelectItem value="loading" disabled>
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
                                )) : <SelectItem value="no_categories" disabled>没有可用分类</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="author_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>资源作者</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value?.toString()}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="选择作者" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {isAuthorsLoading ? (
                                <SelectItem value="loading" disabled>
                                  加载作者中...
                                </SelectItem>
                              ) : (
                                Array.isArray(authors) ? authors.map((author: any) => (
                                  <SelectItem 
                                    key={author.id} 
                                    value={author.id.toString()}
                                  >
                                    {author.name} - {author.title}
                                  </SelectItem>
                                )) : <SelectItem value="no_authors" disabled>没有可用作者</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>
                
                {/* 媒体信息标签页 */}
                <TabsContent value="media" className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="cover_image"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>封面图片 URL</FormLabel>
                          <FormControl>
                            <div className="space-y-4">
                              <Input {...field} placeholder="输入图片URL" />
                              {field.value && (
                                <div className="rounded-md overflow-hidden w-40 h-30 relative">
                                  <img 
                                    src={field.value} 
                                    alt="资源封面预览" 
                                    className="object-cover w-full h-full"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = 'https://via.placeholder.com/320x180?text=封面预览';
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="video_url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>视频链接</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="输入视频URL" />
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
                              <SelectItem value="中英字幕">中英字幕</SelectItem>
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
                              <SelectItem value="中英字幕">中英字幕</SelectItem>
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
                            value={field.value || ""}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="选择视频分辨率" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="1280x720">1280x720</SelectItem>
                              <SelectItem value="1920x1080">1920x1080</SelectItem>
                              <SelectItem value="4096x2160">4096x2160</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            选择常用的视频分辨率
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>
                
                {/* 内容详情标签页 */}
                <TabsContent value="content" className="pt-6">
                  <div className="space-y-6">
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>资源描述</FormLabel>
                          <FormControl>
                            <Tabs defaultValue="edit" className="border rounded-md">
                              <TabsList className="bg-muted">
                                <TabsTrigger value="edit">编辑</TabsTrigger>
                                <TabsTrigger value="preview">预览</TabsTrigger>
                              </TabsList>
                              <TabsContent value="edit" className="p-4">
                                <Textarea 
                                  {...field} 
                                  placeholder="请输入资源描述(支持Markdown格式)" 
                                  className="min-h-[200px] font-mono text-sm"
                                />
                              </TabsContent>
                              <TabsContent value="preview" className="p-4 border-t prose max-w-none prose-headings:mt-6 prose-headings:mb-3 prose-p:my-2 prose-li:my-1 prose-hr:my-6">
                                {field.value ? (
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {field.value}
                                  </ReactMarkdown>
                                ) : (
                                  <p className="text-muted-foreground">无内容预览</p>
                                )}
                              </TabsContent>
                            </Tabs>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="contents"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>课程目录</FormLabel>
                          <FormControl>
                            <Textarea 
                              {...field} 
                              placeholder="请输入课程目录 (JSON格式)" 
                              className="min-h-[180px] font-mono text-sm"
                            />
                          </FormControl>
                          <FormDescription>
                            课程目录使用JSON格式，例如: 章节和小节的结构化数据
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="faq_content"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>常见问题 FAQ</FormLabel>
                          <FormControl>
                            <Tabs defaultValue="edit" className="border rounded-md">
                              <TabsList className="bg-muted">
                                <TabsTrigger value="edit">编辑</TabsTrigger>
                                <TabsTrigger value="preview">预览</TabsTrigger>
                              </TabsList>
                              <TabsContent value="edit" className="p-4">
                                <Textarea 
                                  {...field} 
                                  placeholder="请输入常见问题 (Markdown格式)" 
                                  className="min-h-[150px] font-mono text-sm"
                                />
                              </TabsContent>
                              <TabsContent value="preview" className="p-4 border-t prose max-w-none prose-headings:mt-6 prose-headings:mb-3 prose-p:my-2 prose-li:my-1 prose-hr:my-6">
                                {field.value ? (
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {field.value}
                                  </ReactMarkdown>
                                ) : (
                                  <p className="text-muted-foreground">无内容预览</p>
                                )}
                              </TabsContent>
                            </Tabs>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>
                
                {/* 价格与状态标签页 */}
                <TabsContent value="pricing" className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>资源价格 (积分) *</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input {...field} type="number" step="0.01" min="0" placeholder="输入积分数量，支持小数" />
                            </div>
                          </FormControl>
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
                              <SelectItem value="feifei">菲菲网</SelectItem>
                              <SelectItem value="other">其他</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>
                
                {/* 链接与下载标签页 */}
                <TabsContent value="links" className="pt-6">
                  <div className="space-y-6">
                    <FormField
                      control={form.control}
                      name="resource_url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>资源下载链接</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="输入资源下载链接" />
                          </FormControl>
                          <FormDescription>
                            用户购买后可见的资源链接，可以是网盘地址或直接下载链接
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="resource_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>资源类型</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            value={field.value || "video"}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="选择资源类型" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="video">视频</SelectItem>
                              <SelectItem value="ebook">电子书</SelectItem>
                              <SelectItem value="audio">音频</SelectItem>
                              <SelectItem value="software">软件</SelectItem>
                              <SelectItem value="document">文档</SelectItem>
                              <SelectItem value="other">其他</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>
              </Tabs>
              
              <div className="flex justify-end space-x-4 pt-6 border-t">
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
        </div>
      </div>
    </div>
  );
}