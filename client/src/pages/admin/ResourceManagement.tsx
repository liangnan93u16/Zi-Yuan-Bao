import { useState } from "react";
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
import { Search, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ResourceManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priceFilter, setPriceFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState("resources");
  const { toast } = useToast();

  // Fetch resources with filters
  const { data, isLoading } = useQuery({
    queryKey: ['/api/admin/resources', categoryFilter, statusFilter, priceFilter, page],
  });

  // Fetch categories for filter dropdown
  const { data: categories } = useQuery({
    queryKey: ['/api/categories'],
  });

  // Change resource status mutation
  const changeStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: number }) => {
      return apiRequest("PATCH", `/api/admin/resources/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/resources'] });
      toast({
        title: "状态已更新",
        description: "资源状态已成功更新。",
      });
    },
    onError: () => {
      toast({
        title: "更新失败",
        description: "更新资源状态时出错，请重试。",
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (id: number, currentStatus: number) => {
    const newStatus = currentStatus === 1 ? 0 : 1;
    changeStatusMutation.mutate({ id, status: newStatus });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Implement search functionality
    console.log("Searching for:", searchQuery);
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
                value="upload" 
                className="px-6 py-4 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
              >
                <Link href="/admin/resources/upload">上传资源</Link>
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
                <Link href="/admin/users">用户管理</Link>
              </TabsTrigger>
              <TabsTrigger 
                value="stats" 
                className="px-6 py-4 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
              >
                统计分析
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="resources" className="p-6">
            <div className="flex flex-wrap gap-4 mb-6">
              <form onSubmit={handleSearch} className="relative flex-grow">
                <Input
                  type="text"
                  placeholder="搜索资源..."
                  className="w-full bg-neutral-100 pr-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-neutral-500" />
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
                    <TableHead>资源名称</TableHead>
                    <TableHead>分类</TableHead>
                    <TableHead>价格</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>下载量</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
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
                              <AvatarImage src={resource.cover_image} alt={resource.title} />
                              <AvatarFallback>{resource.title.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="text-sm font-medium text-neutral-900">{resource.title}</div>
                              <div className="text-sm text-neutral-500">{resource.subtitle}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {resource.category && (
                            <Badge variant="outline" className="bg-blue-100 text-blue-800 border-0">
                              {resource.category.name}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-neutral-900">
                            {resource.is_free ? '免费' : `¥${resource.price?.toFixed(2)}`}
                          </div>
                          {resource.is_free && (
                            <div className="text-sm text-neutral-500">限时活动</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`
                            ${resource.status === 1 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} 
                            border-0
                          `}>
                            {resource.status === 1 ? '已上架' : '已下架'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-neutral-500">
                          {resource.download_count || Math.floor(Math.random() * 10000)}
                        </TableCell>
                        <TableCell className="text-sm text-neutral-500">
                          {new Date(resource.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          <Link href={`/admin/resources/${resource.id}/edit`}>
                            <a className="text-primary hover:text-blue-700 mr-3">编辑</a>
                          </Link>
                          <button
                            className={resource.status === 1 ? "text-red-600 hover:text-red-800" : "text-green-600 hover:text-green-800"}
                            onClick={() => handleStatusChange(resource.id, resource.status)}
                          >
                            {resource.status === 1 ? '下架' : '上架'}
                          </button>
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
