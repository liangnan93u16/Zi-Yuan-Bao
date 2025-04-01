import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Loader2 } from "lucide-react";

// 资源请求状态
const requestStatusMap = {
  0: { label: "待处理", color: "bg-yellow-500" },
  1: { label: "处理中", color: "bg-blue-500" },
  2: { label: "已完成", color: "bg-green-500" },
  3: { label: "已拒绝", color: "bg-red-500" }
};

// 请求类型定义
type ResourceRequest = {
  id: number;
  email: string;
  description: string;
  status: number;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
};

export default function ResourceRequests() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<ResourceRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // 获取所有资源请求
  const { data: requests, isLoading } = useQuery({ 
    queryKey: ["/api/admin/resource-requests"],
    queryFn: async () => {
      const response = await fetch("/api/admin/resource-requests", {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("未授权");
        }
        throw new Error("获取资源请求失败");
      }
      return response.json() as Promise<ResourceRequest[]>;
    }
  });

  // 更新资源请求状态的mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: number; status: number; notes?: string }) => {
      return apiRequest('PATCH', `/api/admin/resource-requests/${id}/status`, { status, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/resource-requests"] });
      toast({
        title: "更新成功",
        description: "资源请求状态已更新",
      });
      setSelectedRequest(null);
      setAdminNotes("");
      setIsUpdating(false);
    },
    onError: (error) => {
      console.error("更新资源请求状态失败:", error);
      toast({
        title: "更新失败",
        description: "更新资源请求状态失败，请稍后再试",
        variant: "destructive"
      });
      setIsUpdating(false);
    }
  });

  // 处理状态更新
  const handleStatusChange = async (status: string) => {
    if (!selectedRequest) return;
    
    setIsUpdating(true);
    const statusNum = parseInt(status);
    await updateStatusMutation.mutateAsync({
      id: selectedRequest.id,
      status: statusNum,
      notes: adminNotes || undefined
    });
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return formatDistanceToNow(date, { addSuffix: true, locale: zhCN });
  };

  // 处理请求选择
  const handleRequestSelect = (request: ResourceRequest) => {
    setSelectedRequest(request);
    setAdminNotes(request.admin_notes || "");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2">加载中...</span>
      </div>
    );
  }

  return (
    <div className="container py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">资源需求管理</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 左侧列表 */}
        <div className="md:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>资源需求列表</CardTitle>
              <CardDescription>
                共有 {requests?.length || 0} 个资源需求
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                {requests && requests.length > 0 ? (
                  requests.map((request) => (
                    <div
                      key={request.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedRequest?.id === request.id
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted"
                      }`}
                      onClick={() => handleRequestSelect(request)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="font-medium truncate flex-1">{request.email}</div>
                        <Badge 
                          className={`${requestStatusMap[request.status as keyof typeof requestStatusMap]?.color || "bg-gray-500"} text-white ml-2`}
                        >
                          {requestStatusMap[request.status as keyof typeof requestStatusMap]?.label || "未知"}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {formatDate(request.created_at)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-muted-foreground">暂无资源需求</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 右侧详情 */}
        <div className="md:col-span-2">
          {selectedRequest ? (
            <Card>
              <CardHeader>
                <CardTitle>资源需求详情</CardTitle>
                <CardDescription>
                  提交者邮箱: {selectedRequest.email}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium mb-2">详细描述</h3>
                  <div className="p-3 bg-muted rounded-md whitespace-pre-wrap">
                    {selectedRequest.description}
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-sm font-medium mb-2">当前状态</h3>
                  <Select
                    defaultValue={selectedRequest.status.toString()}
                    onValueChange={handleStatusChange}
                    disabled={isUpdating}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择状态" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">待处理</SelectItem>
                      <SelectItem value="1">处理中</SelectItem>
                      <SelectItem value="2">已完成</SelectItem>
                      <SelectItem value="3">已拒绝</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-2">管理员备注</h3>
                  <Textarea
                    placeholder="添加处理备注..."
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    rows={4}
                    disabled={isUpdating}
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedRequest(null)}
                    disabled={isUpdating}
                  >
                    取消
                  </Button>
                  <Button
                    onClick={() => handleStatusChange(selectedRequest.status.toString())}
                    disabled={isUpdating}
                  >
                    {isUpdating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        更新中...
                      </>
                    ) : (
                      "保存更改"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-[400px] text-center p-6">
                <div className="text-muted-foreground mb-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mx-auto mb-3"
                  >
                    <path d="M16 6h3a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a1 1 0 0 1 1-1h3" />
                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <path d="M9 14v-3" />
                    <path d="M12 14v-3" />
                    <path d="M15 14v-3" />
                  </svg>
                  <p className="text-lg font-medium">选择一个资源需求查看详情</p>
                  <p>在左侧列表中点击任意一项资源需求以查看详情和进行处理</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}