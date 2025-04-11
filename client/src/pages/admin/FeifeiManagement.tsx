import { useState, useEffect, useReducer } from "react";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Link as LinkIcon,
  ExternalLink,
  Download,
  RefreshCw,
  Search,
  AlertCircle,
  Ban, 
  Check,
  FileSearch,
  FileText,
  Image as ImageIcon,
  Globe,
  Copy,
  Zap,
  Import,
  Upload,
  ArrowUpToLine,
  Magnet as MagnetIcon,
  Save
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FeifeiCategory, FeifeiResource, FeifeiTag, insertFeifeiCategorySchema } from "@shared/schema";

// 扩展FeifeiResource类型，添加tags属性
// 扩展类型以匹配数据库中的类型
interface EnrichedFeifeiResource extends Omit<FeifeiResource, 'parsed_content'> {
  tags?: FeifeiTag[];
  parsed_content?: string | null; // 添加解析内容字段，与服务器返回的类型一致
  details_html: string | null; // 添加详情HTML内容字段，不可为undefined
  local_image_path: string | null; // 本地保存的图片路径
  // markdown_content 字段已在 FeifeiResource 中定义为 string | null，无需在这里重新定义
  // coin_price 字段已在 FeifeiResource 中定义，无需重复定义
  linked_resource_id: number | null; // 添加关联的资源管理系统中的资源ID
}

import { Link } from "wouter";

// 创建表单验证模式
const feifeiCategoryFormSchema = insertFeifeiCategorySchema.extend({
  title: z.string().min(1, "标题不能为空").max(100, "标题不能超过100个字符"),
  url: z.string().url("请输入有效的URL").min(1, "URL不能为空")
});

type FeifeiCategoryFormValues = z.infer<typeof feifeiCategoryFormSchema>;

// 提取上架资源的公共函数，用于单个资源上架和批量上架
const addFeifeiResourceToLibrary = async (resourceId: number, parsed_content?: string) => {
  try {
    const response = await apiRequest<{ message: string, resource: { id: number } }>(
      "POST", 
      `/api/feifei-resources/${resourceId}/to-resource`,
      // 如果提供了解析内容参数，则将其传递到API
      parsed_content ? { parsed_content } : undefined
    );
    return {
      success: true,
      message: response.message || "资源已成功转移到资源库",
      resourceId: response.resource?.id || null
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "将资源转移到资源库时发生错误",
      resourceId: null
    };
  }
};

export default function FeifeiManagement() {
  // 添加loadingAI状态，直接控制AI获取大纲按钮的加载状态
  const [loadingAI, setLoadingAI] = useState(false);
  // 添加isUploading状态，控制待上架按钮的加载状态
  const [isUploading, setIsUploading] = useState(false);
  // 网盘链接提取状态
  const [diskLinkInput, setDiskLinkInput] = useState("");
  const [extractedDiskUrl, setExtractedDiskUrl] = useState("");
  const [extractedDiskCode, setExtractedDiskCode] = useState("");
  const [isSavingDiskInfo, setIsSavingDiskInfo] = useState(false);
  
  // 添加forceUpdate辅助函数，用于强制重新渲染组件
  const [, forceUpdate] = useReducer((x) => x + 1, 0);
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isResourcesDialogOpen, setIsResourcesDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<FeifeiCategory | null>(null);
  const [categoryResources, setCategoryResources] = useState<EnrichedFeifeiResource[]>([]);
  const [selectedResource, setSelectedResource] = useState<EnrichedFeifeiResource | null>(null);
  const [isResourcesLoading, setIsResourcesLoading] = useState(false);
  const [selectedResourceId, setSelectedResourceId] = useState<number | null>(null);
  // 分页相关状态
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  // 搜索关键词状态
  const [searchKeyword, setSearchKeyword] = useState("");
  
  // 关键词搜索处理函数
  const handleSearch = () => {
    // 搜索时重置页码到第一页
    setTablePage(1);
    refetch();
  };
  // 表格分页，区别于资源对话框内的分页
  const [tablePage, setTablePage] = useState(1);
  // 监听表格分页变化并自动刷新数据
  const handleTablePageChange = (page: number) => {
    setTablePage(page);
    // 由于useEffect中的refetch只在page变化后触发，这里增加一个额外的刷新
    setTimeout(() => {
      refetch();
    }, 0); 
  };
  // 作废状态过滤
  const [invalidFilter, setInvalidFilter] = useState<string>("all"); // 'all', 'valid', 'invalid'
  const { toast } = useToast();

  // 获取所有菲菲网分类
  const { 
    data: categoriesData = { categories: [], total: 0 }, 
    isLoading,
    isError,
    refetch
  } = useQuery<{ categories: FeifeiCategory[], total: number }>({
    queryKey: ['/api/feifei-categories', { 
      invalidStatus: invalidFilter !== "all" ? invalidFilter === "invalid" : null,
      keyword: searchKeyword,
      page: tablePage,
      pageSize: 10
    }],
  });
  
  // 当invalidFilter、tablePage或searchKeyword变化时，重新获取数据
  useEffect(() => {
    console.log("页面变化，重新获取数据，当前页:", tablePage);
    refetch();
  }, [invalidFilter, tablePage, searchKeyword, refetch]);
  
  // 从响应中提取分类数组
  const categories = categoriesData.categories;

  // 创建表单
  const createForm = useForm<FeifeiCategoryFormValues>({
    resolver: zodResolver(feifeiCategoryFormSchema),
    defaultValues: {
      title: "",
      url: ""
    }
  });

  // 编辑表单
  const editForm = useForm<FeifeiCategoryFormValues>({
    resolver: zodResolver(feifeiCategoryFormSchema),
    defaultValues: {
      title: "",
      url: ""
    }
  });

  // 当选择一个分类进行编辑时，设置表单值
  useEffect(() => {
    if (selectedCategory && isEditDialogOpen) {
      editForm.reset({
        title: selectedCategory.title,
        url: selectedCategory.url
      });
    }
  }, [selectedCategory, isEditDialogOpen, editForm]);

  // 创建分类
  const createCategoryMutation = useMutation({
    mutationFn: async (data: FeifeiCategoryFormValues) => {
      return apiRequest("POST", "/api/feifei-categories", data);
    },
    onSuccess: () => {
      toast({
        title: "分类创建成功",
        description: "新分类已成功添加。",
      });
      setIsCreateDialogOpen(false);
      createForm.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/feifei-categories'] });
    },
    onError: (error: any) => {
      toast({
        title: "分类创建失败",
        description: error.message || "创建分类时出错，请重试。",
        variant: "destructive",
      });
    }
  });

  // 更新分类
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: FeifeiCategoryFormValues }) => {
      console.log("请求数据:", { id, data });
      try {
        const result = await apiRequest("PATCH", `/api/feifei-categories/${id}`, data);
        console.log("请求成功:", result);
        return result;
      } catch (error) {
        console.error("请求失败:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log("mutation成功:", data);
      toast({
        title: "分类更新成功",
        description: "分类信息已成功更新。",
      });
      setIsEditDialogOpen(false);
      setSelectedCategory(null);
      queryClient.invalidateQueries({ queryKey: ['/api/feifei-categories'] });
    },
    onError: (error: any) => {
      console.error("mutation失败:", error);
      toast({
        title: "分类更新失败",
        description: error.message || "更新分类时出错，请重试。",
        variant: "destructive",
      });
    }
  });

  // 删除分类
  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/feifei-categories/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "分类删除成功",
        description: "分类已成功删除。",
      });
      setIsDeleteDialogOpen(false);
      setSelectedCategory(null);
      queryClient.invalidateQueries({ queryKey: ['/api/feifei-categories'] });
    },
    onError: (error: any) => {
      toast({
        title: "分类删除失败",
        description: error.message || "删除分类时出错，请重试。",
        variant: "destructive",
      });
    }
  });

  // 提交创建表单
  const onCreateSubmit = (data: FeifeiCategoryFormValues) => {
    createCategoryMutation.mutate(data);
  };

  // 提交编辑表单
  const onEditSubmit = (data: FeifeiCategoryFormValues) => {
    if (selectedCategory) {
      console.log("提交编辑表单数据:", data);
      updateCategoryMutation.mutate({ id: selectedCategory.id, data });
    }
  };

  // 确认删除
  const onDeleteConfirm = () => {
    if (selectedCategory) {
      deleteCategoryMutation.mutate(selectedCategory.id);
    }
  };

  // 更新分类作废状态的mutation
  const updateInvalidStatusMutation = useMutation({
    mutationFn: async ({ id, isInvalid }: { id: number; isInvalid: boolean }) => {
      return apiRequest<{ message: string, category: FeifeiCategory }>(
        "PATCH", 
        `/api/feifei-categories/${id}/invalidate`, 
        { isInvalid }
      );
    },
    onSuccess: (data) => {
      toast({
        title: data.category.is_invalid ? "分类已作废" : "分类已取消作废",
        description: data.message || "分类作废状态已成功更新。",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/feifei-categories'] });
    },
    onError: (error: any) => {
      toast({
        title: "状态更新失败",
        description: error.message || "更新分类作废状态时出错，请重试。",
        variant: "destructive",
      });
    }
  });

  // 设置分类作废状态
  const toggleInvalidStatus = (category: FeifeiCategory) => {
    // 切换作废状态
    const newStatus = !(category.is_invalid || false);
    updateInvalidStatusMutation.mutate({ 
      id: category.id, 
      isInvalid: newStatus 
    });
  };
  
  // 解析菲菲网站分类的mutation
  const parseWebsiteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest<{ message: string, categories: FeifeiCategory[] }>("POST", "/api/parse-feifei-website");
    },
    onSuccess: (data) => {
      toast({
        title: "网站解析成功",
        description: data.message || `成功解析并保存了 ${data.categories.length} 个分类`,
      });
      
      // 刷新分类列表
      queryClient.invalidateQueries({ queryKey: ['/api/feifei-categories'] });
    },
    onError: (error: any) => {
      toast({
        title: "网站解析失败",
        description: error.message || "解析菲菲网站时出错，请重试。",
        variant: "destructive",
      });
    }
  });
  
  // 解析分类URL
  const parseCategoryUrlMutation = useMutation({
    mutationFn: async (categoryId: number) => {
      return apiRequest<{ message: string, resources: FeifeiResource[] }>("POST", `/api/feifei-categories/${categoryId}/parse`);
    },
    onSuccess: (data) => {
      toast({
        title: "网站解析成功",
        description: data.message || "成功解析网站资源链接。",
      });
      if (selectedCategory) {
        fetchCategoryResources(selectedCategory.id);
      }
    },
    onError: (error: any) => {
      toast({
        title: "网站解析失败",
        description: error.message || "解析网站链接时出错，请重试。",
        variant: "destructive",
      });
      setIsResourcesLoading(false);
    }
  });
  
  // 这个已被删除，批量上架功能已在下面定义

  // 解析当前分类下所有资源的详细页面内容
  const parseAllResourcesInCategoryMutation = useMutation({
    mutationFn: async (categoryId: number) => {
      return apiRequest<{ message: string }>("POST", `/api/feifei-categories/${categoryId}/parse-all-resources`);
    },
    onSuccess: (data) => {
      toast({
        title: "批量解析任务已启动",
        description: data.message || "分类下所有资源的解析任务已在后台运行，请查看控制台日志了解进度。",
      });
    },
    onError: (error: any) => {
      toast({
        title: "启动批量解析任务失败",
        description: error.message || "启动解析分类下所有资源的任务时出错，请重试。",
        variant: "destructive",
      });
    }
  });

  // 批量上架当前分类下的所有资源到资源库
  const batchAddToResourcesMutation = useMutation({
    mutationFn: async (categoryId: number) => {
      return apiRequest<{ message: string }>("POST", `/api/feifei-categories/${categoryId}/batch-add-to-resources`);
    },
    onSuccess: (data) => {
      toast({
        title: "批量上架任务已启动",
        description: data.message || "分类下所有资源的上架任务已在后台运行，请查看控制台日志了解进度。",
      });
    },
    onError: (error: any) => {
      toast({
        title: "启动批量上架任务失败",
        description: error.message || "启动上架分类下所有资源的任务时出错，请重试。",
        variant: "destructive",
      });
    }
  });
  
  // 导入菲菲分类到资源管理分类
  const importCategoriesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest<{ message: string, data: { created: number, updated: number } }>("POST", "/api/import-feifei-categories");
    },
    onSuccess: (data) => {
      toast({
        title: "分类导入成功",
        description: data.message || `成功导入分类到资源管理系统。`,
      });
      
      // 刷新分类列表
      queryClient.invalidateQueries({ queryKey: ['/api/feifei-categories'] });
    },
    onError: (error: any) => {
      toast({
        title: "分类导入失败",
        description: error.message || "导入菲菲分类到资源管理系统时出错，请重试。",
        variant: "destructive",
      });
    }
  });

  // 解析所有菲菲资源
  const parseAllResourcesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest<{ message: string }>("POST", `/api/parse-all-feifei-resources`);
    },
    onSuccess: (data) => {
      toast({
        title: "批量解析任务已启动",
        description: data.message || "所有菲菲资源的解析任务已在后台运行，请查看控制台日志了解进度。",
      });
    },
    onError: (error: any) => {
      toast({
        title: "启动批量解析任务失败",
        description: error.message || "启动解析所有菲菲资源的任务时出错，请重试。",
        variant: "destructive",
      });
    }
  });

  // 获取分类资源 - 支持分页
  const fetchCategoryResources = async (categoryId: number, page: number = 1, pageSize: number = 10) => {
    try {
      setIsResourcesLoading(true);
      const response = await apiRequest<{
        resources: EnrichedFeifeiResource[], 
        pagination: { total: number, page: number, pageSize: number, totalPages: number }
      }>("GET", `/api/feifei-resources/${categoryId}?page=${page}&pageSize=${pageSize}`);
      
      if (response) {
        setCategoryResources(response.resources || []);
        // 如果API返回分页信息，更新分页状态
        if (response.pagination) {
          setCurrentPage(response.pagination.page);
          // 直接从后端获取总页数，不需要前端计算
          setTotalPages(response.pagination.totalPages);
          setTotalItems(response.pagination.total);
        }
      }
      
      setIsResourcesLoading(false);
      setIsResourcesDialogOpen(true);
    } catch (error: any) {
      toast({
        title: "获取资源失败",
        description: error.message || "获取分类资源时出错，请重试。",
        variant: "destructive",
      });
      setIsResourcesLoading(false);
    }
  };
  
  // 解析单个资源页面(列表页中的解析页面按钮)
  const parseResourcePageMutation = useMutation({
    mutationFn: async (params: { resourceId: number }) => {
      // 这个接口只会从页面获取原始内容并自动解析，不需要传递HTML内容
      // 先获取资源的网页内容并保存到数据库
      return apiRequest<{ message: string, resource: EnrichedFeifeiResource }>(
        "POST", 
        `/api/feifei-resources/${params.resourceId}/fetch-and-parse`
      );
    },
    onSuccess: (data) => {
      toast({
        title: "页面抓取解析成功",
        description: data.message || "成功抓取并解析资源页面内容。",
      });
      
      // 更新当前选中的资源
      if (selectedResource && data.resource.id === selectedResource.id) {
        setSelectedResource(data.resource);
      }
      
      // 更新列表中的资源
      if (selectedCategory) {
        fetchCategoryResources(selectedCategory.id);
      }
    },
    onError: (error: any) => {
      toast({
        title: "页面抓取解析失败",
        description: error.message || "抓取并解析页面内容时出错，请重试。",
        variant: "destructive",
      });
      setSelectedResourceId(null);
    }
  });
  
  // 保存HTML内容的Mutation
  const saveHTMLMutation = useMutation({
    mutationFn: async (params: { resourceId: number, htmlContent: string }) => {
      // 调用API更新资源
      return apiRequest("PATCH", `/api/feifei-resources/${params.resourceId}`, {
        course_html: params.htmlContent
      });
    },
    onSuccess: () => {
      toast({
        title: "保存成功",
        description: "课程HTML内容已保存到数据库",
      });
      // 刷新资源数据
      if (selectedCategory) {
        fetchCategoryResources(selectedCategory.id);
      }
    },
    onError: (error: any) => {
      console.error('保存HTML内容失败:', error);
      toast({
        title: "保存失败",
        description: error.message || "保存HTML内容到数据库时出错",
        variant: "destructive",
      });
    }
  });

  // HTML转Markdown的Mutation
  const htmlToMarkdownMutation = useMutation({
    mutationFn: async (resourceId: number) => {
      return apiRequest<{ message: string, resource: EnrichedFeifeiResource }>("POST", `/api/feifei-resources/${resourceId}/html-to-markdown`);
    },
    onSuccess: (data) => {
      toast({
        title: "转换成功",
        description: "HTML内容已成功转换为Markdown格式",
      });
      
      console.log('HTML转Markdown结果:', {
        resourceId: data.resource.id,
        hasMarkdownContent: !!data.resource.markdown_content,
        markdownContentLength: data.resource.markdown_content?.length || 0,
        markdownContentPreview: data.resource.markdown_content?.substring(0, 100)
      });
      
      // 更新当前选中的资源
      if (selectedResource && data.resource.id === selectedResource.id) {
        setSelectedResource(data.resource);
      }
      
      // 更新列表中的资源
      if (selectedCategory) {
        fetchCategoryResources(selectedCategory.id);
      }
    },
    onError: (error: any) => {
      console.error('HTML转Markdown失败:', error);
      toast({
        title: "转换失败",
        description: error.message || "使用AI将HTML内容转换为Markdown时出错",
        variant: "destructive",
      });
    }
  });

  // 提取并保存网盘链接和提取码的函数
  const extractAndSaveDiskLinkInfo = async () => {
    if (!diskLinkInput || !selectedResource || !selectedResource.id) {
      toast({
        title: "操作失败",
        description: "请先输入包含网盘链接的文本，并确保已选择资源",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSavingDiskInfo(true);

      // 提取网盘链接 (支持多种网盘格式)
      // 支持以"链接："或"链接:"开头的网址，以及普通网址格式
      const urlRegex = /(?:链接[：:])?\s*(https?:\/\/[^\s]+(?:pan|yunpan|cloud|disk|quark)[^\s]*)/i;
      const urlMatch = diskLinkInput.match(urlRegex);
      
      let extractedUrl = "";
      if (urlMatch && urlMatch[1]) {
        extractedUrl = urlMatch[1].trim();
        setExtractedDiskUrl(extractedUrl);
      }

      // 提取提取码 (通常是提取码后面跟着4位字母数字组合)
      const codeRegex = /(?:提取码|密码|访问码|验证码|提取密码|提取)[：:]\s*([a-zA-Z0-9]{4,6})/i;
      const codeMatch = diskLinkInput.match(codeRegex);
      
      let extractedCode = "";
      if (codeMatch && codeMatch[1]) {
        extractedCode = codeMatch[1].trim();
        setExtractedDiskCode(extractedCode);
      } else {
        // 尝试匹配单独的4-6位提取码
        const simpleCodeRegex = /\b([a-zA-Z0-9]{4,6})\b/;
        const simpleCodeMatch = diskLinkInput.match(simpleCodeRegex);
        if (simpleCodeMatch && simpleCodeMatch[1]) {
          extractedCode = simpleCodeMatch[1].trim();
          setExtractedDiskCode(extractedCode);
        }
      }

      // 打印提取结果
      console.log("提取网盘链接结果:", { 
        input: diskLinkInput,
        extractedUrl: extractedUrl,
        extractedCode: extractedCode
      });

      // 如果没有提取到链接，显示警告并终止操作
      if (!extractedUrl) {
        toast({
          title: "提取失败",
          description: "未找到网盘链接，请检查输入文本",
          variant: "destructive",
        });
        return;
      }

      // 使用现有的API更新资源
      await apiRequest("PATCH", `/api/feifei-resources/${selectedResource.id}`, {
        cloud_disk_url: extractedUrl,
        cloud_disk_code: extractedCode
      });

      toast({
        title: "提取并保存成功",
        description: "网盘链接和提取码已成功提取并保存",
      });

      // 更新选中的资源
      setSelectedResource({
        ...selectedResource,
        cloud_disk_url: extractedUrl,
        cloud_disk_code: extractedCode
      });

      // 清空输入框
      setDiskLinkInput("");
    } catch (error: any) {
      toast({
        title: "操作失败",
        description: error.message || "提取或保存网盘信息时出错",
        variant: "destructive",
      });
    } finally {
      setIsSavingDiskInfo(false);
    }
  };

  // AI提取课程大纲的Mutation - 仅调用AI提取大纲API，不保存HTML内容
  const extractOutlineMutation = useMutation({
    mutationFn: async (params: { resourceId: number, htmlContent: string }) => {
      // 设置mutation为pending状态
      // 直接调用AI提取大纲API - 注意这个API应只使用已保存在数据库中的HTML内容，不从前端传递HTML
      return apiRequest<{ message: string, resource: EnrichedFeifeiResource }>("POST", `/api/feifei-resources/${params.resourceId}/extract-outline`);
    },
    onSuccess: (data) => {
      toast({
        title: "提取成功",
        description: "课程大纲已成功提取",
      });
      
      console.log('前端收到解析结果:', {
        resourceId: data.resource.id,
        hasParsedContent: !!data.resource.parsed_content,
        parsedContentLength: data.resource.parsed_content?.length || 0,
        parsedContentPreview: data.resource.parsed_content?.substring(0, 100)
      });
      
      // 更新当前选中的资源
      if (selectedResource && data.resource.id === selectedResource.id) {
        setSelectedResource(data.resource);
        console.log('更新后的selectedResource:', {
          id: data.resource.id,
          hasParsedContent: !!data.resource.parsed_content
        });
      }
      
      // 更新列表中的资源
      if (selectedCategory) {
        fetchCategoryResources(selectedCategory.id);
      }
    },
    onError: (error: any) => {
      toast({
        title: "提取大纲失败",
        description: error.message || "使用AI提取课程大纲时出错",
        variant: "destructive",
      });
    }
  });
  
  // 解析资源页面
  const parseResourcePage = (resource: EnrichedFeifeiResource) => {
    setSelectedResourceId(resource.id);
    parseResourcePageMutation.mutate({ resourceId: resource.id });
  };

  // 解析分类URL
  const parseUrl = (category: FeifeiCategory) => {
    setSelectedCategory(category);
    parseCategoryUrlMutation.mutate(category.id);
  };

  // 查看分类资源
  const viewResources = (category: FeifeiCategory) => {
    setSelectedCategory(category);
    // 重置分页
    setCurrentPage(1);
    fetchCategoryResources(category.id);
  };
  
  // 分页处理
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // 如果当前页改变，重新获取数据
    if (selectedCategory) {
      fetchCategoryResources(selectedCategory.id, page, itemsPerPage);
    }
  };

  // 对话框操作函数
  const openCreateDialog = () => {
    createForm.reset({
      title: "",
      url: ""
    });
    setIsCreateDialogOpen(true);
  };

  const openEditDialog = (category: FeifeiCategory) => {
    setSelectedCategory(category);
    editForm.reset({
      title: category.title,
      url: category.url
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (category: FeifeiCategory) => {
    setSelectedCategory(category);
    setIsDeleteDialogOpen(true);
  };

  // 格式化日期
  const formatDate = (dateString: Date | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8">
        <div className="border-b border-neutral-200 px-6 py-4">
          <h2 className="text-xl font-bold">菲菲网管理</h2>
        </div>
        
        <div className="p-6">
          <div className="mb-6 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-semibold">网站分类管理</h3>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="搜索标题"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="w-[200px]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearch();
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSearch}
                  title="搜索"
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
              <Select value={invalidFilter} onValueChange={setInvalidFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="作废状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="valid">未作废</SelectItem>
                  <SelectItem value="invalid">已作废</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => importCategoriesMutation.mutate()}
                size="sm" 
                className="flex items-center gap-1 mr-2"
                variant="default"
                disabled={importCategoriesMutation.isPending}
                title="将菲菲网分类导入到资源管理分类系统"
              >
                {importCategoriesMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Import className="h-4 w-4 mr-1" />
                )}
                导入分类
              </Button>
              <Button 
                onClick={() => parseWebsiteMutation.mutate()}
                size="sm" 
                className="flex items-center gap-1"
                variant="outline"
                disabled={parseWebsiteMutation.isPending}
                title="解析菲菲网站的分类"
              >
                {parseWebsiteMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    解析中...
                  </>
                ) : (
                  <>
                    <Globe className="h-4 w-4" />
                    解析网站
                  </>
                )}
              </Button>
              <Button onClick={openCreateDialog} size="sm" className="flex items-center gap-1">
                <Plus className="h-4 w-4" />
                添加网站
              </Button>
              <Button 
                onClick={() => parseAllResourcesMutation.mutate()}
                size="sm" 
                className="flex items-center gap-1"
                variant="default"
                disabled={parseAllResourcesMutation.isPending}
                title="解析所有菲菲资源"
              >
                {parseAllResourcesMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    解析中...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    解析所有菲菲资源
                  </>
                )}
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="py-10 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : isError ? (
            <div className="py-10 text-center text-red-500">
              加载数据失败，请刷新页面重试
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">ID</TableHead>
                    <TableHead className="w-[300px]">标题</TableHead>
                    <TableHead className="w-[100px]">状态</TableHead>
                    <TableHead className="w-[120px]">创建时间</TableHead>
                    <TableHead className="w-[120px]">更新时间</TableHead>
                    <TableHead className="w-[200px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6">
                        暂无分类数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    categories.map((category, index) => (
                      <TableRow key={category.id} className={category.is_invalid ? "bg-neutral-50" : ""}>
                        <TableCell>{(tablePage - 1) * 10 + index + 1}</TableCell> {/* 根据当前页码计算序号 */}
                        <TableCell>
                          <a 
                            href={category.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className={`${category.is_invalid ? "text-neutral-500" : "text-blue-600"} hover:underline flex items-center max-w-[320px] truncate`}
                          >
                            <LinkIcon className="h-4 w-4 mr-1 flex-shrink-0 text-neutral-400" />
                            <span className={`truncate ${category.is_invalid ? "line-through" : ""}`}>{category.title}</span>
                            <ExternalLink className="h-3 w-3 ml-1 flex-shrink-0" />
                          </a>
                        </TableCell>
                        <TableCell>
                          <Badge variant={category.is_invalid ? "destructive" : "outline"}>
                            {category.is_invalid ? "已作废" : "正常"}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(category.created_at)}</TableCell>
                        <TableCell>{formatDate(category.updated_at)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Button 
                              onClick={() => openEditDialog(category)} 
                              size="sm" 
                              variant="outline"
                              title="编辑"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              onClick={() => parseUrl(category)} 
                              size="sm" 
                              variant="outline"
                              title="解析URL"
                              disabled={parseCategoryUrlMutation.isPending}
                            >
                              {parseCategoryUrlMutation.isPending && selectedCategory?.id === category.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                            </Button>
                            <Button 
                              onClick={() => viewResources(category)} 
                              size="sm" 
                              variant="outline"
                              title="查看资源"
                              disabled={isResourcesLoading}
                            >
                              {isResourcesLoading && selectedCategory?.id === category.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Search className="h-4 w-4" />
                              )}
                            </Button>
                            <Button 
                              onClick={() => toggleInvalidStatus(category)} 
                              size="sm" 
                              variant={category.is_invalid ? "default" : "secondary"}
                              title={category.is_invalid ? "取消作废" : "作废"}
                              disabled={updateInvalidStatusMutation.isPending}
                              className={category.is_invalid ? "bg-green-600 hover:bg-green-700" : ""}
                            >
                              {updateInvalidStatusMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : category.is_invalid ? (
                                <Check className="h-4 w-4" />
                              ) : (
                                <Ban className="h-4 w-4" />
                              )}
                            </Button>
                            <Button 
                              onClick={() => openDeleteDialog(category)} 
                              size="sm" 
                              variant="destructive"
                              title="删除"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              
              {/* 表格分页 */}
              {categoriesData.total > 10 && (
                <div className="mt-4 flex justify-center">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => handleTablePageChange(Math.max(1, tablePage - 1))}
                          className={tablePage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      
                      {Array.from({ length: Math.ceil(categoriesData.total / 10) }).map((_, index) => {
                        const pageNumber = index + 1;
                        // 显示逻辑：显示当前页附近的页码
                        const totalPages = Math.ceil(categoriesData.total / 10);
                        
                        // 始终显示第一页、最后一页、当前页及其前后页
                        if (
                          pageNumber === 1 || 
                          pageNumber === totalPages || 
                          (pageNumber >= tablePage - 1 && pageNumber <= tablePage + 1)
                        ) {
                          return (
                            <PaginationItem key={pageNumber}>
                              <PaginationLink 
                                onClick={() => handleTablePageChange(pageNumber)}
                                isActive={pageNumber === tablePage}
                              >
                                {pageNumber}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        }
                        
                        // 添加省略号
                        if (
                          (pageNumber === 2 && tablePage > 3) || 
                          (pageNumber === totalPages - 1 && tablePage < totalPages - 2)
                        ) {
                          return <PaginationEllipsis key={pageNumber} />;
                        }
                        
                        return null;
                      })}
                      
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => handleTablePageChange(Math.min(Math.ceil(categoriesData.total / 10), tablePage + 1))}
                          className={tablePage === Math.ceil(categoriesData.total / 10) ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 创建分类对话框 */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>添加新网站</DialogTitle>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>网站标题</FormLabel>
                    <FormControl>
                      <Input placeholder="输入网站标题" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={createForm.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>网站URL</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="输入完整URL地址，包含https://" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  取消
                </Button>
                <Button 
                  type="submit" 
                  disabled={createCategoryMutation.isPending}
                >
                  {createCategoryMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  添加
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* 编辑分类对话框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>编辑网站</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>网站标题</FormLabel>
                    <FormControl>
                      <Input placeholder="输入网站标题" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>网站URL</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="输入完整URL地址，包含https://" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  取消
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateCategoryMutation.isPending}
                >
                  {updateCategoryMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  保存
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* 删除分类对话框 */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>确定要删除这个网站吗？此操作不可恢复。</p>
            {selectedCategory && (
              <div className="mt-2 p-3 bg-neutral-50 rounded-md">
                <p><strong>标题：</strong> {selectedCategory.title}</p>
                <p className="truncate"><strong>URL：</strong> {selectedCategory.url}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              取消
            </Button>
            <Button 
              type="button" 
              variant="destructive" 
              onClick={onDeleteConfirm}
              disabled={deleteCategoryMutation.isPending}
            >
              {deleteCategoryMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 查看资源对话框 */}
      <Dialog open={isResourcesDialogOpen} onOpenChange={setIsResourcesDialogOpen}>
        <DialogContent className="sm:max-w-[1000px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex justify-between items-center">
              <DialogTitle>
                {selectedCategory ? `"${selectedCategory.title}" 解析的资源` : "资源列表"}
              </DialogTitle>
            
            </div>
          </DialogHeader>
          
          {isResourcesLoading ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : categoryResources.length === 0 ? (
            <div className="py-8 text-center">
              <AlertCircle className="w-12 h-12 mx-auto text-yellow-500 mb-3" />
              <p className="text-lg text-gray-500">暂无解析资源</p>
              <p className="text-sm text-gray-400 mt-1">
                尝试点击"解析URL"按钮从网站提取链接
              </p>
              {selectedCategory && (
                <Button
                  onClick={() => parseUrl(selectedCategory)}
                  className="mt-4"
                  variant="outline"
                  disabled={parseCategoryUrlMutation.isPending}
                >
                  {parseCategoryUrlMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      正在解析...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      解析URL
                    </>
                  )}
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="mb-4 flex justify-between items-center">
                <p className="text-sm text-gray-500">
                  共找到 {categoryResources.length} 个资源链接
                </p>
                {selectedCategory && (
                  <div className="flex space-x-2">
                    <Button
                      onClick={() => parseUrl(selectedCategory)}
                      size="sm"
                      variant="outline"
                      disabled={parseCategoryUrlMutation.isPending}
                    >
                      {parseCategoryUrlMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          重新解析
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          重新解析
                        </>
                      )}
                    </Button>
                    
                    <Button
                      onClick={() => {
                        if (selectedCategory) {
                          console.log(`开始对分类 ID:${selectedCategory.id} "${selectedCategory.title}" 下所有资源进行解析`);
                          parseAllResourcesInCategoryMutation.mutate(selectedCategory.id);
                        }
                      }}
                      size="sm"
                      variant="outline"
                      className="flex items-center gap-1"
                      disabled={parseAllResourcesInCategoryMutation.isPending}
                      title="批量解析当前分类下所有资源的详细信息（包括所有分页），分批次处理以避免内存溢出，自动提取资源标题、链接、标签和元数据，每10个资源暂停1秒以降低服务器负载"
                    >
                      {parseAllResourcesInCategoryMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          解析中...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4" />
                          重新解析全部
                        </>
                      )}
                    </Button>
                    
                    <Button
                      onClick={() => {
                        if (selectedCategory) {
                          console.log(`开始对分类 ID:${selectedCategory.id} "${selectedCategory.title}" 下所有资源进行批量上架`);
                          batchAddToResourcesMutation.mutate(selectedCategory.id);
                        }
                      }}
                      size="sm"
                      variant="default"
                      className="flex items-center gap-1"
                      disabled={batchAddToResourcesMutation.isPending}
                      title="批量将当前分类下所有资源上架到资源库（包括所有分页），会自动跳过已上架的资源"
                    >
                      {batchAddToResourcesMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          上架中...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          批量上架
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
              
              <div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">ID</TableHead>
                      <TableHead className="w-[340px]">中文标题</TableHead>
                      <TableHead className="w-[100px]">导入状态</TableHead>
                      <TableHead className="w-[100px]">更新时间</TableHead>
                      <TableHead className="w-[240px]">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoryResources.map((resource, index) => (
                      <TableRow key={resource.id}>
                        <TableCell>{(currentPage - 1) * itemsPerPage + index + 1}</TableCell> {/* 显示基于当前页的连续序号 */}
                        <TableCell>
                          <a 
                            href={resource.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline flex items-center"
                          >
                            <LinkIcon className="h-4 w-4 mr-1 flex-shrink-0 text-neutral-400" />
                            <span>{resource.chinese_title}</span>
                            <ExternalLink className="h-3 w-3 ml-1 flex-shrink-0" />
                          </a>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {resource.linked_resource_id ? (
                              <>
                                <Badge variant="outline" className="bg-green-50 border-green-200 text-green-600">
                                  已导入
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation(); // 阻止事件冒泡，防止触发行点击事件
                                    window.open(`/admin/resources/${resource.linked_resource_id}/edit`, '_blank', 'noopener');
                                  }}
                                >
                                  <Pencil className="h-3 w-3 mr-1" />
                                  编辑
                                </Button>
                              </>
                            ) : (
                              <Badge variant="outline" className="bg-gray-50 border-gray-200 text-gray-600">
                                未导入
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{resource.last_update ? formatDate(new Date(resource.last_update)) : '-'}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => parseResourcePage(resource)}
                              size="sm"
                              variant="outline"
                              disabled={parseResourcePageMutation.isPending && selectedResourceId === resource.id}
                            >
                              {parseResourcePageMutation.isPending && selectedResourceId === resource.id ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  解析中
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="mr-2 h-4 w-4" />
                                  解析页面
                                </>
                              )}
                            </Button>
                            <Button
                              onClick={() => {
                                setSelectedResource(resource);
                                setIsDetailsDialogOpen(true);
                              }}
                              size="sm"
                              variant="outline"
                              disabled={false}
                              title="查看资源详情"
                            >
                              <FileSearch className="mr-2 h-4 w-4" />
                              查看详情
                            </Button>

                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {/* 分页控件 */}
                {totalItems > itemsPerPage && (
                  <div className="mt-4 flex justify-center">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious 
                            onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                            className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                        
                        {Array.from({ length: totalPages }).map((_, index) => {
                          const pageNumber = index + 1;
                          
                          // 显示逻辑：总是显示第一页、最后一页，当前页及其前后页
                          const shouldShowPageNumber = 
                            pageNumber === 1 || 
                            pageNumber === totalPages || 
                            Math.abs(pageNumber - currentPage) <= 1;
                          
                          // 省略号逻辑
                          if (!shouldShowPageNumber) {
                            // 在第一页之后且在当前页之前要显示省略号
                            if (pageNumber === 2 && currentPage > 3) {
                              return (
                                <PaginationItem key={`ellipsis-1`}>
                                  <PaginationEllipsis />
                                </PaginationItem>
                              );
                            }
                            // 在当前页之后且在最后一页之前要显示省略号
                            if (pageNumber === totalPages - 1 && currentPage < totalPages - 2) {
                              return (
                                <PaginationItem key={`ellipsis-2`}>
                                  <PaginationEllipsis />
                                </PaginationItem>
                              );
                            }
                            return null;
                          }
                          
                          return (
                            <PaginationItem key={pageNumber}>
                              <PaginationLink
                                isActive={pageNumber === currentPage}
                                onClick={() => handlePageChange(pageNumber)}
                              >
                                {pageNumber}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        })}
                        
                        <PaginationItem>
                          <PaginationNext 
                            onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                            className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </div>
            </>
          )}
          
          <DialogFooter>
            <Button 
              type="button" 
              onClick={() => setIsResourcesDialogOpen(false)}
            >
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 资源详情对话框 */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="sm:max-w-[1000px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>资源详情信息</DialogTitle>
          </DialogHeader>
          
          {selectedResource ? (
            <div className="space-y-6">
              {/* 待上架按钮和编辑链接容器 */}
              <div className="w-full flex space-x-2">
                {/* 待上架按钮 */}
                <Button 
                  variant="outline" 
                  className="flex-grow py-3 text-base"
                  disabled={isUploading}
                  onClick={async () => {
                    if (!selectedResource) return;
                    
                    // 设置上传状态为true，禁用按钮
                    setIsUploading(true);
                    
                    // 确保获取最新的解析结果
                    const parsedContent = selectedResource.parsed_content;
                    
                    if (!parsedContent) {
                      toast({
                        title: "警告",
                        description: "该资源没有解析结果。将继续上架，但课程目录将为空。",
                        variant: "warning"
                      });
                    }
                    
                    // 使用公共函数进行资源上架，传递解析结果
                    const result = await addFeifeiResourceToLibrary(
                      selectedResource.id,
                      parsedContent // 将解析结果作为第二个参数传递
                    );
                    
                    if (result.success) {
                      // 操作成功，更新UI状态
                      if (result.resourceId) {
                        // 在当前selectedResource上存储关联的资源ID
                        setSelectedResource({
                          ...selectedResource,
                          linked_resource_id: result.resourceId
                        });
                      }
                      
                      toast({
                        title: "操作成功",
                        description: parsedContent 
                          ? "资源已成功转移到资源库，解析结果已复制到课程目录"
                          : "资源已成功转移到资源库，默认状态为下架"
                      });
                    } else {
                      // 操作失败，显示错误信息
                      toast({
                        title: "操作失败",
                        description: result.message || "将资源转移到资源库时发生错误",
                        variant: "destructive"
                      });
                    }
                    
                    // 处理完成后，恢复按钮状态
                    setIsUploading(false);
                  }}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      上架中...
                    </>
                  ) : "待上架"}
                </Button>
                
                {/* 资源编辑链接 - 仅当资源已上架时显示 */}
                {selectedResource && selectedResource.linked_resource_id && (
                  <Button
                    variant="outline"
                    className="py-3 text-base flex items-center"
                    onClick={() => {
                      window.open(`/admin/resources/${selectedResource.linked_resource_id}/edit`, '_blank', 'noopener');
                    }}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    编辑
                  </Button>
                )}
              </div>
              
              {/* Tab标签页：基本内容和详情内容 */}
              <div>
                <Tabs defaultValue="basic">
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="basic">基本信息</TabsTrigger>
                    <TabsTrigger value="details">详情介绍</TabsTrigger>
                    <TabsTrigger value="course-content">课程内容解析</TabsTrigger>
                    <TabsTrigger value="parsed-json">解析结果</TabsTrigger>
                    <TabsTrigger value="disk-link">网盘链接</TabsTrigger>
                  </TabsList>
                  <TabsContent value="basic">
                    <div className="space-y-6 pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-medium text-gray-500 mb-2">基本信息</h4>
                          <div className="space-y-2 bg-gray-50 p-3 rounded-md">
                            <p><strong>中文标题：</strong> {selectedResource.chinese_title}</p>
                            <p><strong>英文标题：</strong> {selectedResource.english_title || '-'}</p>
                            <p><strong>资源分类：</strong> {selectedResource.resource_category || '-'}</p>
                            <p><strong>热度：</strong> {selectedResource.popularity || '-'}</p>
                            <p><strong>发布时间：</strong> {selectedResource.publish_date || '-'}</p>
                            <p><strong>最近更新：</strong> {selectedResource.last_update || '-'}</p>
                            <p><strong>金币价格：</strong> {selectedResource.coin_price ? `${selectedResource.coin_price} 金币` : '-'}</p>
                            {(selectedResource.local_image_path || selectedResource.image_url) && (
                              <div>
                                <p><strong>资源图片：</strong></p>
                                {selectedResource.local_image_path ? (
                                  <div className="mt-2 max-w-xs">
                                    <img 
                                      src={selectedResource.local_image_path} 
                                      alt={selectedResource.chinese_title || "资源图片"} 
                                      className="rounded-md border border-gray-200 max-h-48 object-contain"
                                    />
                                    <div className="mt-1 text-xs text-gray-500">
                                      <span>本地图片</span>
                                      <a 
                                        href={selectedResource.local_image_path} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="text-blue-500 hover:text-blue-700 underline inline-flex items-center ml-2 gap-1"
                                      >
                                        <span>查看原图</span>
                                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                      </a>
                                    </div>
                                  </div>
                                ) : selectedResource.image_url && (
                                  <div className="mt-2">
                                    <a 
                                      href={selectedResource.image_url} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="text-blue-500 hover:text-blue-700 underline inline-flex items-center gap-1"
                                    >
                                      <span>查看远程图片</span>
                                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                    </a>
                                  </div>
                                )}
                              </div>
                            )}
                            {selectedResource.preview_url && (
                              <p>
                                <strong>课程预览：</strong> 
                                <a 
                                  href={selectedResource.preview_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-blue-500 hover:text-blue-700 underline inline-flex items-center ml-1 gap-1"
                                >
                                  <span>查看预览</span>
                                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                </a>
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="text-sm font-medium text-gray-500 mb-2">内容规格</h4>
                          <div className="space-y-2 bg-gray-50 p-3 rounded-md">
                            <p><strong>文件内容：</strong> {selectedResource.content_info || '-'}</p>
                            <p><strong>视频尺寸：</strong> {selectedResource.video_size || '-'}</p>
                            <p><strong>文件大小：</strong> {selectedResource.file_size || '-'}</p>
                            <p><strong>课时：</strong> {selectedResource.duration || '-'}</p>
                            <p><strong>语言：</strong> {selectedResource.language || '-'}</p>
                            <p><strong>字幕：</strong> {selectedResource.subtitle || '-'}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 mb-2">标签</h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedResource.tags && selectedResource.tags.length > 0 ? (
                            selectedResource.tags.map((tag: FeifeiTag) => (
                              <Badge key={tag.id} variant="secondary">
                                {tag.name}
                              </Badge>
                            ))
                          ) : (
                            <p className="text-gray-500 italic">暂无标签</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="details">
                    <div className="flex justify-end space-x-2 mt-2 mb-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={htmlToMarkdownMutation.isPending}
                        onClick={() => {
                          if (selectedResource && selectedResource.id) {
                            // 设置转换中状态
                            setLoadingAI(true);
                            // 调用HTML转Markdown的API
                            htmlToMarkdownMutation.mutate(selectedResource.id, {
                              onSettled: () => {
                                setLoadingAI(false);
                              }
                            });
                          } else {
                            toast({
                              title: "无法转换",
                              description: "未选择资源或资源ID无效",
                              variant: "destructive",
                            });
                          }
                        }}
                      >
                        {htmlToMarkdownMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            转换中...
                          </>
                        ) : (
                          <>
                            <FileText className="h-4 w-4 mr-1" />
                            转换为Markdown
                          </>
                        )}
                      </Button>
                    </div>
                    
                    {/* 如果有转换后的Markdown内容，显示转换状态 */}
                    {selectedResource?.markdown_content && (
                      <div className="bg-green-50 border border-green-200 rounded-md p-2 mb-2 text-sm text-green-700">
                        已将HTML内容转换为Markdown格式，转换后的内容将在导入资源时自动使用
                      </div>
                    )}
                    
                    <div className="bg-gray-50 p-3 rounded-md">
                      <div 
                        className="prose max-w-none" 
                        dangerouslySetInnerHTML={{ __html: selectedResource.details_html || '暂无详情' }}
                      />
                    </div>
                  </TabsContent>
                  <TabsContent value="course-content">
                    <div className="space-y-4 mt-3">
                      <div>
                        <label htmlFor="htmlContent" className="block text-sm font-medium text-gray-700 mb-1">
                          HTML代码
                        </label>
                        <textarea
                          id="htmlContent"
                          className="w-full h-40 p-2 border border-gray-300 rounded-md"
                          placeholder="请粘贴课程的HTML代码..."
                          defaultValue={selectedResource?.course_html || ""}
                        />
                      </div>
                      <div className="flex justify-end space-x-4">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={loadingAI}
                          onClick={() => {
                            // 使用AI提取课程大纲
                            if (!selectedResource || !selectedResource.id) {
                              toast({
                                title: "无法提取大纲",
                                description: "未选择资源或资源ID无效",
                                variant: "destructive",
                              });
                              return;
                            }
                            
                            // 获取当前文本域中的HTML内容
                            const htmlContent = (document.getElementById('htmlContent') as HTMLTextAreaElement).value;
                            if (!htmlContent) {
                              toast({
                                title: "没有内容",
                                description: "请先粘贴HTML代码",
                                variant: "destructive",
                              });
                              return;
                            }
                            
                            // 立即设置加载状态 - 确保按钮立即显示"提取中..."
                            setLoadingAI(true);
                            
                            // 先通知用户操作开始
                            toast({
                              title: "正在处理",
                              description: "正在保存HTML内容并准备获取课程大纲...",
                            });
                            
                            console.log(`AI获取大纲按钮：先保存HTML内容，然后再直接调用AI提取大纲API，资源ID: ${selectedResource.id}`);
                            
                            // 先保存HTML内容，使用独立的API调用
                            apiRequest("PATCH", `/api/feifei-resources/${selectedResource.id}`, {
                              course_html: htmlContent
                            })
                              .then(() => {
                                // 保存成功后，调用AI提取大纲
                                console.log("HTML内容已保存，开始调用AI提取大纲API（不从网站获取内容，直接使用数据库中的HTML）...");
                                
                                // 调用AI提取大纲API - 直接使用数据库中的HTML内容，不再从网页获取
                                return extractOutlineMutation.mutateAsync({
                                  resourceId: selectedResource.id,
                                  htmlContent: ""  // 这个参数不再使用，API将使用数据库中的HTML内容
                                });
                              })
                              .catch(error => {
                                console.error("保存HTML或提取大纲过程中出错:", error);
                                toast({
                                  title: "操作失败",
                                  description: error.message || "保存内容或提取大纲过程中出错",
                                  variant: "destructive",
                                });
                              })
                              .finally(() => {
                                // 无论成功还是失败，都将加载状态重置为false
                                setLoadingAI(false);
                              });
                          }}
                        >
                          {loadingAI ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              提取中...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="mr-2 h-4 w-4" />
                              AI获取大纲
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          disabled={saveHTMLMutation.isPending}
                          onClick={() => {
                            const htmlContent = (document.getElementById('htmlContent') as HTMLTextAreaElement).value;
                            if (htmlContent) {
                              if (selectedResource && selectedResource.id) {
                                // 调用保存mutation
                                saveHTMLMutation.mutate({
                                  resourceId: selectedResource.id,
                                  htmlContent: htmlContent
                                });
                              } else {
                                toast({
                                  title: "无法保存",
                                  description: "未选择资源或资源ID无效",
                                  variant: "destructive",
                                });
                              }
                            } else {
                              toast({
                                title: "没有内容",
                                description: "请先粘贴HTML代码",
                                variant: "destructive",
                              });
                            }
                          }}
                        >
                          {saveHTMLMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              保存中...
                            </>
                          ) : (
                            "保存"
                          )}
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="parsed-json">
                    <div className="space-y-4 mt-3">
                      <div className="bg-gray-50 p-3 rounded-md">
                        {selectedResource && selectedResource.parsed_content ? (
                          <div>
                            <div className="flex justify-between items-center mb-3">
                              <h3 className="text-sm font-medium">解析结果（JSON）</h3>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  // 复制到剪贴板
                                  navigator.clipboard.writeText(
                                    selectedResource.parsed_content || ""
                                  ).then(() => {
                                    toast({
                                      title: "已复制",
                                      description: "解析结果已复制到剪贴板",
                                    });
                                  });
                                }}
                              >
                                <Copy className="h-4 w-4 mr-1" />
                                复制
                              </Button>
                            </div>
                            <pre className="bg-gray-100 p-4 rounded-md text-xs whitespace-pre-wrap">
                              {selectedResource.parsed_content}
                            </pre>
                            <div className="text-xs mt-2 text-gray-500">
                              {selectedResource.parsed_content ? 
                                `解析成功，内容长度: ${selectedResource.parsed_content.length} 字符` : 
                                "解析内容为空，请重新尝试解析"}
                            </div>
                            
                            {/* 章节列表展示 */}
                            {(() => {
                              try {
                                // 尝试解析JSON
                                const parsedData = selectedResource.parsed_content ? 
                                  JSON.parse(selectedResource.parsed_content) : null;
                                
                                // 检查是否有中文字段名（"章节"）或英文字段名（"chapters"）
                                if ((parsedData && parsedData.chapters && parsedData.chapters.length > 0) ||
                                    (parsedData && parsedData.章节 && parsedData.章节.length > 0)) {
                                  
                                  // 获取章节数组，兼容中英文字段名
                                  const chapters = parsedData.章节 || parsedData.chapters;
                                  
                                  return (
                                    <div className="mt-4">
                                      <h3 className="text-sm font-medium mb-2">章节列表</h3>
                                      <div className="space-y-3">
                                        {chapters.map((chapter: any, idx: number) => (
                                          <div key={idx} className="border rounded-md p-3">
                                            <div className="flex justify-between">
                                              {/* 兼容中英文字段名 */}
                                              <h4 className="font-medium">{chapter.标题 || chapter.title}</h4>
                                              <span className="text-sm text-gray-500">{chapter.时长 || chapter.duration}</span>
                                            </div>
                                            
                                            {/* 兼容中英文字段名 */}
                                            {((chapter.讲座 && chapter.讲座.length > 0) || 
                                              (chapter.lectures && chapter.lectures.length > 0)) ? (
                                              <ul className="mt-2 space-y-1">
                                                {/* 获取讲座数组，兼容中英文字段名 */}
                                                {(chapter.讲座 || chapter.lectures).map((lecture: any, lectureIdx: number) => (
                                                  <li key={lectureIdx} className="text-sm pl-4 border-l-2 border-gray-200">
                                                    <div className="flex justify-between">
                                                      {/* 兼容中英文字段名 */}
                                                      <span>{lecture.标题 || lecture.title}</span>
                                                      <span className="text-gray-500">{lecture.时长 || lecture.duration}</span>
                                                    </div>
                                                  </li>
                                                ))}
                                              </ul>
                                            ) : (
                                              <p className="text-sm text-gray-500 mt-1">暂无讲座内容</p>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              } catch (error) {
                                console.error("解析JSON失败:", error);
                                return null;
                              }
                            })()}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <p className="text-gray-500">暂无课程大纲，请先点击"AI获取大纲"按钮提取课程结构</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                  
                  {/* 网盘链接标签页 */}
                  <TabsContent value="disk-link">
                    <div className="space-y-4 mt-3">
                      <div className="flex justify-between items-center">
                        <h3 className="text-sm font-medium">当前网盘链接信息</h3>
                        {(selectedResource?.cloud_disk_url || selectedResource?.cloud_disk_code) && (
                          <div className="flex space-x-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                // 复制网盘链接到剪贴板
                                const linkText = `链接: ${selectedResource?.cloud_disk_url || ''}\n提取码: ${selectedResource?.cloud_disk_code || ''}`;
                                navigator.clipboard.writeText(linkText).then(() => {
                                  toast({
                                    title: "已复制",
                                    description: "网盘链接信息已复制到剪贴板",
                                  });
                                });
                              }}
                            >
                              <Copy className="h-4 w-4 mr-1" />
                              复制链接信息
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* 显示当前网盘链接信息 */}
                      <div className="bg-gray-50 p-3 rounded-md">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p><strong>网盘链接：</strong> 
                              {selectedResource?.cloud_disk_url ? (
                                <a 
                                  href={selectedResource.cloud_disk_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-blue-500 hover:text-blue-700 underline inline-flex items-center ml-1 gap-1"
                                >
                                  <span>{selectedResource.cloud_disk_url}</span>
                                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                </a>
                              ) : (
                                <span className="text-gray-500 italic">暂无网盘链接</span>
                              )}
                            </p>
                          </div>
                          <div>
                            <p><strong>提取码：</strong> 
                              {selectedResource?.cloud_disk_code ? (
                                <code className="bg-gray-200 px-1 py-0.5 rounded">{selectedResource.cloud_disk_code}</code>
                              ) : (
                                <span className="text-gray-500 italic">暂无提取码</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* 输入框和提取按钮 */}
                      <div className="mt-4">
                        <label htmlFor="diskLinkInput" className="block text-sm font-medium text-gray-700 mb-1">
                          网盘信息文本
                        </label>
                        <textarea
                          id="diskLinkInput"
                          className="w-full h-32 p-2 border border-gray-300 rounded-md"
                          placeholder="请粘贴包含网盘链接和提取码的文本，例如：链接: https://pan.baidu.com/s/xxx 提取码: abcd"
                          value={diskLinkInput}
                          onChange={(e) => setDiskLinkInput(e.target.value)}
                        />
                      </div>

                      {/* 提取结果显示 */}
                      {(extractedDiskUrl || extractedDiskCode) && (
                        <div className="bg-green-50 border border-green-200 p-3 rounded-md">
                          <h4 className="text-sm font-medium text-green-700 mb-2">提取结果</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p><strong>提取的链接：</strong> 
                                {extractedDiskUrl ? (
                                  <a 
                                    href={extractedDiskUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="text-blue-500 hover:text-blue-700 underline inline-flex items-center ml-1 gap-1"
                                  >
                                    <span className="truncate">{extractedDiskUrl}</span>
                                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                  </a>
                                ) : (
                                  <span className="text-gray-500 italic">未提取到链接</span>
                                )}
                              </p>
                            </div>
                            <div>
                              <p><strong>提取的密码：</strong> 
                                {extractedDiskCode ? (
                                  <code className="bg-gray-200 px-1 py-0.5 rounded">{extractedDiskCode}</code>
                                ) : (
                                  <span className="text-gray-500 italic">未提取到密码</span>
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 按钮组 */}
                      <div className="flex justify-end mt-4">
                        <Button
                          type="button"
                          onClick={extractAndSaveDiskLinkInfo}
                          disabled={!diskLinkInput || isSavingDiskInfo}
                          className="w-full"
                        >
                          {isSavingDiskInfo ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              处理中...
                            </>
                          ) : (
                            <>
                              <MagnetIcon className="mr-2 h-4 w-4" />
                              提取并保存网盘信息
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
              
              <div className="pt-4 flex justify-between items-center">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(selectedResource.url, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  访问原始页面
                </Button>
                

              </div>
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-gray-500">未选择资源</p>
            </div>
          )}
          
          {/* 已移除底部关闭按钮 */}
        </DialogContent>
      </Dialog>
    </div>
  );
}