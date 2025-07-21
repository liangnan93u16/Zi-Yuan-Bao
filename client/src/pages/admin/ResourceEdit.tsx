import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  Loader2,
  FileText,
  BookOpen,
  Info,
  CircleDollarSign,
  Link as LinkIcon,
  ArrowLeft,
  ExternalLink
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Extended schema with client validations
const resourceFormSchema = z.object({
  title: z.string().min(2, "标题至少需要2个字符").max(255, "标题不能超过255个字符"),
  subtitle: z.string().optional(),
  cover_image: z.string().optional(),
  local_image_path: z.string().optional(), // 添加本地图片路径字段
  category_id: z.coerce.number().optional(),
  author_id: z.coerce.number().optional(), // 作者ID
  price: z.string().default("0"), // 更改为字符串类型以匹配后端期望
  video_url: z.string().optional(),
  video_duration: z.coerce.number().optional(),
  video_size: z.string().optional(), // 更改为字符串类型以匹配后端期望
  language: z.string().optional(),
  subtitle_languages: z.string().optional(),
  resolution: z.string().optional(),
  source_type: z.string().optional(),
  status: z.coerce.number().default(1),
  is_free: z.boolean().default(false),
  description: z.string().optional(),
  contents: z.string().optional(), // 课程目录，Markdown格式
  faq_content: z.string().optional(), // 常见问题，Markdown格式
  resource_url: z.string().optional(),
  resource_code: z.string().optional(), // 资源提取码
  resource_type: z.string().optional(),
});

type ResourceFormValues = z.infer<typeof resourceFormSchema>;

export default function ResourceEdit() {
  const [activeTab, setActiveTab] = useState("basic");
  const [_, navigate] = useLocation();
  const params = useParams();
  const resourceId = params.id;
  const { toast } = useToast();

  // Fetch resource data - 使用管理员专用API，不受资源状态限制
  const { data: resource, isLoading: isResourceLoading, refetch } = useQuery({
    queryKey: [`/api/admin/resources/${resourceId}`],
    enabled: !!resourceId, // Only fetch if we have an ID
  }) as { data: any, isLoading: boolean, refetch: () => Promise<any> };

  // Fetch categories
  const { data: categories, isLoading: isCategoriesLoading } = useQuery({
    queryKey: ['/api/categories'],
    staleTime: 0, // 不使用缓存数据
    refetchOnMount: true, // 组件挂载时重新获取数据
  }) as { data: any[], isLoading: boolean };
  
  // Fetch authors
  const { data: authors, isLoading: isAuthorsLoading } = useQuery({
    queryKey: ['/api/authors'],
    staleTime: 0, // 不使用缓存数据 
    refetchOnMount: true, // 组件挂载时重新获取数据
  }) as { data: any[], isLoading: boolean };
  
  // Form setup
  const form = useForm<ResourceFormValues>({
    resolver: zodResolver(resourceFormSchema),
    defaultValues: {
      title: "",
      subtitle: "",
      cover_image: "",
      local_image_path: "", // 添加本地图片路径默认值
      price: "0", // 更改为字符串默认值
      video_url: "",
      video_duration: 0,
      video_size: "0", // 更改为字符串默认值
      language: "",
      subtitle_languages: "中文",
      resolution: "1080p",
      source_type: "original",
      status: 1,
      is_free: false,
      description: "",
      resource_url: "",
      resource_code: "",
    },
  });
  
  // 打印调试信息
  useEffect(() => {
    if (categories) {
      console.log("已加载分类数据:", categories);
    }
    if (authors) {
      console.log("已加载作者数据:", authors);
    }
  }, [categories, authors]);

  // Update form values when resource data is loaded
  useEffect(() => {
    if (resource) {
      console.log("资源加载，原始数据:", JSON.stringify(resource, null, 2));
      
      // 确保价格是字符串类型
      const priceAsString = typeof resource.price === 'string' ? 
        resource.price : (resource.price ? resource.price.toString() : "0");
      
      // 确保视频大小是字符串类型  
      const videoSizeAsString = typeof resource.video_size === 'string' ?
        resource.video_size : (resource.video_size ? resource.video_size.toString() : "0");
        
      // 确保分类ID和作者ID有效
      const categoryId = resource.category_id ? 
        (typeof resource.category_id === 'number' ? resource.category_id : parseInt(resource.category_id as any, 10)) : 
        undefined;
        
      const authorId = resource.author_id ? 
        (typeof resource.author_id === 'number' ? resource.author_id : parseInt(resource.author_id as any, 10)) : 
        undefined;
        
      console.log("处理后的分类ID:", categoryId, "作者ID:", authorId);
      
      // 设置表单默认值
      form.reset({
        title: resource.title,
        subtitle: resource.subtitle || "",
        cover_image: resource.cover_image || "",
        local_image_path: resource.local_image_path || "", // 添加本地图片路径
        category_id: categoryId,
        author_id: authorId,
        price: priceAsString, // 使用字符串价格
        video_url: resource.video_url || "",
        video_duration: resource.video_duration || 0,
        video_size: videoSizeAsString, // 使用字符串视频大小
        language: resource.language,
        subtitle_languages: resource.subtitle_languages || "中文",
        resolution: resource.resolution || "1080p",
        source_type: resource.source_type || "original",
        status: resource.status !== undefined ? resource.status : 0,
        is_free: resource.is_free || false,
        description: resource.description || "",
        contents: resource.contents || "",
        faq_content: resource.faq_content || "",
        resource_url: resource.resource_url || "",
        resource_code: resource.resource_code || "",
      });
      
      // 手动触发表单值更新，确保分类和作者ID正确设置
      setTimeout(() => {
        if (categoryId) {
          form.setValue("category_id", categoryId);
        }
        if (authorId) {
          form.setValue("author_id", authorId);
        }
        
        console.log("表单数据手动设置完成：", {
          categoryId: form.getValues("category_id"),
          authorId: form.getValues("author_id"),
        });
      }, 100);
    }
  }, [resource, form]);

  // Update resource mutation
  const updateResourceMutation = useMutation({
    mutationFn: async (data: ResourceFormValues) => {
      // 确保status字段有值（如果data中没有，则使用原始资源的status值）
      if (data.status === undefined && resource && resource.status !== undefined) {
        data.status = resource.status;
      }
      
      // 数据安全处理 - 确保所有数据都有合适的类型和格式
      const formattedData = {
        ...data,
        // 确保数字类型转换正确
        category_id: data.category_id ? Number(data.category_id) : undefined,
        author_id: data.author_id ? Number(data.author_id) : undefined,
        status: data.status !== undefined ? Number(data.status) : (resource?.status !== undefined ? Number(resource.status) : 1),
        price: data.price ? data.price.toString() : "0",
        video_duration: data.video_duration ? Number(data.video_duration) : undefined,
        video_size: data.video_size ? data.video_size.toString() : undefined,
        // 去除可能的前后空格
        title: data.title ? data.title.trim() : "",
        subtitle: data.subtitle ? data.subtitle.trim() : undefined,
        description: data.description ? data.description.trim() : undefined,
      };
      
      console.log("发送请求数据:", formattedData);
      console.log("请求URL:", `/api/resources/${resourceId}`);
      
      try {
        const result = await apiRequest("PATCH", `/api/resources/${resourceId}`, formattedData);
        console.log("请求成功，返回结果:", result);
        return result;
      } catch (err) {
        console.error("API请求错误:", err);
        throw err;
      }
    },
    onSuccess: (data) => {
      console.log("更新成功:", data);
      toast({
        title: "资源更新成功",
        description: "资源信息已成功更新。",
      });
      
      // 更新缓存
      queryClient.invalidateQueries({ queryKey: ['/api/resources'] });
      queryClient.invalidateQueries({ queryKey: [`/api/resources/${resourceId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/resources/${resourceId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/resources'] });
      
      // 立即重新获取当前资源数据，而不导航离开
      setTimeout(() => {
        refetch();
      }, 100);
    },
    onError: (error: any) => {
      console.error("更新失败:", error);
      let errorMessage = "未知错误";
      
      if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.toString) {
        errorMessage = error.toString();
      }
      
      toast({
        title: "更新失败",
        description: `更新资源时出错: ${errorMessage}`,
        variant: "destructive",
      });
    },
  });

  // 直接保存资源的方法（用于绕过表单验证问题）
  const saveResourceDirectly = () => {
    try {
      // 获取当前表单数据
      const formData = form.getValues();
      
      // 确保保留资源状态值 (resource.status)
      if (!formData.status && resource && resource.status !== undefined) {
        formData.status = resource.status;
      }
      
      // 格式化数据 - 确保price是字符串类型
      const formattedData = {
        ...formData,
        price: formData.price ? formData.price.toString() : "0",
        video_size: formData.video_size ? formData.video_size.toString() : undefined
      };
      
      console.log("直接保存的数据:", formattedData);
      
      // 执行更新操作
      updateResourceMutation.mutate(formattedData);
    } catch (error) {
      console.error("直接保存资源时出错:", error);
      toast({
        title: "更新失败",
        description: `保存资源时出错: ${error}`,
        variant: "destructive",
      });
    }
  };
  
  // 同步图片路径的Mutation
  const syncImagePathMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/resources/${resourceId}/sync-feifei-image-path`, {});
    },
    onSuccess: (data) => {
      console.log("同步图片路径成功:", data);
      toast({
        title: "同步成功",
        description: "本地图片路径已成功从菲菲资源同步",
      });
      
      // 更新缓存
      queryClient.invalidateQueries({ queryKey: ['/api/resources'] });
      queryClient.invalidateQueries({ queryKey: [`/api/resources/${resourceId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/resources/${resourceId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/resources'] });
      
      // 立即重新获取当前资源数据
      setTimeout(() => {
        refetch();
      }, 100);
    },
    onError: (error: any) => {
      console.error("同步图片路径失败:", error);
      let errorMessage = "未知错误";
      
      if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.toString) {
        errorMessage = error.toString();
      }
      
      toast({
        title: "同步失败",
        description: `同步图片路径时出错: ${errorMessage}`,
        variant: "destructive",
      });
    },
  });
  
  // 同步图片路径的方法
  const syncImagePath = () => {
    syncImagePathMutation.mutate();
  };
  
  // 处理图片上传
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // 仅接受图片文件
    if (!file.type.startsWith('image/')) {
      toast({
        title: "上传失败",
        description: "请选择图片文件",
        variant: "destructive",
      });
      return;
    }
    
    // 检查文件大小 (限制为5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "上传失败",
        description: "图片大小不能超过5MB",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await fetch('/api/upload/image', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '上传图片失败');
      }
      
      const result = await response.json();
      
      if (result.success) {
        // 使用COS返回的URL更新封面图片字段
        form.setValue('cover_image', result.data.image_url);
        
        // 清空本地图片路径，因为现在使用COS
        form.setValue('local_image_path', '');
        
        // 立即保存资源，确保图片路径被保存到数据库
        saveResourceDirectly();
        
        toast({
          title: "上传成功",
          description: "图片已成功上传到COS并保存",
        });
        
        // 延迟一点时间后刷新数据，确保能看到最新的图片
        setTimeout(() => {
          refetch();
        }, 500);
      } else {
        throw new Error(result.message || '上传图片失败');
      }
    } catch (error) {
      console.error('上传图片时出错:', error);
      toast({
        title: "上传失败",
        description: error instanceof Error ? error.message : "上传图片时发生错误",
        variant: "destructive",
      });
    }
    
    // 清空file input，允许再次选择相同的文件
    event.target.value = '';
  };

  // Handle form submission
  const onSubmit = (data: ResourceFormValues) => {
    console.log("提交的表单数据:", data);
    console.log("表单验证错误:", form.formState.errors);
    
    if (Object.keys(form.formState.errors).length > 0) {
      console.error("表单存在验证错误:", form.formState.errors);
      toast({
        title: "表单验证失败",
        description: "请检查表单中的错误信息",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // 确保保留资源状态值 (resource.status)
      if (!data.status && resource && resource.status !== undefined) {
        data.status = resource.status;
      }
      
      // 格式化数据 - 确保price和video_size是字符串类型
      const formattedData = {
        ...data,
        price: data.price ? data.price.toString() : "0",
        video_size: data.video_size ? data.video_size.toString() : undefined
      };
      
      console.log("格式化后的表单数据:", formattedData);
      updateResourceMutation.mutate(formattedData);
    } catch (error) {
      console.error("提交表单时出错:", error);
      toast({
        title: "更新失败",
        description: `表单提交错误: ${error}`,
        variant: "destructive",
      });
    }
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
        <div className="border-b border-neutral-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">编辑资源: {resource.title}</h2>
          <Button 
            variant="outline" 
            onClick={() => {
              // 标记需要强制刷新
              localStorage.setItem('force_refresh_resources', 'true');
              
              // 强制立即刷新资源列表
              queryClient.invalidateQueries({ queryKey: ['/api/admin/resources'] });
              queryClient.resetQueries({ queryKey: ['/api/admin/resources'] });
              
              // 先重新获取数据，等待查询完成后再跳转
              queryClient.refetchQueries({ 
                queryKey: ['/api/admin/resources'],
                type: 'all',
                exact: false
              }).then(() => {
                // 在查询完成后导航到资源列表页面
                navigate("/admin/resources");
              });
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
                            onValueChange={(value) => {
                              console.log("分类选择已改变:", value);
                              field.onChange(Number(value));
                            }}
                            value={field.value ? field.value.toString() : resource?.category_id?.toString()}
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
                            onValueChange={(value) => {
                              console.log("作者选择已改变:", value);
                              field.onChange(Number(value));
                            }}
                            value={field.value ? field.value.toString() : resource?.author_id?.toString()}
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
                    
                    <FormField
                      control={form.control}
                      name="language"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>资源语言</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="选择语言" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="中文">中文</SelectItem>
                              <SelectItem value="英文">英文</SelectItem>
                              <SelectItem value="英语">英语</SelectItem>
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
                      name="cover_image"
                      render={({ field }) => (
                        <FormItem className="col-span-1 md:col-span-2">
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
                                <p className="text-sm text-neutral-500 mt-2">推荐尺寸：1920x1080</p>
                              </div>
                            </div>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>
                
                {/* 媒体信息标签页 */}
                <TabsContent value="media" className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 本地图片路径字段 */}
                    <FormField
                      control={form.control}
                      name="local_image_path"
                      render={({ field }) => (
                        <FormItem className="col-span-1 md:col-span-2">
                          <FormLabel>本地图片路径</FormLabel>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                            <FormControl>
                              <Input {...field} placeholder="本地图片路径" />
                            </FormControl>
                            <div className="flex items-center gap-4">
                              {field.value && (
                                <div className="border rounded overflow-hidden w-32 h-20">
                                  <img 
                                    src={field.value.includes('/') 
                                      ? `/images/${field.value.split('/').pop()}` 
                                      : field.value.startsWith('public/images/') 
                                        ? `/images/${field.value.replace('public/images/', '')}`
                                        : field.value} 
                                    alt="本地图片预览" 
                                    className="w-full h-full object-cover" 
                                    onError={(e) => {
                                      console.error("图片加载失败:", field.value);
                                      e.currentTarget.src = "/images/placeholder.svg";
                                    }}
                                  />
                                </div>
                              )}
                              <div className="border border-dashed rounded p-6 text-center flex-grow">
                                <div className="flex justify-center gap-2 flex-wrap">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={syncImagePath}
                                    className="text-xs"
                                  >
                                    从菲菲资源同步图片
                                  </Button>
                                  <label htmlFor="image-upload" className="cursor-pointer">
                                    <div className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 rounded-md px-3 text-xs flex items-center">
                                      上传本地图片
                                    </div>
                                    <input
                                      id="image-upload"
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={handleImageUpload}
                                    />
                                  </label>
                                </div>
                                <p className="text-sm text-neutral-500 mt-2">
                                  本地图片路径用于存储下载的图片
                                </p>
                              </div>
                            </div>
                          </div>
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
                              {field.value && !["1280x720", "1920x1080", "4096x2160"].includes(field.value) && (
                                <SelectItem value={field.value}>{field.value}</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            选择常用的视频分辨率，或者直接输入
                          </FormDescription>
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
                              <SelectItem value="英语">英语</SelectItem>
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
                              <SelectItem value="feifei">菲菲网</SelectItem>
                              <SelectItem value="other">其他</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="video_url"
                      render={({ field }) => (
                        <FormItem className="col-span-1 md:col-span-2">
                          <FormLabel>视频预览URL</FormLabel>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                            <FormControl>
                              <Input {...field} placeholder="视频URL" />
                            </FormControl>
                            <div className="flex items-center h-10">
                              {field.value ? (
                                <p className="text-sm text-green-600">已设置视频预览链接</p>
                              ) : (
                                <p className="text-sm text-neutral-500">未设置视频预览</p>
                              )}
                            </div>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>
                
                {/* 内容详情标签页 */}
                <TabsContent value="content" className="pt-6">
                  {/* 将保存按钮放在内容详情标签页的顶部 */}
                  <div className="flex justify-end mb-6 space-x-4">
                    <Button 
                      type="button" 
                      disabled={updateResourceMutation.isPending}
                      onClick={(e) => {
                        e.preventDefault();
                        saveResourceDirectly();
                      }}
                    >
                      {updateResourceMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          保存中...
                        </>
                      ) : "保存内容"}
                    </Button>
                  </div>
                  
                  <div className="space-y-6">
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex justify-between items-center mb-2">
                            <FormLabel>资源描述</FormLabel>
                            <FormDescription className="m-0">
                              支持 Markdown 格式
                            </FormDescription>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <FormControl>
                                <Textarea {...field} placeholder="输入资源描述" className="min-h-[400px]" />
                              </FormControl>
                            </div>
                            <div className="border rounded-md p-4 overflow-auto max-h-[400px]">
                              <div className="text-sm font-medium mb-2">预览:</div>
                              {field.value ? (
                                <div className="prose prose-sm max-w-none">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {field.value}
                                  </ReactMarkdown>
                                </div>
                              ) : (
                                <div className="text-neutral-500 italic">无内容预览</div>
                              )}
                            </div>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="contents"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex justify-between items-center mb-2">
                            <FormLabel>课程目录</FormLabel>
                            <FormDescription className="m-0">
                              使用 JSON 格式，用于展示课程章节结构
                            </FormDescription>
                          </div>
                          <div className="w-full">
                            <FormControl>
                              <Textarea {...field} placeholder="输入课程目录" className="min-h-[400px] font-mono text-sm" />
                            </FormControl>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="faq_content"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex justify-between items-center mb-2">
                            <FormLabel>常见问题</FormLabel>
                            <FormDescription className="m-0">
                              支持 Markdown 格式，用于展示常见问题与答案
                            </FormDescription>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <FormControl>
                                <Textarea {...field} placeholder="输入常见问题与解答" className="min-h-[400px]" />
                              </FormControl>
                            </div>
                            <div className="border rounded-md p-4 overflow-auto max-h-[400px]">
                              <div className="text-sm font-medium mb-2">预览:</div>
                              {field.value ? (
                                <div className="prose prose-sm max-w-none">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {field.value}
                                  </ReactMarkdown>
                                </div>
                              ) : (
                                <div className="text-neutral-500 italic">无内容预览</div>
                              )}
                            </div>
                          </div>
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
                              <Input {...field} type="number" step="1" placeholder="输入积分数量" />
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
                          <FormDescription>
                            设为免费后，所有用户都可以免费下载此资源
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {/* 资源状态字段已被移除，资源上下架通过资源上下架按钮控制 */}
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
                          <FormDescription className="flex justify-between">
                            <span>用户购买后可见的资源链接，可以是网盘地址或直接下载链接</span>
                            {field.value && (
                              <a 
                                href={field.value} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                <ExternalLink className="h-4 w-4 inline mr-1" />
                                打开链接
                              </a>
                            )}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="resource_code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>资源提取码</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="输入网盘提取码" />
                          </FormControl>
                          <FormDescription>
                            网盘资源的提取码，用户购买后可见
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
              
              {/* 提交按钮 */}
              <div className="flex justify-end pt-4 space-x-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    // 标记需要强制刷新
                    localStorage.setItem('force_refresh_resources', 'true');
                    
                    // 强制立即刷新资源列表
                    queryClient.invalidateQueries({ queryKey: ['/api/admin/resources'] });
                    queryClient.resetQueries({ queryKey: ['/api/admin/resources'] });
                    
                    // 先重新获取数据，等待查询完成后再跳转
                    queryClient.refetchQueries({ 
                      queryKey: ['/api/admin/resources'],
                      type: 'all',
                      exact: false
                    }).then(() => {
                      // 在查询完成后导航到资源列表页面
                      navigate("/admin/resources");
                    });
                  }}
                >
                  取消
                </Button>
                <Button 
                  type="button" 
                  disabled={updateResourceMutation.isPending}
                  onClick={(e) => {
                    e.preventDefault();
                    console.log("保存按钮被点击");
                    console.log("表单状态:", form.formState);
                    console.log("表单数据:", form.getValues());
                    // 使用直接保存方法
                    saveResourceDirectly();
                  }}
                >
                  {updateResourceMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      保存中...
                    </>
                  ) : "保存资源"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}