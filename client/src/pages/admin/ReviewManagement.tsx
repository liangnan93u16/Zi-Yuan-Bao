import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Search, CheckCircle, XCircle, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";

// Status update form schema
const statusUpdateSchema = z.object({
  status: z.number().min(0).max(2),
  admin_notes: z.string().optional(),
});

type StatusUpdateFormValues = z.infer<typeof statusUpdateSchema>;

export default function ReviewManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [reviewDetail, setReviewDetail] = useState<any>(null);
  const [isReviewDetailOpen, setIsReviewDetailOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Check if user is admin
  if (user?.membership_type !== 'admin') {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader>
            <CardTitle>访问受限</CardTitle>
            <CardDescription>您需要管理员权限才能访问此页面</CardDescription>
          </CardHeader>
          <CardContent>
            <p>请联系系统管理员获取访问权限，或返回首页。</p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => window.location.href = "/"}>返回首页</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Fetch reviews based on status filter
  const { data: reviews = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/admin/reviews', statusFilter],
    queryFn: async () => {
      const endpoint = '/api/admin/reviews' + 
        (statusFilter !== 'all' ? `?status=${statusFilter === 'pending' ? 0 : statusFilter === 'approved' ? 1 : 2}` : '');
      const response = await apiRequest("GET", endpoint);
      return (response && typeof response === 'object') ? response : [];
    }
  });

  // Form setup for status update
  const form = useForm<StatusUpdateFormValues>({
    resolver: zodResolver(statusUpdateSchema),
    defaultValues: {
      status: 0,
      admin_notes: "",
    },
  });

  // Update review status mutation
  const updateReviewStatusMutation = useMutation({
    mutationFn: async (data: StatusUpdateFormValues & { id: number }) => {
      const { id, ...updateData } = data;
      return apiRequest("PATCH", `/api/admin/reviews/${id}/status`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/reviews'] });
      setIsReviewDetailOpen(false);
      toast({
        title: "评价状态已更新",
        description: "评价状态更新成功。",
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "更新失败",
        description: `更新评价状态时出错: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const viewReviewDetail = (review: any) => {
    setReviewDetail(review);
    setIsReviewDetailOpen(true);
  };

  const approveReview = (id: number) => {
    updateReviewStatusMutation.mutate({ 
      id, 
      status: 1, // approved
      admin_notes: "评价已通过审核" 
    });
  };

  const rejectReview = (id: number) => {
    updateReviewStatusMutation.mutate({ 
      id, 
      status: 2, // rejected
      admin_notes: "评价未通过审核" 
    });
  };

  const handleStatusUpdate = (data: StatusUpdateFormValues) => {
    if (!reviewDetail) return;
    updateReviewStatusMutation.mutate({
      id: reviewDetail.id,
      ...data
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Implement search functionality
    console.log("Searching for:", searchQuery);
  };

  // Filter reviews based on search query
  const filteredReviews = Array.isArray(reviews) ? reviews.filter((review: any) => {
    let matches = true;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      matches = matches && (
        (review.content && review.content.toLowerCase().includes(query)) ||
        (review.user?.email && review.user.email.toLowerCase().includes(query))
      );
    }
    
    return matches;
  }) : [];

  // Pagination
  const itemsPerPage = 10;
  const paginatedReviews = filteredReviews?.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const totalPages = Math.ceil((filteredReviews?.length || 0) / itemsPerPage);

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8">
        <div className="border-b border-neutral-200 px-6 py-4">
          <h2 className="text-xl font-bold">评价管理</h2>
        </div>
        
        <Tabs defaultValue="reviews">
          <div className="border-b border-neutral-200">
            <TabsList className="h-auto">
              <TabsTrigger 
                value="reviews" 
                className="px-6 py-4 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
              >
                评价审核
              </TabsTrigger>
              <TabsTrigger 
                value="resources" 
                className="px-6 py-4 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
              >
                <a href="/admin/resources">资源管理</a>
              </TabsTrigger>
              <TabsTrigger 
                value="users" 
                className="px-6 py-4 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
              >
                <a href="/admin/users">用户管理</a>
              </TabsTrigger>
              <TabsTrigger 
                value="requests" 
                className="px-6 py-4 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
              >
                <a href="/admin/resource-requests">资源请求</a>
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="reviews" className="p-6">
            <div className="flex flex-wrap gap-4 mb-6">
              <form onSubmit={handleSearch} className="relative flex-grow">
                <Input
                  type="text"
                  placeholder="搜索评价内容或用户..."
                  className="w-full bg-neutral-100 pr-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-neutral-500" />
              </form>
              
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px] bg-neutral-100">
                    <SelectValue placeholder="所有评价" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有评价</SelectItem>
                    <SelectItem value="pending">待审核</SelectItem>
                    <SelectItem value="approved">已通过</SelectItem>
                    <SelectItem value="rejected">已拒绝</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>用户</TableHead>
                    <TableHead>评分</TableHead>
                    <TableHead>评价内容</TableHead>
                    <TableHead>状态</TableHead>
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
                            <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse mr-4"></div>
                            <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
                          </div>
                        </TableCell>
                        <TableCell><div className="h-4 bg-gray-200 rounded w-12 animate-pulse"></div></TableCell>
                        <TableCell><div className="h-4 bg-gray-200 rounded w-48 animate-pulse"></div></TableCell>
                        <TableCell><div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div></TableCell>
                        <TableCell><div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div></TableCell>
                        <TableCell className="text-right">
                          <div className="h-4 bg-gray-200 rounded w-24 ml-auto animate-pulse"></div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : filteredReviews.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10">
                        <MessageCircle className="h-10 w-10 mx-auto text-neutral-300 mb-2" />
                        <p className="text-neutral-500">没有找到匹配的评价</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedReviews?.map((review: any) => (
                      <TableRow key={review.id}>
                        <TableCell>
                          <div className="flex items-center">
                            <Avatar className="h-8 w-8 mr-2">
                              <AvatarImage src={review.user?.avatar} alt={review.user?.email} />
                              <AvatarFallback>{review.user?.email ? review.user.email.charAt(0).toUpperCase() : '?'}</AvatarFallback>
                            </Avatar>
                            <div className="text-sm font-medium">{review.user?.email || '未知用户'}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-0">
                            {review.rating} 星
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <p className="text-sm text-neutral-600 truncate">{review.content}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`
                            ${review.status === 0 ? 'bg-blue-100 text-blue-800' : 
                              review.status === 1 ? 'bg-green-100 text-green-800' : 
                              'bg-red-100 text-red-800'}
                            border-0
                          `}>
                            {review.status === 0 ? '待审核' : 
                             review.status === 1 ? '已通过' : 
                             '已拒绝'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-neutral-500">
                          {new Date(review.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => viewReviewDetail(review)}
                          >
                            查看
                          </Button>
                          {review.status === 0 && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => approveReview(review.id)}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                通过
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => rejectReview(review.id)}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                拒绝
                              </Button>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            
            {totalPages > 1 && (
              <Pagination className="mt-4">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                  
                  {[...Array(totalPages)].map((_, i) => {
                    const pageNum = i + 1;
                    // Only show current page, first, last, and pages around current
                    if (
                      pageNum === 1 || 
                      pageNum === totalPages || 
                      (pageNum >= page - 1 && pageNum <= page + 1)
                    ) {
                      return (
                        <PaginationItem key={pageNum}>
                          <PaginationLink 
                            isActive={page === pageNum}
                            onClick={() => setPage(pageNum)}
                          >
                            {pageNum}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    } else if (
                      pageNum === 2 && page > 3 || 
                      pageNum === totalPages - 1 && page < totalPages - 2
                    ) {
                      return (
                        <PaginationItem key={pageNum}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      );
                    }
                    return null;
                  })}
                  
                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
            
            {/* Review Detail Dialog */}
            <Dialog open={isReviewDetailOpen} onOpenChange={setIsReviewDetailOpen}>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>评价详情</DialogTitle>
                  <DialogDescription>
                    查看评价详情并进行审核操作
                  </DialogDescription>
                </DialogHeader>
                
                {reviewDetail && (
                  <div className="py-4">
                    <div className="mb-4 p-4 bg-neutral-50 rounded-md">
                      <div className="flex items-center mb-2">
                        <Avatar className="h-8 w-8 mr-2">
                          <AvatarImage src={reviewDetail.user?.avatar} alt={reviewDetail.user?.email} />
                          <AvatarFallback>{reviewDetail.user?.email ? reviewDetail.user.email.charAt(0).toUpperCase() : '?'}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-sm font-medium">{reviewDetail.user?.email || '未知用户'}</div>
                          <div className="text-xs text-neutral-500">
                            {new Date(reviewDetail.created_at).toLocaleString()}
                          </div>
                        </div>
                        <Badge className="ml-auto bg-amber-100 text-amber-800 border-0">
                          {reviewDetail.rating} 星
                        </Badge>
                      </div>
                      <p className="text-neutral-700">{reviewDetail.content}</p>
                    </div>
                    
                    <div className="mb-4">
                      <h4 className="text-sm font-medium mb-2">审核状态</h4>
                      <Badge variant="outline" className={`
                        ${reviewDetail.status === 0 ? 'bg-blue-100 text-blue-800' : 
                          reviewDetail.status === 1 ? 'bg-green-100 text-green-800' : 
                          'bg-red-100 text-red-800'}
                        border-0
                      `}>
                        {reviewDetail.status === 0 ? '待审核' : 
                         reviewDetail.status === 1 ? '已通过' : 
                         '已拒绝'}
                      </Badge>
                      
                      {reviewDetail.admin_notes && (
                        <div className="mt-2 text-sm text-neutral-600">
                          <p className="font-medium">管理员备注:</p>
                          <p>{reviewDetail.admin_notes}</p>
                        </div>
                      )}
                    </div>
                    
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(handleStatusUpdate)} className="space-y-4">
                        <FormField
                          control={form.control}
                          name="status"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>更新状态</FormLabel>
                              <Select
                                onValueChange={(v) => field.onChange(parseInt(v))}
                                defaultValue={String(reviewDetail.status)}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="选择状态" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="0">待审核</SelectItem>
                                  <SelectItem value="1">通过</SelectItem>
                                  <SelectItem value="2">拒绝</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="admin_notes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>管理员备注</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="添加审核备注（可选）"
                                  className="resize-none"
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                添加关于此评价的备注或审核理由
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <DialogFooter>
                          <DialogClose asChild>
                            <Button variant="outline" type="button">取消</Button>
                          </DialogClose>
                          <Button 
                            type="submit"
                            disabled={updateReviewStatusMutation.isPending}
                          >
                            {updateReviewStatusMutation.isPending ? '提交中...' : '更新状态'}
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}