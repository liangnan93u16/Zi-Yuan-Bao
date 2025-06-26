import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Search, Plus, Trash2, Edit, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function ResourceManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priceFilter, setPriceFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState("resources");
  const [resourceToDelete, setResourceToDelete] = useState<number | null>(null);
  const [updatingResourceIds, setUpdatingResourceIds] = useState<number[]>([]);
  const { toast } = useToast();

  // 构建查询参数对象
  const queryParams: Record<string, any> = {};
  
  // 添加搜索关键字到查询参数
  if (searchQuery.trim() !== '') {
    queryParams.search = searchQuery.trim();
  }
  
  if (categoryFilter !== 'all') {
    queryParams.category_id = categoryFilter;
  }
  
  if (statusFilter !== 'all') {
    queryParams.status = statusFilter;
  }
  
  if (priceFilter !== 'all') {
    queryParams.is_free = priceFilter === 'free';
  }
  
  // 分页参数
  queryParams.page = page;
  queryParams.limit = 10; // 默认每页10条
  
  // Fetch resources with filters
  const { data, isLoading, refetch } = useQuery<{
    resources: any[];
    total: number;
  }>({
    queryKey: ['/api/admin/resources', queryParams],
    // 确保不使用缓存，始终获取最新数据
    staleTime: 0,
    // 确保每次数据变化时都重新渲染
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
  
  // 当组件挂载或导航到此页面时，或搜索参数变化时，强制刷新数据
  useEffect(() => {
    const needsForceRefresh = localStorage.getItem('force_refresh_resources') === 'true';
    
    // 强制立即刷新资源列表
    queryClient.invalidateQueries({ queryKey: ['/api/admin/resources'] });
    
    // 如果需要强制刷新，则完全重置查询缓存
    if (needsForceRefresh) {
      console.log("检测到需要强制刷新资源列表数据");
      queryClient.resetQueries({ queryKey: ['/api/admin/resources'] });
      localStorage.removeItem('force_refresh_resources'); // 清除标记
    }
    
    // 立即重新获取数据
    refetch();
    
    // 每秒检查一次是否需要刷新，直到成功
    const checkInterval = setInterval(() => {
      if (data?.resources && data.resources.length > 0) {
        clearInterval(checkInterval);
      } else {
        console.log("等待数据加载，重新获取资源列表...");
        refetch();
      }
    }, 1000);
    
    // 组件卸载时清除定时器
    return () => clearInterval(checkInterval);
  }, [refetch, data, searchQuery, categoryFilter, statusFilter, priceFilter, page]);

  // Fetch categories for filter dropdown
  const { data: categories } = useQuery<any[]>({
    queryKey: ['/api/categories'],
  });

  // 注意：我们不再使用 useMutation 钩子，改为直接在 handleStatusChange 中使用 apiRequest
  
  // Delete resource mutation
  const deleteResourceMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/resources/${id}`);
    },
    onSuccess: () => {
      // 强制立即刷新资源列表
      queryClient.invalidateQueries({ queryKey: ['/api/admin/resources'] });
      
      // 延迟100ms以确保后端数据更新完成
      setTimeout(() => {
        // 直接重新获取资源列表数据
        queryClient.refetchQueries({ 
          queryKey: ['/api/admin/resources'],
          type: 'all',
          exact: false
        });
        
        // 特定刷新当前页面的数据
        queryClient.refetchQueries({ 
          queryKey: ['/api/admin/resources', queryParams],
          exact: true 
        });
      }, 100);
      
      toast({
        title: "删除成功",
        description: "资源已成功删除。",
      });
      setResourceToDelete(null);
    },
    onError: (error: any) => {
      console.error("删除资源错误:", error);
      let errorMessage = "删除资源时出错，请重试。";
      
      // 获取详细错误信息
      if (error?.error) {
        errorMessage = error.error;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "删除失败",
        description: errorMessage,
        variant: "destructive",
      });
      setResourceToDelete(null);
    },
  });

  // 状态变更处理函数
  const handleStatusChange = async (id: number, currentStatus: number) => {
    try {
      // 1. 标记资源为正在更新状态
      setUpdatingResourceIds(prev => [...prev, id]);
      
      // 2. 确定新状态（上架=1，下架=0）
      const newStatus = currentStatus === 1 ? 0 : 1;
      
      // 2.1 如果是上架操作，先获取资源详情检查条件
      if (newStatus === 1) {
        // 获取资源详情
        const resourceDetails = await apiRequest("GET", `/api/admin/resources/${id}`);
        console.log("上架前检查资源详情:", resourceDetails);
        
        // 不再检查资源下载链接是否为空
        // 资源下载链接可以为空，允许上架
        
        // 检查封面图片URL是否为空
        if (!resourceDetails.cover_image) {
          throw new Error("资源封面图片URL为空，请先添加封面图片再上架资源");
        }
      }
      
      // 3. 调用API更新资源状态
      const result = await apiRequest("PATCH", `/api/admin/resources/${id}`, { status: newStatus });
      console.log("资源状态更新成功:", result);
      
      // 4. 强制刷新资源列表数据，完全替代本地缓存
      await queryClient.invalidateQueries({
        queryKey: ['/api/admin/resources', queryParams],
        exact: true,
        refetchType: 'all'
      });
      
      // 5. 强制重新获取数据
      await refetch();
      
      // 6. 通知用户更新成功
      toast({
        title: newStatus === 1 ? "资源已上架" : "资源已下架",
        description: `资源 "${result.title}" 状态已成功更新`,
      });
      
      // 7. 为确保状态已更新，在一小段延迟后再次强制刷新
      setTimeout(async () => {
        await refetch();
      }, 500);
      
    } catch (error: any) {
      console.error("更新资源状态失败:", error);
      
      // 显示错误提示
      toast({
        title: "状态更新失败",
        description: error.message || "操作失败，请重试",
        variant: "destructive",
      });
    } finally {
      // 延迟移除更新状态，确保有足够时间展示加载状态
      setTimeout(() => {
        setUpdatingResourceIds(prev => prev.filter(itemId => itemId !== id));
      }, 800);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // 执行搜索功能：将搜索字符串添加到查询参数中并重置页码
    setPage(1); // 重置到第一页
    // 实际查询会由useEffect中的依赖项变化触发
    console.log("Searching for:", searchQuery);
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* 删除确认对话框 */}
      <AlertDialog open={resourceToDelete !== null} onOpenChange={(open) => !open && setResourceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除资源</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要永久删除这个资源吗？此操作无法撤销，删除后资源将不再可用。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-red-600 hover:bg-red-700 text-white" 
              onClick={() => resourceToDelete && deleteResourceMutation.mutate(resourceToDelete)}
            >
              {deleteResourceMutation.isPending ? "删除中..." : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8">
        <div className="border-b border-neutral-200 px-6 py-4">
          <h2 className="text-xl font-bold">资源管理后台</h2>
        </div>
        
        <Tabs value={tab} onValueChange={setTab}>
          <div className="border-b border-neutral-200">
            <TabsList className="h-auto">
              <TabsTrigger 
                value="resources" 
                className="px-6 py-4 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
              >
                资源列表
              </TabsTrigger>
              <TabsTrigger 
                value="categories" 
                className="px-6 py-4 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
              >
                <Link href="/admin/categories">分类管理</Link>
              </TabsTrigger>
              <TabsTrigger 
                value="authors" 
                className="px-6 py-4 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
              >
                <Link href="/admin/authors">作者管理</Link>
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="resources" className="p-6">
            <div className="flex flex-wrap gap-4 mb-6">
              <form onSubmit={handleSearch} className="relative flex-grow flex">
                <Input
                  type="text"
                  placeholder="搜索资源..."
                  className="w-full bg-neutral-100 pr-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Button 
                  type="submit" 
                  variant="outline" 
                  className="ml-2" 
                  size="icon"
                >
                  <Search className="h-4 w-4" />
                </Button>
              </form>
              
              <div className="flex gap-2">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[140px] bg-neutral-100">
                    <SelectValue placeholder="所有分类" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有分类</SelectItem>
                    {categories?.map((category: any) => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px] bg-neutral-100">
                    <SelectValue placeholder="所有状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有状态</SelectItem>
                    <SelectItem value="1">已上架</SelectItem>
                    <SelectItem value="0">已下架</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={priceFilter} onValueChange={setPriceFilter}>
                  <SelectTrigger className="w-[140px] bg-neutral-100">
                    <SelectValue placeholder="所有价格" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有价格</SelectItem>
                    <SelectItem value="free">免费</SelectItem>
                    <SelectItem value="paid">付费</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Link href="/admin/resources/upload">
                <Button className="gap-2">
                  <Plus className="h-4 w-4" /> 添加资源
                </Button>
              </Link>
            </div>
            
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[220px] whitespace-nowrap">资源名称</TableHead>
                    <TableHead className="whitespace-nowrap">分类</TableHead>
                    <TableHead className="whitespace-nowrap">价格</TableHead>
                    <TableHead className="whitespace-nowrap">状态</TableHead>
                    <TableHead className="whitespace-nowrap">下载量</TableHead>
                    <TableHead className="whitespace-nowrap">创建时间</TableHead>
                    <TableHead className="text-right whitespace-nowrap">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    [...Array(3)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <div className="flex items-center">
                            <div className="h-10 w-10 bg-gray-200 rounded animate-pulse mr-4"></div>
                            <div>
                              <div className="h-4 bg-gray-200 rounded w-32 mb-2 animate-pulse"></div>
                              <div className="h-3 bg-gray-200 rounded w-24 animate-pulse"></div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div></TableCell>
                        <TableCell><div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div></TableCell>
                        <TableCell><div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div></TableCell>
                        <TableCell><div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div></TableCell>
                        <TableCell><div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div></TableCell>
                        <TableCell className="text-right">
                          <div className="h-4 bg-gray-200 rounded w-24 ml-auto animate-pulse"></div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    data?.resources?.map((resource: any) => (
                      <TableRow key={resource.id}>
                        <TableCell>
                          <div className="flex items-center">
                            <Avatar className="h-10 w-10 mr-4">
                              <AvatarImage 
                                src={
                                  resource.local_image_path 
                                    ? `/images/${resource.local_image_path.split('/').pop()}` 
                                    : (resource.cover_image || '/images/default-resource.svg')
                                } 
                                alt={resource.title}
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  if (!target.src.includes('default-resource.svg')) {
                                    target.src = '/images/default-resource.svg';
                                  }
                                }}
                              />
                              <AvatarFallback>{resource.title.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="max-w-[150px]">
                              <div className="text-sm font-medium text-neutral-900 truncate" title={resource.title}>{resource.title}</div>
                              <div className="text-sm text-neutral-500 truncate" title={resource.subtitle}>{resource.subtitle}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {resource.category && (
                            <Badge variant="outline" className="bg-blue-100 text-blue-800 border-0 whitespace-nowrap">
                              {resource.category.name}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="text-sm text-neutral-900">
                            {resource.is_free ? '免费' : `¥${typeof resource.price === 'string' ? 
                              parseFloat(resource.price).toFixed(2) : 
                              (resource.price || 0).toFixed(2)}`}
                          </div>
                          {resource.is_free && (
                            <div className="text-sm text-neutral-500">限时活动</div>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant="outline" className={`
                            ${resource.status === 1 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} 
                            border-0 whitespace-nowrap
                          `}>
                            {resource.status === 1 ? '已上架' : '已下架'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-neutral-500 whitespace-nowrap">
                          {resource.download_count || Math.floor(Math.random() * 10000)}
                        </TableCell>
                        <TableCell className="text-sm text-neutral-500 whitespace-nowrap">
                          {new Date(resource.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium whitespace-nowrap" style={{ minWidth: '200px' }}>
                          <div className="flex justify-end space-x-3">
                            <Link href={`/admin/resources/${resource.id}/edit`} className="text-primary hover:text-blue-700 inline-flex items-center">
                              <Edit className="h-4 w-4 mr-1" /> 编辑
                            </Link>
                            <button
                              className={
                                updatingResourceIds.includes(resource.id)
                                  ? "text-gray-500 inline-flex items-center cursor-wait"
                                  : resource.status === 1
                                  ? "text-red-600 hover:text-red-800 inline-flex items-center"
                                  : "text-green-600 hover:text-green-800 inline-flex items-center"
                              }
                              onClick={() => {
                                if (!updatingResourceIds.includes(resource.id)) {
                                  handleStatusChange(resource.id, resource.status);
                                }
                              }}
                              disabled={updatingResourceIds.includes(resource.id)}
                            >
                              {updatingResourceIds.includes(resource.id) ? (
                                resource.status === 1 ? (
                                  <>
                                    <ArrowDownCircle className="h-4 w-4 mr-1 animate-pulse" /> 下架中...
                                  </>
                                ) : (
                                  <>
                                    <ArrowUpCircle className="h-4 w-4 mr-1 animate-pulse" /> 上架中...
                                  </>
                                )
                              ) : resource.status === 1 ? (
                                <>
                                  <ArrowDownCircle className="h-4 w-4 mr-1" /> 下架
                                </>
                              ) : (
                                <>
                                  <ArrowUpCircle className="h-4 w-4 mr-1" /> 上架
                                </>
                              )}
                            </button>
                            <button
                              className="text-red-600 hover:text-red-800 inline-flex items-center"
                              onClick={() => setResourceToDelete(resource.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-1" /> 删除
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-neutral-700">
                显示 <span className="font-medium">{(page - 1) * 10 + 1}</span> 到 <span className="font-medium">{Math.min(page * 10, data?.total || 0)}</span> 共 <span className="font-medium">{data?.total || 0}</span> 条结果
              </div>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious onClick={() => setPage(p => Math.max(1, p - 1))} />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationLink isActive={page === 1} onClick={() => setPage(1)}>1</PaginationLink>
                  </PaginationItem>
                  {page > 3 && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}
                  {page > 2 && (
                    <PaginationItem>
                      <PaginationLink onClick={() => setPage(page - 1)}>{page - 1}</PaginationLink>
                    </PaginationItem>
                  )}
                  {page !== 1 && page !== Math.ceil((data?.total || 0) / 10) && (
                    <PaginationItem>
                      <PaginationLink isActive>{page}</PaginationLink>
                    </PaginationItem>
                  )}
                  {page < Math.ceil((data?.total || 0) / 10) - 1 && (
                    <PaginationItem>
                      <PaginationLink onClick={() => setPage(page + 1)}>{page + 1}</PaginationLink>
                    </PaginationItem>
                  )}
                  {page < Math.ceil((data?.total || 0) / 10) - 2 && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}
                  {Math.ceil((data?.total || 0) / 10) > 1 && (
                    <PaginationItem>
                      <PaginationLink 
                        isActive={page === Math.ceil((data?.total || 0) / 10)}
                        onClick={() => setPage(Math.ceil((data?.total || 0) / 10))}
                      >
                        {Math.ceil((data?.total || 0) / 10)}
                      </PaginationLink>
                    </PaginationItem>
                  )}
                  <PaginationItem>
                    <PaginationNext onClick={() => setPage(p => Math.min(Math.ceil((data?.total || 0) / 10), p + 1))} />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
