import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, StarHalf, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Review {
  id: number;
  user_id: number;
  resource_id: number;
  rating: number;
  content: string;
  created_at: string;
  updated_at: string;
  user?: {
    id: number;
    email: string;
    avatar: string | null;
    membership_type: string | null;
  };
}

interface ReviewSectionProps {
  resourceId: number | string;
}

export default function ReviewSection({ resourceId }: ReviewSectionProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newReview, setNewReview] = useState<{ rating: number; content: string }>({
    rating: 5,
    content: "",
  });
  const [isEditing, setIsEditing] = useState(false);
  const [userReview, setUserReview] = useState<Review | null>(null);

  // 获取评价列表
  const { 
    data: reviews = [], 
    isLoading: isLoadingReviews 
  } = useQuery<Review[]>({
    queryKey: [`/api/resources/${resourceId}/reviews`],
  });

  // 获取评分摘要
  const { 
    data: ratingStats = { average: 0, count: 0 },
    isLoading: isLoadingRating
  } = useQuery<{ average: number; count: number }>({
    queryKey: [`/api/resources/${resourceId}/rating`],
  });

  // 检查当前用户是否已经评价过
  useEffect(() => {
    if (user && reviews.length > 0) {
      const existingReview = reviews.find(review => review.user?.id === user.id);
      if (existingReview) {
        setUserReview(existingReview);
        setNewReview({
          rating: existingReview.rating,
          content: existingReview.content
        });
      }
    }
  }, [reviews, user]);

  // 提交评价
  const submitReviewMutation = useMutation({
    mutationFn: async (data: { rating: number; content: string }) => {
      return fetch(`/api/resources/${resourceId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(res => {
        if (!res.ok) throw new Error('Failed to submit review');
        // 处理可能没有响应体的情况
        if (res.status === 204) {
          return { success: true };
        }
        return res.json();
      });
    },
    onSuccess: () => {
      toast({
        title: userReview ? "评价已更新" : "评价已提交",
        description: userReview ? "您的评价已成功更新" : "感谢您的评价！",
      });
      setIsEditing(false);
      // 刷新评价列表和评分统计
      queryClient.invalidateQueries({ queryKey: [`/api/resources/${resourceId}/reviews`] });
      queryClient.invalidateQueries({ queryKey: [`/api/resources/${resourceId}/rating`] });
    },
    onError: (error) => {
      console.error("Error submitting review:", error);
      toast({
        title: "提交失败",
        description: "评价提交失败，请稍后再试。",
        variant: "destructive",
      });
    },
  });

  // 删除评价
  const deleteReviewMutation = useMutation({
    mutationFn: async (reviewId: number) => {
      return fetch(`/api/reviews/${reviewId}`, {
        method: "DELETE"
      }).then(res => {
        if (!res.ok) throw new Error('Failed to delete review');
        // 处理204 No Content响应，它不会有JSON内容
        if (res.status === 204) {
          return { success: true };
        }
        return res.json();
      });
    },
    onSuccess: () => {
      toast({
        title: "评价已删除",
        description: "您的评价已成功删除",
      });
      setUserReview(null);
      setNewReview({ rating: 5, content: "" });
      // 刷新评价列表和评分统计
      queryClient.invalidateQueries({ queryKey: [`/api/resources/${resourceId}/reviews`] });
      queryClient.invalidateQueries({ queryKey: [`/api/resources/${resourceId}/rating`] });
    },
    onError: (error) => {
      console.error("Error deleting review:", error);
      toast({
        title: "删除失败",
        description: "评价删除失败，请稍后再试。",
        variant: "destructive",
      });
    },
  });

  const handleSubmitReview = () => {
    if (!user) {
      toast({
        title: "请先登录",
        description: "您需要登录才能提交评价。",
        variant: "destructive",
      });
      return;
    }

    if (newReview.content.trim() === "") {
      toast({
        title: "内容不能为空",
        description: "请填写评价内容。",
        variant: "destructive",
      });
      return;
    }

    submitReviewMutation.mutate(newReview);
  };

  const handleDeleteReview = () => {
    if (!userReview) return;
    
    if (window.confirm("确定要删除您的评价吗？")) {
      deleteReviewMutation.mutate(userReview.id);
    }
  };

  const renderStars = (rating: number, size: 'sm' | 'md' = 'md') => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    // 根据size调整星星大小
    const dimensions = size === 'sm' ? "h-4 w-4" : "h-5 w-5";

    for (let i = 0; i < fullStars; i++) {
      stars.push(<Star key={`full-${i}`} className={`${dimensions} fill-current text-amber-500`} />);
    }

    if (hasHalfStar) {
      stars.push(<StarHalf key="half" className={`${dimensions} fill-current text-amber-500`} />);
    }

    const emptyStars = 5 - stars.length;
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<Star key={`empty-${i}`} className={`${dimensions} text-neutral-300`} />);
    }

    return stars;
  };
  
  const renderRatingSelector = () => {
    return (
      <div className="flex items-center space-x-1 mb-4">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setNewReview({ ...newReview, rating: star })}
            className="focus:outline-none"
            aria-label={`Rate ${star} stars`}
          >
            <Star
              className={`h-8 w-8 ${
                star <= newReview.rating
                  ? "text-amber-500 fill-current"
                  : "text-neutral-300"
              }`}
            />
          </button>
        ))}
        <span className="ml-2 text-neutral-700">
          {newReview.rating} {newReview.rating === 1 ? "星" : "星"}
        </span>
      </div>
    );
  };

  if (isLoadingReviews || isLoadingRating) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div className="h-7 bg-gray-200 rounded w-36"></div>
          <div className="flex space-x-1">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-5 w-5 bg-gray-200 rounded-full"></div>
            ))}
            <div className="h-5 bg-gray-200 rounded w-16 ml-2"></div>
          </div>
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="border-b border-neutral-200 pb-6">
            <div className="flex justify-between mb-2">
              <div className="flex items-center">
                <div className="h-10 w-10 bg-gray-200 rounded-full mr-3"></div>
                <div className="h-5 bg-gray-200 rounded w-32"></div>
              </div>
              <div className="flex space-x-1">
                {[...Array(5)].map((_, j) => (
                  <div key={j} className="h-4 w-4 bg-gray-200 rounded-full"></div>
                ))}
              </div>
            </div>
            <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold">用户评价</h3>
        <div className="flex items-center">
          <div className="flex items-center text-amber-500">
            {renderStars(ratingStats.average, 'sm')}
          </div>
          <span className="ml-2 font-bold">{ratingStats.average.toFixed(1)}</span>
          <span className="text-neutral-500 ml-1">({ratingStats.count} 评价)</span>
        </div>
      </div>

      {/* 用户评价表单 */}
      {user && (isEditing || !userReview) && (
        <div className="bg-neutral-50 rounded-lg p-4 mb-6">
          <h4 className="font-medium mb-3">
            {userReview ? "编辑您的评价" : "添加评价"}
          </h4>
          {renderRatingSelector()}
          <Textarea
            value={newReview.content}
            onChange={(e) => setNewReview({ ...newReview, content: e.target.value })}
            placeholder="分享您对这个资源的看法..."
            className="mb-3"
            rows={4}
          />
          <div className="flex justify-end gap-2">
            {userReview && (
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditing(false);
                  setNewReview({
                    rating: userReview.rating,
                    content: userReview.content,
                  });
                }}
              >
                取消
              </Button>
            )}
            <Button onClick={handleSubmitReview} disabled={submitReviewMutation.isPending}>
              {submitReviewMutation.isPending ? "提交中..." : (userReview ? "更新评价" : "提交评价")}
            </Button>
          </div>
        </div>
      )}

      {/* 用户自己的评价 */}
      {user && userReview && !isEditing && (
        <div className="border-b border-neutral-200 pb-6 mb-6">
          <div className="flex items-start mb-2">
            <Avatar className="h-10 w-10 mr-3 mt-1">
              <AvatarFallback>
                {user.email?.substring(0, 1).toUpperCase() || "用"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex justify-between items-center mb-1">
                <div>
                  <div className="font-medium">
                    {user.email?.split('@')[0] || "匿名用户"}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {formatDate(userReview.updated_at)}
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="flex items-center text-amber-500 mr-4">
                    {renderStars(userReview.rating, 'sm')}
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-neutral-600"
                      onClick={() => setIsEditing(true)}
                    >
                      <Edit className="h-4 w-4 mr-1" /> 编辑
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={handleDeleteReview}
                      disabled={deleteReviewMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> 删除
                    </Button>
                  </div>
                </div>
              </div>
              <p className="text-neutral-700">{userReview.content}</p>
            </div>
          </div>
        </div>
      )}

      {/* 评价列表 */}
      <div className="space-y-6">
        {reviews.length === 0 ? (
          <div className="text-center py-6 text-neutral-500">
            暂无评价，成为第一个评价的用户吧！
          </div>
        ) : (
          reviews
            .filter(review => !user || review.user_id !== user.id) // 不显示当前用户自己的评价（因为已经在上面单独显示了）
            .map((review) => (
              <div key={review.id} className="border-b border-neutral-200 pb-6">
                <div className="flex items-start">
                  <Avatar className="h-10 w-10 mr-3 mt-1">
                    <AvatarFallback>
                      {review.user?.email?.substring(0, 1).toUpperCase() || "用"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <div>
                        <div className="font-medium">
                          {review.user?.email?.split('@')[0] || "匿名用户"}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {formatDate(review.updated_at)}
                        </div>
                      </div>
                      <div className="flex items-center text-amber-500">
                        {renderStars(review.rating, 'sm')}
                      </div>
                    </div>
                    <p className="text-neutral-700">{review.content}</p>
                  </div>
                </div>
              </div>
            ))
        )}
      </div>
      
      {!user && (
        <div className="text-center mt-8 p-4 bg-neutral-50 rounded-lg">
          <p className="mb-2">登录后才能提交评价</p>
          <Button asChild variant="outline">
            <a href="/login">登录</a>
          </Button>
        </div>
      )}

      {reviews.length > 0 && (
        <div className="mt-6 text-center">
          <Button variant="outline">查看更多评价</Button>
        </div>
      )}
    </div>
  );
}