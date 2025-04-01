import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
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
import { 
  ImagePlus, 
  FileVideo,
  Loader2
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
  resource_url: z.string().optional(),
  resource_type: z.string().optional(),
});

type ResourceFormValues = z.infer<typeof resourceFormSchema>;

export default function ResourceEdit() {
  const [tab, setTab] = useState("edit");
  const [_, navigate] = useLocation();
  const params = useParams();
  const resourceId = params.id;
  const { toast } = useToast();

  // Fetch resource data
  const { data: resource, isLoading: isResourceLoading } = useQuery({
    queryKey: [`/api/resources/${resourceId}`],
    enabled: !!resourceId, // Only fetch if we have an ID
  }) as { data: any, isLoading: boolean };

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
      resource_url: "",
    },
  });

  // Update form values when resource data is loaded
  useEffect(() => {
    if (resource) {
      const numericPrice = typeof resource.price === 'string' ? 
        parseFloat(resource.price) : (resource.price || 0);
        
      form.reset({
        title: resource.title,
        subtitle: resource.subtitle || "",
        cover_image: resource.cover_image || "",
        category_id: resource.category_id,
        price: numericPrice,
        video_url: resource.video_url || "",
        video_duration: resource.video_duration || 0,
        video_size: resource.video_size || 0,
        language: resource.language || "中文",
        subtitle_languages: resource.subtitle_languages || "中文",
        resolution: resource.resolution || "1080p",
        source_type: resource.source_type || "original",
        status: resource.status || 1,
        is_free: resource.is_free || false,
        description: resource.description || "",
        resource_url: resource.resource_url || "",
      });
    }
  }, [resource, form]);

  // Update resource mutation
  const updateResourceMutation = useMutation({
    mutationFn: async (data: ResourceFormValues) => {
      // 将数字转为字符串以匹配后端期望格式
      const formattedData = {
        ...data,
        price: data.price?.toString(),
        video_size: data.video_size?.toString()
      };
      return apiRequest("PATCH", `/api/resources/${resourceId}`, formattedData);
    },
    onSuccess: () => {
      toast({
        title: "资源更新成功",
        description: "资源信息已成功更新。",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/resources'] });
      queryClient.invalidateQueries({ queryKey: [`/api/resources/${resourceId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/resources'] });
      navigate("/admin/resources");
    },
    onError: (error) => {
      toast({
        title: "更新失败",
        description: `更新资源时出错: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const onSubmit = (data: ResourceFormValues) => {
    updateResourceMutation.mutate(data);
  };

  if (isResourceLoading) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>加载资源数据中...</p>
        </div>
      </div>
    );
  }

  if (!resource) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">资源不存在</h2>
          <p className="mb-6">未找到ID为 {resourceId} 的资源，或者您没有权限编辑该资源。</p>
          <Button onClick={() => navigate("/admin/resources")}>
            返回资源列表
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8">
        <div className="border-b border-neutral-200 px-6 py-4">
          <h2 className="text-xl font-bold">编辑资源: {resource.title}</h2>
        </div>
        
        <Tabs value={tab} onValueChange={setTab}>
          <div className="border-b border-neutral-200">
            <TabsList className="h-auto">
              <TabsTrigger 
                value="edit" 
                className="px-6 py-4 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
              >
                编辑资源
              </TabsTrigger>
              <TabsTrigger 
                value="resources" 
                className="px-6 py-4 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
                onClick={() => navigate("/admin/resources")}
              >
                资源列表
              </TabsTrigger>
              <TabsTrigger 
                value="upload" 
                className="px-6 py-4 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
                onClick={() => navigate("/admin/resources/upload")}
              >
                上传资源
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="edit" className="p-6">
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
                          onValueChange={(value) => field.onChange(parseInt(value))}
                          value={field.value?.toString()}
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
                          value={field.value || "中文"}
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
                          value={field.value || "中文"}
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
                          value={field.value || "1080p"}
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
                          value={field.value || "original"}
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
                            value={field.value ? "true" : "false"}
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
                        <FormLabel>资源状态</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={(value) => field.onChange(parseInt(value))}
                            value={field.value?.toString() || "1"}
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
                      <FormLabel>封面图片URL</FormLabel>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                        <FormControl>
                          <Input {...field} placeholder="图片URL" />
                        </FormControl>
                        <div className="flex items-center gap-4">
                          {field.value && (
                            <div className="border rounded overflow-hidden w-32 h-20">
                              <img src={field.value} alt="封面预览" className="w-full h-full object-cover" />
                            </div>
                          )}
                          <div className="border border-dashed rounded p-6 text-center flex-grow">
                            <ImagePlus className="h-8 w-8 mx-auto text-neutral-400" />
                            <p className="text-sm text-neutral-500 mt-2">图片仅支持URL链接</p>
                          </div>
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
                      <FormLabel>视频URL</FormLabel>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                        <div>
                          <FormControl>
                            <Input {...field} placeholder="视频URL" />
                          </FormControl>
                          <p className="text-sm text-neutral-500 mt-1">目前仅支持外链视频</p>
                        </div>
                        <div className="border border-dashed rounded p-6 text-center">
                          <FileVideo className="h-8 w-8 mx-auto text-neutral-400" />
                          <p className="text-sm text-neutral-500 mt-2">视频仅支持URL链接</p>
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="resource_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>资源下载链接</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="请输入百度网盘或阿里云盘链接"
                        />
                      </FormControl>
                      <FormDescription>
                        付费用户购买后可见的资源下载链接
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* 资源链接类型已取消 */}
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>资源描述</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          rows={6}
                          placeholder="请详细描述该资源的内容、特点和适用人群"
                        />
                      </FormControl>
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
                    disabled={updateResourceMutation.isPending}
                  >
                    {updateResourceMutation.isPending ? "更新中..." : "更新资源"}
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