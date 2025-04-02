import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Check, X, AlertTriangle, BookOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

// 定义评论状态映射
const reviewStatusMap = {
  0: { label: "待审核", color: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200" },
  1: { label: "已通过", color: "bg-green-100 text-green-800 hover:bg-green-200" },
  2: { label: "已拒绝", color: "bg-red-100 text-red-800 hover:bg-red-200" }
};

// 格式化日期函数
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default function ReviewManagement() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedReview, setSelectedReview] = useState<any>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [tab, setTab] = useState("reviews");
  const { toast } = useToast();

  // 定义评论的类型
  interface Review {
    id: number;
    resource_id: number;
    user_id: number;
    rating: number;
    content: string;
    status: number;
    admin_notes?: string;
    created_at: string;
    updated_at: string;
    user?: {
      id: number;
      email: string;
      avatar?: string;
      membership_type?: string;
    };
    resource?: {
      id: number;
      title: string;
      subtitle?: string;
      description?: string;
      is_free: boolean;
      category?: {
        id: number;
        name: string;
      };
      created_at: string;
    };
  }

  // 获取所有评论
  const { data: reviews = [], isLoading, refetch } = useQuery<Review[]>({
    queryKey: ['/api/admin/reviews'],
  });

  // 过滤评论
  const filteredReviews = statusFilter === "all" 
    ? reviews 
    : reviews.filter((review) => review.status === parseInt(statusFilter));

  // 审核评论Mutation
  const reviewMutation = useMutation({
    mutationFn: async (data: { id: number, status: number, admin_notes?: string }) => {
      return apiRequest("PATCH", `/api/admin/reviews/${data.id}`, {
        status: data.status,
        admin_notes: data.admin_notes
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/reviews'] });
      setIsApproveDialogOpen(false);
      setIsRejectDialogOpen(false);
      setAdminNotes("");
      toast({
        title: "评论已审核",
        description: "评论审核状态已成功更新",
      });
    },
    onError: (error) => {
      toast({
        title: "审核失败",
        description: "评论审核操作失败，请重试",
        variant: "destructive",
      });
    },
  });

  // 处理审核通过
  const handleApprove = (review: any) => {
    setSelectedReview(review);
    setIsApproveDialogOpen(true);
  };

  // 处理审核拒绝
  const handleReject = (review: any) => {
    setSelectedReview(review);
    setIsRejectDialogOpen(true);
  };

  // 处理查看资源
  const handleViewResource = (review: any) => {
    setSelectedReview(review);
    setIsViewDialogOpen(true);
  };

  // 确认审核通过
  const confirmApprove = () => {
    reviewMutation.mutate({
      id: selectedReview.id,
      status: 1,
      admin_notes: adminNotes
    });
  };

  // 确认审核拒绝
  const confirmReject = () => {
    reviewMutation.mutate({
      id: selectedReview.id,
      status: 2,
      admin_notes: adminNotes
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-xl shadow-md overflow-hidden p-6">
          <div className="animate-pulse">
            <div className="h-7 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="border rounded-md p-4">
                  <div className="flex items-start">
                    <div className="h-10 w-10 bg-gray-200 rounded-full mr-3"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/4 mb-3"></div>
                      <div className="h-4 bg-gray-200 rounded mb-1"></div>
                      <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8">
        <div className="border-b border-neutral-200 px-6 py-4">
          <h2 className="text-xl font-bold">评论审核管理</h2>
        </div>
        
        <Tabs value={tab} onValueChange={setTab}>
          <div className="border-b border-neutral-200">
            <TabsList className="h-auto">
              <TabsTrigger 
                value="reviews" 
                className="px-6 py-4 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
              >
                评论审核
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
            </TabsList>
          </div>
          
          <TabsContent value="reviews" className="p-6">
            <div className="mb-6 flex justify-between items-center">
              <div className="text-lg font-medium">评论列表</div>
              <div className="flex gap-2 items-center">
                <span className="text-sm text-neutral-500">状态筛选：</span>
                <Select
                  value={statusFilter}
                  onValueChange={setStatusFilter}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="选择状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部评论</SelectItem>
                    <SelectItem value="0">待审核</SelectItem>
                    <SelectItem value="1">已通过</SelectItem>
                    <SelectItem value="2">已拒绝</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => refetch()}>
                  刷新
                </Button>
              </div>
            </div>
            
            {filteredReviews.length === 0 ? (
              <div className="text-center py-8 text-neutral-500">
                没有符合条件的评论
              </div>
            ) : (
              <div className="space-y-4">
                {filteredReviews.map((review: any) => (
                  <Card key={review.id} className={review.status === 0 ? "border-yellow-300" : ""}>
                    <CardContent className="p-4">
                      <div className="flex items-start">
                        <Avatar className="h-10 w-10 mr-3 mt-1">
                          <AvatarFallback>
                            {review.user?.email?.substring(0, 1).toUpperCase() || "用"}
                          </AvatarFallback>
                          {review.user?.avatar && (
                            <AvatarImage src={review.user.avatar} alt={review.user.email} />
                          )}
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium">
                                {review.user?.email?.split('@')[0] || "匿名用户"}
                              </div>
                              <div className="text-xs text-neutral-500 mb-2">
                                {formatDate(review.created_at)}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge className={reviewStatusMap[review.status as keyof typeof reviewStatusMap]?.color || ""}>
                                {reviewStatusMap[review.status as keyof typeof reviewStatusMap]?.label || "未知"}
                              </Badge>
                              <div className="flex items-center text-amber-500">
                                <span className="font-medium text-sm">{review.rating} 星</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="mb-3 text-neutral-700">{review.content}</div>
                          
                          {review.admin_notes && (
                            <div className="bg-neutral-50 p-2 rounded text-sm mb-3">
                              <span className="font-medium">管理员备注：</span> {review.admin_notes}
                            </div>
                          )}
                          
                          <div className="flex justify-between items-center">
                            <div className="text-sm text-neutral-600">
                              <span className="font-medium">资源：</span>
                              <span className="cursor-pointer hover:underline" onClick={() => handleViewResource(review)}>
                                {review.resource?.title || `资源 #${review.resource_id}`}
                              </span>
                            </div>
                            
                            <div className="flex space-x-2">
                              {review.status === 0 && (
                                <>
                                  <Button 
                                    onClick={() => handleApprove(review)} 
                                    variant="outline" 
                                    size="sm" 
                                    className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                                  >
                                    <Check className="h-4 w-4 mr-1" /> 通过
                                  </Button>
                                  <Button 
                                    onClick={() => handleReject(review)} 
                                    variant="outline" 
                                    size="sm" 
                                    className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                                  >
                                    <X className="h-4 w-4 mr-1" /> 拒绝
                                  </Button>
                                </>
                              )}
                              <Button 
                                onClick={() => handleViewResource(review)} 
                                variant="outline" 
                                size="sm"
                              >
                                <BookOpen className="h-4 w-4 mr-1" /> 查看资源
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
      
      {/* 查看资源对话框 */}
      {selectedReview && (
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>查看资源</DialogTitle>
              <DialogDescription>
                资源详情
              </DialogDescription>
            </DialogHeader>
            
            {selectedReview.resource ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">{selectedReview.resource.title}</h3>
                  {selectedReview.resource.is_free ? (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-200">免费</Badge>
                  ) : (
                    <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">付费</Badge>
                  )}
                </div>
                
                {selectedReview.resource.subtitle && (
                  <p className="text-neutral-600">{selectedReview.resource.subtitle}</p>
                )}
                
                {selectedReview.resource.description && (
                  <div>
                    <h4 className="font-medium mb-1">资源描述</h4>
                    <p className="text-neutral-600">{selectedReview.resource.description}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">分类：</span>
                    {selectedReview.resource.category?.name || "未分类"}
                  </div>
                  <div>
                    <span className="font-medium">创建时间：</span>
                    {formatDate(selectedReview.resource.created_at)}
                  </div>
                </div>
                
                <Button variant="secondary" onClick={() => window.open(`/resources/${selectedReview.resource.id}`, '_blank')}>
                  <BookOpen className="h-4 w-4 mr-2" />
                  查看完整资源
                </Button>
              </div>
            ) : (
              <div className="py-4 text-center text-neutral-500">
                无法加载资源信息，资源可能已被删除
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
      
      {/* 通过评论对话框 */}
      <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>通过评论</DialogTitle>
            <DialogDescription>
              通过后，该评论将对所有用户可见
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-neutral-50 p-3 rounded">
              <div className="flex items-center mb-2">
                <span className="font-medium mr-2">用户：</span>
                {selectedReview?.user?.email}
              </div>
              <div className="flex items-center mb-2">
                <span className="font-medium mr-2">评分：</span>
                {selectedReview?.rating} 星
              </div>
              <div>
                <span className="font-medium mr-2">评论内容：</span>
                <p className="mt-1">{selectedReview?.content}</p>
              </div>
            </div>
            
            <div>
              <label htmlFor="admin-notes" className="block text-sm font-medium mb-1">
                管理员备注（可选）
              </label>
              <Textarea
                id="admin-notes"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="输入备注内容..."
                className="resize-none"
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApproveDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={confirmApprove} className="bg-green-600 hover:bg-green-700">
              <Check className="h-4 w-4 mr-2" />
              确认通过
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 拒绝评论对话框 */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>拒绝评论</DialogTitle>
            <DialogDescription>
              拒绝后，该评论将只对评论作者和管理员可见
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-neutral-50 p-3 rounded">
              <div className="flex items-center mb-2">
                <span className="font-medium mr-2">用户：</span>
                {selectedReview?.user?.email}
              </div>
              <div className="flex items-center mb-2">
                <span className="font-medium mr-2">评分：</span>
                {selectedReview?.rating} 星
              </div>
              <div>
                <span className="font-medium mr-2">评论内容：</span>
                <p className="mt-1">{selectedReview?.content}</p>
              </div>
            </div>
            
            <div>
              <label htmlFor="admin-notes" className="block text-sm font-medium mb-1">
                拒绝原因（可选）
              </label>
              <Textarea
                id="admin-notes"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="输入拒绝原因..."
                className="resize-none"
                rows={3}
              />
            </div>
            
            <div className="flex items-start">
              <AlertTriangle className="text-amber-500 h-5 w-5 mr-2 mt-0.5" />
              <div className="text-sm text-neutral-600">
                请确保拒绝理由充分。被拒绝的评论将只对评论作者和管理员可见。
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={confirmReject} variant="destructive">
              <X className="h-4 w-4 mr-2" />
              确认拒绝
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}