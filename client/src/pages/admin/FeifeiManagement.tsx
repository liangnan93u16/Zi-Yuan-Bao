import { useState, useEffect } from "react";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
  AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FeifeiCategory, FeifeiResource, FeifeiTag, insertFeifeiCategorySchema } from "@shared/schema";

// 扩展FeifeiResource类型，添加tags属性
interface EnrichedFeifeiResource extends FeifeiResource {
  tags?: FeifeiTag[];
}

import { Link } from "wouter";

// 创建表单验证模式
const feifeiCategoryFormSchema = insertFeifeiCategorySchema.extend({
  title: z.string().min(1, "标题不能为空").max(100, "标题不能超过100个字符"),
  url: z.string().url("请输入有效的URL").min(1, "URL不能为空")
});

type FeifeiCategoryFormValues = z.infer<typeof feifeiCategoryFormSchema>;

export default function FeifeiManagement() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isResourcesDialogOpen, setIsResourcesDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<FeifeiCategory | null>(null);
  const [categoryResources, setCategoryResources] = useState<EnrichedFeifeiResource[]>([]);
  const [isResourcesLoading, setIsResourcesLoading] = useState(false);
  const { toast } = useToast();

  // 获取所有菲菲网分类
  const { 
    data: categories = [], 
    isLoading,
    isError,
    refetch
  } = useQuery<FeifeiCategory[]>({
    queryKey: ['/api/feifei-categories'],
  });

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
      return apiRequest("PATCH", `/api/feifei-categories/${id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "分类更新成功",
        description: "分类信息已成功更新。",
      });
      setIsEditDialogOpen(false);
      setSelectedCategory(null);
      queryClient.invalidateQueries({ queryKey: ['/api/feifei-categories'] });
    },
    onError: (error: any) => {
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
      updateCategoryMutation.mutate({ id: selectedCategory.id, data });
    }
  };

  // 确认删除
  const onDeleteConfirm = () => {
    if (selectedCategory) {
      deleteCategoryMutation.mutate(selectedCategory.id);
    }
  };

  // 解析URL
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

  // 获取分类资源
  const fetchCategoryResources = async (categoryId: number) => {
    try {
      setIsResourcesLoading(true);
      const response = await apiRequest<EnrichedFeifeiResource[]>("GET", `/api/feifei-resources/${categoryId}`);
      setCategoryResources(response || []);
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

  // 解析分类URL
  const parseUrl = (category: FeifeiCategory) => {
    setSelectedCategory(category);
    parseCategoryUrlMutation.mutate(category.id);
  };

  // 查看分类资源
  const viewResources = (category: FeifeiCategory) => {
    setSelectedCategory(category);
    fetchCategoryResources(category.id);
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
            <h3 className="text-lg font-semibold">网站分类管理</h3>
            <Button onClick={openCreateDialog} size="sm" className="flex items-center gap-1">
              <Plus className="h-4 w-4" />
              添加网站
            </Button>
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
                    <TableHead className="w-[80px]">ID</TableHead>
                    <TableHead className="w-[250px]">标题</TableHead>
                    <TableHead className="w-[350px]">URL</TableHead>
                    <TableHead className="w-[150px]">创建时间</TableHead>
                    <TableHead className="w-[150px]">更新时间</TableHead>
                    <TableHead className="w-[150px]">操作</TableHead>
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
                    categories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell>{category.id}</TableCell>
                        <TableCell>{category.title}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2 max-w-[320px] truncate">
                            <LinkIcon className="h-4 w-4 flex-shrink-0 text-neutral-400" />
                            <a 
                              href={category.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center truncate"
                            >
                              <span className="truncate">{category.url}</span>
                              <ExternalLink className="h-3 w-3 ml-1 flex-shrink-0" />
                            </a>
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(category.created_at)}</TableCell>
                        <TableCell>{formatDate(category.updated_at)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
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
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedCategory ? `"${selectedCategory.title}" 解析的资源` : "资源列表"}
            </DialogTitle>
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
                )}
              </div>
              
              <div className="overflow-y-auto max-h-[60vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">ID</TableHead>
                      <TableHead className="w-[180px]">标题</TableHead>
                      <TableHead className="w-[150px]">中文标题</TableHead>
                      <TableHead className="w-[150px]">英文标题</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead className="w-[120px]">标签</TableHead>
                      <TableHead className="w-[150px]">创建时间</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoryResources.map((resource) => (
                      <TableRow key={resource.id}>
                        <TableCell>{resource.id}</TableCell>
                        <TableCell>{resource.title}</TableCell>
                        <TableCell>{resource.chinese_title || '-'}</TableCell>
                        <TableCell>{resource.english_title || '-'}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2 max-w-[250px] truncate">
                            <LinkIcon className="h-4 w-4 flex-shrink-0 text-neutral-400" />
                            <a 
                              href={resource.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center truncate"
                            >
                              <span className="truncate">{resource.url}</span>
                              <ExternalLink className="h-3 w-3 ml-1 flex-shrink-0" />
                            </a>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {resource.tags?.map((tag: FeifeiTag) => (
                              <Badge key={tag.id} variant="outline" className="bg-gray-100">
                                {tag.name}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(resource.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
    </div>
  );
}